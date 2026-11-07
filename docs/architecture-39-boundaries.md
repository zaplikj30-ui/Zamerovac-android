# Předběžná mapa odpovědností #39 / #42

Stav po etapách19–39, navázání6.11.2026. Jde o kontrolu vazeb v aktuálním kódu, nikoli dokončený nezávislý audit, fyzické ověření ani povolení dalších funkcí. Načteny také nové pokyny main `45d6ae4` / `ee5c0e1`, aktuální VIZE_A_PLAN a #42. Jejich dokumentaci na main tato větev nepřepisuje. Priorita zůstává dokončení #39; plánované budoucí schopnosti mají být zohledněné, ne nyní implementované.

| Odpovědnost | Současná hranice | Kombinované důkazy a zbývající vazba |
| --- | --- | --- |
| Přesné hodnoty a geometrie | editor.js pracuje v obrazových souřadnicích, textové hodnoty/jednotky zůstávají samostatné; commitEditor používá potvrzovaný writer | drawing/interactions: skutečné tahy, hodnoty, Undo/Redo a reopen; fyzická pera a některé kombinace magnetů ještě chybí |
| Stav / zápis | LocalDatabase, CausalClock, SyncConflicts, app.js CAS a sync-edit-guard | Native souběhy a živý UI tah/formulář/detail/skica; app.js stále obsahuje sdílený globální stav, nesmí se plošně přepojit během #39 |
| Dlouhý provider import | MediaIngest + MediaStaging a bounded worker; MainActivity drží Android picker/request token | Čekající input + živý UI/save, stale token/cíl, disk failure, camera cancel; zatím bez fyzické velké dávky |
| Hlas | AudioCapture odděluje recorder od DB locku; MediaStaging potvrzuje soubor/metadatový commit | Stop/kolize/failed metadata + původní poznámka a failed modal; fyzický mikrofon/OS omezení ještě chybí |
| Přímý transport | PeerDiscovery/PeerWifiDirect → PeerCoordinator → PeerHandshake/TLS → PeerTransfer/PeerDataStore | Skutečné JVM sockets/30 souborů/restart a mock rádia; Android Keystore/radio vyžadují zařízení |
| Životní cyklus přenosu | PeerRuntime vlastní koordinátor, DirectSyncService foreground provoz, Activity pouze UI observer | Stop/resume/denied/notification STOP a fresh disk; Doze/force-stop/OEM a případný OS restart neověřeny |
| Cloud | SyncStore/GuardedSyncStore + podepsané zprávy, CloudInbox/CloudScan a společný PeerDataStore | Částečný soubor/forged ACK/network change/direct priority/cancel; SAF není oficiální Drive API a jeho provoz není přesně měřený |
| Historie záloh | Samostatný BackupStore/BackupHistory, žádné delete/replace rozhraní dostupné synchronizaci | Dvě historie/100 originálů/dedup/obnova/rollback; skutečný Google provider dosud neověřen |
| Webový obsah | WebContentPolicy a vlastní zabalený index; cizí odkazy do systémového prohlížeče | Skutečná produkční CSP v Chromiu + MainActivity client/popup test; celá JsApi stále vyžaduje finální audit |
| Export | CustomerPdfExport/RasterPdfWriter a samostatný editovatelný ZIP/import | Nativní obsah, externí PDF parser/render, UI originál/hash; fyzický picker/tisk/aktualizace chybí |
| Bluetooth | BoschBleProtocol/BoschClassicReader a stávající GATT logika; hodnoty přebírá editor | Modelové hodnoty/historie, protokol nebyl kvůli sync přepisován; konkrétní laser musí být fyzicky ověřen |

## Priorita zbývajících konkrétních zásahů

