// Portable contract core for a future Windows outer owner. No Win32/N-API calls.
// This does NOT create processes, own native handles, or attest actual OS cleanup.
// Only the native OwnerContext may feed these witnesses; never Python/IPC data.
#ifndef QA_OUTER_JOB_CORE_HPP
#define QA_OUTER_JOB_CORE_HPP
#include <cstddef>
#include <cstdint>
#include <deque>
#include <mutex>
#include <new>
#include <vector>

namespace qa_outer {
class OwnerCore {
 public:
  static constexpr std::size_t queue_limit=65536, output_limit=1048576;
  struct Snapshot {
    std::uint64_t generation;
    bool blocked, creation_unknown, outer_clean, success_eligible, environment_alive;
    std::size_t stdout_bytes, queued_stdout;
  };
  explicit OwnerCore(std::uint64_t generation):generation_(generation) {
    if (!generation) blocked_=true;
  }
  OwnerCore(const OwnerCore&)=delete;
  OwnerCore& operator=(const OwnerCore&)=delete;

  bool job_ready(std::uint64_t job) {
    std::lock_guard<std::mutex> g(mutex_);
    if (!generation_ || !job || job_ || stopped_ || closed_) return reject();
    job_=job; return true;
  }
  bool begin_create() {
    std::lock_guard<std::mutex> g(mutex_);
    if (!job_ || create_begun_ || stopped_ || blocked_ || empty_queried_ || closed_) return reject();
    create_begun_=true; create_active_=true; startup_active_=true; return true;
  }
  bool create_returned(bool created,std::uint64_t process) {
    std::lock_guard<std::mutex> g(mutex_);
    if (!create_active_ || created!=(process!=0)) return reject();
    create_active_=false; process_=process;
    if (!created) blocked_=true; // No assumption of rollback/absence on failure.
    return true;
  }
  bool verify_suspended(bool identity_and_membership) {
    std::lock_guard<std::mutex> g(mutex_);
    if (create_active_ || !process_ || process_exited_ || verified_ || !startup_active_ || !identity_and_membership) return reject();
    verified_=true; return true;
  }
  bool reserve_resume() {
    std::lock_guard<std::mutex> g(mutex_);
    if (!verified_ || !startup_active_ || process_exited_ || resume_reserved_ || stopped_ || blocked_ || empty_queried_ || closed_) return reject();
    // Linearization point. A concurrent STOP may follow this reservation.
    // Caller retains all native resources until resume_returned, even on STOP.
    resume_reserved_=true; resume_active_=true; return true;
  }
  bool resume_returned(bool success) {
    std::lock_guard<std::mutex> g(mutex_);
    if (!resume_active_) return reject();
    resume_active_=false;
    if (!success) return reject();
    resume_succeeded_=true;
    return true;
  }
  void stop() { std::lock_guard<std::mutex> g(mutex_); stopped_=true; blocked_=true; }
  void environment_gone() {
    std::lock_guard<std::mutex> g(mutex_);
    env_alive_=false; stopped_=true; blocked_=true;
  }
  bool startup_finished() {
    std::lock_guard<std::mutex> g(mutex_);
    if (!startup_active_ || create_active_ || resume_active_) return reject();
    startup_active_=false; return true;
  }
  bool process_exited(std::uint64_t process,std::uint32_t exit_code) {
    std::lock_guard<std::mutex> g(mutex_);
    if (!process_ || process!=process_ || process_exited_ || create_active_) return reject();
    process_exited_=true;
    if (exit_code!=0) blocked_=true;
    return true;
  }
  bool io_started() {
    std::lock_guard<std::mutex> g(mutex_);
    if (!job_ || stopped_ || empty_queried_ || closed_ || io_active_>=3) return reject();
    ++io_active_; return true;
  }
  bool io_finished() {
    std::lock_guard<std::mutex> g(mutex_);
    if (!io_active_) return reject();
    --io_active_; return true;
  }
  bool cleanup_started() {
    std::lock_guard<std::mutex> g(mutex_);
    if (!job_ || cleanup_active_ || empty_queried_ || closed_) return reject();
    cleanup_active_=true; return true;
  }
  bool cleanup_finished() {
    std::lock_guard<std::mutex> g(mutex_);
    if (!cleanup_active_) return reject();
    cleanup_active_=false; return true;
  }
  bool record_empty_job(std::uint64_t job,std::uint64_t active) {
    std::lock_guard<std::mutex> g(mutex_);
    if (!quiescent() || !job_ || job!=job_ || active || empty_queried_ || closed_) return reject();
    empty_queried_=true; return true;
  }
  bool resources_closed(bool all_closes_succeeded) {
    std::lock_guard<std::mutex> g(mutex_);
    if (close_attempted_) { cleanup_failed_=true; return reject(); }
    if (!empty_queried_ || !quiescent() || cleanup_failed_) return reject();
    close_attempted_=true;
    if (!all_closes_succeeded) { cleanup_failed_=true; return reject(); }
    closed_=true; return true;
  }
  bool temp_removed(bool verified_absent) {
    std::lock_guard<std::mutex> g(mutex_);
    if (!closed_ || cleanup_failed_ || temp_attempted_) return reject();
    temp_attempted_=true;
    if (!verified_absent) { cleanup_failed_=true; return reject(); }
    temp_removed_=true; return true;
  }
  bool enqueue_stdout(const unsigned char* bytes,std::size_t length) {
    std::lock_guard<std::mutex> g(mutex_);
    if (empty_queried_ || closed_) { cleanup_failed_=true; return reject(); }
    if (!env_alive_ || !resume_reserved_ || (length && !bytes) ||
        length>output_limit-total_stdout_ || length>queue_limit-queued_stdout_) return reject();
    try { if (length) stdout_.emplace_back(bytes,bytes+length); }
    catch (const std::bad_alloc&) { return reject(); }
    queued_stdout_+=length; total_stdout_+=length; return true;
  }
  bool take_stdout(std::vector<unsigned char>& output) {
    std::lock_guard<std::mutex> g(mutex_);
    if (!env_alive_ || stdout_.empty()) return false;
    output=std::move(stdout_.front()); stdout_.pop_front();
    queued_stdout_-=output.size(); return true;
  }
  bool note_stderr(std::size_t length) {
    std::lock_guard<std::mutex> g(mutex_);
    // Never retain stderr content, only a saturating bounded byte count.
    if (closed_ || empty_queried_) { cleanup_failed_=true; return reject(); }
    if (!resume_reserved_ || length>output_limit-total_stderr_) return reject();
    total_stderr_+=length; return true;
  }
  Snapshot snapshot() const {
    std::lock_guard<std::mutex> g(mutex_);
    const bool clean=closed_ && temp_removed_ && !cleanup_failed_ && quiescent() && queued_stdout_==0;
    const bool normal=process_ && verified_ && resume_succeeded_ && process_exited_;
    return {generation_,blocked_,create_active_,clean,clean && normal && !blocked_ && env_alive_,env_alive_,total_stdout_,queued_stdout_};
  }
 private:
  bool reject() { blocked_=true; return false; }
  bool quiescent() const {
    return !create_active_ && !startup_active_ && !resume_active_ && !cleanup_active_ &&
      io_active_==0 && (!create_begun_ || (process_ && process_exited_));
  }
  const std::uint64_t generation_;
  mutable std::mutex mutex_;
  std::uint64_t job_=0,process_=0;
  bool blocked_=false,stopped_=false,env_alive_=true;
  bool create_begun_=false,create_active_=false,startup_active_=false;
  bool verified_=false,resume_reserved_=false,resume_active_=false,resume_succeeded_=false,process_exited_=false;
  bool cleanup_active_=false,empty_queried_=false,close_attempted_=false,closed_=false;
  bool cleanup_failed_=false,temp_attempted_=false,temp_removed_=false;
  std::size_t io_active_=0,total_stdout_=0,total_stderr_=0,queued_stdout_=0;
  std::deque<std::vector<unsigned char>> stdout_;
};
} // namespace qa_outer
#endif
