# Praktická automatická kontrola #28 – průběžný stav

**Aktuální mapa:** [qa/coverage-v1.json](qa/coverage-v1.json), 34 funkčních oblastí, soubory implementace/testů, pozitivní i negativní kritéria a explicitní mezery. `node tools/qa/audit.cjs` kontroluje platnost mapy/odkazů v rychlém CI; samotná validace žádný uvedený test nespouští a neověřuje zařízení. Jednotlivé historické checkpointy níže zůstávají odlišené od současného stavu.

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

## Synchronizace během skutečné editace – etapa 17

#33/#38/#12/#13 → sync-edit-guard, applySavedState a commitEditor dočasného detailu → `tools/e2e/sync-edit-guard.cjs`. Tři pozitivní/negativní scénáře s modelovým Native diskovým CAS: příchozí data během reálného pointer tahu a vyplňování přesného rozměru, vynucený conflict s přesunem vlastní editace do kopie, přesné finální souřadnicové delta i hodnoty; úprava detailu, parent konflikt a další tah se stále stejnými živými položkami, zachované obě verze a reopen. Místně prošly; CI nového SHA a fyzický Android callback ještě ověřit. Samostatná stavová zpráva nenahrazuje pending data. Produkční Java merge/sign/TLS nejsou v tomto UI testu fingovaně vydávané za dvě zařízení.

## Poznámky/checklist/přílohy/skica – etapa 18

#33/#38 → noteChanged/renderChecks/renderNoteAttachments/saveNote, readonly sketch init a active arrays → `tools/e2e/note-sync.cjs` (4 UI případy). Pozitivní: reálné checklist/file input IDB přílohy s kauzální revizí a reloadovatelným stavem; readonly note/sketch bez změny; callback během poznámky bez zbytečné kopie; Native CAS během skutečného tahu skici zachová koncové body i cizí verzi. Negativní: disk full zachová formulář/draft a retry; locked checklist/remove jsou disabled; modal OK focus nesmí umožnit příchozí přepsání rozpracovaného rozměru. Místně prošly, nové CI ověřit. Native fixture je výslovně modelovaná; Java/přenosy mají samostatné nativní integrační testy.

## WebView / cizí webový obsah – etapa 19

#33 → WebContentPolicy/MainActivity WebViewClient/WebChromeClient a applySavedState → `WebContentPolicyTest`, `tools/e2e/web-content-policy.cjs`, `tests/sync_conflict_bridge.js`. Pozitivní: zabalený HTTPS index, skutečné kreslení a přesná hodnota pod produkční CSP, uživatelský odkaz otevře systémový intent bez Native v popupu. Negativní: cizí origin/port/credentials/scheme, subframe/srcdoc, inline/event/script-příloha nesmí číst bridge či měnit data; MIME nosniff a žádný síťový fallback; __proto__ nesmí změnit prototyp. Browser + Node místně prošly, native compile/testy nové etapy teprve CI; fyzické Android WebView a nezávislý audit neprovedeny.

## Wi-Fi Direct reconnect a očekávaný peer – etapa 20

#33/#38 → PeerWifiDirect/SyncPeerRegistry/PeerCoordinator/PeerHandshake → `PeerWifiDirectTest` (6 případů) + nový skutečný TLS případ v `PeerTlsTest`. Pozitivní: známý peer, obnova skupiny/kanálu, atomicky uložená cesta po ověření, očekávané TLS UUID. Negativní: cizí adresa/pin/UUID, chybějící permission, vypnutá automatika, revokace, busy rádio/minutové retry, opožděné group/peer callbacky a close; žádné mazání Android skupiny ani MAC/certifikát v UI. Nové native CI ověřit; rádio je v adapter testu mock, TLS jsou skutečné sockety, fyzické Samsung/Xiaomi/Lenovo a pozadí nejsou provedené.

## Služba pozadí, návrat UI a napájení – etapa 21

#33/#38 → DirectSyncService/PeerRuntime/TransferPower + MainActivity observer/resume → `DirectSyncServiceTest` (6 native případů) a rozšířený browser `peer-sync.cjs`. Pozitivní: connectedDevice foreground/oznámení, jediný koordinátor, stop obrazovky zachová relaci, čerstvá DB na resume, explicitní notification STOP zachová DB/durable frontu, UI observer není ACK. Negativní: disabled/denied služba nesmí připojit ani hlásit úspěch, rozbité/odpojené UI, background párování se zruší, lock se pustí a po close neobnoví; UI poctivě popíše omezení Androidu. Native vyžaduje novou CI; lifecycle má mock koordinátor, skutečný TLS/datový přenos je samostatný. Doze/force-stop/restart/rádio různých značek a instalace fyzicky neprovedeny.

## Staging hlasu/importu a vlastník poznámky – etapa 22