1. **Publication receipts a bezpečný repair:** etapa 27 je implementuje s podepsaným NEED, expirací a kontrolou konkrétního manifestu; má obě CI SUCCESS v 82eef6d, další revize zůstává. Před touto etapou source opakovaně četl již ověřené cloudové originály. Samotné trvalé „odesláno“ je nebezpečné při odstranění/poškození vzdáleného souboru. Řešení musí oddělit ověřenou publikaci od finálního ACK příjemce a mít autentizovanou opravu nebo jinou ověřitelnou invalidaci. Před kódem ověřit retry/restart, chybějící remote blob, souběžný direct/cloud, nový zdrojový obsah a metered pravidla.
2. **Oficiální Drive API/OAuth:** Android registrace je podle #39/6672377880 potvrzená, přesné výsledné ID zamerovac-android je potvrzené a zapojené do preview, živý účet neověřený; adaptér je již zapojený. Etapa 29 má ověřený DriveHttp/DriveApi REST základ, etapa 30 přidává capability adaptéry, explicitní publish po verified staging a datové integrační testy. Etapa 31 doplňuje samostatný AuthorizationClient a atomic account binding, etapa 32 zapojuje picker/consent/UI/Job přes CloudStorage. Google registrace je potvrzená Console obrazovkami; potvrzené ID zamerovac-android je aktivované pro preview a živý účet se sleduje samostatně. Etapa33 řeší nový namespace po globálním ACK a kauzálně obsolete partial intent. Etapy34/35 dokončily frekvenci a po-TLS route arbitráž a mají obě CI SUCCESS. Přístup připojeného Drive konektoru není přihlašovací token uživatele Android aplikace. Nepřebírat jeho účty/tajemství ani předstírat funkční Google integraci. Potřebné jsou malé stránkované API operace, přesné HTTP limity a testy denied/revoked/expired přístupu; žádné runtime klíče v repozitáři.
3. **Finální datový audit:** etapa 28 opravuje nalezený DB fallback vůči inbox/ACK a direct lastAck stavu; má obě CI SUCCESS v 4b87a45. Dále prověřit obnovu po neúplném lokálním commitu, přílohy po systémovém kill a dočasné soubory. Dosavadní testy nejsou důkazem všech kombinací poruch.
4. **Fyzická akceptace:** LAN/P2P bez routeru i s Wi-Fi, různá zařízení, Keystore/párování/revokace, Doze/OS restart, mobilní pravidla, Bosch, velká média, dvě historie a obnova. Jediná finální APK až po dokončení schválených prací a potřebných kontrolách.

## Dopad plánovaných schopností na návrh

Windows/iPhone/iPad mohou použít dokumentovaný verzovaný wire formát, RFC8785 a golden fixtures. Android rádio/Keystore/discovery jsou adaptéry, nikoli přenosná implementace pro Apple nebo Windows. Tyto aplikace nyní nevznikají.

Budoucí 3D sken je samostatné originální médium s metadaty a verzovanými referencemi; mesh ani mračno bodů se nemá kopírovat do schema:1 records JSON. 2D obrazové souřadnice nejsou 3D metry. Import a renderer mají být samostatné a musí zachovat hodnoty existujících kót; před tím bude nutný konkrétní návrh/migrační testy. JS storeMedia stále používá celý arrayBuffer, proto není vhodný pro velké budoucí modely; proudový nativní import je již oddělený. Žádný 3D modul zde nebyl vytvořen.

Pera/myš, různé režimy ovládání, promítání a tisk mají volat stejná datová pravidla; nemají zavádět paralelní editory či měnit výpočty podle UI režimu. Nelze předem slíbit univerzální rádio/cast/tisk. Žádné SDK, oprávnění pro tyto budoucí funkce ani monetizace nebyly přidány. Současná služba/opravení médií řeší schválenou synchronizaci a bezpečnost.

Strojová mapa [qa/coverage-v1.json](../qa/coverage-v1.json) rozlišuje runtime částečné pokrytí, statické kontroly, manuální brány a otevřené mezery. Ani její validace, ani zelené CI nenahrazují nezávislou revizi a fyzický test.

Etapa34: SyncCadence vlastní potvrzenou lokální konfiguraci a společný durable fg/job attempt gate; sync-cadence.js vlastní volbu četnosti. MainActivity pouze přijímá ACK konfigurace a nastaví Android plánování; incoming TLS zůstává pod dosavadní autorizací. Nepřidává se plošný refaktoring ani další režim.

