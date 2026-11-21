# Zaměřovač 2 — živý návrh, rozhodnutí a návaznost mezi chaty

**Aktualizováno:** 21. 11. 2026. **Stav:** návrh nové samostatné aplikace a technický průzkum; žádný implementační GO, merge ani APK.  
**Pravidlo:** po každém důležitém dohodnutém rozhodnutí sem zapiš stručný stav a zdroj. V novém chatu **nejdřív načíst tento dokument**, [AGENTS.md](../AGENTS.md), [START_ZDE.md](../START_ZDE.md), aktuální PR a níže uvedené zdroje; staré SHA nepovažovat za aktuální.

## 1. Co je rozhodnuto vlastníkem (21. 11. 2026)

1. **Stavíme skutečný Zaměřovač 2 na novém technickém základu, nikoli další záplaty či pouhé přejmenování Zaměřovače 1.** Starý Zaměřovač zůstává nezávislý, nepřepisovat jeho package ID, data ani rozpracované PR. Zde probíhá **návrh**; vytvoření kódu a volba definitivní technologie se schválí odděleně.
2. **Požadavky a vize už existují.** Nevyptávat se na již vyřešené funkce. Reálně vycházet z [VIZE_A_PLAN.md](../VIZE_A_PLAN.md), [původního návrhu v2](../NAVRH_NOVEHO_ZAMEROVACE_OD_NULY.md), [projektového plánu v1](../PROJEKTOVY_PLAN_ZAMEROVACE.md), [datových kontraktů](../DATOVY_FORMAT_A_PC_KOMPATIBILITA.md), [#13](https://github.com/zaplikj30-ui/Zamerovac-android/issues/13), [#28](https://github.com/zaplikj30-ui/Zamerovac-android/issues/28), [#42](https://github.com/zaplikj30-ui/Zamerovac-android/issues/42) a souvisejících PR.
3. **Nové technologie a kvalitní architektura:** vybrat celosvětově používaný, dlouhodobě udržovaný jazyk a osvědčené technologie. Nepsat vlastní databázi, synchronizační infrastrukturu ani renderer, pokud standardní vhodná možnost obstojí. Zkoumat aktuální oficiální zdroje, kompatibilitu, licence, ekosystém, údržbu, výkon a reálné náklady; nevěřit jen slibům marketingu.
4. **Multiplatformní směr:** Android je první skutečná platforma. Předem chránit cestu k Windows, iOS a iPadOS (a případně jiným platformám), ale neslibovat souběžné vydání a předčasně neinstalovat či nepsat jejich infrastrukturu.
5. **Začít malým, kompletním a kvalitním základem, pak postupně nabalovat funkce.** Převzít z v1 ověřené uživatelské chování, datové principy a testy, nikoli nutně její problematickou vnitřní stavbu.
6. **Klíčový cíl: neopakovat chyby vývoje v1.** Spolehlivost, přesnost, jednoduchost, rychlost, zachování dat a snadné hledání příčiny chyby jsou důležitější než množství funkcí či PR.
7. **Při vypadnutí/uzavření chatu pokračovat z GitHubu.** Tento dokument je plánovací „checkpoint“, ale GitHub se neaktualizuje sám: je třeba provést a ověřit skutečný commit. Každý nový chat může načíst tuto cestu a příslušné PR.

**Oddělené produkty:** Konfigurátor–Nářezák a Převaděč spojitosti zůstávají samostatné. Budoucí zapínatelné moduly/pluginy jsou pouze možnost, nikoli dnešní úkol či souhlas se sloučením.

**Povinný rozcestník před novým návrhem/implementací:** [Inventura požadavků, nápadů a otevřených rozhodnutí](ZAMEROVAC_2_INVENTURA_POZADAVKU.md) obsahuje všech 49 bodů původního issue #12, odkazy na 28 historických testů, 44 oblastí zdrojových/testovacích map, 12 základních funkčních oblastí a 34 skupin budoucích či nedořešených nápadů. Výslovně zahrnuje kótování do 360° panoramat / možný 3D pohled, další laserové dálkoměry různých výrobců, placené funkce i ostatní dřívější nápady. **Nový katalog nenahrazuje originální vizi, komentáře v issues ani pozdější vlastníkův souhlas.** Před rozšířením se vždy kontroluje dopad na známé a budoucí potřeby; žádný nápad automaticky neznamená implementační GO.

**Nově výslovně převzato ze [#214](https://github.com/zaplikj30-ui/Zamerovac-android/issues/214) a [#224](https://github.com/zaplikj30-ui/Zamerovac-android/issues/224):** budoucí **časovač práce Start/Pauza/Stop**, historie odpracovaných úseků pro konkrétního zákazníka či zakázku a nastavená hodinová sazba (F33); **fakturace, pracovní výkaz a případný účetní modul** zvlášť (F34). Jsou to potvrzené budoucí uživatelské záměry, **nikoli požadavky na funkce prvního offline editoru ani pokyn nyní programovat účetnictví**. Odlišit **fakturaci zákazníkovi** od **monetizace licence samotné aplikace**.

**NUTNÉ VSTUPNÍ POROVNÁNÍ (ne jen seznam):** [Zaměřovač 2 proti skutečnému kódu v1 – funkce, chyby, testy a diagnostika](ZAMEROVAC_2_POROVNANI_S_V1.md). V1 ověřen na přesném `main` SHA; porovnává 16 funkčních skupin a všech 44 mapovaných oblastí testů včetně známých fyzických regresí. **Nové rozhodnutí vlastníka 21. 11.: diagnostika patří již do M1 prvního offline Kotlin/Compose prototypu**; musí bezpečně a levně měřit fáze gest/vykreslení/uložení/obnovy, bez zákaznických údajů, vyloučit vlastní vliv na výkon a odolat chybám. Samotná existence starých testů není PASS. Nezačínat velký v2 kód před posouzením těchto kontraktů.

**HLAVNÍ ŘÍDICÍ PLÁN VÝVOJE:** [Strom vývoje Zaměřovače 2 – M0, M1–M5 a pozdější větve](ZAMEROVAC_2_STROM_VYVOJE.md). Ukazuje pořadí, závislosti, výsledek a HOTOVO/STOP pro každý malý celek, pravidla práce autor → vlastní review → nezávislý kontrolor → GO vlastníka. **Nejbližší úkol M0 je dokončit datový/úložný kontrakt a bezpečnostní oponenturu**, pak teprve první Kotlin/Compose offline prototyp s jednoduchou diagnostickou vlaječkou. Tato roadmapa není nový souhlas s implementací, Actions nebo APK.

## 2. Co chceme umět — zdroje pravdy, ne druhá kopie seznamu

Cíl je pracovní postup **zakázka → fotografie/podklady → přesná editovatelná kóta/poznámka → volitelně laser → bezpečné uložení → návrat/obnova → export/sdílení**. Podrobná funkční specifikace a stavy jsou v odkazovaných dokumentech. Zachovat ergonomii už schválených kót, čar, šipek, úchopů a lupy; v1 je funkční i nefunkční **reference**, ne zaručená pravda. Reference ImageMeter 26.6.1, Pro 26.5.0 a 3.9.15 využívat pouze ke studiu funkčního chování, **nepřebírat cizí kód či vzhled**.

Klíčové kontrakty: oddělení skutečné číselné hodnoty a jednotky od pixelové geometrie; přesná editovatelná data; původní bajty všech médií; stabilní ID a vazby; Undo/Redo, historie a koš podle definovaných účelů; **první verze pouze lokálně/offline**, online provoz a synchronizace až v pozdější etapě; bezpečné uložení/obnova, ZIP/import/export, migrace; konflikty synchronizace bez tichého přepsání novějších dat; připravenost na metrické/imperiální jednotky a nejprve angličtinu. Změna v2 nesmí skrytě poškodit žádný z těchto principů.

## 3. Poučení z jedničky — co nesmíme zopakovat

**HLÁŠENÁ POZOROVÁNÍ z fyzického používání, nikoliv prokázaná příčina:** (a) po opakovaném pohybu kót se editor začne sekat, ač dřívější verze umožňovaly dlouhé souvislé posouvání; (b) přidávání složek/fotek a některé obrazovky je pomalé; (c) po opravách se někdy zhoršilo jiné ovládání nebo galerie; (d) synchronizace, historie a ukládání se komplikovaly; (e) automatické PASS nedokázaly vždy odhalit chybu na telefonu. Konkrétní důkazy/reprodukce hledat v [#13](https://github.com/zaplikj30-ui/Zamerovac-android/issues/13), [#28](https://github.com/zaplikj30-ui/Zamerovac-android/issues/28), [#231 – diagnostika dotyků](https://github.com/zaplikj30-ui/Zamerovac-android/pull/231), [#232 – zjednodušení ukládání](https://github.com/zaplikj30-ui/Zamerovac-android/pull/232) a aktuálních vydáních. **Nelze bez měření prohlásit cache, Undo/Redo, WebView či synchronizaci za prokázanou příčinu.**

**Prevence navrhovaná pro v2 (ověřit prototypem):**

- **Oddělit gesto, pracovní náhled, hotový editační příkaz a trvalé uložení.** Při každém pixelu pohybu neukládat celou zakázku, nepřidávat neomezené kopie celé scény do Undo ani nespouštět sync. Jeden dokončený přesun = jeden srozumitelný Undo krok; dlouhý plynulý přesun nesmí narůstat s počtem pohybů. Výběr úchopu a pohyb objektu mají definované priority; prst, S Pen, myš a zoom nesmějí vykazovat kolize.
- **Historie úprav ≠ běžné uložení ≠ synchronizace.** Pro běžné bezpečné uložení jednoduchý model aktuálního stavu a obnovitelného zápisu; rozsah Undo/Redo vědomě omezený/správně reprezentovaný, bez nekonečné paměťové historie. Sync potřebuje identitu, revize a ochranu konfliktů, ale nemá automaticky přenášet každý snímek pohybu ani všechny kroky Undo. Není to schválení konkrétního algoritmu, jen hranice odpovědností.
- **Osvědčená transakční úložiště:** jako kandidát lokální SQLite (případně běžná nadstavba typu Room na Androidu), nikoli vlastní složitý zapisovač; vysvětlit WAL, synchronní režim, média mimo DB, atomické vazby, backup, migrace a chování při pádu/vypnutí/plném disku. SQLite samo o sobě není zárukou integrity originálních souborů. Ověřit nejmenším skutečným testem.
- **Výkon:** nepřepočítávat či nenačítat vše při každé změně; omezit životnost cache, udržovat pouze potřebný viditelný stav a náhledy; dekódování fotek a miniatur mimo citlivou cestu gest; jasný limit paměti. Měřit latenci začátku tahu, plynulost po 100/1000 pohybech, načítání 10/100/1000 položek, velikost paměti a čas do bezpečného uložení. Konkrétní cílová čísla určit po prvním srovnávacím měření na reálných zařízeních.
- **Jednoduchá diagnostika od prvního prototypu:** malá **přesunutelná vlaječka → klepnutí otevře Diagnostiku → Zapnout/Vypnout → historie jednotlivých měření → vybrat jedno/více/všechna → Sdílet vybrané nebo Smazat vybrané / Smazat vše**. Sdílet vybrané záznamy společně, bez nutnosti mazat po jednom; historie přežije restart a nesmí se tiše ztratit. Zatím žádné další hlášení, screenshoty, obsáhlé formuláře či dashboard. Jen lehké lokální metriky časů gesta, vykreslení, uložení a chyb bez fotografií, jmen, souřadnic, hodnot laseru či zakázek; sdílení jen výslovně uživatelem, bez telemetrie. Pád či plná diagnostika nesmí rozbít editor ani jeho ukládání; ověřit režii zapnuto/vypnuto. **Podrobný akceptační kontrakt [porovnání V1/V2 §4](ZAMEROVAC_2_POROVNANI_S_V1.md).**
- **Regrese/odpovědnosti:** každá funkce izolovaně testovatelná a zároveň ověřená v souvisejících pracovních cestách. Chyba z telefonu → reprodukce → věrný RED na starém chování, pokud je proveditelný → oprava → PASS, včetně následných scénářů. Kód musí projít důkladným autorským review a následně nezávislým review jinou osobou/chatem; CI/Chromium/emulátor ≠ fyzický Android.
- **Předcházet přebujelosti:** nepřidávat novou vrstvu, speciální synchronizační příznaky, cache nebo testovací brány bez důkazu potřeby. Pokud se opakují opravy stejné konstrukce, porovnat drobnou opravu, osvědčenou knihovnu a změnu návrhu. Jednoduché a vratné řešení je cíl.

## 4. Technologie — předběžné varianty k rozhodnutí

**Zatím NEVYBRÁNO.** Cíl není „jediný jazyk za každou cenu“, ale stabilní funkce na požadovaných platformách a rychlá odezva gest.

| Varianta | Proč ji prozkoumat | Riziko / co změřit |
|---|---|---|
| **A. Kotlin + Compose Multiplatform + sdílené jádro (KMP)** | Kotlin, Android/iOS/desktop podporované sdílení logiky a Compose UI; možnost nativních adaptérů k přístrojům | Přesnost a rychlost vlastního editoru, práce s gesty a S Pen, kvalita Windows UI, iOS build, velikost a údržba |
| **B. Flutter + Dart + CustomPainter** | Jedna rozšířená grafická platforma pro Android, iOS, Windows; výrazná kontrola nad vykreslováním | Nativní Bosch/Bluetooth, složitější editor s perem, platformní soubory, přesné rozlišení vstupů, integrace knihoven |
| **C. Kotlin + nativní Android UI, portovatelné testované jádro** | Menší první krok a přímé Android API, možnost oddělit jádro pro další systémy | Dvojí UI a budoucí portování na Windows/iOS, celkové náklady a týmová údržba |
| **D. C++ + Qt 6 (QML/Qt Quick)** | Nativní C++ geometrie/výpočty, výkonné grafické UI; jeden framework pro Android/iOS/Windows; podobný technologický směr naznačen veřejným changelogem ImageMeteru (Qt6) | Bezpečnost správy paměti a údržby C++, integrace s Android Bluetooth/kamerou/S Pen přes platformní adaptéry, licenční povinnosti Qt (LGPL/GPL vs. komerční), zátěž CI, velikost aplikace, plynulost na slabších telefonech |

**Pracovní kandidáti k férovému posouzení:** A (Kotlin/KMP), B (Flutter) a nově **D (C++/Qt 6)**. C je Android-first kontrolní varianta. Nejprve malé technické srovnání licence, ceny údržby, platformních adaptérů a grafických gest; do dražšího prototypu postupují jen nejsilnější možnosti. **C++ neodmítat bez testu, ale nezaměňovat samotný jazyk za řešení dnešních blokujících ukládacích operací.** Ověřená dokumentace k 21. 11. 2026: [ImageMeter – changelog Qt 6](https://www.imagemeter.com/download/), [Qt podporované platformy](https://doc.qt.io/qt-6/supported-platforms.html), [Qt Android a nativní integrace](https://doc.qt.io/qt-6/android.html), [Qt licencování](https://www.qt.io/development/qt-framework/qt-licensing), [ImageMagick Magick++](https://imagemagick.org/script/magick++.php), [Kotlin/Compose platformy](https://kotlinlang.org/docs/multiplatform/supported-platforms.html), [Android KMP](https://developer.android.com/kotlin/multiplatform), [Flutter podporované platformy](https://docs.flutter.dev/reference/supported-platforms), [SQLite WAL](https://www.sqlite.org/wal.html), [SQLite trvanlivost](https://www.sqlite.org/pragma.html). **Platformní podpora v dokumentaci není důkazem, že náš editor funguje dobře.** Před výběrem ověřit aktualitu, licence, náročnost CI, bezpečnost a zkušenosti s reálnými aplikacemi.

**Prototyp 1 proti 1:** na stejném testovacím telefonu/tabletu stejná fotografie, jedna přesná kóta, úchopy, posun bez sekání, zoom/pan, Undo/Redo, uložit–zavřít–otevřít, test poruchy uložení; oddělené údaje o odezvě, paměti, velikosti a vývoji. Na desktopu aspoň myš/zoom v malé ukázce; pro iOS posoudit dostupné build/test prostředí. Nevybírat framework bez srovnávacích měření a design/security kontroly.

## 5. Navržené hranice nové aplikace (zatím návrh)

1. **Doména:** zakázky, ID, přílohy, přesné hodnoty/jednotky, geometrie a příkazy editace; čisté testy bez telefonu či renderu.
2. **Ukládání:** transakční stav, integrita originálních médií, průběžná obnova a verzované migrace; oddělené od UI a od sítě.
3. **Editor:** rychlý renderer, zásahové oblasti, náhled tahu a gesto; na konci pošle doméně jeden příkaz. Návrh nezaručuje finální technologii rendereru.
4. **Platformní adaptéry:** kamera, úložiště, Bosch Bluetooth, sdílení/tisk, oprávnění, pero a systémové vazby.
5. **Přenos a cloud až v pozdější etapě:** v prvním základu pouze lokální práci a uložení bez účtů, serveru, síťového přenosu či synchronizační fronty. Přitom zachovat čistá data a stabilní identity, aby pozdější rozšíření nebylo zbytečně obtížné. Až bude online etapa aktuální, rozlišit export kopie, zálohu a synchronizaci téže identity, řešit konflikty a bezpečný provoz offline/online; nejprve jen čtecí import v1. Žádné spojení v1/v2 na stejné živé úložiště bez speciálně schváleného protokolu.
6. **Rozšiřitelnost:** volitelné moduly případně v budoucnu; nyní nebudovat plugin engine ani neslučovat samostatné produkty.

## 6. Postup, aby nevznikla druhá přebujelá aplikace

- **Teď:** dokumentovaný návrh, soupis známých problémů v1, aktualizace funkční matice z již existujících zdrojů; průzkum a srovnání osvědčených technologií, licencí a nákladů; výběr nejmenšího věrného prototypu. Žádná změna zdrojů Zaměřovače 1.
- **Potom (samostatné GO):** nový samostatný repozitář, jiné package ID a oddělená data v2; jednoduché testy a automatizace na GitHub-hosted prostředí podle schváleného rozpočtu. HOME RETIRED.
- **První fungující celek:** otevřít fotografii → přidat přesnou kótu → libovolně dlouho ji plynule přesouvat/upravovat → Undo/Redo → uložit → ukončit aplikaci → beze změny znovu otevřít. Ověřit i po pádu, odpojení, přerušení a s chybějícími médii, podle rizika.
- **Pak po malých etapách:** složky a galerie, další nástroje, poznámky, export, laser, import v1, zálohy/sync — každá etapa má přímé testy i regrese již hotového základu. Před nárůstem počtu funkcí prokázat, že ovládání a rychlost se nezhoršily.
- **Srovnání:** u stejného scénáře průkazně porovnat v1 a v2, včetně rychlosti, stability, ergonomie, přesných hodnot, médií a složitosti údržby. Bez dat netvrdit, že je v2 lepší.

### Co je HOTOVO a co NE

- **FAKT:** požadavky/vize a starší návrh v2 existují; vlastník chce nový základ, multiplatformní směr, osvědčené technologie, postupný růst a prevenci chyb.
- **FAKT:** v1 byla hlášena zhoršená plynulost kót, pomalé operace a regrese; jejich úplná technická příčina tímto dokumentem **nebyla prokázána**.
- **NÁVRH:** kandidáti A/B/C/D (včetně C++/Qt), architektonické hranice a testovací prototyp.
- **NOT RUN:** žádný nový prototyp, Android test, benchmark, build, výběr frameworku, iOS či Windows ověření.
- **STOP:** žádné zásahy do v1, merge, APK, Actions, placené služby ani HOME bez příslušného GO.

## 7. Doplnění z konzultace s Claudem (video od vlastníka 21. 11. 2026)

**Zdroj:** vlastník zaslal záznam obrazovky `1000095505.mp4` zachycující svou debatu s Claudem; původní sdílený odkaz: https://claude.ai/share/c825f125-ef29-4e25-a680-ab4c8cfb0b12 . Níže je **věcný výtah z viditelného obsahu videa**, nikoli ověření všech Claudeových tvrzení. Video samotné se kvůli velikosti a soukromí **nevkládá** do veřejného repozitáře.

### Nově upřesněné požadavky vlastníka

- **V1 je testovací aplikace; současná testovací data není nutné převádět.** V2 vzniká vedle ní odděleně, bez přepisu v1. Dřívější plán migrace v1 → v2 proto **není podmínkou zahájení**. Při budoucím importu, práci s reálnými zakázkami nebo přechodu zákazníka bude kompatibilitu, originální média a bezpečnost nutné řešit znovu, ne je vypustit z architektury.
- **Přenést smysl funkčních testů a známé chování, ne nutně jejich konkrétní testovací kód.** Vlastník chce využít dosavadní testy, specifikaci editoru a scénáře chyb; není požadavek držet WebView/JavaScript jen kvůli snadnému znovupoužití testů.
- **Zaměřovač může být jednou součástí většího pracovního celku**, ale ostatní aplikace zůstávají samostatné. Vlastník se zajímá o zapínatelné moduly; nyní to neznamená plugin framework ani sloučení aplikací.

### Co konkrétně navrhl Claude (NÁVRH/ODHAD, nikoli rozhodnutí)

1. **Začít návrhem ústavy dat:** jasně určit, co je rozpracovaná editace, potvrzený stav, původní fotografie, přesná naměřená hodnota, popisek, uložená zakázka a odstraněná položka; které části smějí zmizet při pádu a které nikdy. Z funkční matice v1 převzít očekávané chování pro novou architekturu. Toto doporučení přijímáme jako **užitečný návrhový princip**.
2. **Jednoduché lokální úložiště po zakázkách:** například jednotlivé `job.json` (aktuální stav) a `job.prev.json` (předchozí platná kopie), média zvlášť a neměnná; zápis do dočasného souboru, kontrola a atomické přejmenování. Pohyb kóty není trvalá historie. Undo/Redo patří k editačním příkazům. **Oponentura:** „1+1“ je kandidát pro jednoduchý prototyp, ne schválený produkční kontrakt. Samotné přejmenování nebo jediná kopie nemusí řešit výpadek během zápisu, korektní `fsync`, plný disk, porušení vazeb na média, souběh, konflikty, koš, migrace či backup. Před volbou porovnat se SQLite/Room a otestovat stejné chybové scénáře; nebudovat zbytečné vlastní DB.
3. **Technologie:** Claude preferuje Kotlin + Jetpack Compose pro Android UI, čisté Kotlin jádro (data, jednotky, geometrie, ukládání) a případný pozdější Kotlin Multiplatform; jako alternativy zmiňuje Flutter, React Native a zachování webového editoru při náročném přepisu. **Není to výsledný výběr**: porovnat s variantami A/B/C v §4, včetně skutečného multiplatformního rozsahu a gest na telefonu/tabletu.
4. **Moduly místo pluginového frameworku:** sdílené jednoduché jádro (zakázka, ID, geometrie, hodnoty/jednotky), konkrétní moduly/editor/galerie/laser/export s jednosměrnými vazbami a platformní adaptéry. Pozdější propojování aplikací přes explicitní verzovaný **datový kontrakt** (stabilní ID, přesná hodnota nezávislá na textu, jednotky, verze, chování neznámých polí); nechat každé aplikaci vlastní úložiště. Nezavádět dynamické stahované pluginy bez konkrétní potřeby.
5. **Postup M0–M8 (pracovní návrh, nikoli harmonogram):** M0 pravidla dat a matice testů; M1 fotografie + přesná kóta + uložit/zavřít/otevřít + stres gest; M2 jádro/jednotky/Undo/Redo/obnova po pádu a plném disku; M3 editor a další nástroje; M4 zakázky/galerie/koš; M5 měření včetně Bosch; M6 ZIP/PDF export a import; M7 jazyk/vzhled/ovládání; M8 synchronizace až po vlastním návrhu a důkazech. Toto pořadí lze upravit podle závislostí a výsledků prototypu.
6. **Možná akceptační metrika M1:** cca **1 000 souvislých tahů bez zhoršení plynulosti** a pokus o uložení do **300 ms na konkrétním testovaném telefonu**. Jsou to **navržené cíle, nikoli naměřené výsledky či univerzální SLA**. Upřesnit význam latence, velikost dat, slabší zařízení a test na Samsung Galaxy S24 Ultra / Tab S11 Ultra před rozhodnutím o technologii.

### Testy z v1: co skutečně jde převzít

- **Funkční scénáře, znalost ergonomie, negativní případy, datové vzorky a očekávané výsledky** jsou přenositelné jako zadání bez ohledu na technologii.
- **Doslovné JS unit testy** lze využít přímo jen tehdy, když zůstane odpovídající JS jádro/API; u Kotlinu či Flutteru se očekávané chování **přepíše do nativních testů**. Java testy ochrany starého úložiště/sync se nedají prohlásit za PASS nového úložiště.
- Chromium/Playwright scénáře původního WebView nejsou fyzickým ověřením nového nativního UI. Nutný samostatný test prst/S Pen/zoom/výběr, Android ukládání a pád; později případně Windows myš a iOS zařízení.
- Claude ve videu uvádí počty souborů/testů a hypotézy o příčinách sekání. **Tyto počty ani příčiny nebyly v tomto doplnění nezávisle ověřeny na aktuálním SHA a nepoužívají se jako důkaz.**

**Vyhodnocení:** nejcennější je začít **kontraktem dat + věrným prototypem foto–kóta–uložení–obnova**, nikoli nejprve sestavovat celý framework. V1 ani předchozí dokumentace se nemění; **výběr technologie, datové úložiště a architektura jsou stále otevřená rozhodnutí**, která vyžadují měření a samostatný souhlas.

## 8. Finální upřesnění vlastníka 21. 11. 2026: nejprve čistě offline základ, online až později

**ROZHODNUTÉ POŘADÍ VÝVOJE:** **První malý funkční Zaměřovač 2 bude jen offline**, bez registrace, cloudového účtu, serveru, síťových volání, synchronizačních front a internetové infrastruktury. Nejdřív fotografie → přesná kóta → plynulé úpravy → Undo/Redo → jednoduché bezpečné lokální uložení → zavření a obnovení; pak postupně další základní nástroje, galerie, zakázky a potřebný export. **Online až v budoucí samostatné etapě**, po ověření fungujícího základu a novém rozhodnutí vlastníka: případně účty, sdílení a synchronizace mezi telefonem, tabletem a počítačem. Aplikace tedy není navždy omezena na offline, ale nyní se online **nenavrhuje do implementačních detailů ani neprogramuje**. Stačí neudělat zbytečně neprůchodné datové hranice (editovatelné objekty, stabilní ID, jasné jednotky). Není nutné dnes vytvářet sync protokol, jeho revize, API ani server. Bez internetu musí budoucí verze vždy umět lokálně pracovat.

**UPŘESNĚNÝ PRINCIP OCHRANY DAT:** Ochrana skutečných zakázek a přesných naměřených hodnot je zásadní, ale první aplikace mohla přebujet zbytečnými vrstvami záloh, historie a potvrzování; **není prokázáno, že právě ony způsobují hlášené zpomalení**. V nové aplikaci upřednostnit *nejmenší jednoduchou ochranu, kterou lze prokázat testem*: po potvrzeném uložení se nesmí poškodit zakázka ani originály médií; při nedokončeném gestu/pádu je přijatelné řešit ztrátu právě rozpracovaného tahu odlišně od ztráty již potvrzené práce. O této hranici rozhodnout konkrétními akceptačními testy, ne obecnou zárukou „nikdy nic neztratíme“.

**NÁVRH IMPLEMENTAČNÍHO PRAVIDLA (zatím neschválené technické řešení):**
- Normální přesouvání kóty = levný přechodný náhled; hotová úprava = jedna změna dat a jeden Undo krok; běžné uložení se neplete s historií ani sync.
- Jedno lokální transakční úložiště s rozumným obnovitelným stavem; **žádné násobení nezávislých pojistek jen „pro jistotu“**. Porovnat „1+1“ se SQLite/Room podle skutečné spolehlivosti, náročnosti a výkonu. Neměnit kompaktnost za nevratnou ztrátu již uložených dat.
- **Teď žádný sync.** V budoucí online etapě bude třeba samostatně navrhnout revize a řešení konfliktů dvou zařízení, nepřenášet historii všech gest a nepřepisovat staršími daty novější. Netestovat nyní hypotetický online protokol.
- **První etapa:** věrné malé testy plynulého pohybu, uložit → zavřít → obnovit, pád během uložení, plný disk a chybějící médium. **Pozdější online etapa:** přechod offline/online a dvě souběžné kopie. Každou novou ochranu odůvodnit konkrétním rizikem a ověřit, že nevnáší neúměrné zpoždění.

**Rozsah tohoto doplnění:** pouze rozhodnutí o cílovém chování a návrhové principy. **NEOVĚŘENO:** konkrétní výkon, příčina chyb v1, spolehlivost 1+1 nebo SQLite, funkční synchronizace a její kompatibilita. Bez nového GO žádné programování ani přepis v1.

## 9. Pokyn pro navazující chat

„**Pokračujeme na Zaměřovači 2. Načti aktuální `docs/ZAMEROVAC_2_ZIVY_NAVRH.md` na GitHubu a odkazované dokumenty. Zkontroluj skutečný HEAD/PR a napiš, co je rozhodnuto, co ještě navrhnout a jaký je nejbližší malý krok. Nové dohody zapisuj do stejného dokumentu v izolované větvi/PR, aby další chat nemusel číst celou historii.**“

Při změně požadavku zapisovat datum, důvod a stav (rozhodnuto/návrh/neověřeno). **Neudělat z pracovního návrhu automaticky implementační schválení**. Podrobný starší návrh: [NAVRH_NOVEHO_ZAMEROVACE_OD_NULY.md](../NAVRH_NOVEHO_ZAMEROVACE_OD_NULY.md). Dokumenty o stávajícím Zaměřovači 1 zůstávají platné pro svou aplikaci.


## 10. Rozhodovací bod 21. 11. 2026: zjednodušit v1, nebo stavět v2?

**OTÁZKA VLASTNÍKA, nikoliv finální rozhodnutí:** ochrana dat v1 mohla být přehnaná. Nestačí-li její redukce, dává smysl nový základ? Vlastník zároveň opakovaně pozoroval, že po opravě jedné části vznikají další chyby.

**Nové ověřené podklady z GitHubu:**
- [#221](https://github.com/zaplikj30-ui/Zamerovac-android/issues/221) dokumentuje uživatelův **fyzický srovnávací test**: po čisté instalaci v1.3.0 plynulé kóty; ve v1.4.0 kumulativní sekání po opakovaných úpravách, přetrvává po restartu a zasahuje druhou fotografii. **Pozorování není důkaz jediné příčiny.**
- [#231](https://github.com/zaplikj30-ui/Zamerovac-android/pull/231) / [#230](https://github.com/zaplikj30-ui/Zamerovac-android/pull/230) uvádějí naměřená dlouhá synchronní uložení cca 4,6–5,3 s a přibližně 99 % času v `revisionProtectMs`. To je **konkrétní kandidát na zásadní bottleneck**, nikoli důkaz příčin všech UI/regresních problémů. PR #230 je zavřené bez merge; jeho pouhé zvýšení cache nebylo potvrzeným finálním řešením.
- [#232](https://github.com/zaplikj30-ui/Zamerovac-android/pull/232) je pouze **DRAFT test/RED kontrakt** cílového běžného ukládání „1 aktuální + 1 předchozí“; **neimplementuje opravu, testy nejsou na tomto SHA skutečně spuštěny**. Současná ochrana médií a sync vyžaduje samostatné posouzení, nelze ji plošně odstranit.

**Alternativy k věcnému rozhodnutí:**

| Cesta | Klady | Rizika / hranice |
|---|---|---|
| **A. Úzká vratná redukce historie/ochrany ve v1** | Může rychle prokázat, zda je sekání hlavně ukládáním; zachovává hotové funkce | Závislosti na historii, sync, médiích; nutná věrná regrese a SOURCE/SECURITY review; stále stará architektura |
| **B. Cílené rozdělení v1 na testovatelné části** | Zachová uživatelskou funkčnost a může zmenšit budoucí regresní riziko | Delší zásah do provázaných souborů, regresní rizika, náklady na refaktoring |
| **C. Nový malý základ v2 + převzetí scénářů, nikoli kódu** | Umožňuje jednodušší hranice, přenositelnost Windows/iOS, rychlý renderer/uložení bez historických vrstev | Počáteční funkční zaostávání; nová technologie přinese vlastní chyby; výkon a cena zatím NEOVĚŘENO |

**DOPORUČENÝ PŘÍŠTÍ NEJMENŠÍ POKUS (návrh, nikoliv souhlas s kódem):** na izolované kopii v1 provést jednu bezpečně vratnou, rizikově omezenou úpravu doloženého bottlenecku, s testem opakovaného pohybu/uložení a kontrolou médií. Pro návrh v2 nezávisle připravit jediný **offline** prototyp foto–kóta–Undo/Redo–uložit–obnovit na vybraných kandidátních technologiích. Nemusí současně běžet dva plné vývojové proudy: nejprve stanovit srovnatelný scénář a bránu, až pak v rozsahu schváleném vlastníkem prototypy. Rozhodovat podle **latence po opakování, stability po restartu, přesnosti a integrity dat, počtu nově rozbitých vazeb a údržby** — nikoli podle dojmu z „moderního“ frameworku.

**ZÁVĚR PRO NYNĚJŠÍ NÁVRH:** nepovažovat ochrany za jediného viníka; jejich přebujelost je **kandidát**, opakované regrese jsou širší varování. Proto ponechat záměr v2 otevřený a nezahazovat funkční v1 bez kontrolovaného srovnání. **Žádné automatické GO pro změny kódu, nové SDK, testovací cloud ani merge.**


## 11. Jednostránkový kontrakt dat a rozsah podporovaných telefonů (21. 11. 2026)

**Ústava dat M0:** Claude ve videu doporučil na **jednu stránku** uzavřít, co smí zmizet při pádu a co nikdy, před začátkem programování editoru. S tímto postupem souhlasíme jako s **návrhovou bránou, ne s další složitou pojistkou**. Samostatný stručný návrh: **[ZAMEROVAC_2_USTAVA_DAT.md](ZAMEROVAC_2_USTAVA_DAT.md)**. Rozlišit potvrzené uživatelské principy od dosud **nevybraného technického řešení** (1+1 vs. SQLite/Room, forma jednotky ukládání). V1 má v [#221](https://github.com/zaplikj30-ui/Zamerovac-android/issues/221#issuecomment-7055764442) schválené cílové 1+1, ale [#232](https://github.com/zaplikj30-ui/Zamerovac-android/pull/232) je jen testovací DRAFT/RED, **nikoli hotová oprava nebo fyzický PASS**. V2 vlastní úložiště ani funkční M0 zatím nemá.

**Kompatibilita:** Claude ve videu jmenoval testování na **Galaxy S24 Ultra a Galaxy Tab S11 Ultra**, což je pouze dostupná dvojice pro počáteční fyzické zkoušky, **nikoliv úplná testovací matice ani cílové omezení na Samsung**. Navazuje [KOMPATIBILITA_ZARIZENI.md](../KOMPATIBILITA_ZARIZENI.md) a [VIZE_A_PLAN.md](../VIZE_A_PLAN.md): zamýšlená široká podpora telefonů a tabletů Android různých značek (např. Pixel, Xiaomi, Motorola, OnePlus, Honor) při skutečně stanoveném rozsahu Android API. Žádná z těchto značek zde zatím nemá pro v2 fyzický PASS.

**Testovací vrstvy bez zbytečného přehánění:**
1. **Během prvního prototypu:** S24/Tab jako referenční dostupná zařízení + cílené automatické/emulátorové varianty menší obrazovky, pomalejšího zařízení a odlišné podporované verze Androidu. Prst je povinný, pero/S Pen navíc; měřit 60/120 Hz, měřítko písma, orientaci, paměť a správná oprávnění podle dostupnosti.
2. **Před širším testovacím vydáním:** reálný **alespoň jeden telefon jiné značky a nižší/střední třídy** plus tablet/telefon různé velikosti, ověřit základní pracovní průchod, fotografie/soubory, dlouhé tahy, uložení/obnovu a zamítnuté oprávnění. Pokud zařízení není dostupné, označit NOT RUN a zajistit cílený test, ne tvrdit podporu.
3. **Před veřejným vydáním:** rozšířit matici podle cílového rozsahu Android verzí, velikostí a výrobců, včetně služeb na telefonu bez Google účtu a podle relevantnosti různých Bluetooth/stylus variant. Konkrétní modely a minimální Android rozhodnout až podle technologického prototypu. Žádný nákup zařízení či placená testovací služba bez GO vlastníka.

**Důležité:** Android běh, Chromium, emulátor a skutečný jiný telefon nejsou zaměnitelné důkazy. Nevyžadovat každý fyzický model při každé drobné změně; testovat úměrně riziku, ale před tvrzením „funguje na různých telefonech“ mít důkazy z různých zařízení.


## 12. Google Disk: zálohy vs. úsporná synchronizace (21. 11. 2026; návrh pro budoucí etapu)

**FAKT – již existující požadavek:** [#40](https://github.com/zaplikj30-ui/Zamerovac-android/issues/40) rozlišuje **živou synchronizaci** aktuální práce mezi zařízeními a **obnovitelné historické zálohy** na Google Disku; zálohy obou zařízení a jejich historie se nemají navzájem přepisovat ani být automaticky smazány přenesením mazání ze synchronizace. Google Disk je možné společné úložiště pro oba účely, avšak **oddělené složky/identity a režim obnovy**. To již bylo plánované; nevymýšlet druhý duplicitní systém. Návrh na obnovení po ztrátě telefonu se netýká jen druhého synchronizovaného telefonu — bezpečná obnova vyžaduje **samostatný historický záložní bod**. U v2 se zálohy/online **neimplementují v první offline etapě**.

**FAKT ze zdrojů v1 na main `8a36e353448ba74a066e16372441604b7e7163c7`:**
- `editor.js:finishHandleGesture → commitEditor → save()` ukládá po dokončeném gestu lokálně (nikoli per `pointermove`). `LocalDatabase.write` před každým takovým uložením prochází `ProtectedRevisions`. Tato práce může trvat sekundy. **Lokální save není automaticky internetový upload.**
- `SyncCadence` v režimu auto plánuje cloudový pokus v popředí po ~60 s, systémový Job na pozadí v intervalu ~15 min; přímé připojení k zařízení má auto minimální odstup ~20 s, tick běží po 10 s. Android může běhy zpozdit. Aktuální stav přenosu, objem a konkrétní aktivace na fyzickém telefonu tím nebyly otestované.
- `PeerSnapshot` a `PeerOutbox` přenášejí potvrzené snapshoty a kvůli stávající recovery i historické podklady; proto by bylo nepřesné tvrdit, že v1 „posílá každý `pointermove`“, i stejně nepřesné tvrdit, že vždy odesílá pouze finální poslední kótu.

**NÁVRH pro budoucí v2, vyžaduje pozdější zvláštní schválení a technický test:**
1. **Každý dokončený editační příkaz bezpečně lokálně uložit**, okamžitě bez čekání na internet. Přesouvání kóty během držení prstu nesmí vytvářet síťová data či periodický trvalý archiv.
2. Po uložení označit zakázku jako „čeká na synchronizaci“; **neodesílat každou mezipozici**. Do přenosu poslat nejnovější potvrzený výsledný stav a potřebná originální média. Pokud se mezitím v offline režimu mění více zařízení, uchovat nezbytné údaje o rozdílných revizích, mazání a nevyřešeném konfliktu; bez tichého přepisu.
3. **Spouštěče přenosu:** odchod z editoru (přednostní), ruční „Synchronizovat“, a úsporný časový/obnovovací spouštěč při dlouho otevřeném editoru či návratu internetu. **Jen odchod z editoru nestačí**: v případě pádu, nuceného ukončení či dlouhé otevřené práce by sync nemusela nastat. Konkrétní interval není schválen, určit podle měření, stavu baterie, sítě a mobilních dat.
4. **Síť i tvorbu snapshotu vykonávat mimo citlivou cestu dotyku a UI**; pokusy opakovat podle potřeby s omezením a bez nekonečné fronty mezilehlých tahů. Zobrazit „lokálně uloženo / čeká na synchronizaci / synchronizováno / konflikt“.
5. **Zálohy na Disku oddělené od synchronizace:** manuální bezpečná kopie, později volitelná rozumná automatika až na výslovné rozhodnutí. Úspěšná sync není důkaz existence ověřené zálohy. Smazání na zařízení nesmí tiše odstranit předchozí historický záložní bod.

**Stav:** dohodnutý cíl offline první; Google Disk jako budoucí zálohy/synchronizace dle stávajících plánů; okamžité odesílání každého gesta **není požadavek**. Konkrétní budoucí politika synchronizace je **NÁVRH**, ne implementovaná či telefonem ověřená funkce. Žádný nově schválený cloudový běh ani zásah do v1.


## 13. C++ / Qt oproti Kotlinu a Flutteru – oprava opomenutého kandidáta (21. 11. 2026)

**FAKT:** Uživatelská zmínka o „ImageMagick používá C++“ může znamenat dvě odlišné věci: **ImageMagick** je knihovna na zpracování obrázků (s C++ API Magick++), nikoli editor zakázek; **ImageMeter** je naše funkční referenční aplikace a na oficiální stránce změn uvádí „upgrade GUI toolkit to Qt6“. To **nedokazuje**, že celá aplikace ImageMeter je v C++; podporuje však prověření Qt6/C++ jako realistické možnosti pro vlastní grafický editor.

**OPONENTURA:** C++/Qt může být dobrý kandidát pro složitou geometrii, rendering, více platforem a rychlé gesta. Není však automaticky rychlejší u neefektivního modelu ukládání/synchronizace; zavádí náročnější správu paměti, multiplatformní balení, mobilní Bluetooth/kamera/pero adaptéry a licenční kontrolu. Licenci Qt hodnotit podle skutečně použitých modulů a modelu distribuce, ne předpokládat bezplatnost nebo nutnost platby. V rámci malého porovnání A/B/D ověřit stejné gesto, 20–50 kót na fotografii, opakované tahy, paměť, rozlišení a Android slabší třídy, důkazy a celkové náklady na vývoj. **Žádný framework ani knihovna ImageMagick se nyní neinstaluje, nic se zatím neimplementuje.**


## 14. Volba technologie – minimalizace rizik C++ (rozhodnutí priority, 21. 11. 2026)

**PREFERENCE VLASTNÍKA:** Nenasazovat C++/Qt jen kvůli dojmu maximálního výkonu nebo podobnosti s ImageMeterem. Vyhnout se dodatečným chybám paměti, mobilním adaptérům, licenčnímu a údržbovému zatížení, pokud tato cesta **neprokáže skutečně významnou výhodu dnes či pro realistické budoucí Windows/iOS**. C++ není zakázáno, pouze má vyšší důkazní práh.

**DOPORUČENÉ PRACOVNÍ POŘADÍ, nikoli definitivní schválení frameworku:**
1. **Kotlin + Jetpack Compose pro první Android prototyp**, s oddělenou Kotlin doménou, přesnou geometrií/jednotkami, lokální SQLite a hardware adaptéry. Sdílené části lze později využít přes Kotlin Multiplatform; Compose Multiplatform má oficiálně stabilní Android/iOS/desktop, ale to **nezaručuje** vyhovující chování konkrétních editorových gest na všech platformách.
2. Pokud by Compose editor nedosáhl požadované plynulosti ani po profilování a úzké opravě renderingu, krátce ověřit **alternativní renderer / Flutter** na stejném fotokóta gestickém scénáři. Nedělat automaticky kompletní druhý produkt.
3. **C++/Qt či nativní C++ renderer teprve tehdy**, pokud měření nebo konkrétní budoucí funkce prokáží podstatný náskok, kterého jednodušší cesta nedosáhne za přiměřené náklady. Vyčíslit a zvážit práci na Androidu, Windows/iOS, S Pen/gesta, licence, udržovatelnost a riziko regresí; vše na stejné testovací sadě, včetně slabších telefonů.

**FAKT / LIMIT:** To je technicky zdůvodněné pořadí ke zkoušce, **nikoli naměřené pořadí rychlostí, definitivní výběr technologie ani GO k vytvoření aplikace**, nákupům či cloudovým běhům. Zachovat možnost změny rendereru díky oddělení datového jádra od UI. Příští krok je jediný malý věrný prototyp, ne tři souběžné velké implementace.


## 15. Rozhodnutí vlastníka: první prototyp Kotlin + Compose (21. 11. 2026)

**SCHVÁLENO – technologická preference pro první ověřovací prototyp Zaměřovače 2:** **Kotlin + Jetpack Compose na Androidu**, samostatně testovatelná Kotlin logika (geometrie, hodnoty/jednotky, editační příkazy) a oddělené ukládání; **SQLite je preferovaný kandidát k ověření**, nikoli automaticky hotová databázová architektura. Důvod: pokud C++ nepřinese měřitelný významný přínos, nepřidávat komplikace správy paměti, náklady na údržbu a platformní adaptéry.

**ZÁLOŽNÍ MOŽNOSTI:** při skutečném limitu výkonu/gest po profilování ověřit cílený jiný renderer nebo Flutter. **C++/Qt jen při prokázané výrazné současné nebo budoucí výhodě** nad jednodušším řešením; žádné automatické paralelní tři prototypy. Směr budoucích Windows/iOS zůstává, ale první zkouška je Android a multiplatformní infrastrukturu teď nebudujeme.

**HRANICE SOUHLASU:** souhlas s volbou **prvního prototypu**, nikoli tvrzení o jeho výsledcích či GO k založení projektu, implementaci, cloudovým testům, placeným službám, merge nebo APK. Změny se mají prověřit proti požadavkům kót, prst/S Pen, výkonu slabších Androidů a obnově dat; po měření rozhodnout o pokračování.


## 16. Budoucí monetizace – zachovat možnost bez předčasné implementace (21. 11. 2026)

**FAKT / dlouhodobé zadání:** V [VIZE_A_PLAN.md](../VIZE_A_PLAN.md) už je monetizace **výslovně zapsaná jako otevřená možnost** (části „Budoucí zpoplatnění funkcí či modulů“ a „Možná budoucí monetizace reklamou“). Pro Zaměřovač 2 se přebírá **požadavek neznemožnit budoucí komerční model**, nikoli schválená cena, předplatné, reklama či vydání na Google Play.

**Možné varianty k pozdějšímu rozhodnutí:** zdarma; jednorázová koupě celé aplikace; volitelné placené funkce/moduly/balíčky; předplatné; bezplatná varianta s nerušivou reklamou a jednorázovým odstraněním reklam; případně profesionální licence. Do budoucího posouzení patří i možnost legálně poskytnout vybraným testerům/uživatelům bezplatný přístup či promo kód **bez předem vyvíjeného vlastního licenčního serveru**. Ani jedna varianta nyní není definitivně vybrána.

**Architektonická zásada teď:** oddělit data zákaznických zakázek, přesné hodnoty, offline editor a média od případného budoucího **oprávnění k funkcím / licence**. Změna tarifu nebo nedostupnost obchodní služby **nesmí smazat či poškodit zakázky ani zrušit bezpečný přístup k vlastním datům/exportu**. Moduly mohou zůstat logicky oddělené; **nebudovat nyní plugin engine**. Případné reklamy nesmějí zakrývat editor, úchopy nebo kóty ani narušit práci bez internetu; klientské fotografie/zakázky neposílat reklamním SDK.

**TEĎ NEDĚLAT:** platby, účty, licenční server, reklamní SDK, analytiku, bannery, tarify, omezení funkcí ani registraci do obchodů. Před zavedením monetizace odděleně rozhodnout obchodní model, ověřit pravidla Google Play/Apple, soukromí/GDPR, licenční podmínky, offline chování, obnovu případných nákupů a přenositelnost na Windows/iOS. První prototyp Kotlin/Compose zůstává **malý a plně offline**.

**Stav:** pouze zachování budoucí možnosti v architektuře, žádný nový souhlas k obchodním funkcím, výdajům, vydání nebo implementaci.
