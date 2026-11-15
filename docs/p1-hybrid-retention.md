# P1 hybridní ochrana – implementační checkpoint

Schválení: issue #42, comment 6765153051; technický kontrakt 6765061985.
Vlastní větev `fix/b16-p1-hybrid-retention-codex-20261110` vychází z
#99 `662aa1bd1dffd51d9f259fb3bfb4aa57e57d6c99` a obsahuje #93/#98.
Diagnostické testy #88 jsou převzaty beze změny, bez ignorování či změkčení.

## Kontrakt

`ProtectedRevisions` ukládá přesný původní text JSON před nahrazením potvrzené DB,
včetně předchozího projects.bak, před zveřejněním navrženého nového stavu,
před purge a přesné wire bajty před publikací/přijetím synchronizační revize.
Manifest obsahuje hash, velikost, ID, MIME a název originálů; média zůstávají jednou
ve files/media. Hash názvu chráněného manifestu ověřuje i metadata. Lokální hold
nepřiděluje recovery/CAS/ACK autoritu. Nemění přenosový protokol ani ID příloh.

Dva monotónní katalogy (files/protected-revisions a nezávislý no_backup witness)
zadržují sjednocení všech holdů. Po přerušeném katalogovém commitu restart doplní
chybějící členy. Chybějící nebo poškozený indexovaný manifest, neznámý soubor či
neověřitelný registr zastaví destruktivní operaci. Neúplný zápis se nemaže jako
odpad. Validní AtomicFile .bak a dokončený .new lze potvrdit jako ochranný
důkaz. Ztráta obou katalogů při existující historii je nejednoznačná a zastaví
operaci do ručního prověření. ACK, supersession, zapomenutí peeru, změna namespace ani epochy hold neruší.

Koš, opakovaný pending cleanup, rollback importu/ingestu i publikace originálů
používají společný lokální zámek a stejnou ochranu. Chybějící chráněné ID se nesmí
potichu znovu použít. Přijatý plně ověřený proud může chybějící originál
opravit jen při shodě hash/size se všemi jeho trvalými piny; neznámý nebo jiný
obsah se odmítne. Oprava souboru nemění autoritu databáze. Dočasné soubory mají jiné názvy a nejsou chráněnými originály.
Import i screenshot publikují přes MediaStaging. Přímý TLS a Drive používají
společný PeerDataStore/PeerOutbox; existující hash/need deduplikace se zachovává.

Starší neúplná DB se nezahazuje: raw JSON a dostupné originály se uchovají,
chybějící reference mají explicitní stav MISSING (známý původní hash se zachová)
a sourceComplete=false. Nejde o úplnou zálohu ani ACK důkaz. Synchronizační hold
vyžaduje všechny skutečné originály a hash/size; neúplný zdroj se nesmí publikovat
jako úplný snapshot. Neplatná legacy ID zůstanou v přesných metadatech, nikdy
se nepoužijí jako místní cesta mimo media. Neověřitelný graf historie koš odmítne.

Při selhání DB commitu může zůstat hold navržené, ještě nepotvrzené revize.
Rollback jej nesmí zrušit ani smazat nová média, která už pin získala. Přehled
revizí proto není seznam pouze potvrzených pracovních stavů a žádný hold se
nemůže automaticky stát aktuální DB. Odvozené miniatury lze uklidit i u pinů;
původní soubor a jeho názvová/MIME metadata zůstanou zachované.

Žádný automatický release, TTL, limit pro mazání ani tlačítko smazat vše.
Při chybě perzistence nebo nedostatku místa se operace odmítne. Koš ukazuje počet
chráněných revizí, počet originálů a jejich sjednocenou velikost. Bez ochrany před
ztrátou telefonu, odinstalací nebo fyzickým poškozením původního média.

## Návrh správy – NENÍ implementované oprávnění mazat

