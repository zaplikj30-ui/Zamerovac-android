# Důkazy pokračování po REQUEST FIX

Všechny úplné běhy v `results.json`, `native.log`, `native-junit.xml`, `quick.log`, `quick-full.log`, `browser.log` a `browser-full.log` skutečně testovaly **`3326995e934ba7e088e47a35e26cdc40cb2a5dfd`**. Nejsou přejmenované na pozdější SHA. Po připojení těchto důkazů se finální HEAD znovu testuje; jeho vlastní výsledky a úplné konzolové logy jsou přímo v PR #116, aby další commit důkazů znovu nezměnil testovaný HEAD.

- Managed Linux, Temurin17.0.17+10, Gradle8.10.2, SDK35, Robolectric4.16.1; syntetické soubory, reálné SQLite/loopback TLS, falešní externí poskytovatelé. HOME/telefon/živý Drive to nenahrazuje.
- Preview JVM: **489 metod, 485 PASS / 4 FAIL / 0 ERROR / 0 SKIP**, 63 tříd, celý Gradle **FAIL**. Dvě původní nezměněné #88 diagnostiky a dvě nové end-to-end diagnostiky jsou blokéry; jiné selhání nebylo nalezeno. Souhrn neprohlašuje bezpečnostní akceptaci.
- `SyncConsistencyTest`: **7 PASS**, migrace včetně absence a restartu, lazy dokumenty, hash inventáře a konzistence JSON/generace/epochy. P1/audio/Drive/SAF/TLS/conflict/media návaznosti jsou v úplném JUnit XML.
- Quick: **87 PASS / 0 FAIL / 0 SKIP / 4 režimové NOT RUN**. JVM a browser mají vlastní běhy; fyzický Samsung a APK zůstávají NOT RUN.
- Chromium: **23 sad / 91 scénářů PASS**, 0 FAIL/SKIP/NOT RUN. Native v browseru je model.
- Skutečné 3GiB ZIP, PeerMedia a TLS halfway/retry jsou zahrnuty v úplném JVM běhu a mají stdout SHA důkazy. Heap512MiB není profil celkové paměti ani Android výkonu.

`baseline-before-fixes.log` je **průběžná reprodukce nad pracovním stromem**: původní produkční zdroj odpovídal `e4e17bca28a31651cb05e4625cb7eb36ecc5685b`, nových pět testů tehdy ještě nebylo commitnuto. Zachycuje 7 FAIL (pět nových chybových scénářů + dvě #88). `targeted-worktree.log` je pozdější průběžný běh 118 metod / 114 PASS / 4 FAIL před zdrojovým commitem. Tyto dva logy nejsou důkazem úplného testování čistého commit SHA; finální výsledky výše je nahrazují.

Celý původní `SafSyncV2Test.java` je proti výchozímu HEAD beze změny, SHA-256 `e5eedbb30c6d32d5668a8cf4aabc7c61aee0951c473f7bfe617e6fde7f04e1ad`. Produkční strom po opravách: `101c5ac1e9865ddc46869891931c1126471023d2`.

**#88 BLOCKED / INTEGRATION HOLD.** Návrh nového významu checkpointového potvrzení není implementovaná funkce; viz [příčina a návrh](../../sync-p1-88-blocker.md). Neproběhlo HOME, fyzická QA, živý Drive, merge, APK ani Actions.