Etapa35: PeerSessions vlastní pouze po-TLS route admission/tie-break a conditional cleanup. PeerWifiDirect dodá ověřitelnou lokální group interface informaci, nikoli důvěru. Cloud předává read checkpoint do existujících datových/media modulů; krátký commit je oddělen od velkého hash I/O. Nejde o plošný přesun Android lifecycle ani editoru.

Etapa36: omezená finální kontrola vlastní implementace je v [update-39-final-review.md](update-39-final-review.md); není nezávislý audit. Jeden zjištěný startup key race řeší synchronizovaný existující identity loader, nikoli plošný přesun TLS/Activity. Diskové residue testy neprohlašují fyzický process-kill.

Etapa37: BackupBlobs vlastní jen adresování/výběr ověřené immutable repair kopie; BackupHistory drží integritu/publikaci/restore a BackupStore stále nemá delete/replace. Sdílený CorruptBlob odděluje ověřenou integritní chybu od síťové/provider chyby. Manifestový obsah se nemění.

Etapa38: veřejnou preview registraci/parsing/signing/override hranici vlastní malý Gradle modul, runtime gate má jednotnou kontrolu ID pro SDK/UI/factory. Account flow ani datový/sync protokol se nepřepisují. Nové kontroly nemění triggers APK workflow. Připravené auditní zadání je v [audit-39-handoff.md](audit-39-handoff.md).

Etapa39: aktivace potvrzeného veřejného ID nepřidává další účetní/datovou vrstvu. Stávající preview-only build hranice a společná továrna/UI používají stejnou konfiguraci; signing/package pin a default disabled ostatních variant zůstávají.


## Etapa B1 po #39 – renderer (7. 11. 2026, PR #51)

