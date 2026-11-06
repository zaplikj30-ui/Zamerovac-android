# Zadání nezávislého auditu #39 / #33 / #28 / #42

Toto je připravené zadání a mapa důkazů, nikoli výsledek nezávislého auditu. Přesný předávaný commit a jeho CI odkazy musí být v posledním předávacím komentáři draft PR #41; auditovat tento neměnný SHA. Před začátkem znovu přečíst nejnovější AGENTS/START, #39, #33, #28, #42 a novější komentáře. Chránit main dokumentaci a již uložené opravy, žádná APK/merge ani nová budoucí funkce.

## Ověřený commit k předání

Auditovaná implementace: **86b0a63ff3a503be3692177d86dba7cd0db9543d**. [Native/Gradle/PDF SUCCESS](https://github.com/zaplikj30-ui/Zamerovac-android/actions/runs/42142954490), [Node/Python/Chromium SUCCESS](https://github.com/zaplikj30-ui/Zamerovac-android/actions/runs/42142954473). Build kontrola vyžaduje skutečné zamerovac-android/configured=true, preview package a správný skutečný certifikát. Devatenáct negativních konfiguračních/aktivačních scénářů zůstává. Konfigurace neznamená vybraný účet ani živé OAuth oprávnění. Následná čistě dokumentační předávka nemění tento funkční kód ani testy; při jakékoli nové změně kódu znovu určit auditovaný SHA.

Připravenost k revizi kódu: **ANO**. Výsledek nezávislého auditu: **pending**, živé/fyzické Google/radio/Keystore/Bosch testy: **NOT RUN**. Nic dalšího z registrace/Project ID se nevyžaduje. Žádná APK/merge.

## Rozsah a kritéria

Posoudit celý schválený celek #39, včetně #38/#40 a galerie/editoru/ovládání. Tvrzení o vadě doložit konkrétním kódem a reprodukcí na syntetických datech, odlišit potvrzenou vadu od rizika nebo chybějícího fyzického důkazu. Samotná velikost MainActivity/editor.js není nález. Žádné zákaznické zakázky, účty nebo fotografie v testech/reportech. Žádné Google tokeny, e-maily, OAuth tajemství nebo přihlašovací JSON v repozitáři/artefaktech.

| Priorita / hranice | Co nezávisle ověřit | Kód a současné regresní důkazy |
| --- | --- | --- |
| P0: externí obsah a Native | Cizí iframe/popup/schéma/script/HTML příloha ani podvržené ID nezískají privilegia; mapová funkce zůstane použitelná systémovým prohlížečem. | WebContentPolicy, MainActivity WebViewClient/JsApi, address-correction.js; WebContentPolicyTest, tools/e2e/web-content-policy.cjs a update39.cjs. |
| P0: potvrzený zápis a rozměry | CAS/merge vrací skutečně uložená data; opožděný callback nepřepíše novější ani živou editaci. Jednotky/textové kóty se nezískávají z pixelů. | LocalDatabase, DatabaseRecovery, CausalClock/SyncConflicts, app.js, sync-edit-guard.js; SyncSafetyTest, StorageLifecycleTest, DatabaseRecoveryTest, drawing/interactions/sync-edit-guard/note-sync. |
| P0: autentizace a stav přenosu | Mutual TLS, celý kód na obou zařízeních, správný certifikát/UUID pin a revokace; žádný data ACK před kompletními médii a DB. | SyncTls, PeerHandshake, SyncPeerRegistry, PeerTransfer/PeerDataStore; PeerTlsTest, PeerTransferTest a SyncTlsIdentityTest. JCA provider a rádio jsou test doubles, ne hardware. |
| P0/P1: souběh cest a recovery | Direct/LAN/cloud stejné job/causal principy; source publication není receiver ACK; fallback zneplatní receipts, starý intent ani ztracený ACK nezničí novou práci. | PeerOutbox, PeerSessions/Coordinator, PeerGates, SafSyncV2, CloudInbox/Publications/Scan; SafSyncV2Test, PeerSessionsTest, PeerMediaCheckpointTest. |
| P0/P1: historická záloha | Sync nemá delete/replace backup capability. Nové body a opravné kopie nemění starý obsah/manifest. Partial/corrupt blok, failed source/read/write a restore nezničí současná data. | BackupStore/Blobs/History, BackupImporter, DriveObjectStore; BackupHistoryTest, DriveStoresTest, DocumentBackupStoreTest. |
| P0/P1: skutečná Google konfigurace | Preview package a skutečný SHA1 souhlasí s registrací; pouze drive.appdata, účty oddělené/CAS; žádný token v URL/DB/Bundle/logu. Zkontrolovat scope a public namespace, nikoli jen neprázdný build string. | config/drive-preview.properties, gradle/drive-registration.gradle, app/build.gradle; Gradle drive-config-checks, DriveAuthorization/AccountFlow/Accounts/Http/Api/CloudStorage testy a DriveRegistrationTest s potvrzeným projektovým ID a povoleným native UI. Skutečný Google souhlas je samostatný NOT RUN. |
| P1: dlouhé operace a lifecycle | Síť/provider neblokuje DB/UI, timeout/cancel/direct priorita po blocích. Starý Job/picker/consent/import callback neovládne nový pokus nebo jiný cíl. | ProviderIo, MediaIngest/Staging, AudioCapture, SyncJob/Cadence, DriveAccountFlow, PeerRuntime/DirectSyncService; odpovídající native testy a media-import/voice/note/callback browser scénáře. |
| P1: geometrie a viditelnost | Skutečná gesta a barevné obrysy všech15 nástrojů, úchopy/lupa/Undo/Redo, galerie extreme pan a text mimo původní foto; failure bez kresby musí být odhalen. | tools/e2e/drawing.cjs, interactions.cjs, update39.cjs, zoom-grid.cjs a tests/*interaction.js. Prst/S Pen/Bosch a Android WebView fyzicky NOT RUN. |
| P1/P2: architektura a rozvoj | Přesné společné modely oddělené od Android rádio/Keystore/přihlášení. Při nové hranici nejsou paralelní zapisovače. Změna nemusí předem zavádět Windows/iOS/3D/cast/tisk/režimy. | docs/architecture-39-boundaries.md, datový/wire/cloud kontrakt a qa/coverage-v1.json proti aktuálnímu VIZE_A_PLAN na main. Doporučit malé následné změny s regresními testy, nepřepisovat celý editor. |

## Reprodukce automatických kontrol bez APK

Použít stejné prostředí, verze a příkazy jako `.github/workflows/verify-native.yml` a `quick-check.yml` na předaném SHA. Zejména:

```
gradle --no-daemon -p tools/drive-config-checks verify
gradle --no-daemon :app:verifyDriveRegistration :app:compilePreviewJavaWithJavac :app:testPreviewUnitTest -PdriveRequireConfigured=true
node tools/qa/audit.cjs
python3 -m unittest discover -s tests -p 'test_*.py'
```

Dále celé Node/Chromium a externí PDF parser/render z těchto workflow. QA mapa samotná testy nespouští. Zaznamenat PASS/FAIL/NOT RUN, SHA a přesný reprodukovatelný příkaz. Neprovádět `assemble`, `build-apk.yml`, emulator workflow ani změnu `.github/apk-build-request.txt` v tomto review.

Cíleně kombinovat nové a staré funkce: přesná kóta + příchozí sync během tahu/formuláře; offline A/B konflikt + retry/restart + ZIP; purge + partial cloud intent; nový cloud namespace po direct ACK; dvě historie + smazání aktuálních dat + obnova starého bodu; account switch + opožděný consent; native konfigurace + Job/manuální režim + failed save. Očekávané hodnoty/hash/počet kopií definovat nezávisle na výsledku implementace.

## Co automatická evidence nedokazuje

- Console registrace včetně přesného Project ID zamerovac-android je doložená uživatelskými obrazovkami v #39 (až6673933539). Aktivovaná build konfigurace není živé OAuth na zařízení; report configured=true neznamená vybraný účet nebo udělený souhlas. Znovu registraci ani potvrzení ID nevyžadovat.
- Google Testing má zatím jeden povolený účet. Pro telefon i tablet použít tentýž účet. Skutečný consent/cancel/denied/revoked/expired, appDataFolder, velké originály, dvě historie a obnova jsou NOT RUN do fyzické akceptace.
- Rádio/Keystore/Doze/OS restart/služba a instalace, kamera/mikrofon/kodeky, Bosch/prst/pera a výkon slabšího Androidu jsou NOT RUN. Simulované diskové residue nejsou skutečný process-kill/power-cut. Screenshot bez automatického porovnání není vizuální důkaz.
- HTTP rozpočet je konzervativní a není účtem operátora. Podpis/hash není end-to-end šifrování; oprávnění účtu/poskytovatele zůstávají součástí ochrany cloudových dat. Vývojový signer není produkční identita.

## Formát nálezu a výsledek auditu

Každý nález: priorita, přesný SHA/soubor/funkce, potvrzená vada nebo neověřené riziko, očekávané vs skutečné chování, minimální syntetická reprodukce, dopad na data/kóty/bezpečnost, doporučená malá oprava a test, který skutečně selže před opravou a projde po ní. U P0 nesmí být neohlášená ztráta dat, chybná kóta ani cizí přístup odložené jako kosmetika. P1 posoudit podle skutečného dopadu, nezamlčet limity.

Předat souhrn do #42 a PR #41, testové důkazy do #28; bez duplicitních issues. Stav „připraveno k nezávislému auditu“ není „audit prošel“, „vydáno“ ani „fyzicky ověřeno“. Aktuální připravenost a zbývající překážky zaznamenat až po výsledku nové konfigurace/CI.
