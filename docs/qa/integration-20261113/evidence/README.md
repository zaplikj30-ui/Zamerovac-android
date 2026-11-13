# Dokončené dostupné autorské testy integračního kandidáta

**Testovaný produktový SHA: `ae3b4df53c25557f28b4a25ccb65adc2abdff639`**. [Draft PR #121](https://github.com/zaplikj30-ui/Zamerovac-android/pull/121), větev `integration/approved-fixes-20261113`. Tento archiv je pouze důkazová dokumentace; jeho vlastní commit není další produktový kandidát. Datum 13. 11. 2026. Schválený [plán Koordinátora 22](https://github.com/zaplikj30-ui/Zamerovac-android/issues/42#issuecomment-6852058679).

## Výsledek a meze

| Kontrola | Skutečný stav |
|---|---|
| Node/Python quick | **PASS 90 kontrol**, 0 FAIL/SKIP; zahrnuje 115 Python unittest metod |
| Úplné Chromium `--all` | **PASS 23 suite / 96 jmenovaných případů**, 0 FAIL/SKIP; každý report má produktový SHA |
| Reálné IndexedDB #110 | **PASS** commit, abort add/put, souběžné rezervace, cizí owner/path, restart celého Chromium procesu a privátního profilu |
| Geometrie / syntetický customer export | **PASS 18 + 14 scénářů**, součást quick; pozitivní, neplatné meze, nekonvergence, extrémní clamp, privátní notes:false a neměnnost dat |
| Dodatečný skutečný hi-res raster | **PASS** 8000×6000 -> 2400×1731 a 12000×9000 -> 2400×1733, ikona uvnitř, originální SHA a anotace beze změny; samostatný opt-in skript mimo hlavní matici |
| Úplný raw JVM/Robolectric | **FAIL / exit 1**: 64 čerstvých XML / 513 unikátních metod = 511 PASS + 2 skutečné FAIL, 0 ERROR/SKIP |
| Původní dvě #88 diagnostiky | **EXPECTED FAIL (actual FAIL)**, přesné původní expected0/actual1; aserce/helpery neměněny |
| Oddělená schválená produktová acceptance | **PASS 511**, žádný další FAIL/ERROR/SKIP; raw Gradle není PASS |
| Kritická nativní retence | PASS AudioCompletedKeep 1, PendingAudio 15, ProtectedArchiveCoverage 9, Reconciliation 2, ReceiptSafety 24, DatabaseInstallEvidence 23; všechny uvnitř 513 |
| Velká média / TLS / zálohy | PASS skutečné syntetické 3GiB streamy, přerušení/retry a přesné hodnoty/originály v PeerLargeTlsTest, PeerMediaLargeTest, Audit39SafetyTest; SQLite ABORT/ENOSPC a recovery modely uvnitř 513 |
| Drive registrace | **PASS** valid/disabled + 19 odmítnutých konfigurací, bez přístupu k účtu |
| Nativní PDF fixture | **PASS** nezávislý pypdf + PyMuPDF všech 3 ZIP, celkem 5 PDF / 7 stran |
| Skutečný browser PNG -> produkční nativní PDF/ZIP | **PASS** samostatná Robolectric metoda + nezávislé 2 PDF stránky 1250×1070; skutečné pixely kót `1585,800001 mm`, vnořené `987,000001 mm` a popisku ověřeny po JPEG94, ne pouze existence ZIP |
| Technický APK build | **PASS bez publikace/instalace**; package `cz.zamerovac.app.preview`, versionCode **1155 > vydaných 1154**, konfigurované versionName `1.3.0-test`, shodný signer; všech 37 zabalených assetů byte-exact proti zdrojům |
| #46 nevyžádaný picker | **NOT REPRODUCED** v reálném Chromium s výslovně modelovaným Native mostem; test PASS pro 2 poznámky, focus, Back/Save/Cancel, dvojklik, odmítnutí pozdní přílohy a JS restart; není fyzická oprava Samsungu |
| HOME Windows/WSL 4/4 | **NOT RUN / BLOCKED** do rozhodnutí o samostatném návrhu brány; místní Linux nenahrazuje HOME |
| Fyzický Samsung/Tab/S Pen/Bosch, reálný Drive OAuth/SAF, OEM IME/picker, instalace, radio/reboot/power-cut | **NOT RUN** |
| SKIP | **0** v provedených sadách |

Quick runner samostatně uvádí 4 NOT RUN (native/browser/device/APK), protože testuje jen quick režim. Native/browser/APK byly provedeny odděleně výše; fyzické zařízení zůstává NOT RUN. Žádná tato klasifikace nemění raw Gradle FAIL ani fyzické omezení providerové atomiky.

## Co je integrováno

Základ #116 `1527e3377609633c554195b0641e02e3cfb5fb5e`; novější dokumentační main #118 `8d05d2dd77c4a99f8ad64191c97d37ee3c151e3b` sloučen. Postupně cíleně #49 `a408d4bb...` a #114 `c84a4d61...`; `inset-workspace.js` a `help.js` zachovávají novější render-context a audio texty. `retained-native-and-guards.diff` je záměrně prázdný: proti #116 nebyla změněna Java, původní Java testy, rich-notes/pending-audio/app.js ani workflow/ACK validátor.

Delta 15 souborů proti #116 je v `changed-paths-vs-pr116.txt` a úplném patchi. Produkční změny: pouze `inset-workspace.js`, `customer-export.js`, `help.js`. Test-only import #105 převzat z živého `3f2779ec...`; reálný IDB #110 z `5f325736...`. Starší manual audio implementace/testy nebyly obnoveny přes novější variantu B. Doplňky: pixelové úchopy, #46 a exportní negativní případy. HOME návrh je v produktovém PR v `docs/qa/integration-20261113/HOME_GATE_PROPOSAL.md`, čeká na rozhodnutí, guardy beze změny. Release history zůstává historií skutečných vydání; nová verze nebyla vydána.

## Důkazy a příkazy

- `final-quick.log`, `quick/` obsahuje všech 90 podrobných logů, včetně 115 Python metod.
- `final-browser.log`, `browser/` obsahuje všech 23 logů, 96 screenshotů a plné reporty; `browser-case-matrix.json` je jmenovitá matice 96 případů.
- `final-real-idb.log` a `05-import-model.log` pro skutečný IDB/model; zdroje opt-in testů jsou v produktu.
- `final-jvm/gradle-full.log`, `final-jvm/results.json`, **všech 64 původních úplných JUnit XML** a `jvm-method-matrix.json` pro 513 metod. Základní přikaz: `python3 tools/sync-ack-acceptance.py --output /workspace/integration-evidence/final-jvm`; wrapper spustil celý offline Gradle `:app:testPreviewUnitTest --rerun`.
- `supplemental-highres.log`, `supplemental-highres/` a úplný `highres-extended.cjs`: dodatečný opt-in scénář téhož produkčního JS pro obě rozlišení. Není započítaný jako další suite v hlavních 23/96.
- `customer-pdf-*.zip` jsou čerstvé syntetické výstupy plné nativní sady; `final-pdf-fixtures.log` pro nezávislou kontrolu.
- `supplemental-pdf-src/`, `supplemental-pdf.gradle`, `supplemental-pdf-junit/`, `supplemental-pdf-native.log`: samostatná 1metodová proof sada z dočasného zdrojového adresáře mimo produkt, spouštěná až po plných 513. Plné 513 XML jsou zachované samostatně. Žádná změna tracked Gradle ani CI.
- `check-browser-native-pdf.py`, `browser-to-native-pdf.zip`, `browser-to-native-pdf-check.json`, `supplemental-pdf-independent.log`, `native-pdf-render.png`: skutečný PNG s kótami z hlavního Chromium běhu prošel produkčními CustomerPdfExport/RasterPdfWriter a nezávislými parsery. Průměrná pixelová odchylka <0,67 na kanál; cílené ROI mají 801/971/942 žlutých pixelů a zachovaný obsah při ztrátové JPEG94 kompresi. PDF je záměrně raster bez editovatelných projektových dat. Byte-exact originály ověřují samostatné browser/native testy, nikoli JPEG v PDF.
- `final-drive-config.log`, `final-apk-build.log`, `final-apk-badging.txt`, `final-apk-signature.txt`, `apk-verification.json`: místní příkaz `GITHUB_RUN_NUMBER=155 gradle --no-daemon --max-workers=1 :app:verifyDriveRegistration :app:assemblePreview -PdriveRequireConfigured=true`. APK SHA256 `6d12ddd5629aeb8942df6ebf1f89df91205b9d337032a48c5c578116d0e9b549`. **APK v tomto archivu není a nikam nebyla publikována.**
- `previous-release-evidence.txt`: aktuální release ověřen přes GitHub a autentický job log posledního vydání, který skutečně uvádí signer `c828c967...` a package/versionCode1154/versionName1.3.0-test. Přímý opakovaný download APK byl blokovaný, proto se nepředstírá nové prozkoumání staženého staršího souboru.
- `environment.json`, `github-inventory.json`, `push-trigger-audit.txt`, `SHA256SUMS` pro prostředí, zdroje a integritu.

Běhy proběhly na managed Debian13 x86_64, JDK17.0.17+10, Gradle8.10.2, SDK35/build-tools34, Robolectric4.16.1, Node24.22.1, Python3.12.14, Playwright1.62.1, Chromium156.0.8078.79, pypdf6.21.4/PyMuPDF1.28.2. Privátní localhost, syntetická data, žádné reálné zákaznické soubory. Browser v izolovaném cloud kontejneru používá existující headless harness `--no-sandbox`; nejde o důkaz bezpečnosti spuštění této volby na Windows HOME. Nové GitHub Actions/check-runs pro kandidát: 0.

## Neúspěšné přípravné pokusy, opravy a zbývající rizika

`04-issue46-media.log` a `07-issue46-media-retest.log` zachovávají skutečné FAIL během vývoje testu: fixture původně nastavila selected před setTool (který ho maže) a Native model při reload záměrně resetoval disk. Test nyní respektuje pořadí a přenáší potvrzený modelový disk; `08-issue46-final.log` i celá finální sada PASS. Žádná příčina produktové #46 tím nebyla prokázána ani údajně opravena. Extrémní šířku produkt správně clampuje; finální test vyžaduje zachování dat a bezpečné meze, nikoli vymyšlené odmítnutí.

`apk-offline-missing-dependency.log` zachovává první build FAIL kvůli chybějícímu cache artefaktu `com.google.guava:listenablefuture:1.0`. Po standardním stažení oficiální deklarované závislosti Gradlem ve stejném prostředí následný build/signature/package/assets PASS. Zdroje, závislostní deklarace ani guardy se neměnily.

Zůstává skutečný providerový závod #88; obnovitelné intent/receipt a UNKNOWN z #116 ho neproměňují v atomickou provider transakci. Skutečný Android filesystem/audio/IME/radio, živé Drive kvóty a OAuth, fyzický výkon/power-loss ani HOME bezpečnostní model tímto Linux během ověřeny nejsou. Změna HOME/release guardů vyžaduje samostatné rozhodnutí a test-first nezávislé SOURCE review. Kandidát je po dokončení dostupných autorských testů připraven k závěrečné nezávislé kontrole; **merge/release HOLD**. Žádný merge, release, placená Actions, nákup či zásah do Windows práv.
