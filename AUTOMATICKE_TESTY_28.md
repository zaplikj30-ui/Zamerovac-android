# Praktická automatická kontrola #28 – průběžný stav

Schválené zadání a rozšíření jsou v [issue #28](https://github.com/zaplikj30-ui/Zamerovac-android/issues/28), pokračování ve stejném PR #27 z `50414b5`. Bez APK, změny requestu a merge. Pouze syntetické soubory.

## Skupina 1 – hotovo lokálně, CI ověřit na příslušném commitu

`tools/e2e/drawing.cjs` prakticky vytváří všech 15 kreslicích/kótovacích nástrojů přes nabídku a skutečné pointer tahy/klepnutí: rozměr, čára, šipka, kruh, elipsa, obdélník, plocha, lomená čára, dimenzní a kumulativní řetězec, úhel, volná ruka, směřovat, bodová poznámka a symbol. Nevkládá hotové objekty do JSON.

Každý případ provádí dialogové zadání hodnot/textů, skutečný posun, Undo/Redo, příslušnou úpravu konce/rohu, uložení, zavření, otevření a reload. Kontrolují se přesné desetinné řetězce a jednotky. U plochy také nezávislé vrcholy a výpočet obsahu. U volné ruky/bodové poznámky/symbolu nejsou vymyšlené neexistující délkové vstupy.

Obrysový oracle počítá očekávané body z uložených souřadnic a dokumentované geometrie nezávisle na render/hit-test helperech aplikace. Vyžaduje skutečné žluté pixely s tolerancí antialiasingu; bílé úchopy se nepočítají. Negativní kontrola dočasně potlačí barevné tahy, zachová bílé úchopy a musí odhalit chybějící obrys. Prochází 13 takových negativních kontrol; poznámka a symbol jsou textové, jejich pixely se ověřují samostatně.

První běhy odhalily opožděný autofocus dialogu, který při rychlém přepnutí vstupu mohl přemístit kurzor a spojit úsekové hodnoty v nesprávném poli. `modal` nyní neruší fokus, který už uživatel umístil do dialogu, a ruší starý focus timer. Nemění se uživatelské preference ani význam jednotek. Pomocný `activeSegmentIndex` je stav výběru, nikoliv naměřená geometrie; testy ho odlišují od datových změn.

Sdílený `tools/e2e/harness.cjs` ukládá report s konkrétním krokem/evidencí a screenshot každého úspěšného případu. Při chybě navíc screenshot, konzoli, JS chyby, syntetický model, DOM a Playwright trace. CI vše archivuje jako `practical-e2e-diagnostics`. Lokální diagnostika je v ignorovaném `test-artifacts/`, nesmí se zaměnit za zákaznické podklady.

## Následující skupiny

Praktická workflow a chyby, rychlá gesta, integrita souborů a mapování úplné matice #28 jsou rozpracované. Konkrétní stavy a mezery budou doplněny, nikoliv souhrnně označeny jako kompletně ověřená aplikace. Starší zelené JS/Python/browser/nativní testy se znovu využijí. Skutečný update instalace a Android emulator WebView se pouze připraví bez spuštění, dokud platí zákaz APK. Samsung, S Pen, Bosch, živý cloud a skutečný HW kodek zůstávají samostatné fyzické/integrace kontroly.

## Skupina 2 – praktická workflow a ochrana originálů

Nových šest `tools/e2e/workflows.cjs` případů přes UI: hierarchie/přejmenování/přesun/koš/obnova, long press a kopie s novými ID a zděděným zámkem, textová poznámka/checklist/skica/Undo/příloha, hlavní fotografie + dvě fotografie poznámky + vlastní kóta detailu + galerie + skutečný PNG, zrušení/vysypání koše, fokus/Cancel/vrstvy/hledání. SHA-256 uložených Blobů před/po operacích, kontrola platných vazeb a unikátních ID. Všech šest prošlo lokálně. Posuvnou vlaječku připomínek test skutečně přesune, pokud překrývá kontextové menu; nepoužívá force-click. Browser koš úmyslně odstraňuje pouze záznamy; fyzické mazání a sdílení souborů ověřuje existující `TrashPurgerTest`.

Tři `tools/e2e/interactions.cjs` případy prošly: 1/2/3 klepnutí na oba konce a půlpixelový jitter, skutečný CDP touch start/cancel, pan/wheel/fit a deset reopen cyklů, ukončení řetězce přepnutím nástroje a vložení/odebrání bodu. Při rychlých klepnutích může aplikace správně otevřít editaci; test dialog zavře přes UI a čeká na skutečné pointer události.

`StorageLifecycleTest` navazuje na původní datové testy: opakované izolované obnovy a správné parent/media/detail vazby, přesná dlouhá desetinná hodnota/jednotka/souřadnice, cancel pickerů bez změny dat, 50 paralelních save/export s kontrolou skutečného ZIP a obou originálů, EXIF 90° miniatura včetně barev cache a SHA-256/EXIF/rozměrů originálu. Přidaný sedmý případ kontroluje potvrzená data při pause/stop/resume a nové Activity na API 26; není to OS kill nebo APK update.

**Skutečně nalezené regrese:** duplicitní ID v příchozí záloze vedlo k obnovení dvou položek se stejným ID; neplatné odkazy na média zůstávaly v importovaných datech. Dva testy prokazatelně selhaly před opravou. Import je nyní odmítne před zápisem do media/. Platné starší zálohy a původní importer/exporter zůstávají zachované. Po opravě prošlo 38 nativních testů; sedmý lifecycle případ a finální úplný běh jsou právě ověřované, dosud zde netvrzené jako hotové.

Připravený společný spouštěč, strojový registr, jazykové kontroly a další úrovně jsou rozpracované. Není to tvrzení, že celá aplikace je už automaticky pokrytá. Žádná APK ani emulátor nebyly spuštěny.

## Společná aktualizace #39 – nové praktické a negativní kontroly (5. 11. 2026)

Živý registr nových změn je v [docs/update-39-progress.md](docs/update-39-progress.md) včetně mapy funkcí, chybových cest a omezení; checkpoint přenosového modelu v [docs/sync-v2-checkpoint.md](docs/sync-v2-checkpoint.md). Přidáno `tests/save_acknowledgement.js`, `tools/e2e/update39.cjs`, `SyncSafetyTest` a další skutečné souborové/ZIP testy v `StorageLifecycleTest`. `tests/sync_protocol_v2.js` provádí simulovaný failover s 30 syntetickými soubory, diskovou frontu a dvě modelové historie se 100 společnými originály; nejde o reálnou komunikaci Android/Drive. Rychlé/UI i nativní CI pro `8ac5865` prošly, pozdější SHA musí mít své výsledky. Žádné fyzické ani vydávací ověření se tím nenahrazuje.

## Přímý přenos – etapa 9 #39

Specifikace #38/#33 → PeerSnapshot/Media/Outbox/DataStore/Transfer → `PeerTransferTest`: úplný obousměrný přenos a přesné řetězce kót, poznámka/audio/detail, 30 souborů s přerušením po 19. a restartem outboxu, idempotence, místní změna během přenosu, rozdílné originály stejného ID, EOF/nesprávný hash bez publikace, podvržený source a nebezpečné/duplicitní JSON, kauzálně bezpečné rušení starých pending snapshotů. `SyncCanonicalTest` + `tests/sync_canonical.js` ověřují společné JCS bajty/hash/job ID a neplatné Unicode. Native výsledek je nutné ověřit na konkrétním novém CI SHA; místní Node/Python prošly. Fyzické rádio/Keystore/UI/Drive dosud neprovedeno. Přenos aplikace ještě neaktivuje.

## Android přímé propojení – etapa 10

Specifikace #38/#34/#33 → PeerCoordinator/PeerDiscovery/PeerWifiDirect/MainActivity a peer-sync.js → `PeerDiscoveryTest` (privátní/link-local/ULA proti internet/loopback/multicast/wildcard, žádná fiktivní zařízení bez permission), rozšířený PeerTransferTest (novější změny za dřívějším ACK), `tools/e2e/peer-sync.cjs` (menu/settings/browser, explicitní potvrzení i negativní/Zpět, celý kód/nová relace, cizí HTML jméno, pending/chyba/nezměněná data/oddělená cloud ikona). UI tři scénáře prošly místně; nativní výsledek nové etapy teprve Actions. Praktické radio, permission dialog Androidu a Keystore neověřeny; platí foreground/P2P reconnect omezení v docs/update-39-progress.md. Etapa 9 nativní i quick/UI CI již SUCCESS.

## Historické zálohy a obnova – etapa 11

#40/#33 → BackupHistory/BackupStore/DocumentBackupStore/BackupNetwork a BackupImporter → `BackupHistoryTest`, `DocumentBackupStoreTest`. Pozitivní: 2 instalace/100 originálů, dedup, nová verze jediného média a skutečná obnova starších i nových bajtů, přesné hodnoty/geometrie, audio/detail/historie, místní editace při pomalé obnově. Negativní: write denied/plný storage, null/denied/duplicitní provider, poškozený či chybějící blok, traversal a zakázaný namespace, nedokončený DB commit/rollback, metered bez a s výjimkou. `tools/e2e/backup-history.cjs` prošel místně: skutečné menu a panel, dvě historie, cizí HTML jako text, Cancel/Confirm obnovy, výjimka pro mobilní přenos a chyba bez změny dat. Nové native výsledky teprve Actions; adaptér testuje filesystem/mock ContentResolver, nikoli reálný Disk. Fyzický účet/provider a jeho trvalost zůstávají otevřené. Původní statická pojistka importeru nyní odkazuje na obecné rekurzivní rewriteAll místo zrušeného užšího rewriteItems, ostatní původní ochrany zachovány.

## Konzistence konfliktů a prohlížení – etapa 12

#33/#38/#12/#13 → SyncConflicts + nativní bridge, applySavedState a editor/history/detail lifecycle → Java/JS sdílená fixture, `tests/sync_conflict_bridge.js`, SyncCanonicalTest/SyncSafetyTest a `tools/e2e/read-only-sync.cjs`. Pozitivní: stejný copy ID/obsah a přesná vlastní draft revize, první skutečná historie/geometrie/naměřená hodnota. Negativní: odmítnutý bridge, duplicitní/opakované sloučení, vysypaná konfliktní kopie, legacy purge source a otevření/načtení/detail/reopen bez jakékoli změny dat. Zaznamenat CI daného SHA; žádný HW/rádio/Bosch závěr.

## Podepsaná cloudová synchronizace – etapa 13

#33/#38 → SafSyncV2/CloudProof/CloudFiles/DocumentSyncStore + registry certifikátu po PeerHandshake → SafSyncV2Test. Pozitivní: standardní ECDSA, nativní úplný obousměrný merge a přílohy, immutable retry/restart, malá přesná změna na měřené síti bez opakovaného čtení velkého originálu. Negativní: podvržený ACK nesmí vyprázdnit frontu, odebraná důvěra/změněný podpis/druh, neúplný 19. media upload a žádný předčasný DB commit, velký chybějící soubor na metered čeká. Chromium peer-sync navíc kontroluje stav waiting a izolaci direct/cloud. Nové CI SHA ověřit; adaptér testů je skutečný lokální filesystem, nikoli Drive. Fyzické a provider cancellation/index/metered režie limity jsou přesně v docs/cloud-sync-v2.md.

## Studené náhledy fotografií – etapa 14

#21/#33 → PhotoThumbnails/MainActivity → PhotoThumbnailsTest (pomalý decoder a současný potvrzený save bez globálního locku; purge během decode bez pozdní cache; skutečné zrcadlené pixely/cache reuse/bajty originálu; invalid image a cache write failure). Původní EXIF otočený obrázek v StorageLifecycleTest zůstává. Python místně prošel, nový Native Graphics výsledek vyžaduje CI. Studený start editoru velké fotografie a fyzické různé telefony není tímto benchmarkován.

## Poskytovatel ignorující timeout – etapa 15

#33/#38/#40 → ProviderIo a oba Document adaptéry → ProviderIoTest: skutečné čekající read/write/close ignorují interrupt, volající se vrátí po deadline, další worker funguje, původní caller buffer je chráněný, stream po selhání nepokračuje a opožděný resource se zavře právě jednou. Úspěšné byte/offset/EOF/close kontrakty zůstávají. DocumentBackupStoreTest dál ověřuje null/denied/duplicitní provider, nyní veřejnou query s CancellationSignal. Výsledek nového nativního CI teprve ověřit; skutečný Google provider/Binder a fyzické timeouty nejsou testovány.

## Durable cloud inbox – etapa 16

#33/#38 → CloudInbox/SafSyncV2/SyncStore.namespace → CloudInboxTest + nový SafSyncV2Test. Pozitivní: skutečný DB commit, ztracená publikace ACK, restart, nové podepsané ACK a nulové opakované čtení starých incoming zpráv; druhá instance uvidí potvrzený zápis. Negativní: jiná instalace/úložiště není důkazem lokálního commitu, odmítnutý AtomicFile zápis nemůže změnit ack cache, bez uloženého commitu nebo při změně hash/size nelze potvrdit. Nativní výsledek nové etapy teprve Actions. Zbývající control-frame/list režie a opakované source ověřování popsány v docs/update-39-progress.md.