Budoucí samostatná obrazovka: konkrétní revize, zdrojové zařízení/epocha,
zakázky, přesné hodnoty, ověřenost médií a náhled rozdílu. Zobrazit fyzické bajty
sdílených médií a odhad skutečně uvolnitelných bajtů, aby součet revizí nepočítal
fotografie opakovaně. Nezávisle kontrolovat čitelnost a nabídnout export přesně
vybrané historické revize jako nové kopie bez promotion DB autority.

Zrušení jediného hold může přijít až po další bezpečnostní revizi: ověřit
náhradní trvalou kopii a obnovitelnost konkrétních metadat i všech médií, nebo
explicitní vědomé přijetí trvalé ztráty konkrétní revize vlastníkem. Dvoufázový
commit nesmí vytvořit mezeru v ochraně. Fyzické unlink teprve po kontrole všech
DB/history/fronta/karanténa/ostatní holds referencí. Koš nesmí být tímto souhlasem.
Žádný ACK v2, stáří, kvóta ani novější revize nejsou release tokenem.

## Zbývající rizika a další brána

Nezávislý review + HOME QA musí hodnotit kumulativní diff #99→tento PR, nikoli
přebírat zelené výsledky jiného SHA. Původní dvě přísné diagnostiky #88 zůstávají
FAIL a nesmějí zmizet ze souhrnu. Hybrid mění bezpečnostní následek jejich ACK,
negarantuje nemožný společný atomický commit s externím poskytovatelem.

První hashování a ověřování velkých existujících médií může prodloužit lokální
kritickou sekci. Omezená keš osmi ověřených souhrnů eliminuje opakované parsování
velkých immutable manifestů; změna inode/size/mtime nebo AtomicFile zbytek
vynutí nové čtení/hash. Není to nezávislé měření ANR či výkonu slabého telefonu.
Před akceptací musí fyzické QA změřit odezvu při velkých zakázkách, restart/OS kill,
plný disk, skutečný Drive/SAF a přímý telefon/tablet. Pokud je lokální kritická
sekce příliš dlouhá, navazující úzká optimalizace musí zachovat pořadí ochrany
a nesmí zadržovat DB zámek přes síť.

## Ověřování

Finální funkční SOURCE: `a3c3a5801bd009f0d78b26d452d2074bbd18e4ec`.
Dokumentační HEAD viz PR #100; následné změny jsou pouze předávka a mapa pokrytí.

| Běh / přesné SOURCE SHA | PASS | FAIL | ERROR | SKIP |
| --- | ---: | ---: | ---: | ---: |
| Plná JVM `62bd440f0bcfee8712e2cd76e64f9fa21cd5b2cf` (405) | 403 | 2 | 0 | 0 |
| Finální ochrana + TLS + cloud `a3c3a5801bd009f0d78b26d452d2074bbd18e4ec` (71) | 69 | 2 | 0 | 0 |
| Z toho ProtectedRevisionsTest na finálním SOURCE (21) | 21 | 0 | 0 | 0 |
| Chromium --all (20 sad `49365ee…`, 2 sady `5b75972…`; 82 scénářů) | 22 sad | 0 | 0 | 0 |
| Samostatný Chromium přehled `bf4445d759ccc369388becb117b0ffc64a362560` | 1 scénář | 0 | 0 | 0 |
| Rychlá sada na finálním SOURCE (kontroly/skripty) | 85 | 0 | 0 | 0 |
| Uvnitř rychlé sady Python unittest | 78 | 0 | 0 | 0 |
| Nezávislý parser/render 3 PDF ZIP fixtures z plné JVM | 3 | 0 | 0 | 0 |

**Oba nativní Gradle běhy mají celkový stav FAIL**. Jde přesně o nezměněné
`driveStagedAckMustNotPublishAfterLocalAuthorityLostInsideProviderCommit` a
`safDirectAckMustNotPublishAfterLocalAuthorityLostInsideProviderWrite` z #88:
syntetický provider vytvoří 1 validní podepsaný ACK po ztrátě autority příjemce.
Žádné `@Ignore`, Assume, odstranění ani změkčení těchto asercí. Pomocník i obě
metody byly proti #88 ověřeny byte-for-byte. Hybrid nyní drží nezávislou přesnou
kopii metadat a piny i po takovém ACK. Žádná změna wire protokolu.

