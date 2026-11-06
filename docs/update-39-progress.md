# Společná aktualizace #39 – pracovní evidence

Práce pokračuje na `codex/velka-aktualizace-39`, draft PR #41. Bez merge, APK a skutečných zákaznických dat. Zachované opravy `85ed7ec`, `f4d6282` a izolované revizní vektory.

## Etapa 1 – ukládání a chybové cesty #33

- JS posune potvrzený snapshot až po úspěšném nativním zápisu. Nativní compare-and-save pod lokálním zámkem odmítá zastaralý základ; třícestné sloučení uchovává obě souběžné změny. Opožděný callback čte aktuální diskový stav. Selhání zápisu vrací chybu a nehlásí potvrzení.
- ZIP před prvním bajtem kontroluje přítomnost všech odkazovaných příloh včetně vnořených detailů; chybějící/prázdný soubor export zastaví. Úspěch se oznamuje po uzavření výstupu poskytovatele. Nedokončený výstup se aplikace pokusí odstranit; poskytovatel může odstranění odmítnout.
- Nahrávání při chybě uvolní mikrofon a neplatný záznam se nepřipojí k poznámce.
- Nápověda vysvětluje skutečné chybové chování. `release-history.js.pendingChanges` jsou nevydané pracovní podklady, nikoliv nová smyšlená verze; před vydáním je nutno připravit jednu položku se skutečným číslem workflow.

Testy: `tests/save_acknowledgement.js` (selhání zápisu, potvrzení, přesné konfliktní hodnoty, opakování, opožděný callback), `StorageLifecycleTest` (neúplný ZIP, chyba výstupu, stale compare-and-save, odmítnutý disk, cleanup audia). Místně všechny Node testy prošly, Python 47 se dvěma skipy bez javac. Nové nativní testy musí potvrdit Actions. Testy s mockem disku/mikrofonu nejsou fyzickým ověřením plného telefonu.

## Zbývající schválený rozsah

Úplná #33 ještě není dokončena: síť pod globálním zámkem, druhý postup zápisu sync, integrita a idempotence přenosů, cleanup vzdálených médií, další nedůvěryhodné vstupy. Skutečná přímá/offline synchronizace, párování, přenosová fronta a Google Drive API/OAuth #38 a neměnné historie/obnova #40 nejsou hotové. Dále galerie #35/#36/#37, editor #12/#13, foto #21, landscape lišta #26, navigace nápovědy #29, texty Bluetooth #34 a odpovídající testy #28.

## Prostředí

Git klon jednou selhal: `Failed to connect to proxy port 8080`. `gh auth status` neprošel. Následoval úplný textový snapshot 122 souborů přes GitHub konektor; každý soubor byl ověřen proti Git blob SHA `f4d6282`. Místně je Java runtime 21, chybí javac/Gradle/Android SDK. Prohlížeč Chromium/Playwright je dostupný; lokální server vyžaduje síťové oprávnění sandboxu. Zápisy na větev provádět přes GitHub tree/commit a kontrolovaný očekávaný HEAD, nikdy nepřepisovat jiný chat.

## Etapa 2 – galerie, editor a ovládání

- #35/#36: společná transformace celého galerijního plátna, hranice posunu, zoom kolem prstů, vycentrování při 1× a zrušení gesta; po otočení se hranice přepočítají.
- #37: galerie měří skutečnou geometrii vloženého snímku i výchozího textu pod ním, včetně přesahů a otočení. Při renderu se společně transformují i texty. Spodní pokyn i jeho pruh odstraněny.
- #12/#13: výchozí výběr, lupa při úpravě rohů obdélníku/lichoběžníku i os kruhu/elipsy; zvětšení respektuje rozsah nastavení 2–6. Bez změny výpočtů měření, magnetu a Undo/Redo.
- #26: přídavné nástroje jen na šířku podle dostupného místa; výběr a pořadí v nabídce nástrojů. Původní výšková lišta a nabídka dalších nástrojů zachovány.
- #29: zvýraznění, předchozí/další výskyt, cyklická navigace, samostatné počty témat/výskytů a bezpečné hledání bez diakritiky. Plovoucí tlačítko hlášení nepřekrývá nápovědu.
- #34: neutrální název a stav Bluetooth; dosavadní Bosch cesta zůstává. Nepřidává to nové měřicí protokoly.
- #21 částečně: paměťová LRU mezipaměť do 3 dekódovaných snímků / 24 milionů pixelů zrychluje opakované otevření. Po úplném restartu je první dekódování stále nutné; zrychlení studeného startu na telefonu nebylo měřeno.
- Uložení: trvalé chybové upozornění s opakováním; obal v upgrade.js nyní předává výsledek zápisu a neoznačuje chybu za úspěch v diagnostice.

Ověření: všechny Node skripty, Python 47/2 skipy, Chromium všech 15 kreslicích nástrojů, 6 workflow, interakce, zoom/grid, nápověda a changelog prošly. Cílený `tools/e2e/update39.cjs` prošel (4 případy): extrémní posun na telefon/tablet rozměrech, skutečné žluté pixely popisku pod detailním snímkem, beze změny uložených dat, roh/lupa a přesný text hodnoty, nastavení lišty a rotace, skutečné odmítnutí localStorage zápisu a opakování, chybějící foto, navigace výskytů a Bluetooth stavy. Samostatně prošel původní test 11 viewportů. Nativní CI první etapy selhalo na chybějícím kvalifikovaném názvu DocumentsContract; opraveno v této etapě, nový výsledek ještě ověřit. Žádná APK.

### Mapa regresí #28 pro nové etapy

| Funkce / issue | Pozitivní kontrola | Selhání / ochrana | Důkaz a limit |
| --- | --- | --- | --- |
| Ukládání #33 | potvrzený zápis, opakování | odmítnutý disk, quota, stale callback, dvě přesné hodnoty | Node + skutečné UI; nativní CI čeká |
| ZIP #33 | původní roundtrip a 50 exportů | vnořené chybějící/prázdné médium, selhání výstupu | StorageLifecycleTest; nativní CI čeká |
| Galerie #35–37 | plátno + výchozí popisek za okrajem | extrémní posuny, otočení, neměnnost záznamů | Chromium pixely/gesta; fyzicky neověřeno |
| Editor #12/#13 | roh s lupou, výchozí výběr | ukončení, přesná hodnota, původní 15 nástrojů a Undo/Redo | Chromium; prst/S Pen čeká |
| Lišta #26 | více ikon na šířku, volba | návrat na výšku, neměnnost anotací | 11 viewportů + cílený test |
| Nápověda #29 | 0/N, předchozí/další, konec | diakritika, nevyskytující se slovo, nulová změna dat | Node + Chromium offline; fyzicky čeká |
| Bluetooth #34 | neutrální dialog, název zařízení | nezměněný přenosový kód Bosch | modelové stavy, fyzický laser čeká |
| Foto #21 | stejný dekódovaný obraz z cache | chybějící foto, žádné předčasné kóty | Chromium; studený start Samsung neměřen |

Další krok: sjednotit atomické ukládání synchronizace a hlavní aplikace, odstranit držení globálního datového zámku po dobu práce se vzdáleným poskytovatelem. Celé #38/#40 stále zbývá.

## Etapa 3 – společné úložiště, integrita, přílohy a souběh

`LocalDatabase` nyní používá hlavní aplikace, obnova i synchronizace. Validace před zápisem, sync souborového deskriptoru, atomické nahrazení a chráněná předchozí kopie nemají dvě odlišné implementace.

`SyncEngine` nedrží `TrashPurger.LOCK` při síťových/provider operacích. Oddělený zámek synchronizační relace zabrání souběhu Activity a JobService. Po přenosu znovu načte nejnovější místní stav a sloučí jej, místo přepsání snapshotem z počátku. Trvalý příznak `syncPending` označuje neodeslané novější změny nebo chybu. Stahují se pouze odkazovaná média; souběžně vysypaný koš se kontroluje před publikací staženého souboru. Upload se čte zpět a porovnává SHA-256/velikost; odlišný obsah stejného ID se nepřepíše. Konfliktní ID jsou deterministická a i stejná externí `rev` s odlišným obsahem zachová obě verze. Toto je oprava dosavadního SAF mechanismu, **nikoliv kompletní #38**: nemá transportní frontu/párování, vzdálený mutable `projects.json` stále potřebuje náhradu verzovaným protokolem a nelze garantovat souběh více zařízení ani neomezené timeouty poskytovatele.

Nový [ZIP v2](archive-v2.md) obsahuje manifest SHA-256/velikostí; import ověřuje všechny položky před zápisem a odmítá duplicitní položky/odstraněný povinný manifest. Kontrolují se i limity neznámých položek, historie a druhotné audio reference. Nově zkopírované soubory se při selhání importu/commitu odstraní. Starší ZIP zůstávají podporovány.

JS→Native upload používá dočasné soubory a potvrzenou očekávanou délku. Nelze přepsat existující ID; neúplný soubor se nepřipojí k záznamu. Doplněny i screenshoty hlášení chyb. Historie anotací nyní chrání své soubory před vysypáním jiné položky.

Přidány `SyncSafetyTest` (zablokovaný poskytovatel a souběžný místní save, přesné konflikty, přerušení a trvalý pending, idempotence i shodná podvržená revize) a testy v2 roundtrip/poškození/manifestu/potvrzovaných médií v `StorageLifecycleTest`. Node a Python místně prošly; nové nativní testy musí ověřit Actions. Druhá etapa má nativní CI SUCCESS; praktické CI drawing/workflows/update39/help/changelog SUCCESS; starší browser job odhalil neaktualizovanou injekci chyby načítání po přidání cache. Test nyní vkládá zpoždění na hranici loaderu (skutečné chybějící médium samostatně testuje update39), nejde o prodloužení timeoutu.

## Etapa 4 – izolované jádro #38/#40 a nálezy CI

Přidán skutečný `sync/protocol-v2.js` s trvalou frontou nad CAS adaptérem, kontrolou potvrzení, failover politikou, zachováním souběžných vektorových verzí a neměnnými zálohovacími bloky sdílenými mezi historiemi zařízení. [Přesné rozhraní, důkazy a mezery](sync-v2-checkpoint.md). Kód **není zapojen do Androidu**; UI ani skutečné transporty nepředstírá. Syntetický test 30 souborů s přerušením, restartem fronty, chybným potvrzením a 100 sdílenými originály / dvěma historiemi prošel místně. Nejde o skutečný Google Disk, párování ani radio test.

Třetí nativní CI odhalilo podporovaný neprůhledný historický text `items: "legacy"`; nyní se zachovává beze změny, jen rozpoznané JSON seznamy se přemapují. Původní testy historických dat ponechány, neoslabeny. Starší rotační test nyní ověřuje zachované měřítko a správné **nové** meze posunu, nikoliv chybnou identickou translaci po změně poměru stran. Doplněno chránění aktivního uploadu před opožděným callbackem s cizím ID a test historie odkazující na médium jiné vysypané položky. Tyto opravy je nutné potvrdit novým Actions během.

## Etapa 5 – doplnění vstupních limitů a dostupnosti ovládání

JSON se kontroluje ještě před rekurzivním parserem: velikost, hloubka 100 a striktní UTF-8. Totéž platí pro seznamy anotací uložené uvnitř historických řetězců. Import odmítá neplatné záznamy místo tichého vynechání. Rozbalovací limit se vztahuje i na obsah ZIP položek označených jako adresář. Nečitelný (`null`) cursor poskytovatele není považovaný za prázdnou cloudovou složku. Původní lokální data se při odmítnutí nemění.

Doplňková vysouvací nabídka na šířku zůstává dosažitelná i tehdy, když si uživatel původní ⋮ přeuspořádal do vysunuté lišty. Výškové pořadí ikon se nemění. Cílený browser test ověřil i tento případ a nápovědu se 0/1/N výskyty včetně výsledku pouze v klíčovém slově.

