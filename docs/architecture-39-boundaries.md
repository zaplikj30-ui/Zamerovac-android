# Předběžná mapa odpovědností #39 / #42

Stav po etapách 19–28, 5. 11. 2026. Jde o kontrolu vazeb v aktuálním kódu, nikoli dokončený nezávislý audit, fyzické ověření ani povolení dalších funkcí. Načteny také nové pokyny main `45d6ae4` / `ee5c0e1`, aktuální VIZE_A_PLAN a #42. Jejich dokumentaci na main tato větev nepřepisuje. Priorita zůstává dokončení #39; plánované budoucí schopnosti mají být zohledněné, ne nyní implementované.

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
2. **Oficiální Drive API/OAuth:** chybí registrovaná Android OAuth konfigurace a vlastní adaptér. Přístup připojeného Drive konektoru není přihlašovací token uživatele Android aplikace. Nepřebírat jeho účty/tajemství ani předstírat funkční Google integraci. Potřebné jsou malé stránkované API operace, přesné HTTP limity a testy denied/revoked/expired přístupu; žádné runtime klíče v repozitáři.
3. **Finální datový audit:** etapa 28 opravuje nalezený DB fallback vůči inbox/ACK a direct lastAck stavu; její CI ověřit. Dále prověřit obnovu po neúplném lokálním commitu, přílohy po systémovém kill a dočasné soubory. Dosavadní testy nejsou důkazem všech kombinací poruch.
4. **Fyzická akceptace:** LAN/P2P bez routeru i s Wi-Fi, různá zařízení, Keystore/párování/revokace, Doze/OS restart, mobilní pravidla, Bosch, velká média, dvě historie a obnova. Jediná finální APK až po dokončení schválených prací a potřebných kontrolách.

## Dopad plánovaných schopností na návrh

Windows/iPhone/iPad mohou použít dokumentovaný verzovaný wire formát, RFC8785 a golden fixtures. Android rádio/Keystore/discovery jsou adaptéry, nikoli přenosná implementace pro Apple nebo Windows. Tyto aplikace nyní nevznikají.

Budoucí 3D sken je samostatné originální médium s metadaty a verzovanými referencemi; mesh ani mračno bodů se nemá kopírovat do schema:1 records JSON. 2D obrazové souřadnice nejsou 3D metry. Import a renderer mají být samostatné a musí zachovat hodnoty existujících kót; před tím bude nutný konkrétní návrh/migrační testy. JS storeMedia stále používá celý arrayBuffer, proto není vhodný pro velké budoucí modely; proudový nativní import je již oddělený. Žádný 3D modul zde nebyl vytvořen.

Pera/myš, různé režimy ovládání, promítání a tisk mají volat stejná datová pravidla; nemají zavádět paralelní editory či měnit výpočty podle UI režimu. Nelze předem slíbit univerzální rádio/cast/tisk. Žádné SDK, oprávnění pro tyto budoucí funkce ani monetizace nebyly přidány. Současná služba/opravení médií řeší schválenou synchronizaci a bezpečnost.

Strojová mapa [qa/coverage-v1.json](../qa/coverage-v1.json) rozlišuje runtime částečné pokrytí, statické kontroly, manuální brány a otevřené mezery. Ani její validace, ani zelené CI nenahrazují nezávislou revizi a fyzický test.
