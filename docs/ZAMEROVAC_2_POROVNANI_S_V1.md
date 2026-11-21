# Zaměřovač 2 – skutečné porovnání s jedničkou a diagnostika od začátku

**21. 11. 2026 · v1 zdroj:** `main` SHA `8a36e353448ba74a066e16372441604b7e7163c7`. **V2:** pouze návrh v [PR #234](https://github.com/zaplikj30-ui/Zamerovac-android/pull/234), žádná nová aplikace. Jde o kontrolu existujícího produkčního kódu a mapy testů vůči vizi. NENÍ to potvrzení fyzické funkčnosti ani nezávislý audit všech řádků repozitáře.

**Pravidla:** KÓD = skutečná implementace ve zdroji; TEST EXISTUJE = ověřená testovací cesta, ne dnešní PASS; FYZICKÝ FAIL = doložené selhání uživatelského testu; NÁPAD = jen požadavek. Ověření se opírá o skutečné volání `finishHandleGesture → commitEditor → save`, `LocalDatabase.write → ProtectedRevisions` a další konkrétní místa, nikoli jen názvy souborů.

## 1. Funkční porovnání – co jednička má a co musí dvojka udělat jinak

| # | Oblast | V1 – ověřeno v kódu | V1 – problém / neověřeno | V2 – závěr |
|---|---|---|---|---|
| 1 | Kóty, čáry, geometrie, úchopy, lupa, gesta | KÓD: editor.js finishHandleGesture/commitEditor/drawItem + annotation-geometry.js | FYZICKÝ FAIL výkonu dlouhého posouvání od 1.4.0 (#221); jednotlivé nástroje nejsou všechny fyzicky potvrzené | Kotlin geometrie odděleně od Compose rendereru; jeden dokončený tah = jedna změna/Undo, bez diskového zápisu během pohybu |
| 2 | Undo/Redo a historie editoru | KÓD: AnnotationHistory.recordSnapshot/restore, editor.js undoEditor/redoEditor | Zdroj existuje; dlouhé historie a souběh ukládání bez aktuální fyzické garance | Kompaktní omezený editační příkaz; Undo oddělit od trvalé zálohy a synchronizace |
| 3 | Zakázky, složky, třídění, hledání, hromadné akce, zámky | KÓD: app.js newRecord/parentId/recById, bulk-actions.js a upgrade.js | Kód existuje; všechny varianty zámků, rychlost mnoha položek a importu NEOVĚŘENY | Stabilní ID, samostatné záznamy, zápisy jen změněné položky, explicitní test 10/100/1000 záznamů |
| 4 | Fotografie/video/PDF/miniatury a import | KÓD: MediaIngest.java, PhotoThumbnails.java, VideoActivity.java, app.js | Kód existuje; náročnost načtení a oprávnění podle zařízení NEOVĚŘENY | Původní bajty mimo DB; miniatury a načítání mimo citlivou cestu gest |
| 5 | Galerie a náhledy kót | KÓD: upgrade.js renderGallery/openGallery, customer-export.js | FYZICKÝ FAIL čitelnosti čar a textů v galerii (#50) | Náhled kót z přesných dat s čitelnými popisky při každém zoomu, ne jen zvětšený raster |
| 6 | Poznámky: text/foto/kresba/zvuk/video/přílohy | KÓD: rich-notes.js, sketch.js, AudioCapture.java, PendingAudio.java | Kód existuje; dokončení audia, osiřelé přílohy a chyby IME vyžadují negativní testy (#42) | Oddělená editovatelná data a média, vlastnictví příloh, test odpojení/oprávnění/plný disk |
| 7 | Bluetooth laser Bosch, historie a ruční hodnoty | KÓD: BoschBleProtocol.java, BoschClassicReader.java, upgrade.js rozpoznání modelu | Kód existuje; nelze vydávat za podporu všech přístrojů bez jejich fyzického testu | Přesná hodnota, jednotka, identita zdroje a cílová kóta mimo adaptér konkrétního měřáku |
| 8 | Lokální ukládání a obnova | KÓD: app.js save serializuje celé state; Native.saveDataChecked; LocalDatabase.write projects.json + .bak a ProtectedRevisions | Významné zdržení archivací revizí a fyzická regrese (#221); #232 je stále test-only RED | SQLite preferovaný kandidát; cílené transakce, bezpečný potvrzený zápis, obnova po crash/plném disku |
| 9 | Koš a destruktivní cleanup | KÓD: app.js purgeTrashRecords, TrashPurger.java, ProtectedRevisions | Kód existuje; destruktivní operace + sdílená média/sync a staré revize jsou bezpečnostní riziko | Koš oddělený od Undo, zálohy a sync; odstranit pouze prokazatelně nepotřebná média |
| 10 | ZIP import/export, zákaznické PDF, historie záloh | KÓD: BackupImporter.java, CustomerPdfExport.java, BackupHistory.java, app.js exportFolder/exportPhoto | Kód existuje; systémový výběr ZIP byl hlášen k ověření (#13), import/obnova nejsou automaticky PASS | Editovatelný archiv ≠ PDF zákazníkovi; roundtrip ZIP→obnova→reopen a byte-exact média |
| 11 | Google Disk a přímá synchronizace, zálohy | KÓD: SafSyncV2.java, SyncCadence.java, PeerOutbox.java, DriveBackupStore.java | Rozsáhlý kód/testy; skutečný Drive a dva telefony NEOVĚŘENY; #88 očekávaný syntetický RED | Ne v prvním offline prototypu; později dávkový přenos potvrzených změn, konflikty a oddělená záloha |
| 12 | Různé telefony, pero, lokalizace, nápověda | KÓD: responsive.css, i18n.js, help.js, Android Java/WebView bridge | Kód i testy existují; funkce na různých OEM neznamená ověřeno ve všech telefonech | Compose přístupné škálovatelné UI, prst/S Pen; přenositelné údaje pro budoucí Windows/iOS |
| 13 | Diagnostika a připomínky | KÓD: flight-recorder.js, feedback-reports.js; editor.js měří fáze, native save a ui-stall | Je v testovacím v1; 20 relací × 120 událostí; přínos a režie na každém telefonu NEOVĚŘENY | POVINNÁ SOUČÁST M1: nízkonákladové časy/počty/fáze/chyby, anonymní lokální záznam, izolace od editoru |
| 14 | Panorama/360/3D a jiné modely dálkoměrů | V1 nemá doloženou odpovídající produkční implementaci; vize/issue ano | NÁPAD / budoucí směr, nikoli hotová funkce | Připravit smysluplné vazby dokument–záběr–měření, ale neprogramovat panorama ani 3D engine v M1 |
| 15 | Pracovní časovač zákazníka, hodinovka, výkazy, fakturace | V1 issue #214/#224; v produkčních oblastech není odpovídající komponenta | NÁPAD pro budoucí etapu; detaily fakturace nevybrány | Vazby na zákazníka/zakázku a možnost pozdějších pracovních úseků; účetnictví nyní nestavět |
| 16 | Monetizace aplikace a volitelné moduly | VIZE_A_PLAN.md, issue #224; žádná produkční implementace jako náš zvolený obchodní model | OBCHODNÍ MODEL NEROZHODNUT | Oddělit data zakázky od případné licence; žádný plugin engine/platební systém dnes |

**Nejrizikovější přenos chyb v1:** nepřevzít souběžně serializaci celého stavu zakázek na každý editorový commit, rostoucí archiv historických revizí a zvětšování bitmapových popisků v galerii. Jen změnou jazyka Kotlin/C++ bychom chyby nevyřešili.

## 2. Kontrola všech 44 oblastí mapy zdrojů a testů

Z [qa/coverage-v1.json](../qa/coverage-v1.json) bylo proti úplnému Git stromu v1 ověřeno **44/44 mapovaných oblastí**, **88/88 unikátních zdrojových souborů** a **107/107 unikátních testovacích souborů**. **43 oblastí** jsou ve zdrojové mapě označené `runtime-partial`, **1** `static-only`. Existence není důkaz výsledku testu.

| # | Funkční/testovací oblast v1 | Skutečný soubor | Existující test | Stav ověření |
|---|---|---|---|---|
| 1 | `confirmed-storage` | [zdroj](../app/src/main/java/cz/zamerovac/app/LocalDatabase.java) | [test](../tests/save_acknowledgement.js) | KÓD+TEST EXISTUJE / RUNTIME A TELEFON NEOVĚŘENY |
| 2 | `folders-bulk-locks` | [zdroj](../app/src/main/assets/app.js) | [test](../tools/e2e/workflows.cjs) | KÓD+TEST EXISTUJE / RUNTIME A TELEFON NEOVĚŘENY |
| 3 | `drawing-and-exact-values` | [zdroj](../app/src/main/assets/editor.js) | [test](../tools/e2e/drawing.cjs) | KÓD+TEST EXISTUJE / RUNTIME A TELEFON NEOVĚŘENY |
| 4 | `handles-loupe-selection` | [zdroj](../app/src/main/assets/editor.js) | [test](../tests/dimension_drag_interaction.js) | KÓD+TEST EXISTUJE / RUNTIME A TELEFON NEOVĚŘENY |
| 5 | `undo-redo-history` | [zdroj](../app/src/main/assets/editor.js) | [test](../tools/e2e/drawing.cjs) | KÓD+TEST EXISTUJE / RUNTIME A TELEFON NEOVĚŘENY |
| 6 | `snap-grid-and-zoom` | [zdroj](../app/src/main/assets/editor.js) | [test](../tools/e2e/zoom-grid.cjs) | KÓD+TEST EXISTUJE / RUNTIME A TELEFON NEOVĚŘENY |
| 7 | `landscape-toolbar` | [zdroj](../app/src/main/assets/upgrade.js) | [test](../tools/e2e/update39.cjs) | KÓD+TEST EXISTUJE / RUNTIME A TELEFON NEOVĚŘENY |
| 8 | `gallery` | [zdroj](../app/src/main/assets/upgrade.js) | [test](../tools/e2e/update39.cjs) | FYZICKÝ FAIL #50 |
| 9 | `photo-loading` | [zdroj](../app/src/main/assets/app.js) | [test](../app/src/test/java/cz/zamerovac/app/PhotoThumbnailsTest.java) | KÓD+TEST EXISTUJE / RUNTIME A TELEFON NEOVĚŘENY |
| 10 | `video` | [zdroj](../app/src/main/java/cz/zamerovac/app/VideoActivity.java) | [test](../app/src/test/java/cz/zamerovac/app/VideoReviewTest.java) | KÓD+TEST EXISTUJE / RUNTIME A TELEFON NEOVĚŘENY |
| 11 | `notes-checklist-sketch` | [zdroj](../app/src/main/assets/app.js) | [test](../tools/e2e/note-sync.cjs) | KÓD+TEST EXISTUJE / RUNTIME A TELEFON NEOVĚŘENY |
| 12 | `rich-notes-detail` | [zdroj](../app/src/main/assets/rich-notes.js) | [test](../tools/e2e/workflows.cjs) | KÓD+TEST EXISTUJE / RUNTIME A TELEFON NEOVĚŘENY |
| 13 | `voice-recording` | [zdroj](../app/src/main/java/cz/zamerovac/app/AudioCapture.java) | [test](../app/src/test/java/cz/zamerovac/app/AudioCaptureTest.java) | KÓD+TEST EXISTUJE / RUNTIME A TELEFON NEOVĚŘENY |
| 14 | `provider-media-import` | [zdroj](../app/src/main/java/cz/zamerovac/app/MediaIngest.java) | [test](../app/src/test/java/cz/zamerovac/app/MediaIngestTest.java) | KÓD+TEST EXISTUJE / RUNTIME A TELEFON NEOVĚŘENY |
| 15 | `trash-and-shared-media` | [zdroj](../app/src/main/java/cz/zamerovac/app/TrashPurger.java) | [test](../app/src/test/java/cz/zamerovac/app/TrashPurgerTest.java) | KÓD+TEST EXISTUJE / RUNTIME A TELEFON NEOVĚŘENY |
| 16 | `bosch-values-and-history` | [zdroj](../app/src/main/java/cz/zamerovac/app/BoschBleProtocol.java) | [test](../tests/laser_auto_interaction.js) | KÓD+TEST EXISTUJE / RUNTIME A TELEFON NEOVĚŘENY |
| 17 | `address-and-external-map` | [zdroj](../app/src/main/java/cz/zamerovac/app/AddressLookup.java) | [test](../tests/test_address_map_link.py) | KÓD+TEST EXISTUJE / RUNTIME A TELEFON NEOVĚŘENY |
| 18 | `webview-boundary` | [zdroj](../app/src/main/java/cz/zamerovac/app/WebContentPolicy.java) | [test](../app/src/test/java/cz/zamerovac/app/WebContentPolicyTest.java) | KÓD+TEST EXISTUJE / RUNTIME A TELEFON NEOVĚŘENY |
| 19 | `customer-export` | [zdroj](../app/src/main/java/cz/zamerovac/app/CustomerPdfExport.java) | [test](../app/src/test/java/cz/zamerovac/app/Post147DataTest.java) | KÓD+TEST EXISTUJE / RUNTIME A TELEFON NEOVĚŘENY |
| 20 | `full-zip-backup` | [zdroj](../app/src/main/java/cz/zamerovac/app/BackupImporter.java) | [test](../app/src/test/java/cz/zamerovac/app/StorageLifecycleTest.java) | KÓD+TEST EXISTUJE / RUNTIME A TELEFON NEOVĚŘENY |
| 21 | `historical-backup` | [zdroj](../app/src/main/java/cz/zamerovac/app/BackupHistory.java) | [test](../app/src/test/java/cz/zamerovac/app/BackupHistoryTest.java) | KÓD+TEST EXISTUJE / RUNTIME A TELEFON NEOVĚŘENY |
| 22 | `causal-format-and-conflicts` | [zdroj](../app/src/main/java/cz/zamerovac/app/CausalClock.java) | [test](../app/src/test/java/cz/zamerovac/app/SyncCanonicalTest.java) | KÓD+TEST EXISTUJE / RUNTIME A TELEFON NEOVĚŘENY |
| 23 | `durable-queue-and-transfer` | [zdroj](../app/src/main/java/cz/zamerovac/app/SyncQueueStore.java) | [test](../app/src/test/java/cz/zamerovac/app/PeerTransferTest.java) | KÓD+TEST EXISTUJE / RUNTIME A TELEFON NEOVĚŘENY |
| 24 | `tls-and-mutual-pairing` | [zdroj](../app/src/main/java/cz/zamerovac/app/SyncTls.java) | [test](../app/src/test/java/cz/zamerovac/app/PeerTlsTest.java) | KÓD+TEST EXISTUJE / RUNTIME A TELEFON NEOVĚŘENY |
| 25 | `lan-and-wifi-direct` | [zdroj](../app/src/main/java/cz/zamerovac/app/PeerDiscovery.java) | [test](../app/src/test/java/cz/zamerovac/app/PeerDiscoveryTest.java) | KÓD+TEST EXISTUJE / RUNTIME A TELEFON NEOVĚŘENY |
| 26 | `direct-service-lifecycle` | [zdroj](../app/src/main/java/cz/zamerovac/app/PeerRuntime.java) | [test](../app/src/test/java/cz/zamerovac/app/DirectSyncServiceTest.java) | KÓD+TEST EXISTUJE / RUNTIME A TELEFON NEOVĚŘENY |
| 27 | `sync-during-live-editor` | [zdroj](../app/src/main/assets/sync-edit-guard.js) | [test](../tools/e2e/sync-edit-guard.cjs) | KÓD+TEST EXISTUJE / RUNTIME A TELEFON NEOVĚŘENY |
| 28 | `signed-cloud-sync` | [zdroj](../app/src/main/java/cz/zamerovac/app/SafSyncV2.java) | [test](../app/src/test/java/cz/zamerovac/app/SafSyncV2Test.java) | KÓD+TEST EXISTUJE / RUNTIME A TELEFON NEOVĚŘENY |
| 29 | `provider-deadline-and-inbox` | [zdroj](../app/src/main/java/cz/zamerovac/app/ProviderIo.java) | [test](../app/src/test/java/cz/zamerovac/app/ProviderIoTest.java) | KÓD+TEST EXISTUJE / RUNTIME A TELEFON NEOVĚŘENY |
| 30 | `cloud-scan-batches` | [zdroj](../app/src/main/java/cz/zamerovac/app/CloudScan.java) | [test](../app/src/test/java/cz/zamerovac/app/CloudScanTest.java) | KÓD+TEST EXISTUJE / RUNTIME A TELEFON NEOVĚŘENY |
| 31 | `route-network-and-job-cancel` | [zdroj](../app/src/main/java/cz/zamerovac/app/GuardedSyncStore.java) | [test](../app/src/test/java/cz/zamerovac/app/GuardedSyncStoreTest.java) | KÓD+TEST EXISTUJE / RUNTIME A TELEFON NEOVĚŘENY |
| 32 | `help` | [zdroj](../app/src/main/assets/help.js) | [test](../tests/help_guide.js) | KÓD+TEST EXISTUJE / RUNTIME A TELEFON NEOVĚŘENY |
| 33 | `release-history` | [zdroj](../app/src/main/assets/release-history.js) | [test](../tests/release_history.js) | KÓD+TEST EXISTUJE / RUNTIME A TELEFON NEOVĚŘENY |
| 34 | `local-feedback` | [zdroj](../app/src/main/assets/feedback-reports.js) | [test](../tests/feedback_report_structure.js) | STATICKÉ TESTY |
| 35 | `drive-rest-boundary` | [zdroj](../app/src/main/java/cz/zamerovac/app/DriveHttp.java) | [test](../app/src/test/java/cz/zamerovac/app/DriveHttpTest.java) | KÓD+TEST EXISTUJE / RUNTIME A TELEFON NEOVĚŘENY |
| 36 | `drive-authorization-and-account-binding` | [zdroj](../app/src/main/java/cz/zamerovac/app/DriveAuthorization.java) | [test](../app/src/test/java/cz/zamerovac/app/DriveAuthorizationTest.java) | KÓD+TEST EXISTUJE / RUNTIME A TELEFON NEOVĚŘENY |
| 37 | `sync-frequency` | [zdroj](../app/src/main/java/cz/zamerovac/app/SyncCadence.java) | [test](../app/src/test/java/cz/zamerovac/app/SyncCadenceTest.java) | KÓD+TEST EXISTUJE / RUNTIME A TELEFON NEOVĚŘENY |
| 38 | `route-arbitration-and-cloud-progress` | [zdroj](../app/src/main/java/cz/zamerovac/app/PeerSessions.java) | [test](../app/src/test/java/cz/zamerovac/app/PeerSessionsTest.java) | KÓD+TEST EXISTUJE / RUNTIME A TELEFON NEOVĚŘENY |
| 39 | `drive-preview-registration` | [zdroj](../config/drive-preview.properties) | [test](../tools/drive-config-checks/build.gradle) | KÓD+TEST EXISTUJE / RUNTIME A TELEFON NEOVĚŘENY |
| 40 | `audit39-data-safety` | [zdroj](../app/src/main/java/cz/zamerovac/app/ArchiveLimits.java) | [test](../app/src/test/java/cz/zamerovac/app/Audit39FindingsTest.java) | KÓD+TEST EXISTUJE / RUNTIME A TELEFON NEOVĚŘENY |
| 41 | `p1-hybrid-protected-revisions` | [zdroj](../app/src/main/java/cz/zamerovac/app/ProtectedRevisions.java) | [test](../app/src/test/java/cz/zamerovac/app/ProtectedRevisionsTest.java) | POTVRZENÝ BOTTLENECK #221 |
| 42 | `pending-audio-retention` | [zdroj](../app/src/main/java/cz/zamerovac/app/PendingAudio.java) | [test](../app/src/test/java/cz/zamerovac/app/AudioCompletedKeepTest.java) | KÓD+TEST EXISTUJE / RUNTIME A TELEFON NEOVĚŘENY |
| 43 | `sync-core-b-ledger-adapters-content` | [zdroj](../app/src/main/java/cz/zamerovac/app/SyncLedger.java) | [test](../app/src/test/java/cz/zamerovac/app/SyncLedgerTest.java) | KÓD+TEST EXISTUJE / RUNTIME A TELEFON NEOVĚŘENY |
| 44 | `sync-ack-recoverable-obligations` | [zdroj](../app/src/main/java/cz/zamerovac/app/PeerOutbox.java) | [test](../app/src/test/java/cz/zamerovac/app/SyncReceiptSafetyTest.java) | KÓD+TEST EXISTUJE / RUNTIME A TELEFON NEOVĚŘENY |

**Rozsah zdrojového ověření:** přímo otevřené byly `editor.js` (gesto/commit/render/lupa), `app.js` (save/rekord/koš/export), `upgrade.js` (galerie/laser), `LocalDatabase.java`, `ProtectedRevisions.java`, `SyncCadence.java`, `flight-recorder.js` a `MainActivity.java`; u zbývajících oblastí byl proti Git stromu ověřen soubor a jeho test, ne celý obsah. Z mapy proto nelze odvodit přesné procento hotových funkcí.

## 3. Dohledatelnost původních požadavků (49/49) a budoucích nápadů (34)

Všech [49 očíslovaných požadavků #12](https://github.com/zaplikj30-ui/Zamerovac-android/issues/12) a jejich [přepis do inventury](ZAMEROVAC_2_INVENTURA_POZADAVKU.md) zůstává zachován v původních detailech: 1.1–1.8 kóty/úchopy → editor+geometrie; 2.1–2.8 tvary → editor/sketch; 3.1–3.6 úhly/řetězce → editor/laser; 4.1–4.9 poznámky → rich-notes/AudioCapture; 5.1–5.5 galerie → upgrade/customer-export; 6.1–6.4 symboly → editor; 7.1–7.4 Bosch → BLE/Classic; 8.1–8.5 export/přenos dat → BackupImporter/CustomerPdfExport. Úplný zdrojový detail a rekonstrukce 28 historických testů zůstávají v inventuře. Žádný nezaškrtnutý bod #12 není automaticky fyzický FAIL nebo chybějící kód.

**Budoucí nápady:** [34 skupin v inventuře](ZAMEROVAC_2_INVENTURA_POZADAVKU.md) včetně kót do 360° panoramat, možného 3D, široké podpory laserů, pracovního časovače se sazbou zákazníka a historie práce, fakturace, monetizace a budoucích zapínatelných modulů. Tyto požadavky nemají být záminkou vyvíjet hned 3D/účetnictví/pluginy.

### 3.1 Všech 49 jednotlivých bodů – zdrojová stopa a nutná zkouška

**Důležitá hranice:** přítomnost souboru oblasti **neprokazuje implementaci každého požadovaného detailu**. Proto je v tabulce výslovně stav konkrétního bodu **NEOVĚŘENO**, kromě známého fyzického problému galerie a zjevně pouze plánované inteligentní funkce. Je to správné zadání pro budoucí detailní regresi, nikoliv 49 falešných PASS.

| Bod #12 | Požadované chování | Existující cesta ve v1 | Stav konkrétního detailu | Co ověřit před převzetím do v2 |
|---|---|---|---|---|
| **1.1** | Zvětšit pouze vzhled bílých úchopových kroužků. Dotykovou oblast a citlivost neměnit. | [zdroj oblasti](../app/src/main/assets/editor.js) | Zdroj editoru doložen; jednotlivá přesná ergonomie neověřena | test gesta / lupa / pixely |
| **1.2** | Kroužky mají být poloprůhledné a nemají překrývat žluté čáry nebo hroty. | [zdroj oblasti](../app/src/main/assets/editor.js) | Zdroj editoru doložen; jednotlivá přesná ergonomie neověřena | test gesta / lupa / pixely |
| **1.3** | Uchopením středu čáry nebo kóty přesunout celý objekt. | [zdroj oblasti](../app/src/main/assets/editor.js) | Zdroj editoru doložen; jednotlivá přesná ergonomie neověřena | test gesta / lupa / pixely |
| **1.4** | Uchopením koncového bodu přesouvat jen daný konec. | [zdroj oblasti](../app/src/main/assets/editor.js) | Zdroj editoru doložen; jednotlivá přesná ergonomie neověřena | test gesta / lupa / pixely |
| **1.5** | Opravit magnetické přichytávání, aby šly body snadno oddělit. | [zdroj oblasti](../app/src/main/assets/editor.js) | Zdroj editoru doložen; jednotlivá přesná ergonomie neověřena | test gesta / lupa / pixely |
| **1.6** | Vypnutí přichytávání musí vypnout všechny jeho režimy. | [zdroj oblasti](../app/src/main/assets/editor.js) | Zdroj editoru doložen; jednotlivá přesná ergonomie neověřena | test gesta / lupa / pixely |
| **1.7** | Text přidaný k šipce zobrazovat nad její čárou. | [zdroj oblasti](../app/src/main/assets/editor.js) | Zdroj editoru doložen; jednotlivá přesná ergonomie neověřena | test gesta / lupa / pixely |
| **1.8** | Zachovat přesnou lupu při umisťování a přesouvání bodů. | [zdroj oblasti](../app/src/main/assets/editor.js) | Zdroj editoru doložen; jednotlivá přesná ergonomie neověřena | test gesta / lupa / pixely |
| **2.1** | Plocha: čtyři nezávisle pohyblivé rohy, nepravidelné tvary a rozměry stran. | [zdroj oblasti](../app/src/main/assets/editor.js) | Kód nástrojové oblasti existuje; konkrétní tvar neověřen | test viditelného tvaru a ovládání |
| **2.2** | Plocha: prostředním úchopem přesouvat celý tvar. | [zdroj oblasti](../app/src/main/assets/editor.js) | Kód nástrojové oblasti existuje; konkrétní tvar neověřen | test viditelného tvaru a ovládání |
| **2.3** | Obdélník ponechat jako samostatný jednoduchý nástroj. | [zdroj oblasti](../app/src/main/assets/editor.js) | Kód nástrojové oblasti existuje; konkrétní tvar neověřen | test viditelného tvaru a ovládání |
| **2.4** | Kruh: přesun za střed, změna velikosti za obvod, průměr Ø / poloměr R. | [zdroj oblasti](../app/src/main/assets/editor.js) | Kód nástrojové oblasti existuje; konkrétní tvar neověřen | test viditelného tvaru a ovládání |
| **2.5** | Elipsa: přesouvání celku a dvě nezávisle upravitelné osy. | [zdroj oblasti](../app/src/main/assets/editor.js) | Kód nástrojové oblasti existuje; konkrétní tvar neověřen | test viditelného tvaru a ovládání |
| **2.6** | Lomená čára: jednotlivé vrcholy spojené rovnými úsečkami, včetně jejich úprav. | [zdroj oblasti](../app/src/main/assets/editor.js) | Kód nástrojové oblasti existuje; konkrétní tvar neověřen | test viditelného tvaru a ovládání |
| **2.7** | Volná ruka musí plynule kopírovat pohyb prstu nebo S Penu. | [zdroj oblasti](../app/src/main/assets/editor.js) | Kód nástrojové oblasti existuje; konkrétní tvar neověřen | test viditelného tvaru a ovládání |
| **2.8** | Inteligentní kreslení: samostatný nástroj pro narovnání ručního náčrtu půdorysu. (inteligentní narovnání není doložené jako hotové) | [zdroj oblasti](../app/src/main/assets/editor.js) | Nedoložené jako implementovaná funkce; jen zadání | test viditelného tvaru a ovládání |
| **3.1** | Dimenzní řetězec: zobrazovat rozměr každého jednotlivého úseku. | [zdroj oblasti](../app/src/main/assets/editor.js) | Editor a laserový vstup existují; detail neověřen | test hodnot/řetězců/jednotek |
| **3.2** | Kumulativní řetězec: zobrazovat vzdálenosti od společného počátečního bodu. | [zdroj oblasti](../app/src/main/assets/editor.js) | Editor a laserový vstup existují; detail neověřen | test hodnot/řetězců/jednotek |
| **3.3** | Oba řetězce: odlišné ikony, přidávání, přesouvání a mazání bodů. | [zdroj oblasti](../app/src/main/assets/editor.js) | Editor a laserový vstup existují; detail neověřen | test hodnot/řetězců/jednotek |
| **3.4** | Oba řetězce: ruční zadávání délek a přenos měření z laseru Bosch. | [zdroj oblasti](../app/src/main/assets/editor.js) | Editor a laserový vstup existují; detail neověřen | test hodnot/řetězců/jednotek |
| **3.5** | Úhel: společný vrchol a dvě upravitelná ramena podle ImageMeteru. | [zdroj oblasti](../app/src/main/assets/editor.js) | Editor a laserový vstup existují; detail neověřen | test hodnot/řetězců/jednotek |
| **3.6** | Sklon čáry: zachovat i naši současnou variantu zobrazení úhlu. | [zdroj oblasti](../app/src/main/assets/editor.js) | Editor a laserový vstup existují; detail neověřen | test hodnot/řetězců/jednotek |
| **4.1** | Prázdná poznámka: ponechat výchozí text „Klikněte pro zadání textu“. | [zdroj oblasti](../app/src/main/assets/rich-notes.js) | Funkce poznámek existuje; detail v telefonu neověřen | test příloh/oprávnění/gest |
| **4.2** | Po vložení fotografie zobrazovat fotografii místo výchozího textu. | [zdroj oblasti](../app/src/main/assets/rich-notes.js) | Funkce poznámek existuje; detail v telefonu neověřen | test příloh/oprávnění/gest |
| **4.3** | Vlastní text a fotografie se zobrazují a přesouvají společně. | [zdroj oblasti](../app/src/main/assets/rich-notes.js) | Funkce poznámek existuje; detail v telefonu neověřen | test příloh/oprávnění/gest |
| **4.4** | U hlasové poznámky zobrazit malou ikonu mikrofonu. | [zdroj oblasti](../app/src/main/assets/rich-notes.js) | Funkce poznámek existuje; detail v telefonu neověřen | test příloh/oprávnění/gest |
| **4.5** | Klepnutím na text i fotografii otevřít stejnou úplnou nabídku poznámky. | [zdroj oblasti](../app/src/main/assets/rich-notes.js) | Funkce poznámek existuje; detail v telefonu neověřen | test příloh/oprávnění/gest |
| **4.6** | Zachovat fotografie, videa, hlasové nahrávky a další přílohy. | [zdroj oblasti](../app/src/main/assets/rich-notes.js) | Funkce poznámek existuje; detail v telefonu neověřen | test příloh/oprávnění/gest |
| **4.7** | Spojovací šipka: v klidu pouze žlutý hrot, bez viditelné tečky. | [zdroj oblasti](../app/src/main/assets/rich-notes.js) | Funkce poznámek existuje; detail v telefonu neověřen | test příloh/oprávnění/gest |
| **4.8** | Při přesouvání hrotu zobrazit větší bílý úchop; hrot přesouvat samostatně. | [zdroj oblasti](../app/src/main/assets/rich-notes.js) | Funkce poznámek existuje; detail v telefonu neověřen | test příloh/oprávnění/gest |
| **4.9** | Po prvním povolení mikrofonu automaticky začít nahrávat bez druhého klepnutí. | [zdroj oblasti](../app/src/main/assets/rich-notes.js) | Funkce poznámek existuje; detail v telefonu neověřen | test příloh/oprávnění/gest |
| **5.1** | V galerii zobrazovat fotografie se všemi kótami, poznámkami a symboly. | [zdroj oblasti](../app/src/main/assets/upgrade.js) | Galerie existuje; čitelnost kót fyzicky vadná #50 | test čitelnosti a viewer lock |
| **5.2** | V galerii zamknout úpravy objektů, aby šlo bezpečně listovat prstem. | [zdroj oblasti](../app/src/main/assets/upgrade.js) | Galerie existuje; tento konkrétní detail NEOVĚŘEN; #50 dokládá jinou vadu – čitelnost kót | test čitelnosti a viewer lock |
| **5.3** | Po otevření editoru znovu umožnit běžné úpravy všech objektů. | [zdroj oblasti](../app/src/main/assets/upgrade.js) | Galerie existuje; tento konkrétní detail NEOVĚŘEN; #50 dokládá jinou vadu – čitelnost kót | test čitelnosti a viewer lock |
| **5.4** | Stejné chování zajistit i ve druhém prohlížeči fotografií. | [zdroj oblasti](../app/src/main/assets/upgrade.js) | Galerie existuje; tento konkrétní detail NEOVĚŘEN; #50 dokládá jinou vadu – čitelnost kót | test čitelnosti a viewer lock |
| **5.5** | Po návratu z editoru zobrazovat aktuálně uložené anotace. | [zdroj oblasti](../app/src/main/assets/upgrade.js) | Galerie existuje; tento konkrétní detail NEOVĚŘEN; #50 dokládá jinou vadu – čitelnost kót | test čitelnosti a viewer lock |
| **6.1** | Rozšířit knihovnu symbolů pro elektroinstalaci, půdorysy a další použití. | [zdroj oblasti](../app/src/main/assets/editor.js) | Symboly v editoru existují; detail knihovny neověřen | test ikon/kategorií/uložení |
| **6.2** | Přidat přehledné kategorie a vyhledávání symbolů. | [zdroj oblasti](../app/src/main/assets/editor.js) | Symboly v editoru existují; detail knihovny neověřen | test ikon/kategorií/uložení |
| **6.3** | Přidat naposledy použité symboly. | [zdroj oblasti](../app/src/main/assets/editor.js) | Symboly v editoru existují; detail knihovny neověřen | test ikon/kategorií/uložení |
| **6.4** | Umožnit vlastní text u symbolu a zachovat rychlé předvolby. | [zdroj oblasti](../app/src/main/assets/editor.js) | Symboly v editoru existují; detail knihovny neověřen | test ikon/kategorií/uložení |
| **7.1** | Opravit skutečný přenos naměřených hodnot z Bosch GLM 100-25 C. | [zdroj oblasti](../app/src/main/java/cz/zamerovac/app/BoschBleProtocol.java) | Bosch kód existuje; specifický model vyžaduje fyzický test | test BLE a přesné hodnoty |
| **7.2** | Přenášet hodnoty do právě aktivní kóty nebo rozměrového pole. | [zdroj oblasti](../app/src/main/java/cz/zamerovac/app/BoschBleProtocol.java) | Bosch kód existuje; specifický model vyžaduje fyzický test | test BLE a přesné hodnoty |
| **7.3** | Zprovoznit historii naměřených hodnot. | [zdroj oblasti](../app/src/main/java/cz/zamerovac/app/BoschBleProtocol.java) | Bosch kód existuje; specifický model vyžaduje fyzický test | test BLE a přesné hodnoty |
| **7.4** | Zjednodušit nalezení laseru a jeho opětovné připojení. | [zdroj oblasti](../app/src/main/java/cz/zamerovac/app/BoschBleProtocol.java) | Bosch kód existuje; specifický model vyžaduje fyzický test | test BLE a přesné hodnoty |
| **8.1** | Odstranit duplicitní export z rozbalené nástrojové lišty. | [zdroj oblasti](../app/src/main/java/cz/zamerovac/app/BackupImporter.java) | ZIP/export vrstva existuje; konkrétní detail neověřen | test ZIP/export/import/reopen/byte-identical |
| **8.2** | Zachovat ostatní možnosti exportu. | [zdroj oblasti](../app/src/main/java/cz/zamerovac/app/BackupImporter.java) | ZIP/export vrstva existuje; konkrétní detail neověřen | test ZIP/export/import/reopen/byte-identical |
| **8.3** | Přidat export celé zvolené složky včetně podsložek a příloh. | [zdroj oblasti](../app/src/main/java/cz/zamerovac/app/BackupImporter.java) | ZIP/export vrstva existuje; konkrétní detail neověřen | test ZIP/export/import/reopen/byte-identical |
| **8.4** | Při aktualizaci zachovat uložené zakázky, fotografie, kóty a poznámky. | [zdroj oblasti](../app/src/main/java/cz/zamerovac/app/BackupImporter.java) | ZIP/export vrstva existuje; konkrétní detail neověřen | test ZIP/export/import/reopen/byte-identical |
| **8.5** | Zachovat dosavadní funkční ovládání všude, kde nebyla požadována změna. | [zdroj oblasti](../app/src/main/java/cz/zamerovac/app/BackupImporter.java) | ZIP/export vrstva existuje; konkrétní detail neověřen | test ZIP/export/import/reopen/byte-identical |

**44 mapovaných oblastí, 49 položek a 28 historických testů nejsou sčitatelné počty funkcí:** jsou to různé pohledy na stejný kód a chování.
## 4. Jednoduchá diagnostika od PRVNÍHO prototypu – upřesnění vlastníka 21. 11. 2026

**Diagnostika je povinnou součástí M1, ale má být MALÁ, JEDNODUCHÁ A SAMOSTATNÁ.** Vlastník ocenil přesunutelnou vlaječku v jedničce a nechce velké diagnostické menu, formuláře hlášení, screenshoty, videonástroje ani další diagnostické funkce zatím. Cílem je snadno předat anonymní časový záznam závady.

### 4.1 Minimální ovládání

1. **Jedna nenápadná přesunutelná vlaječka** mimo úchopy a nástroje editoru. Klepnutí otevře malý panel **Diagnostika**, nikoli formulář připomínky z v1. Polohu vlaječky si aplikace pamatuje.
2. Panel má jasné **Zapnout záznam / Vypnout záznam** a viditelný stav. Každé nové zapnutí začíná nové samostatné měření (sezení), výchozí stav vypnuto.
3. **Historie měření** se po ukončení aplikace neztrácí. Každé sezení má datum/čas a stručný počet událostí. Zaškrtávacím výběrem lze označit **jedno, více nebo všechna** měření.
4. **Sdílet vybrané:** pouze označená měření, jedno nebo více, v jednom přehledném anonymním textu/souboru (verze aplikace, čas, povolené časy a počty). Nic se neposílá bez uživatelova klepnutí; sdílení záznamy nesmaže.
5. **Smazat vybrané / Smazat vše:** hromadná operace jedním potvrzením; **žádné nucené mazání po jednom**. Při dosažení limitu upozornit a umožnit hromadné uvolnění místa, stará měření tiše neodstraňovat. Smazání diagnostiky se nikdy nedotkne zakázek, kót a fotografií.
6. **Zatím nepřidávat** vlastní formulář připomínek, automatické screenshoty, kreslení do snímků, dashboard, telemetrický server ani mnoho specializovaných panelů. Pozdější rozšíření jen podle skutečné potřeby.

### 4.2 Nutné technické minimum a zkouška

- **Stačí lehké měření hlavních fází:** dokončený tah kóty, vykreslení, místní uložení/obnova, základní počty prvků a typy chyb nebo zastavení UI. Nezapisovat nic na disk při každém pohybu prstu; další podrobné metriky až při konkrétní závadě.
- **Soukromí:** pevně povolené typy událostí/číselné hodnoty; žádné fotografie, screenshoty, texty, jména či ID zákazníků/zakázek, míry a hodnoty laseru, souřadnice, GPS, audio. Bez automatického odesílání. Výpis lze před sdílením zkontrolovat.
- **Bezpečnost:** omezená velikost historie, lokální potvrzené uložení, obnova po restartu. Chyba či plná paměť diagnostiky nesmí poškodit historii měření ani zablokovat editor, Undo/Redo, ukládání zakázek nebo pracovat s osobními médii.
- **Akceptační test M1:** vlaječka → zapnout → posouvat kóty → vypnout → po restartu vybrat dvě starší sezení → sdílet právě ta dvě → hromadně smazat vybraná → ostatní měření i zakázka zůstávají. Ověřit anonymitu, chování při poškození logu/plném disku a režii diagnostiky zapnuté vs vypnuté.

**FAKT z jedničky:** soubor flight-recorder.js už umožňuje jednotlivá sezení, sdílení jednoho, mazání po jednom i všech najednou. Soubor feedback-reports.js nabízí přesunutelnou vlaječku a rychlý přepínač diagnostiky, ale klepnutí hlavně otevírá rozsáhlejší připomínku. **Ve dvojce ponecháme jednoduchou vlaječku a doplníme výběr více sezení pro společné sdílení i hromadné mazání; ostatní funkce zatím ne.**

## 5. Co musí být správně od začátku, ale nemáme to nyní programovat

**M0 datová rozhodnutí:** stabilní identita zakázky/složky/fotografie/anotace/média, přesná hodnota+jednotka odděleně od pixelů, verze dat, vlastnictví originálů, obecný vstup měření, připojitelné dokumentové typy. Nepsat nyní prázdné tabulky 3D, panoramatu, fakturace, licence a cloudové sync.

**M1 první prototyp:** Kotlin + Compose, jeden celý offline pracovní tok foto–kóta–gesto–Undo/Redo–SQLite kandidát pro transakční save/reopen **plus povinná diagnostika**.

**M2+**: galerie, poznámky, ZIP a Bosch; později panorama, další výrobci laserů, pracovní výkaz/faktury, samostatné aplikace/moduly, Windows/iOS a Google Disk záloha/sync vždy až podle konkrétního testu a dalšího rozhodnutí.

## 6. Protokol důkazů

- **FAKT:** `main` SHA `8a36e353448ba74a066e16372441604b7e7163c7`; mapované soubory existují (44 oblastí / 88 zdrojů / 107 testů); uvedená konkrétní volání a diagnostika existují v kódu. [#221](https://github.com/zaplikj30-ui/Zamerovac-android/issues/221) a [#50](https://github.com/zaplikj30-ui/Zamerovac-android/issues/50) dokumentují fyzická hlášení regresí; [PR #232](https://github.com/zaplikj30-ui/Zamerovac-android/pull/232) obsahuje jen RED testy.
- **NOT RUN:** nová Android/Gradle/JUnit/Chromium/Actions/emulátorová ani fyzická zkouška v této dokumentační etapě. Testovací soubor ≠ zelené testy a V1 ≠ fyzicky potvrzený V2.
- **RIZIKO:** nejde o kompletní čtení 88 produkčních souborů ani každého starého issue/PR; u konkrétní implementace je nutná podrobná hluboká SOURCE/SECURITY oponentura, vyhodnocení všech relevantních produkčních vazeb a regresí. Vlastní dokumentační kontrola není nezávislá.
- **STOP:** žádný GO pro merge, sestavení APK, cloudové testy nebo vytvoření produkčního v2 kódu. Nezávislý kontrolor jiný chat až po autorském review tohoto dokumentačního diffu.
