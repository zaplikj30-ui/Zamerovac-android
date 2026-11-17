# CLOUD-DIAG (inert, implementation only)

Design approval: PR156 review5930531066; owner/coordinator scope comment6933916048.
P remains 3886fcf80213e4693464d3f30104885c1c58f53e; Q is this reviewed validator
commit (not the historical V9f733b). E is a future separately approved workflow
commit. No self SHA is embedded in the disposable runtime.

Entry: tools/qa-cloud-diag.cjs, only after the workflow's actual QUICK succeeds.
Workflow remains `false &&`. Future activation and any hosted run require another
SOURCE review and owner GO, exact P/Q/E, acceptance of native Node egress/CDN risk,
and checking the unchanged 12 USD budget. Repository variables
CLOUD_DIAG_APPROVED_Q/E must be set by the owner to those externally approved
commits; this implementation does not change repository configuration.

The existing pidfd/subreaper owner contains preparation (npm ci, ignore scripts,
no audit/fund, reviewed lock1.62.1) and the browser workers. Npm and Chromium
preparation happen only inside a hosted run, never on import or during QUICK.
No HOME, apt, sudo, npx, alternate mirror, global npm configuration or sandbox
fallback. A private cache and absolute verified package CLI install the matching
Chromium revision. SRI verifies the npm archives; it does NOT authenticate the
Chromium download independently of the official CDN. Installed trees and ELF
identity are captured for change detection, not same-UID adversarial immutability.

Node and Python independently validate one temporary schema2 runtime.json and its
SHA256, including P/Q/E, package lock/SRI/tree, revision, ELF identity, Node/Python
and owner UID. The tracked runtime JSON remains unapproved. HOME profile and
Windows Job behavior remain unchanged. Cloud permits writable scratch installs;
HOME's original write guard remains. Every descendant receives an explicit env
allowlist and isolated HOME/TMP without tokens, proxy auth, npmrc or preloads.

A single 200-minute deadline includes preparation, drawing17 and full23/96;
workflow browser step210/job330 leave cleanup headroom. Existing per-worker8min
and heartbeat limits remain. A second stage does not renew the deadline. Signals
use the existing cooperative owner path; external hard termination has no bounded
cleanup guarantee and never constitutes PASS or retry permission.

Smoke runs the complete unchanged drawing suite, not a filtered subset. Its report
is distinct from full; full executes all 23 original bodies/96 exact names again.
PASS requires finalized exact reports and KNOWN_CLEAN. Named assertion FAIL stays
FAIL; partial/unknown admission or cleanup is BLOCKED, remaining stages NOT RUN.
Private redacted smoke/full/summary reports survive safe scratch removal. No raw
DOM/trace/pixel/log upload; unknown scratch is retained, never automatically reset.
GITHUB_OUTPUT is emitted only after final identity checks AND scratch cleanup.

Browser contexts block service workers and WS/WSS before pages/popups. Only the
exact loopback HTTP origin is routed. Fetch has maxRedirects0 and denies external
Location; IPv6/DNS/external origins are rejected. Reviewed synthetic route.fulfill
fixtures remain possible. These routes are NOT an OS firewall for native Node,
which runs independently SOURCE-reviewed code under a trusted host assumption.

QUICK preserves the 74 original families/190 actual names and 16 prior EXTRA Node
cases, adding 5 required CLOUD-DIAG cases (21 EXTRA). Python preserves216+5 and
adds2 runtime/lock cases (223 total). The original 67 P hashes, drawing17, full96,
product trees, HOME workflows, raw JVM #88 failures and release guards are intact.
Models/unit tests are not hosted Chromium/sandbox PASS. Real npm/CDN preparation,
drawing17, full23/96, pixel assertions and hosted cleanup remain NOT RUN until GO.
