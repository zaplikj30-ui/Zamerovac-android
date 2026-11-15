# Schválená bezpečnostní oprava následků ACK #88

Výchozí HEAD `926145452564baf4e52f817de90077eba6f292d4`, base/main `cf7807905f77f6fd8478c137b1b41aca6ebc3275`. [Výslovné schválení vlastníka v #42](https://github.com/zaplikj30-ui/Zamerovac-android/issues/42#issuecomment-6837252374), [nezávislé ACCEPT DESIGN Kontrolora 40](https://github.com/zaplikj30-ui/Zamerovac-android/pull/116#pullrequestreview-5882418408). Práce pouze ve vlastní větvi draft PR #116. Aktuální výsledný HEAD, vlastní skutečné testy a úplné logy jsou v PR a checkpointu #42. INTEGRATION/RELEASE HOLD trvá do nezávislé revize a následně povolené QA.

## Skutečně změněný kontrakt

Podepsaný v2 ACK znamená **historický transportní doklad**. Smí utlumit aktivní upload, nikoli zrušit obnovitelný záměr, uvolnit P1 pin nebo tvrdit dnešní zdraví DB příjemce. Původní providerový závod je dále reprodukovatelný; jeho důsledky řeší trvalý záměr a ověření při přímém autentizovaném spojení.

`SyncLedger` používá stávající tabulky `targets/deliveries/revisions/revision_media` a hashované `documents`. Beze změny SQLite schématu ukládá malý stavově nezávislý doklad `intent:<target>:<revision>`: původní sourceRef, velikost, recovery epochu zdroje, SHA manifestu a binding cíle (provider, namespace/account/SAF scope SHA, peer, fingerprint, pairedAt, receiver recovery epoch). Neměnné snapshot bytes a úplný mediální manifest jsou v již existujících SQL řádcích. Nejde o druhý retenční systém; pouze `ProtectedRevisions` nadále rozhoduje o ochraně přesných preimages a původních médií.

`PeerOutbox.completed` nejprve ověří původní source bytes, jejich SQL kopii/manifest, aktuální autoritu a cílový binding, zachová P1 a neměnný soubor. Zápis transportního dokladu a odstranění **aktivních** metadata/blob jobs proběhnou **v jedné SQLite transakci**. Pád/ENOSPC znamená buď původní aktivní frontu, nebo durable záměr s receipt; nikdy ztrátu obou. Přesný duplikát je idempotentní, nesprávné ID/size/hash/target/pairing/epoch neprojde. Metadata ACK přes starší interní `acknowledge` míří do stejné transakční cesty.

`cleanup` ponechá všechny sourceRef odkazované SQL delivery záměry, i po ACK a explicitním odebrání aktivního párování. Žádné nové GC, odpinování nebo mazání poslední kopie. Pro předchozí variantu B, která už smazala redundantní outbox soubor po ACK, je dostupná nezávisle hashově ověřená SQL kopie stejného snapshotu. Tato výjimka platí pouze pro původní stav `transport-ack`, bez aktivního či quarantined odkazu na sourceRef a bez nejasné `.bak/.new` evidence. U aktivní fronty i nového receipt se nedostupný sourceRef nesmí automaticky nahradit SQL kopií; SQL bytes zůstávají důkazem pro prověření, ne novým oprávněním k ACK. Přítomný poškozený soubor se **nepřepisuje** ani nemaskuje fallbackem. Chybějící logický source, změněná SQL data/manifest nebo binding skončí chybou; evidence se neresetuje.

`pending` je aktivní práce; `activeProjects` pouze aktivní pracovní metadata. `pendingProjects` navíc počítá současné neověřené pracovní receipt záměry. V2 `lastAck/lastSuccess` zůstává historická kompatibilní informace, nikoli rozhodovací autorita. Historie po restartu postupuje podle per-target SQL receipt i při chybě zápisu globálního peer timestampu po SQL commit.

## Ověření přes existující autentizované TLS spojení

Nepřidává se cloudový challenge/response, server, nová knihovna, nový přenosový frame, byte-resume ani obecný synchronizační protokol. Ve stávajícím v2 `hello` je pouze volitelná schopnost `inventoryVersion:1`. Ve stávajícím `batch` se po vyjednání přidá `inventory:[hash...]` s nejvýše dvěma právě připravenými pracovními/recovery snímky. Je to úzké aditivní označení existujících snapshotů, ne změna jejich obsahu nebo způsobu přenosu. Starý parser pole ignoruje; klient bez schopnosti zůstává plně kompatibilní pro přenos, ale jeho ACK nikdy nevytvoří inventární checkpoint.

Při spojení se pro inventář znovu zachytí skutečné bajty současných médií, nikoli jen cache předchozího manifestu, a připraví se současná metadata a existující přenos `need/blob/commit/ack` ověří potřebná média. Již správné soubory se podle skutečného SHA znovu nestreamují. Není zavedeno nové periodické background přehashování; kontrola odpovídá konkrétnímu autentizovanému přenosu. Recovery obsah v3 bez podpory dále čeká.

`PeerDataStore.applyInventory` může vytvořit typovaný `VerifiedInventory` až po skutečném ověření SHA všech relevantních souborů, normálním bezpečném apply a durable zápisu. Samotný manifest nebo hash z databáze takový doklad nevytvoří. Doklad má samostatnou kopii metadat a ověřuje jejich neměnnost. Mezi apply a reconciliation se mediální kontrola může opřít o stejné inode a jemné unix ctime; při chybějící podpoře se konkrétní potřebný soubor znovu hashuje. Nepoužívá se size/mtime jako náhrada integrity ani trvalá hash cache pro přenosy.

`PeerOutbox.reconcile` přijme pouze tyto ověřené doklady, vybraný současný inventář v autentizovaném batch a shodnou recovery epochu. Současně zkontroluje pairing/fingerprint a binding dříve uloženého receipt. Pro pracovní revizi posoudí **kauzální pokrytí**, ne jen rovnost hashů: novější receiver revize může pokrývat starší odeslanou. Pro obnovitelné podklady ověří zahrnutí přesných historických revizí. Potřebná média musí mít stejné ID, SHA a velikost v právě ověřeném pracovním/recovery inventáři. Konflikt, chybějící soubor, jiná epocha nebo pozdější změna dokladu nepovolí checkpoint. TLS nevyrábí transportní receipt v jiném účtu/složce: může pouze ověřit již existující receipt záměr pro tentýž spárovaný receiver.

Výsledek je `verified-checkpoint` s konkrétními snapshot SHA, peer/epochou a časem pozorování. Je to **historické ověření**, nikdy trvalá garance zdravého disku. Při další relaci se připraví čerstvý inventář; běžný stávající přenos může opakovat chybějící nedokončený soubor od začátku. Novější data nepřepisuje staršími. Nezdravá pracovní DB nadále vyžaduje výslovnou obnovu; nevzniká automatická obnova DB z jiné instalace ani nový algoritmus slučování revizí.

## Pravdivý stav a kompatibilita

Persistovaný receiver stav v `syncLedgerState` a přehledu zařízení je vždy **UNKNOWN**: historický doklad neprokazuje nepřetržité zdraví offline zařízení. UI odlišuje lokální Save, aktivní čekání, historické přijetí a obsah ověřený při posledním přímém spojení, a výslovně uvádí neověřený současný stav druhého zařízení. Žádný z těchto stavů nevytvoří potvrzení historické zálohy. Cloud-only receipt zůstává čekáním na ověření, bez opakovaného nahrávání stejných GB. Přechod účtu/SAF URI/párování/epochy vytváří samostatný cíl; staré podklady zůstávají.

## Transparentní produktová brána

Spuštění z čistého commit SHA:

    python tools/sync-ack-acceptance.py --output /cesta/k/dukazum

Nástroj **vždy spustí celý** `:app:testPreviewUnitTest --rerun`, včetně původních dvou fyzikálních diagnostik. Gradle s jejich dvěma FAIL je nadále **FAIL/exit1**. Report `physical_diagnostics` je viditelně klasifikuje jako **EXPECTED FAIL (actual FAIL)** jen pokud jde přesně o jejich původní expected0/actual1 providerovou aserci. Jakýkoli jiný výsledek těchto testů se prověřuje jako chyba brány. Neexistuje Ignore/Assume/SKIP ani `ignoreFailures`.

Oddělený `product_acceptance` smí být PASS, pouze když všechny ostatní metody skutečně PASS, zejména oba nezměněné `SyncAckReconciliationTest` a nová negativní sada `SyncReceiptSafetyTest`. Jiné FAIL/ERROR/SKIP, chybějící metody, neúplná sada, staré XML po chybě kompilace, duplicitní testy, změněný HEAD/strom nebo porušená integrita původních diagnostik bránu blokují. Návratový kód0 nástroje znamená pouze produktovou bránu; nikdy zelený celý Gradle. Úplný Gradle log, všechny JUnit XML a strukturovaný report se zachovají.

Kontrola integrity chrání původní provider fixture/setup/helpery a celý blok obou #88 včetně `ackProviderBoundary`, a také **celý původní nový E2E soubor**, pomocí pevných SHA-256. V jiných starších testech se pouze zpřesnila původní očekávání „0 aktivní upload = hotovo“: současně se nově požaduje retained UNKNOWN záměr. Data/media/CAS aserce zůstaly. `tests/test_sync_ack_acceptance.py` ověřuje, že třetí FAIL, SKIP, jiné selhání pod známým názvem nebo chybějící E2E nelze zamaskovat jako úspěch.

## Vlastní kontrola, nalezené příčiny a omezení

`SyncReceiptSafetyTest` kontroluje reálné SQL transakce a všechny fault hranice quiet/receipt/commit, reálný ABORT/ENOSPC trigger, restart/duplicity, účet a SAF URI, pairing a recovery epochy, explicitní testovou obnovu staršího stavu, poškozený sourceRef/SQL manifest, nutnost skutečných mediálních bajtů, změnu při zachovaném mtime, kauzální konflikt, nezávislý namespace a pravdivý UNKNOWN. Dvě původní E2E dál kontrolují foto/video/audio, detached audio, přesné hodnoty/jednotky/body/historii, restart objektů a skutečný TLS retry do novější revize. Produkční automatický restore nebyl přidán.

Aktivní hledání navíc prokázalo dvě související chyby: zahřátá cache ignorovala validní vnější výměnu JSON beze změny procesní generace (opraveno porovnáním přesných aktuálních bajtů); SQLite `quick_check` neodhalil ztracenou navázanou source revizi (doplněn fail-closed `foreign_key_check`, žádné tiché doplnění poškozené aktivní evidence). Obě reprodukce byly před opravou skutečně RED. Vlastní revize prvního návrhu doplnila také explicitní shodu s již známou receiver epochou a oddělila skutečné fresh media capture od quiet metadata cache; negativní scénáře tuto hranici dále chrání. Také odstraněna závislost postupu historie na globálním timestampu, který může selhat až po trvalém SQL receipt.

Vlastní kontrola sleduje celé `SafSyncV2 → completed → SyncQueueStore → SyncLedger`, legacy i TLS, identitu a epochy, P1/audio a UI. Zůstávají původní přesné formáty, pracovní CAS a jediná P1 retenční autorita. Množství retained metadat a cena hashů na reálném telefonu vyžadují měření; žádné automatické GC nebo heuristické uvolnění pinů nejsou součástí.

HOME Windows, fyzický Android/SAF/OEM/Doze/MediaRecorder a rádio/reboot dvou zařízení, živý Drive/OAuth/kvóty, skutečný disk-full/power-cut a fyzicky instalovaný starý klient jsou **NOT RUN**, pokud je nepotvrdí samostatná oprávněná QA. Managed Linux/Robolectric a browser Native model je nenahrazují. Nezávislé opakované review Kontrolora 40 následuje až po finálních vlastních důkazech. Žádný merge, APK, release, Actions nebo placená infrastruktura.

První úplná produktová brána na `82440269b2fcf72bd88ebced6872d8c65aea3bc7` správně skončila FAIL kvůli regresi fallbacku R10 (navíc ke dvěma EXPECTED FAIL). [Úplné prvotní výsledky a následná příčina](qa/sync-ack-88/README.md) zůstávají zachované. Oprava nemění žádnou aserci ani helper původního `DatabaseInstallEvidenceTest`; finální vlastní běh opraveného SHA následuje a jeho úplné výsledky jsou přímo v PR #116.