Galerie, detaily a exporty nyní předávají vlastní renderovací kontext; editor má výchozí adaptér. Vykreslení nepřepíná živý dokument/pohled/výběr, přesné body zůstávají v obrazových souřadnicích a popisky/tahy ve výstupních pixelech. Změna `343c172` nemění perzistenci, sync ani schéma. Není zaveden nový příkazový model či přepsán celý editor. [Implementace, FAIL/PASS, omezení a další hranice médií](qa-professional-20261107.md#etapa-b1--pokračování-galerie-v-pr-51-7-11-2026). #52 je koordinovaně převzat, #49 stále samostatný; N4 zůstává povinný FAIL.

## Etapa B2 – geometrie bez editorových globálů (rozpracovaná větev z B1, 7. 11. 2026)

Nový `annotation-geometry.js` obsahuje čisté výpočty převodu screen/world, hranic obrázku,
čtyřúhelníků, kruhu/elipsy, kumulativních úseček a plochy ze známých stran/úhlopříčky.
`editor.js` zachovává původní veřejné názvy jako tenké adaptéry na tento modul, tedy
nezmění výchozí gesta, renderovací kontext B1 ani uložené `schema:1`. Číselné hodnoty,
jednotky a souřadnice nejsou zaokrouhlovány; originály médií ani synchronizace se nemění.
Modul se načítá před `editor.js`. Existující VM interakční testy používají stejné API
v izolovaném kontextu; nový `tests/annotation_geometry_contract.js` hlídá kontrakt
samostatného výpočtu, neporušené hodnoty a nezávislost na Androidu.

**Integrace / důkazy:** lokální syntaktické a deterministické srovnání starých a vytažených
funkcí ještě není náhradou všech regresních Node/Python/Playwright/JVM/Android testů.
N4 a Android System UI ANR z B1 tím nejsou vyřešeny. Větev vzniká přímo z
`ac23d1a`, původní PR #51 se nemění; žádný merge, nový PR, automatický Actions
běh ani APK pouze kvůli této etapě.

## Etapa B3 – bezstavové vyhledávání úchopů (navazuje na B2, 7. 11. 2026)

Z `editor.js` byla izolována původní geometrie `nearestHandle` do čistého
`AnnotationGeometry.nearestHandle(point,items,transform,onlyItem)`.
Editor zachovává původní kompatibilní signaturu; funkce dostává konkrétní seznam
objektů a transformaci namísto čtení živého `current` a `view`.
Nemění se 31px prahová vzdálenost, podíl krajního úchopu 0,27,
pořadí kandidátů, reference na editovatelný objekt ani uložené hodnoty.
Kontrola přímého porovnání původní/nové funkce nad 15200 případy
proběhla v dostupném izolovaném V8. Samostatný regresní test je
`tests/annotation_grip_geometry.js`; úplné Node, Chromium a Android testy
ještě nebyly znovu spuštěny, N4 zůstává známý FAIL. Samostatná navazující
větev z B2 bez PR a Actions; původní Codex B1 ani B2 se nemění.

## Etapa B4 – geometrie výběru objektů bez živého stavu editoru (7. 11. 2026)

`nearestItem` a `segmentLineScreen` pracují nyní v `annotation-geometry.js` se zadaným
seznamem objektů a transformací. Editor si uchoval stejné API; pouze měření skutečné
šířky popisku poskytuje callback `captionHit`. Původní pořadí výběru, 26px tolerance,
odsazení kót, dotyky kruhů/ploch/úseček a přesná data jsou zachovány.
Porovnání původní a nové funkce před zápisem: 44000 deterministických PASS.
Cílený test `tests/annotation_hit_geometry.js` PASS v izolovaném V8.
Plná Node.js/Chromium/Android regrese stále NOT RUN, N4 známé FAIL.
Bez merge/PR/Actions, změna pouze v samostatné následné větvi po B3.

## Etapa B5 – oddělené rozhodování o úseku a úchopu (7. 11. 2026)

Rozpoznání aktivního úseku pro laser je nyní v čistém `AnnotationGeometry.nearestEditableSegment`;
priorita dotykového výběru v `AnnotationSelection.dragHandle`. Editor zůstává vlastníkem
přesunů, checkpointu, Undo/Redo a zápisu. Zachovány přesné hodnoty, výběr koncového
bodu a středu, priorita popisků, přiřazení hran obdélníku i původní schema a sync.
Navazuje přímo na B4; cílená regrese `tests/annotation_selection_contract.js`.
Plná Android/Chromium/JVM integrace zatím neproběhla, N4 je nadále známý FAIL.
Bez nového PR, merge, Actions a APK.

## Etapa B9 – čisté magnetické přichytávání (7. 11. 2026)

Zbylý výpočet `snap` pro body, mřížku a vodorovné/svislé zarovnání byl vyjmut
z `editor.js` do čistého `AnnotationGeometry.snapPoint`. Editor zůstává
vlastníkem stavů `prefs`, `view`, `photoSize`, `current.items` a gest;
předává je pouze jako explicitní argumenty. Zachováno pořadí mřížka → cizí
body → osy, práh 12/zoom, oddělený gridDistance, tolerance, ochrana
vlastních bodů (`ignore.item` podle reference), omezení na fotografie
a možnost odtrhnout bod mimo přichytávací zónu. Žádný datový či sync protokol
ani ukládané kóty se nemění. `index.html` se nemění: geometrie se již načítá
před editorem. Regresní test `tests/annotation_snap_contract.js` drží
nezávislou kopii původní implementace a 42 000 deterministických porovnání
včetně kontroly neměnnosti originálních dat. Zatím pouze samostatná
navazující větev z kontrolního PR #57; bez merge a bez samostatné APK.

## Etapa B10 – čisté přizpůsobení a přiblížení (7. 11. 2026)

Výpočty `fitImage` a `zoomAt` byly odděleny jako
`AnnotationGeometry.fittedViewport` a `AnnotationGeometry.zoomedViewport`.
Vrací jen `zoom/dx/dy` bez přístupu k DOM/Androidu či živému objektu.
Editor výsledky přiřazuje do původního `view` a volá stávající `paint`.
Zachován okraj 24 px, minimální a maximální zoom 0,05–12, bod pod
prstem, nulové rozměry plátna, Undo/Redo a uložené přesné hodnoty.
`tests/annotation_viewport_contract.js` obsahuje nezávislý původní
algoritmus a 42 000 deterministických porovnání včetně kontroly
neměnnosti souřadnic a transformace. Připravena společná regresní
brána B9+B10, žádná samostatná APK ani změna technologie.