Místně prošly všechny Node testy, Python 47 s 2 skipy bez javac, cílené update39 a 11 viewportů. Pro předchozí `8ac5865` jsou **obě CI SUCCESS**: [rychlé/UI](https://github.com/zaplikj30-ui/Zamerovac-android/actions/runs/41960696051), [nativní kompilace/testy](https://github.com/zaplikj30-ui/Zamerovac-android/actions/runs/41960696056). Poslední etapu je nutné znovu potvrdit na jejím vlastním SHA.

## Pravdivá hranice dokončení

Hotové kódové etapy nejsou celé zadání #39. Především:

- **#33 zbývá:** kompletní prověření všech vstupů/nativního mostu, nová bezpečná synchronizační publikace místo sdíleného přepisovaného `projects.json`, kompletní kauzální koš a důkazy při všech typech selhání provideru. Tato práce není nezávislý bezpečnostní audit ani certifikace MASVS.
- **#38 zbývá skutečná integrace:** vektory při každé editaci, nativní durable fronta, LAN, offline Wi-Fi P2P bez routeru, vzájemné bezpečné párování/revokace, skutečný Drive API adaptér, metered network policy z Androidu, media payload streaming/timeouty/failover, pravdivé UI čekajících souborů a konfliktů, lifecycle/Doze. Izolovaný model není funkční synchronizace mezi dvěma instalacemi.
- **#40 zbývá:** reálné úložiště na Drive, oddělený výběr/namespace, seznam historií obou zařízení a prostoru, bezpečné obnovení jako kopie přes nativní import. Izolovaný content-addressed backup engine už má testy, aplikace jej ale nenabízí a netvoří skutečnou historii Disku.
- **#21:** cache pomáhá opakovanému otevření, studený start velkých fotek po restartu ještě potřebuje měření a případné nativní optimalizace.
- **Fyzicky neprovedeno:** telefon/tablet Samsung, Xiaomi/Lenovo a jiné značky, S Pen, Bosch, skutečný Drive účet/provider, přenosová rádia, reálný výpadek/plný disk a aktualizace instalace. Windows/iOS aplikace nebyly vytvořené. Nová APK nebyla sestavená a PR se neslučuje.

**Další jediný konkrétní krok:** po kontrole nejnovějšího HEAD a Actions implementovat Android adaptér identity/atomické fronty a napojení kauzálních revizí/tombstones na skutečné místní změny podle `docs/sync-v2-checkpoint.md`; teprve na tomto bezpečném základě transporty a UI. Nepřidávat zahraniční adresní službu, reklamy ani licence.

## Etapa 6 – nativní základ a skutečné kauzální revize

`DeviceIdentity` trvale ukládá náhodné UUID instalace; nepoužívá výrobce/model ani hardwarový identifikátor. `touch` a `newRecord` skutečné aplikace nyní vedou `syncClock` (UUID → přesný celočíselný čítač). `CausalClock` porovnává vektory v nativním SAF merge, nepovažuje hodiny telefonu za pořadí změn. Starší záznamy bez vektorů se přijímají konzervativně dosavadním mechanismem, nikoliv automatickou jistotou o jejich kauzalitě.

Skutečné vysypání koše ukládá `syncTombstones` bez obsahu smazaných záznamů. Pozorovaná starší verze už nevzkřísí původní ID. Nezávislá změna vůči tombstone se zachová pod novým konfliktním ID; opakování ji nemnoží. JS callback/třícestné sloučení má stejnou ochranu a otevřený editor následuje zachovanou kopii. Browser fallback koše používá stejné čítače.

`SyncQueueStore` a nativní bridge `loadSyncQueue` / `saveSyncQueue(expectedRevision,text)` poskytují skutečný souborový AtomicFile/CAS s kontrolou potvrzení, velikosti, revize a položek. **Koordinátor a transporty jej zatím nevyužívají**; není to běžící nová synchronizace. Další krok je napojit frontu, media payload streaming, transportní adaptéry a UI, ne pouze tyto metody přejmenovat za hotový produkt.

Přidán `tests/causal_app_clock.js` pro skutečné JS pomocníky: čítače/overflow, souběh a koš, přesný text rozměru, ochrana klíče `constructor` a navázání živého editoru na kopii. `SyncSafetyTest` rozšířen o nativní stabilní identitu, kauzální pořadí proti chybným hodinám, opakované sloučení s košem a nativní persistentní frontu/restart/stale CAS/selhání zápisu. Všechny Node a Python kontroly prošly místně; cílené Chromium a šest workflow rovněž. Nové nativní testy čekají na Actions.

Pátá etapa měla nativní CI SUCCESS; browser kontrola odhalila závod testu s asynchronním přepočtem galerie při rotaci. Galerie nyní omezí posun ihned při resize a po přepočtu; test čeká na skutečně dokončené vykreslení daného viewportu a potom ověřuje meze. Místně 11 viewportů prošlo. Toto nemění měřené hodnoty ani uloženou geometrii.

**Aktualizovaná návaznost:** identita, lokální queue store a `syncClock`/tombstones už nejsou pouze návrh. Ještě je nutné je propojit s jediným běžícím synchronizačním koordinátorem, společným protokolem v2 a skutečnými autentizovanými transporty. Podmínky nehotové #38/#40 a fyzického ověření výše nadále platí.

## Etapa 7 – dokončení revize checkpointu

Nechráněný původní `saveData` zůstává pouze Java pomocníkem pro staré nativní fixture testy; **nemá `@JavascriptInterface`**, takže WebView může zapisovat databázi jen potvrzovaným compare-and-save. Nativní regresní test to kontroluje přes skutečné anotace rozhraní.

Identita instalace je uložená atomicky v `Context.getNoBackupFilesDir()`, mimo Android Auto Backup. Obnovení systémové zálohy tak podle Android kontraktu nekopíruje identitu na druhé zařízení; ID není odvozeno od účtu ani hardwaru. Test ověřuje stálost jednoho adresáře a různé identity dvou instalací.

Šestá etapa má celé rychlé/UI CI SUCCESS. Nativní CI našlo důležitou starší podmínku: živý vzdálený záznam bez kauzálních čítačů se nesmí tiše zahodit proti vysypanému koši. Opraveno konzervativně: smazané staré záznamy se nevracejí; živá verze s neznámým pořadím se zachová jako **označená kopie s novým ID**, stejně jako prokazatelná souběžná změna. Původní test zůstal a navíc ověřuje, že původní vysypané ID nevstane. Legacy `trashPurgedIds` se při merge doplní prázdnou kauzální tombstone se stejnou opatrnou politikou.

Všechny Node/Python kontroly prošly místně, po napojení skutečných čítačů znovu prošlo všech 15 nástrojů, šest workflow a cílené nové UI případy. Poslední nativní/CI výsledek je nutné ověřit na posledním SHA této etapy; tuto poznámku nepovažovat za předem daný úspěch.

**Předávka pro další pokračování celé #39:** stabilní identita, kauzální čítače/koš a nativní durable queue store jsou nyní naprogramované. Ještě chybí zapojení fronty do koordinátoru a jeho skutečných LAN/offline P2P/Drive adaptérů, párování/revokace, publikace neměnných autentizovaných revizí, stav čekajících médií, zálohovací historie/obnova v aplikaci a fyzické ověření. Aktualizace proto nadále není celá dokončená a nesmí se vydat nová APK ani sloučit PR.

## Etapa 8 – skutečná TLS relace a oboustranné párování (navázání na další pokyn Pokračuj)

Přidány `SyncTls`, `SyncPeerRegistry`, `PeerHandshake` a `PeerWire`. Produkční větev používá P-256 privátní klíč z Android Keystore, TLS 1.2/1.3 s klientským certifikátem a vazbu schváleného instalačního UUID na přesný SHA-256 otisk certifikátu. Neznámý certifikát je povolený jen v explicitním režimu párování; aplikační data nejsou povolena před oběma potvrzeními a potvrzeným uložením důvěry. Porovnává se celý 256bitový otisk obou identit a čerstvých nonce, nikoli snadno kolidující krátký PIN. Změněný certifikát nebo stejný certifikát pod cizím UUID se odmítá; revokace odstraní vazbu. Nativní/UI řízení relace a objevování ještě následuje, tyto třídy zatím aplikace neaktivuje.

`PeerTlsTest` používá skutečné JVM TLS sockety na loopbacku a tři veřejné syntetické testovací klíče, které se nevkládají do APK. Ověřuje shodný párovací otisk na obou stranách, přesný šifrovaný JSON payload po schválení, odmítnutí na jedné straně bez uložení důvěry, opakované připojení schválených certifikátů, cizí certifikát, podvrženou identitu, odebranou důvěru a nebezpečné délky rámců. Místně nelze spustit bez Android/JDK nástrojů; musí potvrdit nativní Actions. Není to ověření Android Keystore na hardwaru ani Wi-Fi rádia.

Sedmá funkční etapa `4faea62` má obě CI SUCCESS: [rychlé/UI](https://github.com/zaplikj30-ui/Zamerovac-android/actions/runs/41963758002) a [nativní](https://github.com/zaplikj30-ui/Zamerovac-android/actions/runs/41963757913). Další krok je přenos snapshotů/médií přes tuto relaci a spojení s nativní frontou, potom LAN/bezrouterový Android adaptér a UI. Žádná APK ani merge.

TLS CI nejprve odhalilo rozdíl běhového prostředí: Conscrypt v Robolectric na JDK 17 potřebuje testovací `--add-opens java.base/java.net`. Oprava platí pouze pro JVM test task, nemění ověřování certifikátů Androidu. Negativní testy nyní vyžadují konkrétní příčinu odmítnutí; libovolná infrastrukturní výjimka se nesmí vydávat za úspěšný bezpečnostní test.

## Etapa 9 – úplné zprávy, skutečný media streaming a durable potvrzení

`PeerSnapshot`, `PeerMedia`, `PeerOutbox`, `PeerDataStore`, `PeerTransfer` spojují TLS s nativní CAS frontou a atomickou databází. Přenášejí všechny referencované originály včetně detailu, hlasu a historie anotací. Média se streamují do dočasné podoby s SHA-256/fsync, příjemce po dokončení znovu zkontroluje úplnost a sloučí čerstvou lokální databázi; teprve pak potvrdí metadata. Síť nedrží společný DB zámek. Nedokončená příloha se nepublikuje, odlišné originály téhož ID se nepřepíší. Připravený outbox/potvrzení jsou atomické a mimo systémové zálohy, přežijí restart; novější pending snapshot nahrazuje starší jen při prokázaném kauzálním zahrnutí. Žádné operace nad historickými zálohami. Přesný wire kontrakt: [peer-transfer-v2.md](peer-transfer-v2.md).

Java a ECMAScript mají společné RFC8785 kanonické bajty a job ID, ověřované zlatou fixture; přidaná Apache-2.0 knihovna a licence. Odmítají se poškozené Unicode řetězce místo tiché náhrady znaků; tato již aktivní ochrana je v české nápovědě/nevydané historii. Přenosové třídy aplikace zatím neaktivuje, takže uživatelský návod k neexistující síťové obrazovce se záměrně nevymýšlí.

Nové pozitivní/negativní nativní testy skutečné TLS sítě a dat jsou připravené, výsledek musí potvrdit Actions. Místně prošly všechny Node skripty včetně sdíleného JCS kontraktu a Python 47 se dvěma skipy bez javac. Etapa 8 `6d7c806` má [nativní](https://github.com/zaplikj30-ui/Zamerovac-android/actions/runs/42006466498) i [rychlé/UI](https://github.com/zaplikj30-ui/Zamerovac-android/actions/runs/42006466203) CI SUCCESS. Další implementace: nativní koordinátor relací/lifecycle, LAN discovery a obecný Wi-Fi Direct bez routeru, UI oboustranného párování a pravdivých front. Poté skutečný Drive a historie záloh/obnova. Bez APK/merge; celé #39 zůstává rozpracované.

## Etapa 10 – Android LAN/Wi-Fi Direct a obrazovka párování

`PeerCoordinator` nyní aktivuje skutečné TLS sockety/frontu v otevřené aplikaci. `PeerDiscovery` registruje/řeší mDNS službu s náhodným názvem bez zakázek či stabilního ID; odchozí LAN socket se váže na Wi-Fi a odmítá internetové adresy. `PeerWifiDirect` používá obecný Android WifiP2pManager, kontrolu funkce/permissions a skupinové IP, bez Play Services a vendor API. Párování má omezené časové okno, celý porovnávací kód, explicitní schválení na obou stranách a oddělené Android oprávnění, které nenarušuje Bosch callback. Nesouhlas, timeout, ztracená oprávnění a nepodporované rádio mají konkrétní chybový stav.

Nativní koordinátor omezuje počet socketů/pracovníků, serializuje peer napříč instancemi po návratu do Activity a při souběžném připojení upřednostní deterministicky tutéž relaci na obou stranách. Opuštění aplikace spojení zavře; trvalá fronta zůstane. Odebrání důvěry zavře aktivní socket, zruší pending pairing a odstraní pouze místní outbox práce daného peer, nikoli zakázky či historické zálohy. Místní nové změny po přenosu znovu připraví čekající zprávu, nesmějí se ztratit za dřívějším ACK. Odlišný stav důvěry po přerušeném párování vyžaduje porovnání znovu na obou zařízeních.

Přidána offline obrazovka ☰ / Nastavení → Synchronizace zařízení: zapnutí, párování LAN/P2P, celý kód, odmítnutí/Zpět, počty čekajících potvrzení, chyba/retry a odebrání zařízení. Nedůvěryhodné názvy se vkládají jako text. Přímý callback už neoznačí ikonu Google Disku jako úspěšnou. Česká nápověda kapitoly 20 a nevydaná historie popisují skutečnou aktivní implementaci i omezení.

Místně prošly tři nové Chromium UI případy (`tools/e2e/peer-sync.cjs`): menu/nastavení/browser bez Native/data beze změny; explicitní souhlas celého kódu, odmítnutí/Zpět/nová relace; cizí HTML názvy, čekání/chyba a izolace cloudového stavu. Nativní `PeerDiscoveryTest` ověřuje lokální route filtr a nepředstíraná zařízení bez permissions. Nové native změny čekají na Actions. **Etapa 9 b52b295 má obě CI SUCCESS**: [native](https://github.com/zaplikj30-ui/Zamerovac-android/actions/runs/42010461581), [quick/UI](https://github.com/zaplikj30-ui/Zamerovac-android/actions/runs/42010458232), včetně skutečného TLS přenosu 19/30/restart/souběh.

**Zbývající omezení:** žádné fyzické rádio/Keystore ani Samsung/Xiaomi/Lenovo nebyly ověřené. Přenos při uspání běží pouze podle foreground lifecycle, není nepřetržitý background service. Rozpadlou P2P skupinu tato etapa ještě automaticky neobnovuje, nové vyhledání/výběr je možné z UI. Drive fallback/šifrované neměnné cloudové zprávy, jednotná Android metered policy a reálné historie/obnova záloh jsou další práce. Starší SAF sync není nová cloudová implementace. Celé #39 není dokončené, žádná APK ani merge.

Etapa 10 `ca2f148` má nativní kompilaci i testy SUCCESS a praktické kreslení/workflow/pair UI SUCCESS. Starší browser test v quick CI odhalil pevný souřadnicový testovací bod, který po prodloužení menu ležel v dosahu legitimního Chromium touch adjustment poslední položky. Test nyní vybírá střed největší skutečně volné oblasti podle aktuální geometrie a před dotykem nezávisle ověří, že cíl leží mimo menu. Nadále vyžaduje spotřebování celého dotyku, žádný otevřený modal a nezměněná data; nemění se aplikace ani časové limity. Jde o opravu QA geometrie bez změny UI chování, proto nevyžaduje změnu uživatelské nápovědy.

## Etapa 11 – skutečné historické zálohy a obnova v aplikaci

`BackupHistory` + oddělený capability interface `BackupStore` a `DocumentBackupStore` nyní vytvářejí skutečné neměnné body po instalaci se sdílenými SHA-256 bloky v `Zamerovac-zalohy/backups/v2`. Interface neobsahuje přepis ani mazání. Každý blok se po zápisu čte zpět a před publikací historického manifestu se znovu kontroluje úplnost. Existující poškozený blok se nesmí opravit přepsáním naslepo. Historie telefonu/tabletu jsou oddělené podle no-backup UUID, totožné originály a shodný datový JSON sdílejí prostor. Živá synchronizace tento namespace nezná.

Aplikace nabízí ☰ / Nastavení → Historické zálohy, samostatný výběr složky, ruční vytvoření bodu, historie více zařízení, odhad velikosti bloků, úplnou kontrolu a obnovu jako nové kopie. Žádná automatická frekvence, prořezávání ani licence. Odpojení pouze odebere místní výběr, vzdálené body nemaže. Neznámý/cloudový poskytovatel vyžaduje neměřenou Wi-Fi nebo výslovnou výjimku pro jedinou operaci; místní složka funguje offline. **Google Disk stále závisí na schopnostech jeho DocumentsProvider. Toto není oficiální Drive API/OAuth ani živě ověřený Disk účet.**

Obnova stáhne a ověří vše do soukromé dočasné složky mimo DB zámek. Poté načte nejnovější místní stav a vytvoří nové record/media ID, čítače a root složku přes společný importer. Při neúspěšném commitu nová média odstraní, existující práci nepřepíše. Nově se rekurzivně přemapují i obecné notes/audio a serializovaná historie; přesné kóty zůstávají řetězce. Selhání pouhého obnovení seznamu po úspěšné operaci nesmí vyvolat falešné selhání obnovy a duplicitní retry.

Připraven `BackupHistoryTest` se skutečnými soubory a nativním importerem: dva device adresáře/100 originálů, 101 bloků místo dvou fyzických sad, změna jednoho originálu přidá jeden blok, stará i nová obnova přesných bajtů, současná místní editace během restore, odmítnutý storage/poškozený či chybějící blok, rollback po odmítnutém DB zápisu, audio/detail/historie a traversal. `DocumentBackupStoreTest`: null/revoked provider, duplicitní názvy bez otevření writeru, nepovolený namespace, metered policy. Výsledek nových native testů musí potvrdit Actions. Místní browser případ `tools/e2e/backup-history.cjs` prošel (UI, dvě historie, bezpečné jméno, zrušení/explicitní obnova a mobilní výjimka, chybový stav bez změny dat).

Etapa Android sync + oprava testovací geometrie `75d81de` má **obě CI SUCCESS**: [native](https://github.com/zaplikj30-ui/Zamerovac-android/actions/runs/42013611233), [quick/UI](https://github.com/zaplikj30-ui/Zamerovac-android/actions/runs/42013611225). Dále zbývá skutečný Drive OAuth adaptér a neměnné cloudové sync zprávy, plné failover/Android background/P2P reconnect, studené foto a zbylá #33 kontrola. Fyzické rádio, značky, Keystore, Drive/provider, plný disk na telefonu a update instalace nejsou ověřené. Celé #39 dosud nedokončeno; bez APK/merge.

První native běh etapy 11 sestavil produkční Java kód, ale testovací kompilaci zastavila použitá neveřejná metoda NetworkCapabilities.addCapability. Test nyní přes Mockito poskytuje stejný Android systémový údaj (hasCapability), včetně false/true větve; nevolá skryté API a neoslabuje požadavek na neměřenou síť. Nové native funkční testy musí proběhnout v následujícím CI. Quick/UI celé etapy 11 prošlo.

## Etapa 12 – shodné konfliktní kopie a prohlížení bez falešných změn

`SyncConflicts` je nyní společný deterministický helper nativního merge a WebView třícestného compare-and-save. Nové nativní bridge metody přijímají pouze omezené/validované JSON záznamy, při chybě se save nepotvrdí. Stejná dvojice verzí má shodného vítěze a copy ID/obsah v Java i ECMAScript kontraktu; opačné pořadí nemnoží kopie. Živý editor/note následuje svou zachovanou revizi i při změně ID, nepřepne se na jiný vítězný originál. Dříve vysypaná deterministická kopie se nevrátí; známý legacy purge conflictSource brání zbytečné další kopii.

Otevření fotografie už samo nemění uloženou šířku/výšku a upgrade wrapper nevkládá časově novou historii při pouhém čtení. Rozměr plátna se stále čte z originálu pro správnou geometrii, zapisuje se až s opravdovou editací; přesné měření se nemění. Historie uchová výchozí stav až při první úpravě. Totéž platí pro návrat z nepozměněného detailu.

Regrese: společná Java/JS golden fixture conflict ID/obsahu, `tests/sync_conflict_bridge.js` (aktuální draft navázaný na kopii, existující copy, odmítnutý bridge), `SyncSafetyTest` (vysypaná kopie a legacy purge source). Nový skutečný Chromium případ `tools/e2e/read-only-sync.cjs` porovnává data/revize po dvou otevřeních fotografie a prohlížení detailu, pak skutečně kreslí a zadává přesný rozměr, kontroluje první historii, novou revizi a správný rozměr plátna i po reopen. Node/Python prošly místně; native a CI nového SHA musí potvrdit Actions.

Etapa 11 včetně opravy veřejného API testu `2ce24aa` má obě CI SUCCESS: [nativní zálohy/obnova](https://github.com/zaplikj30-ui/Zamerovac-android/actions/runs/42015191968), [quick/UI](https://github.com/zaplikj30-ui/Zamerovac-android/actions/runs/42015191917). Stále zbývají oficiální Drive a neměnná cloudová sync publikace, plné Android failover/pozadí/P2P reconnect a zbytek výkonové/bezpečnostní revize; fyzické testy neprovedeny. Bez APK/merge.

## Etapa 13 – odstranění mutable cloudového writeru z produkční cesty

Nová produkční `SafSyncV2` nahrazuje volání starého `SyncEngine.sync()` v Activity i JobService. Místo sdíleného projects.json používá neměnné SHA-256 bloky, podepsané čekající revize a podepsané ACK spárovaných UUID. Veřejný certifikát uložený po místním TLS párování musí souhlasit se schváleným otiskem. Standardní P-256/SHA256withECDSA podpis zahrnuje autora, příjemce, hash/velikost a druh zprávy. Přenos potvrzuje jen validní ACK po ověřeném commitu příjemce. Přerušení nepřepíše novější ani předchozí blok, retry vytvoří novou immutable podobu. Starší cloudové soubory zůstávají nedotčené, neimportují se automaticky jako důvěryhodná v2 data.

Cloud sdílí gate/outbox s přímou cestou, respektuje její prioritu, rozpočet payloadů na měřené síti a explicitní jednorázovou výjimku. Malá změna může dorazit bez cloudového uploadu velkých originálů, které příjemce už má; jinak čeká na média. Stav UI nyní rozlišuje čekání od úspěchu, foreground timer/JobScheduler používají stejný engine. Backup modul má sdílený minimální immutable interface, ale oddělený namespace/adapter bez přístupu živé synchronizace k historii.

`SafSyncV2Test`: skutečné ECDSA podpisy, filesystem immutable store, nativní fronta/DB a media streaming. Úplné dorovnání, výpadek 19. média / restart / původní DB beze změny, podvržený ACK, revokace, změněné podepsané tělo/druh a metered malá změna s již přítomnou velkou fotografií. Nové native výsledky musí potvrdit Actions. Node/Python a nový UI waiting/cloud isolation místně prošly.

Etapa 12 `6a7e5f6` má obě CI SUCCESS: [native](https://github.com/zaplikj30-ui/Zamerovac-android/actions/runs/42016361396), [quick/UI](https://github.com/zaplikj30-ui/Zamerovac-android/actions/runs/42016361454). Přesný protokol a zbývající rizika: [cloud-sync-v2.md](cloud-sync-v2.md). **Stále není hotový oficiální Drive OAuth adaptér**, není ověřený živý Google Disk ani fyzická rádia. Zbývají cancellation/deadline blokujícího provideru, persistentní inbox/paginace a omezení metered režie, P2P group reconnect/background, studené fotografie a závěrečná #33 revize. Žádná APK ani merge, celé #39 zůstává rozpracované.

## Etapa 14 – náhled fotografie neblokuje databázi

`PhotoThumbnails` provádí bounds/sample decode, EXIF a JPEG cache mimo `TrashPurger.LOCK`. Při publikaci jen krátce ověří původní délku/mtime/existenci; smazaný či změněný zdroj nevytvoří opožděnou cache. Souběhy stejného cache souboru mají omezené bucket zámky a unikátní dočasné názvy. Žádný originál se nemění. Thumbnail správně respektuje i zrcadlené EXIF orientace. Toto zlepšuje souběh při studených náhledech, **není to naměřené zrychlení prvního dekódování velkého originálu v editoru na telefonu**.

`PhotoThumbnailsTest` s Native Graphics: řízený pomalý decoder při současném DB save, zdroj smazaný při čekání, zrcadlený obrázek/skutečné barevné pixely i cache druhého otevření, SHA/bajty originálu, chybný obraz a odmítnutá cache. Zůstává starší skutečný EXIF 90° test v StorageLifecycleTest. Nový native výsledek teprve Actions; Python místně prošel. Česká nápověda a nevydaná historie odpovídají změně.

Etapa 13 `6a6543c` má native i všechny tři quick/UI joby SUCCESS: [native](https://github.com/zaplikj30-ui/Zamerovac-android/actions/runs/42018590669), [quick/UI](https://github.com/zaplikj30-ui/Zamerovac-android/actions/runs/42018590574). Podepsaný skutečný filesystem cloud test včetně výpadku a metered scénáře prošel. Nejde o ověřený Google Drive účet. Další hlavní práce je provider cancellation/deadline a škálování inbox/metered režie, oficiální OAuth konfigurace/adaptér, P2P reconnect/background a finální audit/telefonní testy. Bez APK/merge.

## Etapa 15 – omezené čekání na externího poskytovatele

`ProviderIo` obaluje SAF query (včetně lazy cursor oken a close), create, open i jednotlivé read/write/flush/close. Volající má limit 30 s na externí operaci, cancellation pro query a oddělené omezené cleanup pracovníky. Ani provider ignorující interrupt/cancel nemůže trvale držet peer gate či neomezeně vytvářet vlákna. Při vyčerpání bounded poolu další operace selže jako čekající; místní DB pracuje dál. Dokončená opožděná cursor/stream odpověď se zavře a nevrátí volajícímu. Každý rozpracovaný writer vlastní kopii svého bloku, takže po timeoutu nepoužije později změněný buffer. Pozdní externí zápis smí dokončit jen svůj předem vytvořený immutable orphan, nikdy cizí historický ani novější soubor.

Stejná ochrana je v DocumentBackupStore i DocumentSyncStore. `ProviderIoTest` explicitně používá neodpovídající read/write/close, které ignorují interrupt, a ověřuje včasný návrat, volného dalšího pracovníka, zákaz opětovného použití vadného streamu, late-resource cleanup i původní bajty při změně caller bufferu. Nové CI výsledky teprve Actions; lokální Python prošel. Pokud samotný OS/provider navždy zablokuje všechny limitované workery, další cloud operace hlásí čekání do obnovení provideru/procesu; nelze tvrdit, že Java umí ukončit libovolný cizí Binder call.

Etapa 14 `73d6511` má obě CI SUCCESS: [native/Native Graphics](https://github.com/zaplikj30-ui/Zamerovac-android/actions/runs/42019145467), [quick/UI](https://github.com/zaplikj30-ui/Zamerovac-android/actions/runs/42019145403). Další konkrétní kódová práce: persistentní inbox a metered režie starých cloud zpráv, P2P automatické znovuvytvoření skupiny/lifecycle, oficiální Drive adapter a jeho dosud nedostupná registrace klienta, finální audit a fyzická ověření. Žádná APK ani merge.

Native CI etapy 15 nebylo funkční selhání aplikace: produkční i testovací Java se sestavily, ale Robolectric nedokázal stáhnout SDK artefakt z repo1.maven.org kvůli HTTP 429. Neopakujeme stejný selhaný postup: runtime resolver nyní používá kanonický oficiální Maven Central endpoint repo.maven.apache.org a workflow cachuje pouze veřejné org/robolectric SDK artefakty. Testy, verze SDK i integrita se neoslabují; jde o CI infrastrukturu bez změny ovládání/nápovědy. Quick/UI etapy 15 SUCCESS; plný native funkční výsledek stále nutno ověřit po opravě.

## Etapa 16 – trvalý inbox a pokračování ACK bez opakování dat

`CloudInbox` ukládá atomicky a s fsync, která konkrétní zpráva již opravdu změnila/ověřila lokální DB a zda se její podepsané ACK úspěšně publikovalo. Index je oddělen podle instalačního UUID i konkrétního úložiště, v no-backup adresáři; změna účtu/složky nebo jiná instalace jej nesmí použít jako důkaz svého commitu. Zápis potvrzení před DB commitem není možný. Kopie transakčního JSON a generace mezi instancemi brání tomu, aby odmítnutý zápis zůstal jen jako falešný úspěch v cache.

Po ztraceném publikování ACK se při dalším spuštění podepíše/publikuje pouze potvrzení již uložené zprávy. Známé dokončené zprávy nevyžadují opakované čtení vzdáleného payloadu a nepřidávají další zakázku. Rozšířen `SafSyncV2Test` o skutečný diskový commit + přerušené ACK + nový engine a nulové opakované čtení staré incoming zprávy. `CloudInboxTest` ověřuje restart/druhou instanci, oddělené úložiště/instalaci, odmítnutý AtomicFile zápis bez falešné ack cache a změněnou immutable zprávu. Nové nativní CI musí potvrdit tuto etapu.

**Zbývající škálování:** provider stále může při listování přenášet vlastní režii a množství neznámých/podvržených zpráv potřebuje paginaci/rozpočet řídicích rámců. SAF interní síťovou spotřebu nelze považovat za tvrdě změřený datový limit. Čekající source upload se dosud znovu ověřuje, je nutné bezpečně omezit jeho opakované readback při dlouho offline příjemci. Toto není hotová přímá OAuth integrace Google Drive.

## Etapa 17 – živý tah, formulář a detail během sync callbacku

Kontrola našla další skutečnou chybovou cestu: Native callback mohl vyměnit model během zachyceného úchopu nebo rozepsaného dialogu. Detailní editor navíc ukládal dočasný záznam před aktualizací/touch rodiče a po CAS konfliktu mohl ztratit návaznost dalšího tahu. Nový sync-edit-guard odloží pouze UI callback během tahu/rozepsaného formuláře/detailu; potvrzované ukládání nadále CAS-rekonciluje čerstvý nativní disk. Po dokončení se použije aktuální DB, nikoli starý callback snapshot.

Dočasný detail nyní přepíše vlastní detailItems/dimensions do skutečného rodiče a touchne jej **před** jediným potvrzovaným save. applySavedState zahrne živého rodiče, při ekvivalentních items zachová jejich skutečné objekty pro úchopy, následuje vlastní konfliktní revizi a odstraní pole, která v nové podobě nejsou. Nepřeruší druhý následný tah po změně ID kopie. Samostatná stavová zpráva nesmí přepsat odložená data.

Tři nové skutečné Chromium případy `tools/e2e/sync-edit-guard.cjs` prošly místně: reálný pointer down/move, Native callback uprostřed tahu, pokračování až do přesného delta/uložení obou verzí; rozepsaný přesný rozměr při Native změně; detailní kóta + parent CAS conflict + další tah a reopen. Native bridge je v těchto browser případech výslovně modelovaný diskový CAS a vynucená losing-local větev, zatímco produkční Java konflikt je samostatně ověřen golden fixture/native testy. Nejde o fyzický Android callback test. Nové kompletní CI musí potvrdit tuto etapu.

Etapa 16 `d9bc3e2` má obě CI SUCCESS: [native včetně provider deadline a durable inbox](https://github.com/zaplikj30-ui/Zamerovac-android/actions/runs/42022195553), [quick/UI](https://github.com/zaplikj30-ui/Zamerovac-android/actions/runs/42022195587). Maven canonical endpoint/cache odstranil infrastrukturní blokaci; testy nebyly vypnuté. Další velké otevřené body zůstávají přesně v START_ZDE a cloud-sync-v2.md; žádná APK ani merge.

## Etapa 18 – revize všech změn poznámky a živá skica

Kontrola skutečných handlerů našla checklisty/přílohy, které měnily data bez touch, takže je kauzální merge mohl zaměnit za starší verzi. Jejich add/edit/check/remove nyní nastaví revizi a potvrdí zápis; text checklistu se zapisuje s krátkým debounce, revize vzniká už při změně. Callback výběru přílohy drží původního vlastníka, kontroluje jeho dostupnost/kind/zámek a nepřipojí soubor k jiné právě otevřené poznámce. Neúspěšný save poznámky ji nezavře a neoznačí jako dokončenou. Zámek zahrnuje checklist i odebírání příloh.

Pouhé otevření poznámky a prázdné skici nevytváří nové pole/revizi. Native UI callback počká po celou poznámku či modal (i při přesunu fokusu na OK). Ekvivalentní arrays items/checks/media/sketchStrokes udrží živé reference po CAS: debounce textu během kreslení neztratí zbývající body skici.

`tools/e2e/note-sync.cjs` čtyři místně úspěšné skutečné UI scénáře: readonly note/sketch, checklist a opravdový IDB import/odebrání souboru s kontrolou revize/uložených dat; Native incoming během čtení a zavření bez falešného konfliktu; skutečná skica s CAS uprostřed tahu a kontrolou finálních souřadnic; odmítnutý zápis/formulář/retry a zamčené ovládání. Model diskového CAS je sdílená Native fixture (není to fyzický Android). Předchozí tři live editor scénáře prošly i s fokusem tlačítka OK. Nové CI teprve ověřit.

Etapa 17 `c65963e` má [native](https://github.com/zaplikj30-ui/Zamerovac-android/actions/runs/42024555518) i [quick/UI](https://github.com/zaplikj30-ui/Zamerovac-android/actions/runs/42024555590) SUCCESS. Dále pokračuje kontrola nativních vstupů a hranice WebView, P2P reconnect/pozadí, škálování cloudu a oficiální OAuth. Bez APK/merge, fyzická zařízení neověřena.

## Etapa 19 – hranice privilegované WebView

Cizí dokument se nesmí načíst do editoru s Native rozhraním. Nový WebContentPolicy kontroluje přesný HTTPS origin/port a jediný index dokument; navigace rámců a implicitní vzdálené requesty se blokují. Webové kliknutí jde do systémového prohlížeče. Popup pro target=_blank má samostatnou JS-disabled WebView bez Native mostu, blokované zdroje a omezenou životnost. CSP zakáže inline skripty, event atributy, cizí skripty, iframe/srcdoc a spuštění média jako skriptu; nosniff + bezpečný MIME a oddělená media CSP chrání přílohy. Zachované externí mapy/RÚIAN a ID opravy. Opaque pole __proto__ se při aplikaci potvrzeného modelu definuje jako data a nemění prototyp živé zakázky.

Nový `WebContentPolicyTest` testuje skutečný MainActivity WebViewClient: trusted index, cizí/userinfo/port/lookalike/file/content/data/js a subframe blokace, CSP hlavičky, neprůchozí resource fallback, MIME skriptu a systémový intent + popup bez bridge. Vyžaduje nativní CI. `tools/e2e/web-content-policy.cjs` prošel místně s opravdovými assety a přesnou produkční CSP na HTTPS originu: skutečná kóta 1585,800001 a současně zablokované injektované inline/media skripty, onerror a cizí/srcdoc rámce; žádné čtení Native ani změna dat. Browser fixture modeluje pouze top-level Native; nemaskuje pageerror z chyb aplikace. Node regresní test zachová __proto__ i prototyp. Help/changelog/registr aktualizovány.

Etapa 18 `b252e13` má [native](https://github.com/zaplikj30-ui/Zamerovac-android/actions/runs/42029668110) a [quick/UI](https://github.com/zaplikj30-ui/Zamerovac-android/actions/runs/42029668177) SUCCESS. Toto není úplný bezpečnostní audit #33 ani fyzické WebView ověření na Androidu. Zbývají nativní ingest/lifecycle souběhy, P2P reconnect/pozadí, cloudové škálování a skutečný OAuth/Drive. Bez APK/merge.

## Etapa 20 – automatická obnova známé P2P skupiny

PeerWifiDirect nyní v popředí s povoleným autoSync/oprávněním obnoví i zaniklou skupinu: periodické discovery nejvýše jednou za minutu, výběr pouze dříve autentizované adresy, omezení probíhajícího connect/busy retry, obnova ztraceného service channel. Rádiová adresa se uloží atomicky v no-backup registru teprve po úspěšném oboustranném TLS a sváže s UUID/pinem. Samotná MAC nepovolí důvěru: očekávané UUID se kontroluje již v hello před approval/datovým přenosem. Změna či redakce adresy potřebuje ruční výběr. Skupina jiné aplikace se nemaže. Pozdní odpovědi pro starý kanál/skupinu/ukončený koordinátor nemohou obnovit spojení. UI dostává jen název/stav/čas/pending, nikoli certifikát/MAC/ACK hash. AutoSync=false se respektuje i v discovery callbacku.

`PeerWifiDirectTest` (6 případů) používá skutečný adaptér a simulované Android rádio: známá/unknown cesta, oprávnění/disabled/revokace, minutové retry a BUSY, ztráta a nové vytvoření skupiny/kanálu, pozdní group/peer callback a close, durable route + cizí pin/invalid MAC. `PeerTlsTest` navíc ověří skutečný loopback TLS reconnect s očekávaným UUID a odmítne jiné již spárované zařízení ještě před payloadem. Tato nová native etapa vyžaduje vlastní CI; fyzické rádiové vyjednání různých značek a uspání nejsou testovány. Plné pozadí a oficiální Drive/OAuth dál chybí.

Etapa 19 `a2e3039b22a4ec1b5450fd01db78cd31474d353a` má [quick/UI](https://github.com/zaplikj30-ui/Zamerovac-android/actions/runs/42050715921) a [native](https://github.com/zaplikj30-ui/Zamerovac-android/actions/runs/42050716076) SUCCESS, včetně skutečného MainActivity WebViewClient/MIME/popup testu a produkční CSP v Chromiu. Žádná APK ani merge.

## Etapa 21 – služba přímého přenosu nezávislá na obrazovce

Zavření/zničení MainActivity už nezavírá běžící přenos. PeerRuntime vlastní jediný application koordinátor, UI se jen přihlásí/odhlásí. Již autentizované relace drží uživatelem zapnutá DirectSyncService (connectedDevice foreground, generic private notification s vypnutím). Poslední odchod UI ukončí pouze párování; cizí zařízení se na pozadí neschvaluje. Neúspěšný UI observer nezmění výsledek potvrzeného DB zápisu/ACK. Návrat a dokončení načtení WebView ověří generaci disku a vyšlou čerstvý callback do stávajícího edit/CAS guardu. Callbacky po destroy jsou ignorované.

Service start je jen z viditelné aplikace/persistovaného zapnutí; bez zapnutí se nic nepřipojí. START_STICKY dovoluje případný systémový restart, nelze jej zaměnit s garancí po force-stop/boot. Odmítnutý foreground start ukáže chybu a ukončí službu bez změny DB/fronty. Notification STOP vypne nastavení i koordinátor, nemaže frontu/zálohy. PARTIAL_WAKE_LOCK se drží jen při skutečné autentizované relaci, má 90s deadline a close/idle jej uvolní; pozdní callback po close jej nemůže znovu získat. Oprávnění a manifest doplněny; bez automatických battery-exemption zásahů. Android 13 notification permission je volitelné pro viditelnost v běžném seznamu, ne podmínka zachování dat.

Nový `DirectSyncServiceTest` (6 native případů): service notification/connectedDevice/sticky/explicit STOP a nezměněná skutečná DB/fronta; disabled a synthetic denied-FGS se zobrazeným problémem; skutečný MainActivity stop/resume neukončí koordinátor a přečte potvrzené background změny; rozbitý/odpojený UI observer nebrání dalšímu; lock release/close. Lifecycle test má mock koordinátor, nepředstírá dvě rádia. Samostatné TLS/PeerTransfer integrační testy zůstávají. Nová etapa musí projít native CI, fyzické uspání a restart OS/brand dosud neověřeny.

Etapa 20 `5d60de9444084b41db01aed8d125921dcfe56913` má [quick/UI](https://github.com/zaplikj30-ui/Zamerovac-android/actions/runs/42052470121) a [native](https://github.com/zaplikj30-ui/Zamerovac-android/actions/runs/42052470268) SUCCESS (všech 6 radio adapter případů a expected-peer skutečný TLS test). Zbývá oficiální Drive/OAuth a škálování cloudu, další native ingest/security a fyzická integrace. Žádná APK/merge.

## Etapa 22 – potvrzený hlas a ingest bez přepsání originálu

AudioCapture odděluje lifecycle mikrofonu od DB locku; nahrává pouze do soukromého staging souboru. Úspěšný stop musí uvolnit recorder, ověřit neprázdnou délku, fsync a publikovat nový originál + potvrzená metadata. Start/stop/empty/cancel/kolize/metadata failure nezveřejní částečný hlas ani nesmažou původní originál. Sdílený MediaStaging používá i URI import/kamera a WebView upload; opraven ignorovaný výsledek SharedPreferences.commit v finishMedia. Metadata jsou omezená, kontrolují MIME/control chars/Unicode a délku; všechny tyto cesty commitují pod krátkým společným lokálním lockem.

JS hlas drží původního vlastníka poznámky, Uložit/Zpět ukončí a připojí úspěšný hlas před potvrzeným zápisem; neúspěch ponechá formulář. Pozdní permission retry neotevře mikrofon pro jinou poznámku/modal. Bodová poznámka nyní vrací výsledek persist i do OK/Back/detail; selhání audio/disku nesmí modal zavřít nebo otevřít detail. Cancel používá explicitní zrušení stagingu, ne dokončení osiřelého záznamu. Přesné existující kóty nejsou měněné.

`AudioCaptureTest` (5) testuje skutečné staging soubory a řízený recorder: success/potvrzení, start/stop/empty/cancel failure, původní i pozdní kolizi/MIME, metadata rollback a DB save během čekajícího prepare. Rozšířen StorageLifecycleTest: Native stop cleanup, skutečný URI partial/success/collision, WebView upload metadata-failure/nebezpečný vstup; stará kontrola audio pole nahrazena veřejným chováním nové třídy. Browser note-sync má nyní 6 skutečných UI případů, navíc hlas vlastník/Save/failure a rich modal OK/Back/disk retry/cancel. Browser Native recorder je model, nejde o fyzické nahrávání.

Zbývající ingest omezení: URI provider copy/metadata query jsou dosud synchronní v onActivityResult (nutno přesunout do bounded workeru s request/owner tokenem); recorder OS prepare/release a mikrofon při uspání nejsou fyzicky změřené. Hlas má být nahráván v popředí, současná connectedDevice služba není microphone služba. Další cloud scaling/official OAuth a fyzická integrace dál zbývají.

Etapa 21 `d3f5228bca82414d6367e43cfd8119f923852eb2` má [quick/UI](https://github.com/zaplikj30-ui/Zamerovac-android/actions/runs/42054633968) a [native](https://github.com/zaplikj30-ui/Zamerovac-android/actions/runs/42054634111) SUCCESS, včetně 6 nových service lifecycle/failure testů. Nová etapa 22 čeká na vlastní native CI; bez APK/merge.

## Etapa 23 – systémový ingest na workeru a vlastník požadavku

URI metadata/copy z onActivityResult jsou přesunuty do jediného bounded ingest workeru. MediaIngest provádí query/getType/open/read/close přes ProviderIo deadline a ukládá přes MediaStaging. Hlavní vlákno i potvrzený DB save zůstávají dostupné při čekajícím poskytovateli; purge je po dobu batch odmítnut. Destroy přeruší worker a nedokončený soubor se nepřipojí. Nejvýše 1024 příloh v dávce, 2 GiB na soubor; obsahové URI, žádný libovolný file/http/js zdroj.

Výběr drží náhodný request token, původní folder/handler a identitu případného dialogu. Dávka nepovolí druhý výběr. Native callbacks/done se musí shodovat s tokenem: starý výsledek ani done neupraví novou relaci. Přepnutí složky nepřesměruje soubor, smazaný/zamčený cíl nebo zavřený původní modal se odmítne. Přidání nevytrhne uživatele z jiného editoru/formuláře. Selhání DB zápisu ponechá nový záznam jako viditelný draft s existujícím retry bannerem; původní média zůstávají nedotčená. Camera permission/cancel/failure také korektně ukončí stejný požadavek.

Nový `MediaIngestTest` (3 native): skutečný timeout vstupu a zrušení bez změny DB/metadata/staging; metadata deadline, Unicode/MIME a zakázané zdroje; skutečný MainActivity onActivityResult se čekajícím inputem, živý UI Handler a současný potvrzený save, ochrana purge, finální bajty/token callback. Provider/radio není skutečný účet/telefon. `media-import.cjs` má 3 místně úspěšné UI případy: původní složka a stale token/done, deleted/locked/modal-owner, cancel a odmítnutý save/retry s přesným původním cílem. Novou nativní CI ověřit.

Etapa 22 `f13249635254f0870e9f923a3d9a4f19ee227331` má [quick/UI](https://github.com/zaplikj30-ui/Zamerovac-android/actions/runs/42057199019) a [native](https://github.com/zaplikj30-ui/Zamerovac-android/actions/runs/42057199058) SUCCESS (5 AudioCapture + rozšířená skutečná storage/URI/upload failure a 6 note UI scénářů). Zbývá cloudový control/list budget, source pending readback a oficiální Drive API/OAuth, finální audit a fyzické různé značky/Doze/mikrofon/Bosch/Drive/instalace. Bez APK/merge.

Etapa 23 místní doplňující regrese: všech 6 note-sync a 6 workflows případů prošlo včetně reálného IDB importu, dvou detailních fotografií, galerie/PNG/Undo a koše. Browser fixture nyní před kliknutím zachytí skutečný filechooser a nastaví jeho soubory; nepokračuje po automatickém zrušení nativního pickeru v headless Chromiu. Cancel logika aplikace zůstala aktivní. Obsahové URI s číselným Android user/profile prefixem jsou přijímány, cizí http/file/js a neplatná authority nikoli.

## Etapa 24 – omezené cloudové řídicí čtení a trvalé procházení

CloudFiles již nečte celé další 64KiB tělo za limitem řídicí zprávy; nejvýše limit+1, nulový postup/interrupt se odmítne. SafSyncV2 má omezené dávky a samostatný rozpočet řídicích read/list operací: 32 neznámých zpráv v receive průchodu, 8 proof kandidátů na hledání, 128 rámců v relaci, řídicí ProviderIo 60s/2 workers a kumulovaná kontrolní doba. Ověřené velké streaming přenosy a lokální hashování se tímto časovým rozpočtem nezastaví. Při Policy=false se nevolá ani list/open/create poskytovatele. Reads a podpisové publikace se započítají do aplikačního metered rozpočtu.

No-backup CloudScan je oddělená atomická pozice instalace/úložiště/scope, kruhově pokračuje po restartu a rozděluje práci mezi peery. Není potvrzením dat a nikdy nezavře frontu. Inbox s potvrzeným DB commitem a nedokončeným ACK má přednost; staré acked zprávy se znovu neotvírají. List cache v rámci relace se po vlastní publikaci invaliduje. Odstraněna trvalá blokace nad 10000 historických zpráv; jednotlivý provider list má nadále cap 100000 a chybí skutečná API paginace.

Nové native testy: CloudFilesReadTest (4) přesné bajty/hash, limit+1, trailing blob bez přepsání výstupu, zero-progress/invalid-limit/interrupt; CloudScanTest (2) restart/round robin, store/owner/scope oddělení, jiná instance a odmítnutý AtomicFile zápis/unsafe position; SafSyncV2Test přidává absolutní zákaz provider operací při zakázané síti a 80 neplatných zpráv před skutečnou podepsanou revizí, několik nových enginů, omezené čtení, finální přesná kóta/media a outbox smazaný až validním ACK. Novou native CI ověřit.

Limity zůstávají výslovné: SAF interní síťové list/HTTP náklady nelze tvrdě změřit, pending source stále čte ověřené cloudové originály znovu a potřebuje durable publication receipt + bezpečný repair/invalidation. Oficiální Drive API/OAuth/registrace chybí. Tato etapa není prohlášení dokončené celé #33/#38/#39. Fyzická zařízení/Doze/Keystore/mikrofon/Bosch/Drive/instalace neověřeny.

Etapa 23 `6890640254b2460d4e883297e003100e21db346f` má [native](https://github.com/zaplikj30-ui/Zamerovac-android/actions/runs/42059954678) a [quick/UI](https://github.com/zaplikj30-ui/Zamerovac-android/actions/runs/42059954983) SUCCESS včetně 3 MediaIngest testů a 3 nových browser import případů. Žádná APK ani merge.

## Etapa 25 – direct priorita a síťová pravidla mezi bloky / Job cancellation

GuardedSyncStore znovu kontroluje připojení, cancellation a ověřenou žádost o direct route před každým provider list/open/create/read/write/flush. Close se nezablokuje. Priority marker vzniká po TLS ověření před čekáním na peer gate; cloud uvolní relaci na následujícím checkpointu, také před DB apply. Přechod na měřenou síť zastaví velký upload v následujícím bloku, ne až po celém souboru. Již probíhající syscall může doběhnout do svého limitu; provider buffery nejsou plně řízené aplikací. Partial data se nepotvrdí, local originals/DB/outbox zůstávají, retry vytvoří nový immutable blob.

SyncJob používá per-attempt AtomicBoolean + AtomicReference, interrupt na stop/destroy, cancelled Policy a CAS v finally. Starý zastavený worker nemůže vynulovat novou relaci nebo dokončit její job; vypnutý autoSync engine nespustí. Nezrušený výsledek rozlišuje úspěch a retry po výjimce.

Nové native kontroly: GuardedSyncStoreTest (next read/write/list odmítnuté, close vždy proveden a žádné dodatečné bajty), SyncJobTest (3 lifecycle případy: starý worker ignoruje interrupt, nový zůstává platný, zrušené pokusy nevolají jobFinished; success/error retry; autoSync off), SafSyncV2Test +2 integrační scénáře s reálnými immutable soubory/DB/outbox/hash: přímá cesta či změna unmetered policy po prvním 64KiB media bloku zastaví upload, nezveřejní neúplnou DB a nedá ACK; další enginy dokončí beze změny přesných bajtů. Nativní CI této etapy teprve ověřit.

Etapa 24 `398a69bc8ddd539a929a955747a8c27587d84b3e` má [native](https://github.com/zaplikj30-ui/Zamerovac-android/actions/runs/42062946224) a [quick/UI](https://github.com/zaplikj30-ui/Zamerovac-android/actions/runs/42062945704) SUCCESS (všech 8 nových read/cursor/fault/integrace testů). Další největší otevřené body: opakované source readback vyžaduje publication receipts + bezpečný repair, oficiální Drive/OAuth a paginace/hard datový rozpočet, finální audit obnovy/fallback a fyzická integrace. Bez APK/merge, testovací data syntetická.

## Etapa 26 – QA mapa a předběžné odpovědnosti, bez změny funkcí

Doplněn strojový registr qa/coverage-v1.json: 34 skutečných funkčních oblastí, implementace → vrstvy testů → pozitivní/negativní kritéria → limity. Nepředstírá mapu každého staršího tlačítka; feedback je jen staticky kontrolovaný, celá aplikace není verified. Sedm manuálních bran a explicitní otevřené mezery zůstávají. tools/qa/audit.cjs v quick CI zkontroluje skutečné cesty/unikátní ID/vrstvy/pravdivé stavy; místní validace i negativní fixture s neexistujícím testem prošly podle očekávání. Nejde o spuštění uvedených testů a není to certifikace.

Na main mezitím vznikly dokumentační požadavky #42 (`45d6ae4`, `ee5c0e1`); byly načteny s aktuální VIZE_A_PLAN a komentáři. Nejsou přepisovány. docs/architecture-39-boundaries.md obsahuje předběžnou mapu současných odpovědností, kombinované testy, skutečné mezery a návaznosti plánovaných Windows/iOS/3D/vstupních schopností. Tyto budoucí funkce nevznikají. Kompletní nezávislá revize je pořád až po dokončení #39. QA etapa nemění aplikaci, nápovědu ani instalovanou historii.

**Ověřený funkční checkpoint:** `29083a829e7324ae2a594972cd7c906015910e2b`, [native](https://github.com/zaplikj30-ui/Zamerovac-android/actions/runs/42066214116) a [quick/UI](https://github.com/zaplikj30-ui/Zamerovac-android/actions/runs/42066213565) SUCCESS. Předchozí `86fd126` selhal při kompilaci kvůli chybnému BooleanSupplier.get; opraveno getAsBoolean bez vypnutí testu. Native potvrdil route/network next-chunk a SyncJob cancellation/regrese, PDF parser/render také SUCCESS.

**Přesný další krok:** řešit source published-blob receipts současně s ověřitelným repair/invalidation; pouhé přeskočení readback navždy by mohlo zablokovat obnovu chybějícího vzdáleného souboru. Potom oficiální Drive/OAuth a skutečná stránkovaná API cesta/rozpočet (registrace Android OAuth konfigurace není v repo/prostředí k dispozici), finální datový/security audit včetně DB fallback/receipts a fyzická LAN/P2P/Doze/Bosch/Drive/restore akceptace. Zachovat branch/expected HEAD, neposouvat main ani nevydávat APK.

## Etapa 27 – trvalá evidence ověřené publikace a podepsaný repair

Zdroj při čekání už znovu nestahuje všechny velké cloudové originály: CloudPublications drží ověřený hash/size/path v no-backup instalaci/store, ověří dostupnost v metadata seznamu, má 24h expiraci a kontrolu posunu hodin zpět. Zápis receipt je atomický až po remote readback; neovlivňuje finální outbox ACK. Při chybějícím/poškozeném souboru příjemce publikuje samostatně podepsaný NEED s konkrétním manifestem/blobem a durable counterem. Zdroj povolí jen vlastní referencovaný blob, znovu ověří/opraví jej pod novým immutable názvem a teprve pak potvrdí repair counter. Replay nedělá opakované velké reads; metered/direct/cancel je stále nadřazené. Podrobnosti/časové limity v cloud-sync-v2.md.

Přidané native testy: CloudPublicationsTest (3) restart/store/owner/age/metadata/clock/round, failed AtomicFile bez cache false success, durable need/backoff/counter/replay; SafSyncV2Test +6: opakovaný pending source bez velkých reads, smazaná cloudová kopie, stejně velká korupce a replay, podvržený/unreferenced repair, velká oprava čeká na unmetered, chybějící samotný snapshot a legacy kořenová data. Ověřují skutečné files/DB/outbox/podpisy/exaktní hodnoty, ne živý Drive účet. Místní Node/Python/QA map ověřit; nová native CI musí potvrdit tuto etapu.

Žádné změny geometrie, Bosch, backup historie, opravené mapy/ID ani vydané verze. Nápověda/nevydané poznámky/QA mapa aktualizovány. Oficiální Drive API/OAuth, jeho klientská registrace, paginace/hard data a finální audit/fyzické zkoušky ještě nejsou hotové. Bez APK/merge.

Etapa 27 checkpoint **82eef6d321af340c8dd5932093dbfc4cf9539633**: [native SUCCESS](https://github.com/zaplikj30-ui/Zamerovac-android/actions/runs/42082852446), [quick/UI SUCCESS](https://github.com/zaplikj30-ui/Zamerovac-android/actions/runs/42082852438). Včetně nových publication/repair testů, PDF a dosavadních regresí.

## Etapa 28 – DB fallback proti starému inboxu a ACK

Audit našel reálnou mezeru: po návratu z poškozeného projects.json ke staršímu projects.bak mohl no-backup inbox dál přeskočit dříve přijaté změny; historický vlastní cloudový ACK také nebyl důkazem aktuálního místního stavu. Nový DatabaseRecovery potvrzuje lokální UUID éry obnovy před vrácením starší kopie a invaliduje generační cache. Opakované čtení téhož fallbacku éru neotáčí; úspěšný hlavní stav ji znovu připraví pro další poruchu. Neúspěšný journal zápis či vadná evidence zabrání falešnému úspěchu, původní DB soubory zůstávají. Ztráta obou souborů po dřívějším zápisu také zneplatní potvrzení.

CloudInbox váže evidenci na tuto místní éru, včetně živé cache a znovuotevření. Historický cloudový ACK už sám nepřeskočí místní import. Direct batch přidává volitelné recovery UUID v autentizovaném TLS; změna zruší jen poslední ACK tomuto peeru, aby znovu nabídl současný snapshot. Initiator se obnoví v aktuální výměně, responder může potřebovat další automatickou výměnu. Pole je kompatibilní rozšíření v2, starší peer je ignoruje a jeho automatická obnova tím není garantována. Recovery není kauzální hodina, nemění schema ani přesné kóty a nepřenáší se jako zakázka.

Nové testy: DatabaseRecoveryTest (3, opakovaná porucha/re-arm, odmítnutý journal, ztráta DB/poškozený journal), CloudInboxTest (+1 cached/reopened), SafSyncV2Test (+1 fallback až po finálním ACK s původními médii), PeerTransferTest (+2 skutečné TLS, obnova initiator/responder bez nové uživatelské editace). Native kompilace/testy musí být potvrzeny novým CI; místní Node/Python/QA ověřit. Nápověda a nevydaná historie aktualizované. Žádná APK/merge; Drive OAuth, process-kill/velká data a fyzické zkoušky dál zbývají.

Etapa 28 checkpoint **4b87a459493f0a30bb552f37ade68b6da3b3a2a6**: [native SUCCESS](https://github.com/zaplikj30-ui/Zamerovac-android/actions/runs/42084505694), [quick/UI SUCCESS](https://github.com/zaplikj30-ui/Zamerovac-android/actions/runs/42084506171). Včetně všech 7 nových recovery testů, dosavadních přenosů a externí PDF kontroly.

## Etapa 29 – samostatná Drive v3 REST/HTTPS hranice (zatím nezapojená)

DriveHttp omezuje token na Authorization header přes HTTPS www.googleapis.com, žádné automatické redirecty/cache, connect/read timeouty, kontroly sítě/interruptu mezi 64KiB a limit odpovědi +1 bajt. 401 zneplatní právě použitý token, chyby neobsahují serverový obsah/token; žádné PATCH/DELETE ani generická URL. DriveApi pracuje s flat appDataFolder objekty pojmenovanými verzovanou cestou, úplnými stránkami (100), nextPageToken/incompleteSearch/cycle/count limity a create-only resumable uploadem 256KiB. Ověřuje Range, finální ID/name/size a přesnou délku zdroje. Selhání nevrátí dokončený objekt; nový pokus zatím začíná novou relaci, nikoli per-chunk resume po restartu.

9 nových testů DriveHttpTest/DriveApiTest spouští skutečný kód na Robolectric SDK26 s řízeným HttpsURLConnection. Zahrnují serializaci, 3 stránky včetně prázdné, opaque token, 2 celé + poslední krátký chunk a shodné bajty; podvržené URL/hlavičky, denied/mid-chunk policy, 401/403/404/429/503, neúplný/cyklický seznam, partial/long source, špatný Range a předčasné final. Native CI tuto etapu musí teprve potvrdit.

**Přesná hranice dokončení:** nové třídy zatím nevolá SyncStore/BackupStore ani Android OAuth/UI. Není to dokončená podpora Disku. Chybí adaptéry, staging/abort při close, účet a oddělená namespace, AuthorizationClient, jeho povinná registrace package+SHA1/projekt/consent, denied/expired/revoked integrace a reálný účet. AppDataFolder je soukromý prostor aplikace stejného Google projektu/účtu a neumí sdílení mezi cizími účty; uživatel ho může v Disku smazat. Nezaměňovat za systémové Android backup. Před zapojením ověřit souběžné vytvoření stejného backup blobu a velikost lokální staging kopie. Konzervativní HTTP budget není přesné měření TLS/TCP či operátora.

Nápověda a vydaná historie se v této etapě nemění: aktivní chování aplikace je beze změny a nápověda správně stále uvádí, že oficiální Drive integrace není hotová. Mapa testů má samostatnou oblast s limity; žádná APK/merge. Oficiální podklady a navázání viz docs/drive-api-integration.md.

Etapa 29 checkpoint **63d5d16fa10a584610f5e591033fdfe366693e74**: native [SUCCESS](https://github.com/zaplikj30-ui/Zamerovac-android/actions/runs/42098280995); quick/UI 42098281099 při této předávce ještě ověřit. Všech 9 nových REST/HTTPS testů prošlo.

## Etapa 30 – Drive capability adaptéry, staging a celé datové scénáře

DriveObjectStore převádí flat API objekty na virtuální adresáře; DriveSyncStore smí pouze sync/v2 a DriveBackupStore pouze backups/v2. Namespace hash je svázaný s explicitním účtem/projektem dodaným budoucí auth vrstvou a nemění se při přidání checkpointu. DriveHttp checkpoint propaguje direct/network/cancel i dovnitř dlouhé publikace, sdílí konzervativní budget.

Nový PendingOutput kontrakt odděluje dokončený zdroj od close. CloudFiles a BackupHistory zavolají publish až po ověření celé délky/hash; Drive staging pak fsyncne soubor a spustí upload. Close vždy pouze zavře/odklidí, nepublikuje partial source ani výjimku. Příprava je omezená na 2GiB a potřebuje dočasnou lokální kopii, nikoli druhý originál v DB. Při znovuotevření se odklidí vlastní opuštěné staging soubory; aktivní a cizí soubory zůstanou. Remote se nikdy nepřepisuje ani nemaže. Souběžné Drive create smí způsobit více fyzických kopií stejného jména: pouze content-addressed blob se vybere podle skutečného hashe; nejednoznačné kontrolní zprávy se odmítnou a velikost duplicitního blobu je přibližná. Není slíbená fyzická globální deduplikace při závodu.

DriveStoresTest (7) provádí nativní engine přes skutečný REST/stream kód s řízeným serverem: úplný signed snapshot/media/ACK, přesná kóta, výpadek uvnitř média + nezměněná receiver DB/čekající outbox/retry, dvě historie/100 originálů/dedup/skutečná obnova, failed HTTP bez nového bodu, cancel/abort/capability/account scope, duplicitní blob a orphan cleanup. BackupHistoryTest +1 odmítá zero-progress a limit+1 proud bez nekonečné smyčky nebo změny DB. Native CI musí potvrdit kompilaci/běh nové etapy; místní Node/Python 47 (2 skipy bez javac)/QA prošly.

**Ještě není hotové Android připojení účtu:** produkční MainActivity/SyncJob stále vybírají SAF, nikoli nové Drive adaptéry. Další krok je AuthorizationClient, explicitní účet samostatně pro sync/backup, UI/Job a povinná registrace Google projektu/package+SHA1/consent. Připojený Drive plugin nelze použít jako app OAuth. Zelený fake-HTTPS scénář není fyzický účet, router, rádio, process-kill ani OEM akceptace. Nápověda/nevydaná historie doplněná o odmítnutí prázdného/chybně dlouhého backup proudu; žádná APK/merge.

CI infrastruktura po etapě 29: native42098280995 SUCCESS, quick42098281099 měla syntax/pixely SUCCESS, ale browser job127494000260 timeout/cancel při apt downloadu fontů před spuštěním testů. Samostatný **2d888c5db501810954a4b3b94a8e9ecbc08f6ba9** vynechává jen redundantní apt instalaci, zachovává pinned Chromium a všechny testy. Nová CI musí potvrdit všechny joby; neskrývat cancelled jako SUCCESS.

První native běh etapy 30 (10e9837 / 42100336287): kompilace úspěšná, 169 z 170 testů prošlo. Jediná chyba byla v novém očekávání testu obnovy: BackupImporter správně přidává vedle kopie fotografie také kořenovou složku obnovy, takže celkem jsou 3 záznamy (původní + složka + kopie), nikoli 2. Test nyní výslovně ověřuje všechny tři, kind složky, vazbu parentId, nový ID kopie a zachování původního ID, přesné kóty i bajtů. Produkční obnovovací chování se kvůli tomuto testu nemění, žádný test není vypnutý; nová celá CI musí projít.

Etapa 30 potvrzena v **17b8c87d2c9cb5799d30e50a131e6708d991bd0a**, native42101012145 / quick42101012080 SUCCESS. Všech 170 native testů prošlo, včetně adapter/range/abort, plného signed sync/error/retry a dvou Drive historií/100 originálů/obnovy. Quick zahrnuje všechny dřívější browser testy po infrastrukturní opravě apt.

## Etapa 31 – Android AuthorizationClient a oddělené účty (zatím bez UI zapojení)

DriveAuthorization používá aktuálně dokumentovaný Google Play services auth 22.0.0, pouze drive.appdata scope a konkrétní Account. Background Tasks.await má 30s limit/interrupt, neblokuje UI a při potřebném souhlasu neotevírá dialog na pozadí. Token má jen krátkou 5min memory cache; 401 ruší právě použitý token, nepřepíše novější cached token. Změna bindingu během authorize zabrání jeho publikaci/cache. Chybové zprávy nepropouštějí serverový text/cause s tokenem. Žádný server refresh secret, export tokenu nebo připojený Drive plugin.

DriveAccounts potvrzuje backend/účet zvlášť pro sync a backup atomickým no-backup souborem; není v projektech ani v systémové obnově účtu. Readback musí uspět před aktivací. Vadná/Unicode/control vazba se odmítne, failed AtomicFile nepřepne ani živou instanci na nepotvrzený účet. Změna/odpojení zastaví starý binding před dalším síťovým krokem, druhou funkci ani historii nemění.

BuildConfig.DRIVE_CLOUD_PROJECT je veřejný ID projektu, nikoli tajemství. Lze jej zadat driveCloudProject Gradle property nebo ZAMEROVAC_DRIVE_PROJECT env; nyní je prázdný, protože ověřená registrace/projekt není dostupná. Defaultní SDK cesta proto explicitně odmítne falešné připojení. Ještě je nutné napojit Android picker/consent/UI/Job a samostatné account scope továrny pro adaptéry.

DriveAccountsTest (3) + DriveAuthorizationTest (5) mají skutečné SDK typy/request/task a mock klienta: scope/account pin, cache/401, consent/denied/config, starý účet během autorizace, UI/interrupt, disk failure/reopen/scope a Unicode. Native CI nové etapy musí potvrdit SDK dependency/kompilaci/testy; skutečný účet/párování Google s package+SHA1 ani fyzické zařízení nejsou ověřené. Místní QA/diff check ověřit. Aktivní UI se v této etapě nemění, nápověda/vydaná historie proto stále poctivě uvádějí nedokončené připojení. Bez APK/merge.

První native etapy31 (0647a27 / 42102368591): SDK22 dependency a Android kompilace prošly; z178 testů 175 úspěšných. Tři nové auth testy měly UnfinishedStubbingException kvůli zanořenému Mockito when při přípravě mock grant objektů. Oprava vytváří grant objekty před stubbingem klienta, produkční auth se nemění a žádný test se nevypíná. Následuje celý nový CI běh.

Etapa 31 potvrzena v **edab326c71ab632cb527d15af9ef4c82c4389818**, native42103280750 / quick42103281667 SUCCESS, všech 178 native testů. SDK22 i negativní auth scénáře po opravě fixture prošly, skutečný účet neověřen.

## Etapa 32 – picker, souhlas, UI a produkční volba backendu

DriveAccountFlow řeší explicitní Google picker a PendingIntent souhlas, zachovává cílovou funkci/účet přes recreation bez tokenu v Bundle a hlídá background/pozdní callbacky. Authorizing úloha se po stop/resume bezpečně přihlásí znovu bez dvojitého dialogu. DriveAccounts má per-feature monotónní revision/CAS, takže starý souhlas ani systémový picker nepřepíše novější účet/složku (včetně změny tam a zpět). Odpojení nastaví none; nevrací se tiše na starou SAF složku a nezmění druhou funkci.

CloudStorage je společná továrna pro MainActivity i SyncJob: podle potvrzeného backendu vytvoří oddělený DriveSyncStore/DriveBackupStore nebo původní Document variantu, namespace obsahuje projekt i účet. Každý HTTP krok je vázaný na původní účet/cancellation a aktuální síť. Drive vyžaduje ověřené internetové připojení, velké automatické přenosy neměřenou síť nebo explicitní výjimku; lokální SAF zůstává offline. Bez požadovaného souhlasu job neotevře dialog.

JS drive-accounts je samostatný modul v synchronizačním a zálohovacím panelu, zobrazuje pouze účet/stav, texty bezpečně vkládá jako textContent, nepracuje s projekty ani tokenem. Při změně storeKey se zahodí jen zobrazený starý seznam/ověření historie. Cloud menu vede na připojení Google účtu, systémová složka má pravdivé vlastní označení a jednorázová metered výjimka zůstává. Pokud BuildConfig project ID není registrovaný/dodaný (současný stav), UI jasně deaktivuje neověřené připojení; místní funkce a P2P zůstávají samostatné.

Nové testy: CloudStorageTest4, DriveAccountFlowTest6, MainCloudSelectionTest2 a jeden merged-permission test SDK; skutečné SDK typy/lifecycle/factory/backend a řízený klient/server. Chromium drive-accounts3 prošlo místně (oddělení/cancel, nezapojená konfigurace/hostile text, změna účtu/historie), také původní peer-sync3 a backup-history1. Node/Python47 (2 skipy bez javac) prošly. Nová native/quick CI musí potvrdit tuto etapu; živý Google účet/registrace ani fyzické zařízení se tím netestují. Nápověda/nevydaná historie aktualizované, bez APK/merge.

**Konkrétní další práce před dokončením:** při první cloud konfiguraci nebo změně namespace ověřit, že global direct/old-store lastAck nepřeskočí publikaci kompletní nové cloudové kopie. Zároveň zbývá schválená nastavitelná frekvence 15/30/60/ručně a kontrola Android priority nearby → LAN → cloud. Tyto mezery nelze považovat za splněné jen podle dosavadních end-to-end testů z čistého stavu. Potom finální datový/bezpečnostní audit a fyzická akceptace. Externí blokátor zůstává legitimní Google Cloud klient a jeho veřejný project ID; nepřebírat účty ani tokeny konektoru.

Etapa 32 potvrzena v **505ac68efee0674128f65c47243c2f55a98d90d4**, native42106918253 / quick42106918323 SUCCESS. Všech191 native testů (včetně merged permission a picker/lifecycle/factory) a nové browser account scénáře prošly; reálný Google účet/registrace fyzicky nikoli.

## Etapa 33 – úplná cloud kopie po global ACK a staré partial intent

Nalezené global lastAck přeskočení řeší samostatný durable marker kompletní publikace podle owner/store/peer/snapshot s denní expirací. Vznikne až po ověření metadat, podepsané zprávy a všech referencovaných souborů. Není to receiver DB ACK. Chybějící/expirující marker nebo ověřený repair vynutí připravení aktuálního snapshotu i po direct/old-store ACK. Historický ACK se smí použít pro dokončení nové cloud fronty až po úplné ověřené kopii v aktuálním namespace; malý metered pokus nesmí skrýt chybějící velké médium. Repair se čte i u dříve dokončeného přenosu.

Druhá nalezená vazba: zdroj může po odeslání intentu a před dokončením média zakázku legitimně vysypat. Příjemce po přijetí a ověření novějšího stavu/tombstone nesmí navždy čekat na již nepotřebné staré médium. PeerDataStore nejdřív levně prokáže kauzální dominanci a nepotřebnost chybějících ID, pak ověří všechny současné originály a generaci/staty pod DB lockem. Teprve poté uloží **místní obsolete receipt**, nikdy remote ACK chybějících souborů. Concurrent změna nebo soubor stále potřebný aktuálním stavem se nesmí vyřadit. DB recovery zneplatní i obsolete receipts. Epoch se vzorkuje před inbox lockem; poslední lokální receipt smí držet DB→inbox, žádný síťový I/O pod ním neběží.

Nové testy: CloudPublicationsTest+1, CloudInboxTest+1, SafSyncV2Test+6 (nový namespace po potvrzeném starém přenosu; platný historický ACK + chybějící velké médium na metered; repair až po finálním ACK a receiver fallback; skutečný TrashPurger po partial přenosu bez falešného old ACK; concurrent verze; aktuálně potřebný missing soubor). Node/Python47 (2skipy bez javac)/QA místně prošly; nová native/quick CI musí potvrdit tuto etapu.

Limity: odstraněná stará metadata bez dostupného důkazu nahrazení zůstávají nepotvrzená; nepředstírat opravu ztracených všech kopií či nezávislý audit. Potom zbývá schválená frekvence, Android nearby/LAN/cloud priority, finální audit/large-data/process-kill a fyzická akceptace. Legitimní GCP klient stále není dostupný. Nápověda/nevydané poznámky doplněné; žádná APK/merge.


Etapa33 potvrzena v **727dc4b09585b4a1741a2aa1725f8d23a3209e05**, native42110374717 / quick42110374881 SUCCESS, všech199 nativních testů. Metadata-only obsolete mezera zůstává poctivě nepotvrzená; návazný audit má zajistit, že jednotlivá nedostupná stará zpráva neblokuje vlastní outgoing navždy.

## Etapa 34 – potvrzovaná frekvence a společné plánování

SyncCadence je samostatná AtomicFile evidence v no-backup: auto/15/30/60/manual + enabled/wifiOnly a durable poslední cloud attempt podle store namespace. Nativní configure vrací potvrzení až po fsync/readback; vadný vstup nebo zápis neaktivuje jiný režim. Při chybné evidenci se automatic zastaví a wifiOnly zůstane konzervativní. Legacy SharedPreferences jsou pouze migrační fallback při chybějící evidenci. CloudStorage, foreground Runnable, Job a PeerCoordinator čtou stejnou potvrzenou volbu. Výchozí auto zachovává local20s/fgcloud60s/bg15min; explicitní interval platí i pro cloud na pozadí. JobScheduler může čas odložit.

Společný atomic claim zabraňuje současnému automatickému fg/job zahájení stejného pokusu; explicitní akce jej obejde, změna store dostane první pokus hned. Wall+elapsed chrání proti rollback/reboot uváznutí. Ručně omezuje vlastní automatické zahajování, neukončuje aktivní přenos ani příchozí důvěryhodné direct spojení. Pro úplné zastavení local slouží vypnutí existující služby; ruční Retry otevře krátké okno pro obnovení známé P2P cesty. Párování a explicitní akce fungují dál. UI význam vysvětluje, neukládá neúspěšnou změnu jako potvrzenou; starý checkbox umí znovu zapnout auto.

Nové testy SyncCadenceTest8, MainCloudSelectionTest+2, SyncJobTest+1 a Chromium sync-cadence2 (místně PASS): přesné intervaly, reopen, souběžný claim, jiné úložiště, hodiny, manual/disabled, disk blocker, invalid/corrupt vstup, skutečný JsApi/Job interval a nezměněné zakázky, neaktivování při failed UI/native save. Existující Job cancellation test nadále testuje lifecycle izolovaně přes claim seam. Native/quick nové etapy ještě ověřit. Česká nápověda/nevydané poznámky/QA mapa doplněné. Bez APK/merge a bez tvrzení fyzické časové garance.


Etapa34 potvrzena v **ad643802803a99612f8532b09468b34b720916d3**, native42113655813 / quick42113655903 SUCCESS. Native configure/Job interval, chybové cesty i celé UI prošly, bez APK či fyzické časové garance.

## Etapa 35 – skutečná arbitráž místních relací a postup cloudu

PeerSessions odděluje admission až po mutual TLS: ověřená nearby relace nahradí LAN, opačně ne; v rámci stejné cesty zůstává společný initiator UUID tie-break. Conditional remove zabrání starému socketu vymazat novější relaci. Zavření nahrazeného socketu nehlásí chybu nové relace; staging/fronta zabezpečují retry. LAN se dál zkouší jako fallback, nečeká se neomezeně na nedostupné rádio. PeerWifiDirect získá group interface i pro vlastníka skupiny; příchozí socket porovnává skutečnou lokální IP s tímto rozhraním přes NetworkInterface, bez pevné subnet/adresy/výrobce. Group/channel/close zneplatní informaci i opožděný callback. UI ukazuje použitou místní cestu.

Cloud route/network/cancel checkpointy se nově přenášejí do místního čtení/hashování originálů: capture/outbox/needed/superseded/apply a přijímání kontrolují po 64KiB. Ověřený direct tedy nemusí čekat za gigabajty local hash v peer gate. Background local preparer také uvolní gate nové direct relaci. Duplicate media hash se přesunul před DB lock; pod ním zůstává krátká kontrola statů a create-only commit, souběžně vzniklý originál se nepřepíše. Zero-progress source failne bez neúplné cílové přílohy.

Nedostupná jedna stará metadata/média či failed ACK se řeší po zprávách. Zůstává pending/chyba a bez falešného ACK, ale pozdější incoming a vlastní outgoing mohou v omezené dávce pokračovat. Signed metadata bez důkazu kauzálního nahrazení se automaticky nevyřazují. CloudScan.Deferred se nadále šíří do dávkového čekání a neignoruje prioritu/cancellation.

Nové native případy: PeerSessionsTest3 (včetně souběhu16), PeerWifiDirectTest+1 (actual loopback interface vs foreign local address, owner/disconnect/channel), PeerMediaCheckpointTest4 (chunk defer/original; duplicate mimo DB lock; cancel/zero; colliding original), SafSyncV2Test+2 (direct arrival právě při local hash, gate release/žádná publikace/retry; nedostupná stará metadata + nové incoming a vlastní note outgoing bez old ACK). Jsou to syntetické soubory a řízené adapter rádio, nikoli fyzické P2P. Novou native/quick CI ověřit. Node/Python/QA a peer UI místně spustit před commitem. Nápověda/nevydané poznámky/QA aktualizované, bez APK/merge.

Další konkrétní krok: vyhodnotit CI etapy35, konečná omezená bezpečnostní/datová revize (process-kill/large-data, manifest/logy/architektura a kombinace funkcí), zaznamenat nezastupitelné fyzické brány. Živý Drive nadále vyžaduje legitimní externí GCP registraci a test stejného účtu; nefalšovat konfiguraci ani nepoužít přihlášení konektoru.


Etapa35 potvrzena v **87db82198530ac712fcee962664a419545d8edfe**, native42115099893 / quick42115099985 SUCCESS. Nová route/hash/supersession/progress sada prošla včetně původních TLS/media/account/cadence a browser regresí; rádio je nadále řízený adapter, ne fyzické zařízení.

## Etapa 36 – omezená závěrečná kontrola a startup identity race

Kontrola konkrétních datových/Android/účetních hranic je v update-39-final-review.md. Nalezený reálný souběh: Direct coordinator a cloud při prvním startu mohly oba zjistit chybějící AndroidKeyStore alias a vytvořit odlišný klíč nebo načíst key/cert přes jeho nahrazení. SyncTls.androidIdentity nyní serializuje celé ensure+load. Nový SyncTlsIdentityTest používá skutečnou JCA hranici s řízeným providerem a dvěma vlákny, žádný Android hardware; ověřuje jeden generate, shodný key/fingerprint a čekání druhého startu.

DatabaseRecoveryTest+3 doplňuje partial/complete ale nepublikované tmp a backup.tmp, stav po publikaci backup před primary rename a nedostupný writer staging. Zachová přesné hodnoty a původní recovery kopii; čtení nesmí povýšit tmp. Tyto testy modelují diskové pozůstatky, nesmějí být označené skutečným process-kill/power-cut. Novou native/quick CI ověřit. Nápověda/nevydané změny/QA38 a START doplněné, všechny původní výsledky zachované. Žádná APK ani merge.

Externí technická překážka: není dostupný legitimní Google Cloud projekt/OAuth Android registrace. Produkční adaptér/auth/UI/Job je naprogramovaný, ale v této konfiguraci se připojení poctivě nepovolí. Poslední potřebné integrační/fyzické důkazy nelze nahradit konektorem ani syntetickou CI. Pokračování přesně v závěrečné kontrole a drive-api-integration.md. Neoznačovat #39/#38/#40 za hotové ani zavírat issues.

První native etapy36 (fcf4aa9 /42116269121) zkompilovala produkční aplikaci, ale compileUnitTest selhalo na Files.readString, které compile Android SDK neposkytuje. Test opravuje UTF-8 decode přes již používané readAllBytes; produkční změna/testovací očekávání se nemění a žádný test nebyl vypnutý. Celá native CI musí projít znovu.


Etapa36 potvrzena v **20eb4551a677edea3664a44d11499949b72360e0**, native42116667936 / quick42116667853 SUCCESS. Po opravě pouze test API prošly všechny native testy včetně skutečné JCA hranice/dvou startup vláken a tří diskových residue stavů. Není to fyzický Keystore/process-kill.

## Etapa37 – retry historické zálohy bez přepsání partial/corrupt bloku

Omezený závěrečný audit zjistil další konkrétní funkční vazbu #40: neúplný canonical blob po přerušeném SAF zápisu nebo poškozený historický blob mohl trvale blokovat další zálohu stejného dostupného originálu. Fail-closed bránilo přepsání, ale chyběla bezpečná nová kopie. BackupBlobs nyní hledá a ověřuje canonical hash a případné hash-UUID kopie. Nový pokus při prokázané absenci/integritním poškození použije nový immutable název, zachová původní fyzický soubor i manifesty. Manifest nadále ukazuje hash/size, tedy stejný historický obsah; check/restore hledá jen validní bajty a před DB commitem znovu kontroluje hash. Zdravé bloky se dál deduplikují.

ImmutableStore.CorruptBlob odlišuje prokázanou integritní chybu od provider permission/timeout/network failure. DriveObjectStore vrátí tuto konkrétní chybu také při všech poškozených duplicate blob kopiích. Provider chyby se neignorují jako povolení psát. Výběr alternativ je bounded16, nic se nemaže ani nepřepisuje, oprava vyžaduje dostupný originál. Dodatečné ověřovací čtení je cena bezpečného výběru; nevydává se za záchranu ztracených všech kopií.

Nové native testy4: po partial11byte prvním bloku/restartu nový bod+restore a původní partial beze změny; poškozený canonical a dvě historie/check/restore/reuse s nezměněnými manifesty a přesnými bajty; denied read nikdy nevytvoří repair; Drive REST duplicate corrupt canonical obě kopie zůstanou a nová validní varianta obnoví starou historii. Novou native/quick CI ověřit. Nápověda/nevydaná historie/QA doplněné, bez APK/merge. Po této cílené opravě zbývá externí GCP registrace/živý účet, nezávislá kontrola a fyzické brány; nerozšiřovat audit do neomezených budoucích funkcí.


Etapa37 potvrzena v **c1b91feb29508379d6d06bfc0832388f91a8ebc6**, native42117735945 / quick42117735619 SUCCESS. Celý native/JVM/PDF a Node/Python/Chromium běh včetně čtyř nových retry/repair historických scénářů prošel. Žádná APK/merge a žádný skutečný Google účet.

## Závěrečná předávka této pracovní dávky

Dokončené etapy34–37 zahrnují schválenou frekvenci, skutečnou po-TLS route arbitráž, local hash yield a izolaci staré nedostupné zprávy, serializaci startup klíče, crash-residue regrese a bezpečný retry záloh bez přepsání historie. Produkční OAuth/API/UI/Job je naprogramovaný, ale registrace v legitimním Google Cloud projektu není dostupná; prostředí má prázdné secrets/runtime bindings/outbound identities a konektor není OAuth klient Android aplikace. Public ID zůstává prázdný a UI připojení deaktivované. Kompletní #39 tudíž není hotová.

Další konkrétní pracovník: (1) přečíst aktuální START/AGENTS z main i větve, HEAD a PR/issue komentáře/CI; (2) legitimní Google Cloud/Drive API/Android klient pro package+SHA1 podle drive-api-integration.md, potvrzený veřejný project ID do podporované Gradle property/env bez secretu; (3) nezávislé review #33/#42 a potřebné kontroly; (4) až po dokončení konfigurace a kódu jediná společná testovací APK a skutečné phone/tablet přihlášení/sync/history/restore/párování/Doze/Bosch/instalace. Nezávislé review a všechny fyzické brány jsou pending/NOT RUN, ne úspěšné testy. Budoucí nápady se neimplementují, issues se neuzavírají.


## Etapa38a – navázání na dokončenou Google registraci (6. 11. 2026)

Načteny komentáře #39 až6672377880: Cloud projekt Zamerovac-Android, Drive API Enabled, External/Testing, Android preview klient se správným package/SHA1, jeden testovací účet a drive.appdata jsou potvrzené uživatelskými obrazovkami. Registrace se neopakuje. Main45d6ae4/AGENTS21bb8b9/VIZE9d9b8f5 byly znovu přečtené; dokumentace druhého chatu se nemění. Větev neměla novější kód než4d139e0, obě jeho CI SUCCESS42118508211/42118508229.

Zápis uvádí zamerovac-android pouze jako původně předvyplněný návrh ID, nikoli potvrzený výsledek. Přesné veřejné Project ID bylo vyžádáno samostatně; nejde o opakování registrace ani žádost o přihlašovací údaje. Do jeho potvrzení se nesmí vymyslet hodnota nebo označit skutečný OAuth test jako prošlý.

Nezávisle připravena malá Gradle hranice veřejné registrace: pouze projectId/applicationId/certificateSha1, ověření skutečného PKCS12 certifikátu, odmítnutí jiného package/podpisu/projektového override a neznámých polí. Samostatný Gradle test používá skutečný validátor, pozitivní/disabled vstupy a18 záporných variant včetně chybného aliasu/chybějícího souboru; bez Android pluginu, APK, účtu a síťové autorizace. Native workflow jej spustí před původní nezměněnou kompilací/testy. Tato mezietapa ještě nezapíná Drive v aplikaci; navazující preview-only BuildConfig/UI/negative testy jsou připravené a čekají na přesné ID. Není důvod znovu zakládat projekt nebo žádat secret/token/e-mail.
