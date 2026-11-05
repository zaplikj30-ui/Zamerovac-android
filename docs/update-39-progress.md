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