Plná sada je na předchozím přesném SOURCE. Poslední změna umožňuje pouze obnovu
chybějícího média přesně podle všech pinů; ověřují ji všechny tři finální cílené
třídy (21 ochrana, 14 TLS, 36 cloud). **Plná 405 sada na finálním SOURCE NOT RUN**;
nelze ji takto označit. Webové assety a Chromium testy jsou na finálním SOURCE
bitově shodné s testovanými `49365ee...` i `5b75972...`. Browser runner snímá HEAD
při startu každé sady; během běhu přibyly pouze nativní commity. Skutečné SHA
všech 22 sad jsou ve strojovém [browser manifestu](qa/p1-hybrid-browser.json). Rychlý runner má 4 režimová NOT RUN
(Gradle, Chromium, fyzický Samsung, APK); Gradle/Chromium byly provedeny odděleně,
fyzický telefon a APK nikoli.

Skutečné prostředí: managed cloud pracovní workspace Debian 13.6, Linux 6.18.57
x86_64; Temurin JDK 17.0.21+9, Gradle 8.10.2, SDK35 / build-tools34,
Robolectric4.16.1 SDK35, 2 workers; Node24.22.1, Python3.12.14,
Chromium156.0.8078.79, Playwright z připraveného runtime. Pouze syntetická data,
lokální soubory a loopback TLS. Není to Windows HOME QA, Android instalace,
reálné rádio, Android DocumentsProvider ani živý Google účet. Android restart,
OS kill/power-cut, skutečný disk-full, Bosch/S Pen a HOME QA **NOT RUN**.
Žádný GitHub Actions trigger, APK build, merge, release ani změna verze.

**Měření malého syntetického příkladu:** 5 dalších přesných metadatových revizí,
stále 2 originální soubory / 12 bajtů; metadata 1 193 → 5 963 bajtů. Nejde o
měření 1GB zakázky. Žádná další kopie originálů nevznikla. Reálný růst při nových
unikátních médiích a dlouhé historii zůstává fyzickou akceptační bránou.

Strojově přepočtené JUnit výsledky:
[plná JVM](qa/p1-hybrid-native-full.json),
[finální cílené třídy](qa/p1-hybrid-final-transports.json),
[browser manifest](qa/p1-hybrid-browser.json).

Historie vývoje nezamlčena: původní pokusy blokoval JRE bez javac, chybějící
build-tools34 a CA/proxy. První cílený běh 22 PASS/1 FAIL měl chybný nový
low-space scénář (opakoval již archivovanou revizi), opraven na novou revizi.
Rozšíření dočasně odhalilo tři chyby nových testovacích fixture (deleted ZIP,
syncProtocol normalizace) a staré předpoklady fyzického purge. Plný běh na
`ab9701c462a3a626706701e2076378533cbc180a`: 401 / 44 FAIL, převážně setup
před vytvořením médií, přepis stejného originálu a původní purge kontrakt.
Předchozí dva pomalé plné běhy byly ukončeny při odhalení opakovaného parsování
velkých manifestů / prefs po každém souboru; opraveno bounded keší a batch commitem.
Audio/rotation/recovery fixture nyní modelují potvrzenou DB a fyzická média před
platným save, ztrátu média simulují následným skutečným odstraněním. Historické
zálohy používají pro nové bajty nové ID, starý originál se byte-exact kontroluje.
Testy purge nyní požadují piny + původní bajty a úspěšný úklid regenerovatelných
miniatur. Původní #88 RED zůstává. První Chromium --all: 21 PASS/1 FAIL kvůli
zastaralému očekávání ghost záznamu; scénář zpřísněn na #99: ghost nesmí být v
runtime ani v pozdějším save, explicitní nový import pak musí projít.

Další jediný krok: nezávisle revidovat PR #100 a finální transportní obnovu,
poté autorizované HOME QA na přesném finálním SOURCE a fyzická akceptace uvedených
bran. **INTEGRATION HOLD; žádný merge/APK/release.**
