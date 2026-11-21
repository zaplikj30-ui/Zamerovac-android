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

## 4. Povinná diagnostika OD PRVNÍHO v2 prototypu – rozhodnutí uživatele 21. 11. 2026

Diagnostika není odložená funkce. Je **akceptační podmínka M1** spolu s editorem, bezpečným uložením a základními testy.

1. **Malý oddělený Kotlin záznamník:** předem povolené typy událostí, časová razítka a počty; omezená paměťová historie, oddělená testovací sezení, lokální uložení jen ve vhodný okamžik. Žádná historie každého mikropohybu prstu ani synchronní diskové zápisy v `pointermove`.
2. **Měřit fáze:** start a otevření editoru, vstup a délku gesta, vykreslení a zadrhnutí snímků, dokončený příkaz, Undo/Redo, serializaci/přípravu transakce, diskový commit, návrat potvrzení, obnovu při restartu, miniatury, galerie, import média, chyby oprávnění a selhání. U každé chyby typ/fáze/počet, bez uživatelského obsahu.
3. **Výkon pod kontrolou:** počty kót/fotek/složek, stručné údaje o paměti a latenci; srovnání 100 a 1000 opakovaných tahů a 10/100/1000 položek. Měřit **diagnostika vypnutá vs zapnutá**; při zhoršení sama diagnostika nemůže projít.
4. **Soukromí:** nikdy neukládat fotografii, screenshot, GPS, jména, zákaznické texty, identifikátory zakázek, laserové hodnoty, přesné souřadnice ani zvuk. Žádná síťová telemetrie. Uživatel záznam sám zapne, zobrazí, zkopíruje/sdílí nebo smaže; pro běžný produkční režim se později rozhodne o dostupném minima počítadel.
5. **Izolace chyb diagnostiky:** překročený limit, poškozený log, nepovolené úložiště nebo vyčerpání paměti nesmí zrušit kótu, poškodit DB, zablokovat Undo ani vyvolat pád. V těchto případech končí nanejvýš diagnostika.
6. **Použití pro opravy:** chyba z telefonu → reprodukovat, přečíst anonymní časový záznam, určit podezřelou fázi, vytvořit věrný regresní RED, opravit a provést PASS na finálním SHA. CI/Chromium/emulátor a skutečný Android vést odděleně.

**Přijímací zkouška M1:** fotografie → vložit/editovat kótu → 100/1000 tahů → Undo/Redo → potvrzené lokální uložení → restart → přesné obnovení. Diagnostika musí umět popsat čas gesta, vykreslení, uložení a obnovy. Testovat i plný disk a falešné potvrzení uložení, plus výpadek samotné diagnostiky. Žádná skutečná data zákazníka.

## 5. Co musí být správně od začátku, ale nemáme to nyní programovat

**M0 datová rozhodnutí:** stabilní identita zakázky/složky/fotografie/anotace/média, přesná hodnota+jednotka odděleně od pixelů, verze dat, vlastnictví originálů, obecný vstup měření, připojitelné dokumentové typy. Nepsat nyní prázdné tabulky 3D, panoramatu, fakturace, licence a cloudové sync.

**M1 první prototyp:** Kotlin + Compose, jeden celý offline pracovní tok foto–kóta–gesto–Undo/Redo–SQLite kandidát pro transakční save/reopen **plus povinná diagnostika**.

**M2+**: galerie, poznámky, ZIP a Bosch; později panorama, další výrobci laserů, pracovní výkaz/faktury, samostatné aplikace/moduly, Windows/iOS a Google Disk záloha/sync vždy až podle konkrétního testu a dalšího rozhodnutí.

## 6. Protokol důkazů

- **FAKT:** `main` SHA `8a36e353448ba74a066e16372441604b7e7163c7`; mapované soubory existují (44 oblastí / 88 zdrojů / 107 testů); uvedená konkrétní volání a diagnostika existují v kódu. [#221](https://github.com/zaplikj30-ui/Zamerovac-android/issues/221) a [#50](https://github.com/zaplikj30-ui/Zamerovac-android/issues/50) dokumentují fyzická hlášení regresí; [PR #232](https://github.com/zaplikj30-ui/Zamerovac-android/pull/232) obsahuje jen RED testy.
- **NOT RUN:** nová Android/Gradle/JUnit/Chromium/Actions/emulátorová ani fyzická zkouška v této dokumentační etapě. Testovací soubor ≠ zelené testy a V1 ≠ fyzicky potvrzený V2.
- **RIZIKO:** nejde o kompletní čtení 88 produkčních souborů ani každého starého issue/PR; u konkrétní implementace je nutná podrobná hluboká SOURCE/SECURITY oponentura, vyhodnocení všech relevantních produkčních vazeb a regresí. Vlastní dokumentační kontrola není nezávislá.
- **STOP:** žádný GO pro merge, sestavení APK, cloudové testy nebo vytvoření produkčního v2 kódu. Nezávislý kontrolor jiný chat až po autorském review tohoto dokumentačního diffu.