#33/#38 → AudioCapture/MediaStaging/Native upload + JS voice/rich persist → AudioCaptureTest (5), rozšířen StorageLifecycleTest (audio, URI partial/success/collision, upload metadata failure/input), `note-sync.cjs` nově 6 UI scénářů. Pozitivní: potvrzený kompletní hlas/metadata, save u původního vlastníka, DB zápis během pomalého recorder startu, URI a WebView upload roundtrip. Negativní: start/stop/empty/cancel/disk/metadata chyby, dřívější i souběžný originál zůstane, neplatné MIME/control/Unicode, rich OK/Back neschová neuložený draft, cancel nahrávání nepublikuje. Browser úspěšný, nové native CI ověřit. Recorder je řízený test double; fyzický mikrofon/uspání a odezva URI provideru nejsou ověřeny.

## Asynchronní URI ingest, původní cíl a request token – etapa 23

#21/#33/#38 → MediaIngest/MainActivity bounded worker + pickMedia/acceptPickedMedia → MediaIngestTest (3 native) a `media-import.cjs` (3 skutečné browser UI). Pozitivní: UI Handler a potvrzený save při blokovaném inputu, finální originální bajty a request token, původní složka po navigaci. Negativní: timeout/cancel/unsafe URI/metadata, purge během importu, stale callback/done, druhý výběr, deleted/locked cíl a zavřený modal, disk failure zachová draft/retry. Browser místně prošel, native vyžaduje novou CI. Skutečný provider/velká souborová dávka na fyzickém Androidu dosud neprovedeny.

## Cloudové řídicí dávky a restart procházení – etapa 24

#33/#38 → CloudFiles/CloudScan/SafSyncV2 → CloudFilesReadTest (4), CloudScanTest (2), SafSyncV2Test +2 integrační případy. Pozitivní: přesné bajty/hash/EOF, trvalý kruhový cursor mezi instalacemi/store/scope a priority nedokončeného ACK, skutečná podepsaná revize/media/kóta po 80 neplatných zprávách a restartech. Negativní: limit+1/zero-progress/interrupt, failed AtomicFile write, unsafe cursor, zakázaná síť nesmí ani list/open/create, podvržené zprávy nemohou vymazat frontu. Nové native CI vyžaduje ověření; provider je souborový/test double, skutečný Drive/SAF přenos ani hard síťová spotřeba nejsou testovány.

## Přepnutí cesty/sítě při přenosu a rušení jobů – etapa 25

#33/#38 → GuardedSyncStore/SafSyncV2/PeerCoordinator intent priority/SyncJob → GuardedSyncStoreTest, SyncJobTest (3), SafSyncV2Test (+2). Pozitivní: po dalším dostupném pokusu skutečné originální bajty a potvrzený outbox, success/failure Job retry. Negativní: po prvním 64KiB bloku přijde ověřená direct priorita nebo ztráta unmetered oprávnění → další write se neprovede, DB/fronta nejsou falešně potvrzené; zrušený starý worker ani přes ignorované interrupt nesmaže novou relaci či nezavolá jobFinished; close se vždy povolí. Nové native CI ověřit; síťová změna je řízený policy callback, nejde o fyzický Wi-Fi/cellular handover.

## Strojová mapa a rozhraní pro navázání – etapa 26 (QA/dokumentace)

34 oblastí v qa/coverage-v1.json mapuje současné funkce na skutečné existující testy, pozitivní/negativní kritéria a jejich limity. Feedback je výslovně static-only; ostatní runtime-partial, nikoli kompletní pokrytí všech tlačítek a poruch. Sedm manuálních bran má stav not-run/blocked/pending; oficiální Drive, source publication repair, hard provider budget a low-memory/fallback audit jsou otevřené mezery. Audit CLI v rychlém CI ověřuje soubory/ID/vrstvy a brání mylnému fullApplicationVerified; místní negativní fixture s chybějícím testem byla skutečně odmítnuta. Není to další důkaz fyzického fungování aplikace.

Předběžné rozhraní/moduly/vazby a pořadí další práce v docs/architecture-39-boundaries.md, načteny nejnovější main pravidla a #42. Žádné nové uživatelské funkce ani změny UI/chování aplikace; proto etapa nemění nápovědu/historii vydání. Obě CI posledního funkčního checkpointu 29083a8 SUCCESS (42066214116/42066213565).

## Cloud publication cache a repair – etapa 27

#33/#38 → CloudPublications/CloudProof.NEED/SafSyncV2 → CloudPublicationsTest (3) + SafSyncV2Test (+6). Pozitivní: verified receipts survive restart, pending source nečte velký originál znovu, odstraněný/stejně velký corrupt blob a chybějící snapshot se bezpečně obnoví. Negativní: failed receipt write/foreign scope/expired clock, forged/unreferenced/replayed NEED nesmí číst libovolná data ani uzavřít outbox, velká oprava na metered počká. Ověřují skutečný disk/sign/DB a přesnou kótu/media; native CI nové etapy teprve ověřit, skutečný Drive provider neproveden.
