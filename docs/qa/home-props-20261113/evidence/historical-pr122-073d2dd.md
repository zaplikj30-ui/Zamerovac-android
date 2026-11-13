# Historický popis a logy PR122 na 073d2dd – není aktuální předání

Současný E2E harness vypínal Chromium sandbox a lokální runner nedokázal doložit bezpečný start. Balík zavádí společný explicitní sandbox launch s ověřením runtime diagnostiky a BLOCKED bez fallbacku. Samostatná neprodukční procesová sonda doplňuje skutečné ukončení a reapování vlastních potomků místo pouhého mocku kill().

**QA-ONLY / DRAFT / HOME + MERGE + RELEASE HOLD.** Finální testovaný a pushovaný HEAD **`073d2ddf39cce26e9466453eeaff222462ed195f`**, vlastní větev `qa/home-props-security-20261113`, základ main `8d05d2dd77c4a99f8ad64191c97d37ee3c151e3b`.

[Schválení vlastníka](https://github.com/zaplikj30-ui/Zamerovac-android/issues/42#issuecomment-6853678011) · [nález Kontrolora 40](https://github.com/zaplikj30-ui/Zamerovac-android/pull/121#pullrequestreview-5891220124) · [podrobný popis a hranice](https://github.com/zaplikj30-ui/Zamerovac-android/blob/073d2ddf39cce26e9466453eeaff222462ed195f/docs/qa/home-props-20261113/README.md).

## Změna a ochrany

- Harness i runner používají `chromiumSandbox:true`, explicitní absolutní `CHROMIUM_PATH`, žádné vlastní browser argumenty a žádný downgrade. CDP odmítá zakázané skutečné flagy; `chrome://sandbox` se musí ověřit do 7 s. Linux vyžaduje namespace/SUID + PID/network + Seccomp/TSYNC, Windows rendererové PID/Lockdown/Untrusted. Windows fixture není živý Windows důkaz. Každá sada musí předložit vlastní sandbox report; exit 0 bez něj je BLOCKED.
- `home_process_tree_probe.py` je test-only nonroot Linux/WSL sonda: pevná vlastní tříúrovňová fixture, vlastní session/PGID, ověřený PID/starttime/UID/SID, TERM/KILL a reapování vlastních osiřelých potomků včetně zombie. Skutečné EOF, smrt klientského procesu, ztráta heartbeat, timeout, cancel a normální exit 0 leadera. Testy kontrolují zánik PID a zachování cizího prostoru: sentinel bajtů i živého kontrolního procesu mimo skupinu. Primární signály neúčinné ⇒ BLOCKED, vlastní nouzový úklid, žádný falešný PASS.
- Navazuje na princip #117, nepřepisuje jeho runner ani větev. #121 `ae3b4df53c25557f28b4a25ccb65adc2abdff639`, #117 `2997cd46000a038497e14497a0fba6b8d2d29a2b` a souběžný #119 `650b9c0b3358f09e4393780a1627dfef49627748` zachovány. Sonda sama WSL nespouští a na Windows skončí před spawnem BLOCKED. Žádné workflow propojení, instalace, root/sudo/chmod/chown, změna Windows účtu/ACL/cache ani globální kill.
- QA gate testovací executable fixture nyní dostanou počáteční režim při výlučném vytvoření, bez následného chmod; původní gate aserce se nemění. `app/**`, přesná data, původní média, synchronizace, dvě #88 diagnostiky, signing/version/release pravidla a všech sedm workflow jsou proti main byte-exact beze změny.

## Autorské výsledky na přesném HEAD

| Kontrola | Skutečný výsledek |
|---|---|
| Všech `tests/*.js` | **48 skriptů PASS / 0 FAIL / 0 SKIP**, včetně 11 nových bezpečnostních testů s pozitivními i negativními fixture a skutečnou CLI cestou runneru |
| Celé `python3 -m unittest discover -s tests -p 'test_*.py' -v` | **121 PASS / 0 FAIL / 0 ERROR / 0 SKIP**, včetně 11 procesových/guard testů |
| Živé procesové scénáře uvnitř Python sady | **8 PASS**: 7 řádných cleanup cest + očekávaný BLOCKED při neúčinných signálech; všechny vlastní PID skutečně pryč, tmp odstraněno, vnější sentinel i proces zachovány |
| Syntax nových/změněných QA skriptů, nedotčený produkt/workflow | **PASS** |
| Původní Bash unit #117 v privátním zdrojovém snapshotu | **2 PASS**; pouze mock, není WSL/process-tree důkaz |
| Skutečný sandboxovaný Chromium pokus přes finální runner | **raw FAIL / exit 1 → BLOCKED**, 0 aplikačních případů; SUID helper vlastní `nobody`, Chromium odmítá bezpečný start; také crashpad error. Žádný workaround ani opakování bez sandboxu. |
| HOME Windows/service sandbox smoke, Windows/WSL přenos EOF/cancel, offline cache, Gradle/JVM513, produktové Chromium23/96, fyzický Android/Drive/SAF | **NOT RUN / HOME BLOCKED** |
| GitHub Actions, merge, release, APK | **NOT RUN**, nejsou povoleny tímto PR |

**Prostředí:** managed Debian GNU/Linux 13, Linux 6.18.57 x86_64/glibc 2.41, neprivilegovaný uid1000, Node24.22.1, Python3.12.14, existující Temurin17.0.17+10, Playwright1.62.1, Chromium156.0.8078.79. Na začátku 2 Java smoke SKIP kvůli PATH; po použití již připraveného JDK jsou ve finální sadě oba PASS. Nic se neinstalovalo. Linux PASS není Windows/WSL HOME PASS.

**Test-first evidence:** [původní browser RED](https://github.com/zaplikj30-ui/Zamerovac-android/blob/073d2ddf39cce26e9466453eeaff222462ed195f/docs/qa/home-props-20261113/evidence/red-browser.log), [procesový RED](https://github.com/zaplikj30-ui/Zamerovac-android/blob/073d2ddf39cce26e9466453eeaff222462ed195f/docs/qa/home-props-20261113/evidence/red-process.log), [průběžný FAIL teardownu](https://github.com/zaplikj30-ui/Zamerovac-android/blob/073d2ddf39cce26e9466453eeaff222462ed195f/docs/qa/home-props-20261113/evidence/intermediate-process-fail.log), [referenční mock](https://github.com/zaplikj30-ui/Zamerovac-android/blob/073d2ddf39cce26e9466453eeaff222462ed195f/docs/qa/home-props-20261113/evidence/reference117-mock.log). Browser aserce reprodukovaly nebezpečný launch a chybějící BLOCKED. První procesový RED znamenal neexistující živou sondu, **netvrdí reprodukci úniku v původním #117**. Pozdější skutečný fault test dokládá odmítnutí živých přeživších procesů. Průběžný `BrokenPipeError` v testovacím teardownu opraven, původní log zachován.

**Triggery před pushem:** znovu ověřené main/PR SHA a všech 7 workflow, stejné [SHA256 + události](https://github.com/zaplikj30-ui/Zamerovac-android/blob/073d2ddf39cce26e9466453eeaff222462ed195f/docs/qa/home-props-20261113/evidence/workflow-triggers.json); automatický HOME push pouze `main`, žádný PR trigger či nový YAML. Push směřuje jen do vlastní QA větve. Po publikaci se ověří skutečné runs/statuses; neoznačovat za CI PASS.

## Rizika a další krok

Nezávislé SOURCE/security review tohoto finálního SHA. Teprve potom vlastník rozhodne o případném neškodném HOME testu. Windows parser/renderer policy nebyly ověřeny živým service účtem; odlišná diagnostika je BLOCKED. Procesová sonda prokazuje pevný vlastní strom v managed Linuxu, nikoli skutečný WSL transport/Gradle daemon s novou session, násilné SIGKILL supervisoru nebo vypnutí PC. Před HOME zůstává nutné ověřit nonroot účet, PID/PGID a read-only/offline cache. Staré #88 zůstávají původními skutečnými diagnostikami; zde nebyly přepsány ani znovu spouštěny. Finální HOME 4/4/release brána se tímto PR neaktivuje.

## Čerstvé úplné logy na `073d2ddf39cce26e9466453eeaff222462ed195f`

Příkazy běžely nad čistým commitem; HEAD a čistota ověřeny před i po regresi. `JAVA_HOME=/workspace/toolchains/jdk-17.0.17+10`, jeho `bin` na PATH. Níže jsou všechny Node výstupy a celý Python výstup, včetně PID důkazů. Z případných ANSI escape sekvencí je odstraněno pouze terminálové barvení.

<details><summary>node tests/annotation_geometry_contract.js — PASS</summary>

```text
PASS B2: pure transforms, precise models, legacy corners/area/cumulative, no mutation

```
</details>

<details><summary>node tests/annotation_grip_geometry.js — PASS</summary>

```text
PASS B3: grip geometry, midpoint move zone, isolation, legacy adapter, no mutation

```
</details>

<details><summary>node tests/annotation_history_contract.js — PASS</summary>

```text
PASS B14: 10,000 differential edits/undo/redo, exact values/media, invalid snapshots atomic, bounded history

```
</details>

<details><summary>node tests/annotation_history_save_failure.js — PASS</summary>

```text
PASS B14: real Undo/Redo, failed write banner, retry, exact data/media, malformed snapshot no-write

```
</details>

<details><summary>node tests/annotation_hit_geometry.js — PASS</summary>

```text
PASS B4: touch hit shapes, shifted dimensions, caption priority, adapter, immutable values

```
</details>

<details><summary>node tests/annotation_pinch_contract.js — PASS</summary>

```text
PASS B11: 42000 pure two-pointer pinch comparisons, input immutability and zoom bounds

```
</details>

<details><summary>node tests/annotation_resize_contract.js — PASS</summary>

```text
PASS B7: 32,000 old/new resize calculations, immutable precise models, 4 shapes, script order

```
</details>

<details><summary>node tests/annotation_selection_contract.js — PASS</summary>

```text
PASS B5: laser target segments, grip precedence, selection, unchanged precise data

```
</details>

<details><summary>node tests/annotation_snap_contract.js — PASS</summary>

```text
PASS B9: 42000 deterministic legacy/pure snap comparisons, immutable inputs, own-object exemption

```
</details>

<details><summary>node tests/annotation_translation_contract.js — PASS</summary>

```text
PASS B6: 24,000 differential cases, no mutation, zoom, bounds, exact values, module order

```
</details>

<details><summary>node tests/annotation_viewport_contract.js — PASS</summary>

```text
PASS B10: 42000 legacy/pure fit + zoom differential comparisons, anchored cursor, zoom bounds

```
</details>

<details><summary>node tests/audit39_hierarchy.js — PASS</summary>

```text
PASS A39-03: shared Java/JS hierarchy fixtures, offline CAS moves, stable repeat and exact values
PASS A39-03: transport-neutral JS merge follows the same hierarchy contract

```
</details>

<details><summary>node tests/bosch_history_devices.js — PASS</summary>

```text
OK: meter-specific history, simple single-meter UI, legacy migration and safe deletion

```
</details>

<details><summary>node tests/causal_app_clock.js — PASS</summary>

```text
PASS actual app clock helpers: causal order, bounds, tombstone versus independent edit, no old revival and active editor copy

```
</details>

<details><summary>node tests/dimension_drag_interaction.js — PASS</summary>

```text
OK: dragging endpoints works, tiny double taps never change or collapse dimensions/lines

```
</details>

<details><summary>node tests/e2e_harness_git_preflight.js — PASS</summary>

```text
PASS: git ENOENT fails before Chromium launch; no 8-minute timeout

```
</details>

<details><summary>node tests/editor_full_tools.js — PASS</summary>

```text
OK: full editor tools, labels, segments, Bosch-compatible model and icon ordering

```
</details>

<details><summary>node tests/experimental_and_precision.js — PASS</summary>

```text
OK: experimenty vypnuté ve výchozím stavu, menu, ikony a desetiny mm

```
</details>

<details><summary>node tests/extra_toolbar_interaction.js — PASS</summary>

```text
OK: expandable two-row ImageMeter-style toolbar and accessible toggle

```
</details>

<details><summary>node tests/feedback_inflight_save.js — PASS</summary>

```text
PASS: slow feedback Save blocks close/list/Back, stale callbacks cannot publish

```
</details>

<details><summary>node tests/feedback_raster_reuse.js — PASS</summary>

```text
PASS: feedback raster reuse, transactional localStorage save/readback, failed writes, draft retention and safe deletion

```
</details>

<details><summary>node tests/feedback_report_structure.js — PASS</summary>

```text
OK: vlaječka, kreslení S Penem, offline evidence a hromadný ZIP

```
</details>

<details><summary>node tests/geometry_drag_28.js — PASS</summary>

```text
OK: quad, circle, target plus B7 rect and ellipse size changes preserve precise values

```
</details>

<details><summary>node tests/gesture_history_undo_redo.js — PASS</summary>

```text
PASS B8/B12/B13: tap, jitter, multi-touch, cancel, exit and exact Undo/Redo

```
</details>

<details><summary>node tests/help_guide.js — PASS</summary>

```text
PASS full offline help: 25 chapters, Czech search, offline scripts, safe menus and Back

```
</details>

<details><summary>node tests/home_sandbox_security.js — PASS</summary>

```text
✔ harness explicitly enables sandbox before any application case (5.440817ms)
✔ launch policy rejects disabled sandbox, flags and malformed options before spawn (0.752439ms)
✔ launch error blocks once, no retry or downgrade (0.287455ms)
✔ unverifiable or disabled runtime sandbox closes browser and blocks (0.532967ms)
✔ positive fixtures keep Linux and Windows evidence separate (0.470542ms)
✔ runner reports sandbox failure as BLOCKED and cannot count it as PASS (3.029065ms)
✔ Windows policy diagnostics require live renderer IDs, Lockdown and Untrusted integrity (0.328487ms)
✔ CDP/diagnostic failure closes the browser and never invokes application body (0.406746ms)
✔ stalled diagnostics are bounded, close browser and return BLOCKED (7002.077571ms)
✔ real runner CLI checkpoints BLOCKED for each sandbox preflight failure (192.624682ms)
✔ suite exit 0 cannot pass runner without validated sandbox report (5.160201ms)
ℹ tests 11
ℹ suites 0
ℹ pass 11
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 7216.031063

```
</details>

<details><summary>node tests/inset_workspace_interaction.js — PASS</summary>

```text
OK: move outside photo, independent arrow anchor, caption, resize, persistence

```
</details>

<details><summary>node tests/laser_auto_interaction.js — PASS</summary>

```text
OK: Bosch měří přímo vybranou kótu, bezpečný převod a uložení

```
</details>

<details><summary>node tests/laser_precision_regression.js — PASS</summary>

```text
PASS laser-precision/dimension
PASS laser-precision/line
PASS laser-precision/arrow
PASS laser-precision/circle
PASS laser-precision/ellipse
PASS laser-precision/target
PASS laser-precision/chain
PASS laser-precision/cumulative
PASS laser-precision/polyline
PASS laser-precision/angle

```
</details>

<details><summary>node tests/laser_tap_interaction.js — PASS</summary>

```text
OK: laser nevyžaduje dodatečné klepnutí na kótu

```
</details>

<details><summary>node tests/local_browser_qa_contract.js — PASS</summary>

```text
PASS: local Chromium server isolates assets/symlinks, correct HTTP/MIME, strict statuses, exact suite allowlist

```
</details>

<details><summary>node tests/media_import_ownership.js — PASS</summary>

```text
PASS N4-A: reserve, duplicate owner, stale token, publish, restart and fail closed

```
</details>

<details><summary>node tests/menu_dismiss_interaction.js — PASS</summary>

```text
OK: outside menu gestures captured completely; inside/openers/forms preserved

```
</details>

<details><summary>node tests/new_28_regressions.js — PASS</summary>

```text
OK: locale registry, quadrilateral area, grip contours, archive/lock/search source contracts

```
</details>

<details><summary>node tests/note_leader_interaction.js — PASS</summary>

```text
OK: note without text/media, automatic arrow at fixed photo point, independent handles

```
</details>

<details><summary>node tests/post17_regressions.js — PASS</summary>

```text
OK: #17 transformed contours, area, readable text, finish/persist paths, exact hints, short/long grip zones
OK: annotation Back saves on confirmation, discards explicitly, or keeps editing

```
</details>

<details><summary>node tests/refactor_end_to_end_undo.js — PASS</summary>

```text
PASS: B1-B6 dimension and polyline, actual drag/Undo/Redo, precise saved values and jitter

```
</details>

<details><summary>node tests/refactor_shape_resize_undo.js — PASS</summary>

```text
PASS B7: real rect/area/circle/ellipse gesture, Undo/Redo, exact laser and side values

```
</details>

<details><summary>node tests/release_history.js — PASS</summary>

```text
PASS true versioned changelog: fixed releases, improvements, no future notes, offline, help and menus

```
</details>

<details><summary>node tests/revision_vector.js — PASS</summary>

```text
revision vectors: positive, concurrent and invalid-input cases passed

```
</details>

<details><summary>node tests/save_acknowledgement.js — PASS</summary>

```text
PASS: rejected write, acknowledgement, exact conflict values, retry and delayed native callback

```
</details>

<details><summary>node tests/save_blocked_load_regression.js — PASS</summary>

```text
PASS B15: blocked-load/save flags and banner, real retry, native CAS failure, exact values and media

```
</details>

<details><summary>node tests/symbol_search_interaction.js — PASS</summary>

```text
OK: vyhledávání symbolů bez diakritiky, mezer a drobných překlepů

```
</details>

<details><summary>node tests/sync_canonical.js — PASS</summary>

```text
PASS shared RFC8785 canonical bytes, job IDs, source references and invalid Unicode

```
</details>

<details><summary>node tests/sync_conflict_bridge.js — PASS</summary>

```text
PASS shared deterministic conflict bridge, exact active draft, duplicate suppression and failed bridge

```
</details>

<details><summary>node tests/sync_protocol_v2.js — PASS</summary>

```text
PASS isolated v2 core: 30 synthetic file tasks/simulated failover, persistent queue/restart, idempotent ack, metered policy, exact conflicts, 2 device histories/100 deduplicated blobs, old/new restore and storage faults

```
</details>

<details><summary>node tests/trash_ui_interaction.js — PASS</summary>

```text
OK: native purge preserves live editor/note references, exact values, stale-snapshot errors and repeated taps

```
</details>

<details><summary>node tests/versioning.js — PASS</summary>

```text
PASS semantic versioning and monotonic Android update requirements

```
</details>

<details><summary>Python — 121 PASS, 0 FAIL/ERROR/SKIP</summary>

```text
{"scenario": "cancel", "ready": {"event": "ready", "workspace": "/tmp/zamerovac-home-tree-nybeszfn", "members": [{"pid": 4272, "pgid": 4272, "sid": 4272, "start": 137423, "uid": 1000}, {"pid": 4273, "pgid": 4272, "sid": 4272, "start": 137425, "uid": 1000}, {"pid": 4274, "pgid": 4272, "sid": 4272, "start": 137428, "uid": 1000}]}, "result": {"status": "PASS", "reason": "cancel", "cleanupVerified": true, "platform": "Linux-6.18.57-x86_64-with-glibc2.41", "uid": 1000, "signals": ["TERM", "KILL"], "reaped": [4272, 4273, 4274], "workloadExitCode": -9}, "outsideSentinel": "unchanged", "outsideProcess": "alive"}
{"scenario": "client-exit", "ready": {"event": "ready", "workspace": "/tmp/zamerovac-home-tree-un8htc6h", "members": [{"pid": 4279, "pgid": 4279, "sid": 4279, "start": 137453, "uid": 1000}, {"pid": 4280, "pgid": 4279, "sid": 4279, "start": 137456, "uid": 1000}, {"pid": 4281, "pgid": 4279, "sid": 4279, "start": 137459, "uid": 1000}]}, "result": {"status": "PASS", "reason": "eof", "cleanupVerified": true, "platform": "Linux-6.18.57-x86_64-with-glibc2.41", "uid": 1000, "signals": ["TERM", "KILL"], "reaped": [4279, 4280, 4281], "workloadExitCode": -9}, "outsideSentinel": "unchanged", "outsideProcess": "alive"}
{"scenario": "eof", "ready": {"event": "ready", "workspace": "/tmp/zamerovac-home-tree-3ly2_67i", "members": [{"pid": 4285, "pgid": 4285, "sid": 4285, "start": 137484, "uid": 1000}, {"pid": 4286, "pgid": 4285, "sid": 4285, "start": 137487, "uid": 1000}, {"pid": 4287, "pgid": 4285, "sid": 4285, "start": 137490, "uid": 1000}]}, "result": {"status": "PASS", "reason": "eof", "cleanupVerified": true, "platform": "Linux-6.18.57-x86_64-with-glibc2.41", "uid": 1000, "signals": ["TERM", "KILL"], "reaped": [4285, 4286, 4287], "workloadExitCode": -9}, "outsideSentinel": "unchanged", "outsideProcess": "alive"}
{"scenario": "invalid", "ready": {"event": "ready", "workspace": "/tmp/zamerovac-home-tree-nu4x9kl3", "members": [{"pid": 4291, "pgid": 4291, "sid": 4291, "start": 137513, "uid": 1000}, {"pid": 4292, "pgid": 4291, "sid": 4291, "start": 137516, "uid": 1000}, {"pid": 4293, "pgid": 4291, "sid": 4291, "start": 137520, "uid": 1000}]}, "result": {"status": "PASS", "reason": "invalid", "cleanupVerified": true, "platform": "Linux-6.18.57-x86_64-with-glibc2.41", "uid": 1000, "signals": ["TERM", "KILL"], "reaped": [4291, 4292, 4293], "workloadExitCode": -9}, "outsideSentinel": "unchanged", "outsideProcess": "alive"}
{"scenario": "fault", "ready": {"event": "ready", "workspace": "/tmp/zamerovac-home-tree-ggaaiv8b", "members": [{"pid": 4297, "pgid": 4297, "sid": 4297, "start": 137544, "uid": 1000}, {"pid": 4298, "pgid": 4297, "sid": 4297, "start": 137546, "uid": 1000}, {"pid": 4299, "pgid": 4297, "sid": 4297, "start": 137549, "uid": 1000}]}, "result": {"status": "BLOCKED", "reason": "Command '['/opt/codex/runtimes/codex-primary-runtime/dependencies/python/bin/python3', '/workspace/Zamerovac-android/tools/home_process_tree_probe.py', '--fixture', 'leader', '--work', '/tmp/zamerovac-home-tree-ggaaiv8b']' timed out after 2 seconds"}, "outsideSentinel": "unchanged", "outsideProcess": "alive"}
{"scenario": "normal", "ready": {"event": "ready", "workspace": "/tmp/zamerovac-home-tree-pkc0m6qq", "members": [{"pid": 4302, "pgid": 4302, "sid": 4302, "start": 137774, "uid": 1000}, {"pid": 4303, "pgid": 4302, "sid": 4302, "start": 137777, "uid": 1000}, {"pid": 4304, "pgid": 4302, "sid": 4302, "start": 137780, "uid": 1000}]}, "result": {"status": "PASS", "reason": "normal", "cleanupVerified": true, "platform": "Linux-6.18.57-x86_64-with-glibc2.41", "uid": 1000, "signals": ["TERM", "KILL"], "reaped": [4302, 4303, 4304], "workloadExitCode": 0}, "outsideSentinel": "unchanged", "outsideProcess": "alive"}
{"scenario": "heartbeat-loss", "ready": {"event": "ready", "workspace": "/tmp/zamerovac-home-tree-6agt5f72", "members": [{"pid": 4310, "pgid": 4310, "sid": 4310, "start": 137835, "uid": 1000}, {"pid": 4311, "pgid": 4310, "sid": 4310, "start": 137838, "uid": 1000}, {"pid": 4312, "pgid": 4310, "sid": 4310, "start": 137841, "uid": 1000}]}, "result": {"status": "PASS", "reason": "heartbeat-timeout", "cleanupVerified": true, "platform": "Linux-6.18.57-x86_64-with-glibc2.41", "uid": 1000, "signals": ["TERM", "KILL"], "reaped": [4310, 4311, 4312], "workloadExitCode": -9}, "outsideSentinel": "unchanged", "outsideProcess": "alive"}
{"scenario": "timeout", "ready": {"event": "ready", "workspace": "/tmp/zamerovac-home-tree-auqbguhq", "members": [{"pid": 4317, "pgid": 4317, "sid": 4317, "start": 137909, "uid": 1000}, {"pid": 4318, "pgid": 4317, "sid": 4317, "start": 137912, "uid": 1000}, {"pid": 4319, "pgid": 4317, "sid": 4317, "start": 137916, "uid": 1000}]}, "result": {"status": "PASS", "reason": "timeout", "cleanupVerified": true, "platform": "Linux-6.18.57-x86_64-with-glibc2.41", "uid": 1000, "signals": ["TERM", "KILL"], "reaped": [4317, 4318, 4319], "workloadExitCode": -9}, "outsideSentinel": "unchanged", "outsideProcess": "alive"}
test_address_script_loaded_and_valid (test_address_and_icons.PhotoAddressAndIconsTest.test_address_script_loaded_and_valid) ... ok
test_manually_confirmed_address_is_preserved (test_address_and_icons.PhotoAddressAndIconsTest.test_manually_confirmed_address_is_preserved) ... ok
test_ruian_only_looks_at_real_addresses (test_address_and_icons.PhotoAddressAndIconsTest.test_ruian_only_looks_at_real_addresses) ... ok
test_rural_house_number_not_discarded_when_street_missing (test_address_and_icons.PhotoAddressAndIconsTest.test_rural_house_number_not_discarded_when_street_missing) ... ok
test_svg_icons_not_placeholder_characters (test_address_and_icons.PhotoAddressAndIconsTest.test_svg_icons_not_placeholder_characters) ... ok
test_valid_and_invalid_coordinates (test_address_map_link.AddressMapLinkTest.test_valid_and_invalid_coordinates) ... ok
test_binary_distance_frame (test_bosch_ble.BoschBleTests.test_binary_distance_frame) ... ok
test_meter_history_separate_button_and_long_press (test_bosch_ble.BoschBleTests.test_meter_history_separate_button_and_long_press) ... ok
test_meter_identity_is_private_and_persistent (test_bosch_ble.BoschBleTests.test_meter_identity_is_private_and_persistent) ... ok
test_protocol_integration (test_bosch_ble.BoschBleTests.test_protocol_integration) ... ok
test_cloud_is_manual_only (test_ci_cloud_release_gate.CloudReleaseSafetyGateTest.test_cloud_is_manual_only) ... ok
test_no_stale_fixed_release_notes (test_ci_cloud_release_gate.CloudReleaseSafetyGateTest.test_no_stale_fixed_release_notes) ... ok
test_owner_main_and_two_explicit_approvals (test_ci_cloud_release_gate.CloudReleaseSafetyGateTest.test_owner_main_and_two_explicit_approvals) ... ok
test_preflight_checks_old_package_before_expensive_build (test_ci_cloud_release_gate.CloudReleaseSafetyGateTest.test_preflight_checks_old_package_before_expensive_build) ... ok
test_release_race_stops_publication (test_ci_cloud_release_gate.CloudReleaseSafetyGateTest.test_release_race_stops_publication) ... ok
test_version_comes_from_published_apk_not_workflow_counter (test_ci_cloud_release_gate.CloudReleaseSafetyGateTest.test_version_comes_from_published_apk_not_workflow_counter) ... ok
test_other_selection_tools_remain (test_dimension_selection.DimensionSelectionTests.test_other_selection_tools_remain) ... ok
test_soft_outline_includes_line_terminal_ticks_and_arrows (test_dimension_selection.DimensionSelectionTests.test_soft_outline_includes_line_terminal_ticks_and_arrows) ... ok
test_visual_rings_are_translucent_and_independent_of_touch_target (test_dimension_selection.DimensionSelectionTests.test_visual_rings_are_translucent_and_independent_of_touch_target) ... ok
test_white_selection_is_behind_yellow_line_not_drawn_over_it (test_dimension_selection.DimensionSelectionTests.test_white_selection_is_behind_yellow_line_not_drawn_over_it) ... ok
test_current_tool_is_highlighted_with_accessible_state (test_editor_toolbar.EditorToolbarTests.test_current_tool_is_highlighted_with_accessible_state) ... ok
test_existing_tools_and_repeat_mode_still_available (test_editor_toolbar.EditorToolbarTests.test_existing_tools_and_repeat_mode_still_available) ... ok
test_new_sketch_menu_uses_consistent_name_and_icon (test_editor_toolbar.EditorToolbarTests.test_new_sketch_menu_uses_consistent_name_and_icon) ... ok
test_style_button_is_pencil_and_ruler_not_dimension_shortcut (test_editor_toolbar.EditorToolbarTests.test_style_button_is_pencil_and_ruler_not_dimension_shortcut) ... ok
test_toolbar_extension_parses (test_editor_toolbar.EditorToolbarTests.test_toolbar_extension_parses) ... ok
test_tools_only_behind_plus (test_editor_toolbar.EditorToolbarTests.test_tools_only_behind_plus) ... ok
test_undo_and_redo_icons_are_exact_mirrors (test_editor_toolbar.EditorToolbarTests.test_undo_and_redo_icons_are_exact_mirrors) ... ok
test_back_persists_unsaved_photo_note (test_gallery_camera_notes.PhotoNotesGalleryTests.test_back_persists_unsaved_photo_note) ... ok
test_camera_cancellation_cleans_state (test_gallery_camera_notes.PhotoNotesGalleryTests.test_camera_cancellation_cleans_state) ... ok
test_gallery_includes_outside_insets (test_gallery_camera_notes.PhotoNotesGalleryTests.test_gallery_includes_outside_insets) ... ok
test_cancel (test_home_process_tree.ProcessTreeTests.test_cancel) ... ok
test_client_process_death_closes_communication (test_home_process_tree.ProcessTreeTests.test_client_process_death_closes_communication) ... ok
test_eof (test_home_process_tree.ProcessTreeTests.test_eof) ... ok
test_invalid_communication (test_home_process_tree.ProcessTreeTests.test_invalid_communication) ... ok
test_missing_real_signals_is_blocked_and_emergency_recovery_is_scoped (test_home_process_tree.ProcessTreeTests.test_missing_real_signals_is_blocked_and_emergency_recovery_is_scoped) ... ok
test_normal_completion_also_reaps_descendants (test_home_process_tree.ProcessTreeTests.test_normal_completion_also_reaps_descendants) ... ok
test_silent_broken_communication (test_home_process_tree.ProcessTreeTests.test_silent_broken_communication) ... ok
test_timeout_with_live_heartbeat (test_home_process_tree.ProcessTreeTests.test_timeout_with_live_heartbeat) ... ok
test_foreign_or_changed_group_is_not_signalled (test_home_process_tree.RuntimeGuardTests.test_foreign_or_changed_group_is_not_signalled) ... ok
test_missing_kernel_reaper_support_blocks_before_spawn (test_home_process_tree.RuntimeGuardTests.test_missing_kernel_reaper_support_blocks_before_spawn) ... ok
test_root_or_windows_never_starts_a_process (test_home_process_tree.RuntimeGuardTests.test_root_or_windows_never_starts_a_process) ... ok
test_adversarial_comment_only_preflight_before_gradle_rejected (test_home_qa_gate.GateUnitTest.test_adversarial_comment_only_preflight_before_gradle_rejected) ... ok
test_adversarial_extra_cloud_job_must_fail_closed (test_home_qa_gate.GateUnitTest.test_adversarial_extra_cloud_job_must_fail_closed) ... ok
test_adversarial_fake_jdk_and_gradle_files_are_not_valid_versions (test_home_qa_gate.GateUnitTest.test_adversarial_fake_jdk_and_gradle_files_are_not_valid_versions) ... ok
test_adversarial_inline_pr_trigger_and_unguarded_job_rejected (test_home_qa_gate.GateUnitTest.test_adversarial_inline_pr_trigger_and_unguarded_job_rejected) ... ok
test_adversarial_powershell_wsl_python_alias_rejected (test_home_qa_gate.GateUnitTest.test_adversarial_powershell_wsl_python_alias_rejected) ... ok
test_adversarial_python_script_triplequote_wsl_discovery_rejected (test_home_qa_gate.GateUnitTest.test_adversarial_python_script_triplequote_wsl_discovery_rejected) ... ok
test_adversarial_wrong_executable_versions_rejected (test_home_qa_gate.GateUnitTest.test_adversarial_wrong_executable_versions_rejected) ... ok
test_all_home_workflows_never_run_node_python_unittest_inside_wsl (test_home_qa_gate.GateUnitTest.test_all_home_workflows_never_run_node_python_unittest_inside_wsl) ... ok
test_current_trusted_home_workflows_are_safe_from_wsl_node_discovery (test_home_qa_gate.GateUnitTest.test_current_trusted_home_workflows_are_safe_from_wsl_node_discovery) ... ok
test_owner_controlled_ci_positive (test_home_qa_gate.GateUnitTest.test_owner_controlled_ci_positive) ... ok
test_python_x_utf8_explicit_subprocess_remains_supported (test_home_qa_gate.GateUnitTest.test_python_x_utf8_explicit_subprocess_remains_supported) ... ok
test_render_explicit_output_file_utf8_without_pythonutf8 (test_home_qa_gate.GateUnitTest.test_render_explicit_output_file_utf8_without_pythonutf8) ... ok
test_render_output_file_refuses_overwriting_existing_yaml (test_home_qa_gate.GateUnitTest.test_render_output_file_refuses_overwriting_existing_yaml) ... ok
test_render_rejects_noncanonical_output_location (test_home_qa_gate.GateUnitTest.test_render_rejects_noncanonical_output_location) ... ok
test_render_rejects_unsafe_branch_or_sha (test_home_qa_gate.GateUnitTest.test_render_rejects_unsafe_branch_or_sha) ... ok
test_render_stdout_redirect_cp1250_must_be_utf8_bytes (test_home_qa_gate.GateUnitTest.test_render_stdout_redirect_cp1250_must_be_utf8_bytes) ... ok
test_source_sha_exact_accept (test_home_qa_gate.GateUnitTest.test_source_sha_exact_accept) ... ok
test_strict_rejects_disagreement_of_source_and_expected (test_home_qa_gate.GateUnitTest.test_strict_rejects_disagreement_of_source_and_expected) ... ok
test_strict_rejects_missing_preflight_before_junit (test_home_qa_gate.GateUnitTest.test_strict_rejects_missing_preflight_before_junit) ... ok
test_strict_rejects_untrusted_checkout_ref (test_home_qa_gate.GateUnitTest.test_strict_rejects_untrusted_checkout_ref) ... ok
test_windows_node_missing_is_fail_fast (test_home_qa_gate.GateUnitTest.test_windows_node_missing_is_fail_fast) ... ok
test_windows_python_and_node_positive (test_home_qa_gate.GateUnitTest.test_windows_python_and_node_positive) ... ok
test_windows_python_missing_is_fail_fast (test_home_qa_gate.GateUnitTest.test_windows_python_missing_is_fail_fast) ... ok
test_workflow_rejects_missing_wsl_node_before_gradle (test_home_qa_gate.GateUnitTest.test_workflow_rejects_missing_wsl_node_before_gradle) ... ok
test_workflow_rejects_unpinned_actions_cloud_and_credentials (test_home_qa_gate.GateUnitTest.test_workflow_rejects_unpinned_actions_cloud_and_credentials) ... ok
test_workflow_rejects_wsl_direct_unittest (test_home_qa_gate.GateUnitTest.test_workflow_rejects_wsl_direct_unittest) ... ok
test_workflow_valid_windows_wsl_split (test_home_qa_gate.GateUnitTest.test_workflow_valid_windows_wsl_split) ... ok
test_wrong_or_nonliteral_source_rejected (test_home_qa_gate.GateUnitTest.test_wrong_or_nonliteral_source_rejected) ... ok
test_wsl_must_not_run_windows_python_node (test_home_qa_gate.GateUnitTest.test_wsl_must_not_run_windows_python_node) ... HOME QA STOP: Node-dependent Python unittest is WINDOWS-only; run windows-quick, not a WSL Python discovery step
ok
test_wsl_native_missing_java_rejected_before_junit (test_home_qa_gate.GateUnitTest.test_wsl_native_missing_java_rejected_before_junit) ... ok
test_wsl_native_valid_even_without_node (test_home_qa_gate.GateUnitTest.test_wsl_native_valid_even_without_node) ... ok
test_wsl_on_plain_linux_is_rejected (test_home_qa_gate.GateUnitTest.test_wsl_on_plain_linux_is_rejected) ... ok
test_api_only_correct_repo (test_home_qa_version_preflight.HomeQaCodePreflight.test_api_only_correct_repo) ... ok
test_authorization_stripped_cross_origin (test_home_qa_version_preflight.HomeQaCodePreflight.test_authorization_stripped_cross_origin) ... ok
test_current_and_future_release_codes_not_fixed (test_home_qa_version_preflight.HomeQaCodePreflight.test_current_and_future_release_codes_not_fixed) ... ok
test_downgrade_overflow_and_bad_semver_stop (test_home_qa_version_preflight.HomeQaCodePreflight.test_downgrade_overflow_and_bad_semver_stop) ... ok
test_https_only_redirect (test_home_qa_version_preflight.HomeQaCodePreflight.test_https_only_redirect) ... ok
test_missing_release_fails_closed (test_home_qa_version_preflight.HomeQaCodePreflight.test_missing_release_fails_closed) ... ok
test_prior_signature_package_and_version_code (test_home_qa_version_preflight.HomeQaCodePreflight.test_prior_signature_package_and_version_code) ... ok
test_published_latest_ignores_draft (test_home_qa_version_preflight.HomeQaCodePreflight.test_published_latest_ignores_draft) ... ok
test_version_name_mismatch_rejected (test_home_qa_version_preflight.HomeQaCodePreflight.test_version_name_mismatch_rejected) ... ok
test_workflow_requires_exact_dynamic_preflight (test_home_qa_version_preflight.HomeQaCodePreflight.test_workflow_requires_exact_dynamic_preflight) ... ok
test_cross_host_signed_asset_never_receives_token (test_home_release_asset_redirect.ReleaseRedirectSecurity.test_cross_host_signed_asset_never_receives_token) ... ok
test_insecure_http_redirect_is_rejected (test_home_release_asset_redirect.ReleaseRedirectSecurity.test_insecure_http_redirect_is_rejected) ... ok
test_other_https_host_also_never_receives_token (test_home_release_asset_redirect.ReleaseRedirectSecurity.test_other_https_host_also_never_receives_token) ... ok
test_plain_python_would_forward_fake_token (test_home_release_asset_redirect.ReleaseRedirectSecurity.test_plain_python_would_forward_fake_token) ... ok
test_request_rejects_non_api_origin_before_network (test_home_release_asset_redirect.ReleaseRedirectSecurity.test_request_rejects_non_api_origin_before_network) ... ok
test_request_rejects_wrong_repo_before_network (test_home_release_asset_redirect.ReleaseRedirectSecurity.test_request_rejects_wrong_repo_before_network) ... ok
test_same_origin_github_api_retains_token (test_home_release_asset_redirect.ReleaseRedirectSecurity.test_same_origin_github_api_retains_token) ... ok
test_workflow_stays_owner_only_and_manual (test_home_release_asset_redirect.ReleaseRedirectSecurity.test_workflow_stays_owner_only_and_manual) ... ok
test_all_authenticated_redirects_refused (test_home_release_publish_url_security.ReleasePublishingSecurity.test_all_authenticated_redirects_refused) ... ok
test_exact_upload_endpoint_and_name_allowed (test_home_release_publish_url_security.ReleasePublishingSecurity.test_exact_upload_endpoint_and_name_allowed) ... ok
test_expected_release_api_calls_allowed (test_home_release_publish_url_security.ReleasePublishingSecurity.test_expected_release_api_calls_allowed) ... ok
test_publish_uses_restrictive_opener_not_default_urlopen (test_home_release_publish_url_security.ReleasePublishingSecurity.test_publish_uses_restrictive_opener_not_default_urlopen) ... ok
test_upload_host_cannot_be_used_for_arbitrary_paths (test_home_release_publish_url_security.ReleasePublishingSecurity.test_upload_host_cannot_be_used_for_arbitrary_paths) ... ok
test_workflow_requires_owner_main_and_approved_release (test_home_release_publish_url_security.ReleasePublishingSecurity.test_workflow_requires_owner_main_and_approved_release) ... ok
test_wrong_hosts_ports_paths_and_schemes_rejected (test_home_release_publish_url_security.ReleasePublishingSecurity.test_wrong_hosts_ports_paths_and_schemes_rejected) ... ok
test_detail_can_leave_photo_without_moving_note_anchor (test_imagemeter_inset.ImageMeterInsetTests.test_detail_can_leave_photo_without_moving_note_anchor) ... ok
test_grips_match_video_without_changing_hit_targets (test_imagemeter_inset.ImageMeterInsetTests.test_grips_match_video_without_changing_hit_targets) ... ok
test_image_border_stays_yellow_when_selected (test_imagemeter_inset.ImageMeterInsetTests.test_image_border_stays_yellow_when_selected) ... ok
test_new_inset_is_large_enough_and_existing_size_survives (test_imagemeter_inset.ImageMeterInsetTests.test_new_inset_is_large_enough_and_existing_size_survives) ... ok
test_original_image_remains_editable (test_imagemeter_inset.ImageMeterInsetTests.test_original_image_remains_editable) ... ok
test_cloud_and_media_are_real_modules (test_project.SourceSmokeTest.test_cloud_and_media_are_real_modules) ... ok
test_dimension_endpoints_match_grips_and_loupe (test_project.SourceSmokeTest.test_dimension_endpoints_match_grips_and_loupe) ... ok
test_editor_controls_present (test_project.SourceSmokeTest.test_editor_controls_present) ... ok
test_excluded_tools (test_project.SourceSmokeTest.test_excluded_tools) ... ok
test_installed_version_visible_to_user (test_project.SourceSmokeTest.test_installed_version_visible_to_user) ... ok
test_javascript_syntax (test_project.SourceSmokeTest.test_javascript_syntax) ... ok
test_manifest_and_resources (test_project.SourceSmokeTest.test_manifest_and_resources) ... ok
test_photo_capture_time_and_readable_location (test_project.SourceSmokeTest.test_photo_capture_time_and_readable_location) ... ok
test_photo_thumbnails_and_menu (test_project.SourceSmokeTest.test_photo_thumbnails_and_menu) ... ok
test_photo_waits_before_drawing_annotations (test_project.SourceSmokeTest.test_photo_waits_before_drawing_annotations) ... ok
test_reference_magnifier_geometry (test_project.SourceSmokeTest.test_reference_magnifier_geometry) ... ok
test_all_added_javascript_compiles (test_upgrade.BigUpdateSmokeTest.test_all_added_javascript_compiles) ... ok
test_backup_includes_originals_and_isolated_restore (test_upgrade.BigUpdateSmokeTest.test_backup_includes_originals_and_isolated_restore) ... ok
test_deferred_ideas_are_not_claimed_as_shipped (test_upgrade.BigUpdateSmokeTest.test_deferred_ideas_are_not_claimed_as_shipped) ... ok
test_diagnostics_and_version_history_present (test_upgrade.BigUpdateSmokeTest.test_diagnostics_and_version_history_present) ... ok
test_new_modules_are_loaded_from_app_index (test_upgrade.BigUpdateSmokeTest.test_new_modules_are_loaded_from_app_index) ... ok
test_photo_notes_contain_editable_detail (test_upgrade.BigUpdateSmokeTest.test_photo_notes_contain_editable_detail) ... ok
test_preview_id_and_signing_are_not_changed (test_upgrade.BigUpdateSmokeTest.test_preview_id_and_signing_are_not_changed) ... ok

----------------------------------------------------------------------
Ran 121 tests in 7.804s

OK

```
</details>

<details><summary>Skutečný Chromium — raw exit 1, BLOCKED</summary>

```text
HOME BLOCKED: Chromium sandbox preflight: HOME BLOCKED: browserType.launch: Target page, context or browser has been closed
Browser logs:

<launching> /usr/bin/chromium --disable-field-trial-config --disable-background-networking --disable-background-timer-throttling --disable-backgrounding-occluded-windows --disable-back-forward-cache --disable-breakpad --disable-client-side-phishing-detection --disable-component-extensions-with-background-pages --disable-component-update --no-default-browser-check --disable-default-apps --disable-dev-shm-usage --disable-edgeupdater --disable-extensions --disable-features=AvoidUnnecessaryBeforeUnloadCheckSync,BoundaryEventDispatchTracksNodeRemoval,DestroyProfileOnBrowserClose,DialMediaRouteProvider,GlobalMediaControls,HttpsUpgrades,LensOverlay,MediaRouter,PaintHolding,ThirdPartyStoragePartitioning,BlockOriginHeaderModificationOnRedirect,Translate,AutoDeElevate,OptimizationHints,msForceBrowserSignIn,msEdgeUpdateLaunchServicesPreferredVersion --enable-features=CDPScreenshotNewSurface --allow-pre-commit-input --disable-hang-monitor --disable-ipc-flooding-protection --disable-popup-blocking --disable-prompt-on-repost --disable-renderer-backgrounding --disable-updater-scheduler --force-color-profile=srgb --metrics-recording-only --no-first-run --password-store=basic --use-mock-keychain --no-service-autorun --export-tagged-pdf --disable-search-engine-choice-screen --unsafely-disable-devtools-self-xss-warnings --edge-skip-compat-layer-relaunch --disable-infobars --disable-search-engine-choice-screen --disable-sync --enable-unsafe-swiftshader --headless --hide-scrollbars --mute-audio --blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4 --user-data-dir=/tmp/playwright_chromiumdev_profile-UKwldi --remote-debugging-pipe --no-startup-window
<launched> pid=4397
[pid=4397][err] [4397:4397:1113/133539.429323:ERROR:third_party/crashpad/crashpad/util/file/filesystem_posix.cc:63] mkdir : No such file or directory (2)
[pid=4397][err] chrome_crashpad_handler: --database is required
[pid=4397][err] Try 'chrome_crashpad_handler --help' for more information.
[pid=4397][err] [4397:4397:1113/133539.432394:FATAL:sandbox/linux/suid/client/setuid_sandbox_host.cc:172] The SUID sandbox helper binary was found, but is not configured correctly. Rather than run without sandboxing I'm aborting now. You need to make sure that /usr/lib/chromium/chrome-sandbox is owned by root and has mode 4755.
Call log:
  - <launching> /usr/bin/chromium --disable-field-trial-config --disable-background-networking --disable-background-timer-throttling --disable-backgrounding-occluded-windows --disable-back-forward-cache --disable-breakpad --disable-client-side-phishing-detection --disable-component-extensions-with-background-pages --disable-component-update --no-default-browser-check --disable-default-apps --disable-dev-shm-usage --disable-edgeupdater --disable-extensions --disable-features=AvoidUnnecessaryBeforeUnloadCheckSync,BoundaryEventDispatchTracksNodeRemoval,DestroyProfileOnBrowserClose,DialMediaRouteProvider,GlobalMediaControls,HttpsUpgrades,LensOverlay,MediaRouter,PaintHolding,ThirdPartyStoragePartitioning,BlockOriginHeaderModificationOnRedirect,Translate,AutoDeElevate,OptimizationHints,msForceBrowserSignIn,msEdgeUpdateLaunchServicesPreferredVersion --enable-features=CDPScreenshotNewSurface --allow-pre-commit-input --disable-hang-monitor --disable-ipc-flooding-protection --disable-popup-blocking --disable-prompt-on-repost --disable-renderer-backgrounding --disable-updater-scheduler --force-color-profile=srgb --metrics-recording-only --no-first-run --password-store=basic --use-mock-keychain --no-service-autorun --export-tagged-pdf --disable-search-engine-choice-screen --unsafely-disable-devtools-self-xss-warnings --edge-skip-compat-layer-relaunch --disable-infobars --disable-search-engine-choice-screen --disable-sync --enable-unsafe-swiftshader --headless --hide-scrollbars --mute-audio --blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4 --user-data-dir=/tmp/playwright_chromiumdev_profile-UKwldi --remote-debugging-pipe --no-startup-window
  - <launched> pid=4397
  - [pid=4397][err] [4397:4397:1113/133539.429323:ERROR:third_party/crashpad/crashpad/util/file/filesystem_posix.cc:63] mkdir : No such file or directory (2)
  - [pid=4397][err] chrome_crashpad_handler: --database is required
  - [pid=4397][err] Try 'chrome_crashpad_handler --help' for more information.
  - [pid=4397][err] [4397:4397:1113/133539.432394:FATAL:sandbox/linux/suid/client/setuid_sandbox_host.cc:172] The SUID sandbox helper binary was found, but is not configured correctly. Rather than run without sandboxing I'm aborting now. You need to make sure that /usr/lib/chromium/chrome-sandbox is owned by root and has mode 4755.
  - [pid=4397] <gracefully close start>
  - [pid=4397] <kill>
  - [pid=4397] <will force kill>
  - [pid=4397] <process did exit: exitCode=null, signal=SIGABRT>
  - [pid=4397] starting temporary directories cleanup
  - [pid=4397] finished temporary directories cleanup
  - [pid=4397] <gracefully close end>

Výsledky Chromium: /tmp/home-props-final-browser/Zamerovac-QA/browser/run-2026-11-13T13-35-38-988Z-4385/results.json

```
</details>

