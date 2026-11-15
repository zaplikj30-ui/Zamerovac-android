// Portable contract tests. No Win32, N-API, process creation or native cleanup proof.
#include "../tools/win32/qa_outer_job_core.hpp"
#include <functional>
#include <iostream>
#include <stdexcept>
#include <thread>
#include <vector>
using qa_outer::OwnerCore;
static void demand(bool v) { if (!v) throw std::runtime_error("contract failed"); }
static void started(OwnerCore& o) {
  demand(o.job_ready(71)); demand(o.begin_create());
  demand(o.create_returned(true,81)); demand(o.verify_suspended(true));
}
static void ran(OwnerCore& o) { started(o); demand(o.reserve_resume()); demand(o.resume_returned(true)); }
static void quiet(OwnerCore& o) {
  demand(o.startup_finished()); demand(o.process_exited(81,0));
}
static void closed(OwnerCore& o) {
  demand(o.record_empty_job(71,0)); demand(o.resources_closed(true)); demand(o.temp_removed(true));
}
int main() {
  std::vector<std::pair<const char*,std::function<void()>>> cases={
    {"normal completion",[]{ OwnerCore o(1); ran(o); quiet(o); closed(o); demand(o.snapshot().outer_clean); demand(o.snapshot().success_eligible); }},
    {"STOP before job creation",[]{ OwnerCore o(1); o.stop(); demand(!o.job_ready(71)); demand(!o.begin_create()); demand(o.snapshot().blocked); }},
    {"STOP during create and zero count",[]{ OwnerCore o(1); demand(o.job_ready(71)); demand(o.begin_create()); o.stop(); demand(!o.record_empty_job(71,0)); demand(!o.snapshot().outer_clean); demand(o.snapshot().creation_unknown); }},
    {"late create after STOP never reserves resume",[]{ OwnerCore o(1); demand(o.job_ready(71)); demand(o.begin_create()); o.stop(); demand(o.create_returned(true,81)); demand(o.verify_suspended(true)); demand(!o.reserve_resume()); quiet(o); closed(o); demand(o.snapshot().outer_clean); demand(!o.snapshot().success_eligible); }},
    {"STOP races reserved resume",[]{ OwnerCore o(1); started(o); demand(o.reserve_resume()); o.stop(); demand(!o.resources_closed(true)); demand(o.resume_returned(true)); demand(!o.reserve_resume()); quiet(o); closed(o); demand(!o.snapshot().success_eligible); }},
    {"failed membership never resumes",[]{ OwnerCore o(1); demand(o.job_ready(71)); demand(o.begin_create()); demand(o.create_returned(true,81)); demand(!o.verify_suspended(false)); demand(!o.reserve_resume()); demand(!o.snapshot().success_eligible); }},
    {"failed create has no fabricated process exit",[]{ OwnerCore o(1); demand(o.job_ready(71)); demand(o.begin_create()); demand(o.create_returned(false,0)); demand(o.startup_finished()); demand(!o.process_exited(81,0)); demand(!o.record_empty_job(71,0)); demand(o.snapshot().blocked); }},
    {"duplicate create completion is sticky",[]{ OwnerCore o(1); started(o); demand(!o.create_returned(true,82)); demand(!o.reserve_resume()); }},
    {"duplicate start",[]{ OwnerCore o(1); demand(o.job_ready(71)); demand(o.begin_create()); demand(!o.begin_create()); demand(o.snapshot().blocked); }},
    {"duplicate resume permit",[]{ OwnerCore o(1); started(o); demand(o.reserve_resume()); demand(!o.reserve_resume()); demand(o.resume_returned(true)); demand(!o.snapshot().success_eligible); }},
    {"resume failure",[]{ OwnerCore o(1); started(o); demand(o.reserve_resume()); demand(!o.resume_returned(false)); quiet(o); closed(o); demand(o.snapshot().outer_clean); demand(!o.snapshot().success_eligible); }},
    {"no empty attestation before original exit",[]{ OwnerCore o(1); ran(o); demand(o.startup_finished()); demand(!o.record_empty_job(71,0)); demand(!o.snapshot().outer_clean); }},
    {"wrong process witness",[]{ OwnerCore o(1); ran(o); demand(o.startup_finished()); demand(!o.process_exited(82,0)); demand(!o.record_empty_job(71,0)); }},
    {"wrong Job witness",[]{ OwnerCore o(1); ran(o); quiet(o); demand(!o.record_empty_job(72,0)); demand(!o.resources_closed(true)); }},
    {"surviving process",[]{ OwnerCore o(1); ran(o); quiet(o); demand(!o.record_empty_job(71,1)); demand(!o.snapshot().outer_clean); }},
    {"I/O or cleanup lease blocks query",[]{ OwnerCore o(1); ran(o); demand(o.io_started()); demand(o.cleanup_started()); quiet(o); demand(!o.record_empty_job(71,0)); demand(o.io_finished()); demand(!o.record_empty_job(71,0)); demand(o.cleanup_finished()); closed(o); demand(!o.snapshot().success_eligible); }},
    {"three pipe workers is a fixed bound",[]{ OwnerCore o(1); ran(o); demand(o.io_started()); demand(o.io_started()); demand(o.io_started()); demand(!o.io_started()); demand(o.io_finished()); demand(o.io_finished()); demand(o.io_finished()); demand(!o.io_finished()); demand(o.snapshot().blocked); }},
    {"close failure cannot recover to clean",[]{ OwnerCore o(1); ran(o); quiet(o); demand(o.record_empty_job(71,0)); demand(!o.resources_closed(false)); demand(!o.resources_closed(true)); demand(!o.temp_removed(true)); demand(!o.snapshot().outer_clean); }},
    {"TEMP removal never precedes native closure",[]{ OwnerCore o(1); ran(o); quiet(o); demand(!o.temp_removed(true)); demand(!o.snapshot().outer_clean); }},
    {"failed TEMP is sticky",[]{ OwnerCore o(1); ran(o); quiet(o); demand(o.record_empty_job(71,0)); demand(o.resources_closed(true)); demand(!o.temp_removed(false)); demand(!o.temp_removed(true)); demand(!o.snapshot().outer_clean); }},
    {"bounded queues and byte totals",[]{ OwnerCore o(1); ran(o); std::vector<unsigned char> block(65536,42),out; demand(o.enqueue_stdout(block.data(),block.size())); demand(o.take_stdout(out)); demand(out==block); for(int i=1;i<16;i++){demand(o.enqueue_stdout(block.data(),block.size())); demand(o.take_stdout(out));} demand(!o.enqueue_stdout(block.data(),1)); demand(o.snapshot().stdout_bytes==1048576); demand(o.snapshot().blocked); }},
    {"queue overflow and stderr cap",[]{ OwnerCore o(1); ran(o); std::vector<unsigned char> b(65536,7); demand(o.enqueue_stdout(b.data(),b.size())); demand(!o.enqueue_stdout(b.data(),1)); demand(!o.note_stderr(1048577)); demand(o.snapshot().queued_stdout==65536); }},
    {"empty Job without a worker can never be success",[]{ OwnerCore o(1); demand(o.job_ready(71)); closed(o); demand(o.snapshot().outer_clean); demand(!o.snapshot().success_eligible); }},
    {"stdout before resume permit is a protocol fault",[]{ OwnerCore o(1); unsigned char b=42; demand(!o.enqueue_stdout(&b,1)); demand(o.snapshot().blocked); }},
    {"missing context generation never owns a Job",[]{ OwnerCore o(0); demand(!o.job_ready(71)); demand(!o.snapshot().outer_clean); demand(!o.snapshot().success_eligible); }},
    {"empty-query proof forbids later create",[]{ OwnerCore o(1); demand(o.job_ready(71)); demand(o.record_empty_job(71,0)); demand(!o.begin_create()); }},
    {"quiescent process can never obtain a late resume permit",[]{ OwnerCore o(1); started(o); demand(o.startup_finished()); demand(o.process_exited(81,0)); demand(o.record_empty_job(71,0)); demand(!o.reserve_resume()); }},
    {"stdout after quiescent query invalidates cleanup",[]{ OwnerCore o(1); ran(o); quiet(o); demand(o.record_empty_job(71,0)); unsigned char b=42; demand(!o.enqueue_stdout(&b,1)); demand(!o.resources_closed(true)); demand(!o.temp_removed(true)); demand(!o.snapshot().outer_clean); }},
    {"duplicate native close destroys cleanup eligibility",[]{ OwnerCore o(1); ran(o); quiet(o); closed(o); demand(!o.resources_closed(false)); demand(!o.snapshot().outer_clean); }},
    {"nonzero process exit remains blocked after full cleanup",[]{ OwnerCore o(1); ran(o); demand(o.startup_finished()); demand(o.process_exited(81,7)); closed(o); demand(o.snapshot().outer_clean); demand(!o.snapshot().success_eligible); }},
    {"split UTF8 bytes are preserved without premature decoding",[]{ OwnerCore o(1); ran(o); const unsigned char utf8[]={0xf0,0x9f,0x98,0x80}; std::vector<unsigned char> all,part; for(unsigned char b:utf8)demand(o.enqueue_stdout(&b,1)); while(o.take_stdout(part))all.insert(all.end(),part.begin(),part.end()); demand(all==std::vector<unsigned char>(utf8,utf8+4)); }},
    {"env loss and concurrent STOP/resume",[]{
      for(int i=0;i<200;i++) { OwnerCore o(1); started(o); bool permit=false;
        std::thread a([&]{permit=o.reserve_resume();}); std::thread b([&]{o.environment_gone();}); a.join();b.join();
        if(permit)demand(o.resume_returned(true));
        demand(!o.reserve_resume()); quiet(o); closed(o);
        demand(!o.snapshot().environment_alive); demand(!o.snapshot().success_eligible);
      }
    }},
    {"closed context never restarts and identity is separate",[]{ OwnerCore o(17); ran(o); quiet(o); closed(o); demand(o.snapshot().generation==17); demand(!o.begin_create()); demand(!o.resources_closed(true)); demand(!o.snapshot().success_eligible); }}
  };
  unsigned failed=0;
  for (const auto& c:cases) { try { c.second(); std::cout<<"PASS "<<c.first<<'\n'; } catch(const std::exception&) { ++failed;std::cout<<"FAIL "<<c.first<<'\n'; } }
  std::cout<<"tests="<<cases.size()<<" fail="<<failed<<"\n";return failed?1:0;
}
