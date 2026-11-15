# Third normal attempt: STEP9 repair, INERT / REVIEW REQUIRED

Owner explicitly requested diagnosis, repair and one subsequent normal run in
this session. Scope stays 57 models, one normal no-op and original 15 TAP;
no fault/hang, installs, Chromium/WSL, APK, merge or runner changes.

Previous activation 915e368fe86112d1dbc9fdff0ee97f9d09e8cf5f, run43720233819,
job132830420650: identity, marker attestation, checkouts and exact SHAs PASS;
STEP9 exit1 without any failed-command diagnostic. All tests skipped; checkout
cleanup PASS. Exact historical failing subcommand is NOT PROVEN. CMD FINDSTR
pipelines are a hypothesis, not a proven Windows LF root cause.

The correction removes all silent CMD Git-output pipelines from STEP9. The
existing Node executable directly runs fixed Git arguments, checks command
success, compares trimmed LF/CRLF output to exact SHAs/types, verifies each
local input path/HEAD/cleanliness before import, keeps --update-shallow and
checks both commit objects plus the pinned historical blob. QA HEAD and clean
worktree are rechecked after import. Git stdout/stderr are captured, never
published. Failure emits only a fixed stage and numeric Git exit code (or null)
and exit1. No shell/URL fallback, unshallow, install, alternative pin or native
worker is introduced. No extra timeout/kill strategy for Git was added.

The new workflow is derived from reviewed PR146 workflow blob
738746d14e288b8e7c09fc5dc9d80591476787fb: new THIRD workflow name, exact branch,
marker, commit message, YAML attestation path and concurrency group, plus a
corrected review comment and STEP9. All other test/preflight/cleanup code stays
unchanged. Spent PR146 branch and marker are untouched. A fresh one-shot lease
is necessary; changing run_number on the spent workflow would bypass its guard.

Workflow branch: qa/pr141-normal-third-20261115.
Marker: docs/qa/qa141-authorized-normal-third-run.trigger (ABSENT).
Message: OWNER-APPROVED-QA141-NORMAL-THIRD-20261115.
QA source: 58b456c8ad3f603c57cf2ee8c6d784c76c2446fb.
Product: ae3b4df53c25557f28b4a25ccb65adc2abdff639.
Reference: 7445ebc456e59ea735a377fc98c83542066a88b8.

Tests execute the exact embedded STEP9 program: LF/CRLF, wrong/missing source,
symlink, dirty input, command error/privacy, wrong object type, invalid run ID
and pin, static one-shot preservation, real independent depth1 clones and
cached-object negative controls. They are Linux Git tests and VM API models,
NOT actual Windows CMD/MinGit proof. Initial targeted run 12/12 PASS. Full
available regression and exact final SHA are recorded in the PR/#42 handoff.

Self-review: fixed local paths/arguments, no shell or input-directed revision,
source preflight even when objects cached, successful Git exit AND output,
immutable QA HEAD, private stderr, bounded output, no activation marker,
unchanged owner/ref/run/attempt guards, original 57/no-op/15 and conditional
cleanup/STOP/NO RETRY. No C architecture is implemented or claimed.

Activation is BLOCKED until a different independent reviewer approves the
exact new prepared HEAD and cumulative diff. Owner consent is already present,
but it is not independent review. Then recheck branch/marker/runs/current pins
and create one marker-only child with unchanged YAML; atomically update_ref
with expected_sha of the reviewed prepared HEAD. No rerun or guard relaxation.
Windows and new HOME on this repair: NOT RUN pending that review, never PASS.
