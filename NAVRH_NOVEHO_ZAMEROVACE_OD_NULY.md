# Zaměřovač 2 – návrh úplně nové aplikace od nuly

**Datum:** 6. 11. 2026  
**Stav:** Samostatný návrh a výchozí pracovní plán. **Není spuštěný vývoj nové aplikace, schválená změna produkčního kódu ani rozhodnutí nahradit původní Zaměřovač.**

## 1. Co uživatel skutečně zamýšlí

Vytvořit **druhý, skutečně nový Zaměřovač**, který bude postupně umět to samé co existující aplikace, ale vznikne na znovu promyšlených technických základech. Nejde pouze o kosmetické úpravy, modernizaci uvnitř původního programu ani přejmenování stávající aplikace.

- **Zaměřovač 1** zůstává použitelná, nezměněná referenční aplikace. Její vydání, aktualizace a opravy pokračují nezávisle.
- **Zaměřovač 2** by byl vyvíjen **odděleně**, ideálně ve vlastním repozitáři a s vlastní testovací identitou, aby nemohl přepsat aplikaci nebo uživatelská data první verze.
- Nový návrh využije získané požadavky, funkční ukázky, zkušenosti a testy; nemusí mechanicky opisovat starou strukturu kódu.
- Původní aplikace se nebude rušit, dokud nebude na skutečných datech a zařízeních prokázána funkční a datová rovnocennost nové verze.

## 2. Co známe a co zatím nevíme

**Ověřený vývojový kontext k datu návrhu:**
- Poslední vydaná testovací verze původní aplikace je **1.2.152**. Existující kombinace Android/Java a HTML/CSS/JavaScript WebView obsahuje zakázky, fotky, editor anotací, Bluetooth Bosch, poznámky, export a další nástroje; ne všechny funkce prošly praktickým ověřením.
- Velká aktualizace je rozpracovaná v [issue #39](https://github.com/zaplikj30-ui/Zamerovac-android/issues/39) / [draft PR #41](https://github.com/zaplikj30-ui/Zamerovac-android/pull/41); implementační checkpoint `86b0a63`, poslední známé předání `fefb46ff`. Obsahuje zásadní změny ukládání, synchronizace a záloh. **Zelené CI nenahrazuje nezávislý audit ani test na telefonu/tabletu a reálném účtu Google.**
- [Issue #42](https://github.com/zaplikj30-ui/Zamerovac-android/issues/42) obsahuje pravidla architektury a bezpečnosti; [#28](https://github.com/zaplikj30-ui/Zamerovac-android/issues/28) registr automatických testů; [#13](https://github.com/zaplikj30-ui/Zamerovac-android/issues/13) uživatelské testy; [VIZE_A_PLAN.md](VIZE_A_PLAN.md) schválené i neschválené nápady.
- [Datový formát a kompatibilita](DATOVY_FORMAT_A_PC_KOMPATIBILITA.md) popisuje existující starší `schema: 1` a ZIP; úpravy v #39 mohou přidávat další kontrakty. Nesmí se předstírat, že je současný formát již definitivním univerzálním standardem.

**Před zahájením nové implementace je nutné zjistit:** co konkrétně v původní aplikaci funguje na zařízení, co je jen v kódu, co je rozpracované, co je závada a jaké chování uživatel opravdu chce zachovat. Samotný seznam souborů nebo automatických testů není průkaz celkové funkčnosti.

## 3. Požadovaná funkční shoda

Novou aplikaci posuzovat podle **použitelných uživatelských postupů**, nikoliv jen podle počtu tlačítek:

1. **Zakázky a galerie:** založení, organizace složek, fotografie a videa, přehled, hledání, mazání/koš, obnova, rychlé načítání.
2. **Fotografický editor:** přesné kóty, čáry, šipky, lomené čáry, dimenzní/kumulativní řetězce, obdélník, lichoběžník, kruh, elipsa, úhel, volná kresba, symboly, práce s úchopy a zoomem, lupa, zarovnávání a přichytávání; vše editovatelné po zavření.
3. **Poznámky a přílohy:** text, fotografie, zvuková nahrávka, šipka, umístění a přístup z galerie; hlasová nahrávka není totéž jako budoucí rozpoznávání řeči.
4. **Měření:** Bluetooth Bosch (BLE/Classic podle skutečně podporovaných zařízení), ruční přesné hodnoty a historie, jasné stavy připojení, bezpečné přiřazení hodnoty konkrétní kótě.
5. **Uložení a předání:** offline režim, automatické bezpečné ukládání, Undo/Redo, historie, ZIP export/import, zákaznické PDF, úplná obnova bez ztráty původních dat.
6. **Synchronizace a zálohování:** až po doložené akceptaci #39 popsat očekávané cloud/LAN/direct chování, autorizaci, offline frontu, historii a konflikty; netvrdit shodu s dosud neověřenou funkcí.
7. **Přístupnost a ovládání:** telefony i tablety, různé výkony zařízení, prst/pero/myš, srozumitelné české ovládání a příprava dalších jazyků, nápověda odpovídající realitě.

**Každá funkce bude mít řádek v matici:** požadované chování → důkaz ve staré verzi → co nová verze implementuje → automatický test → fyzické ověření → zbývající rozdíl. Oddělovat *hotovo / částečně / nefunguje / pouze nápad*. Nápady nepřidávat automaticky do prvního vydání v2.

## 4. Jak by měly vypadat nové technické základy

Architekturu je nutné teprve vybrat podle krátkého funkčního prototypu, ne podle módního názvu frameworku.

- **Společná doména:** identita zakázky, hierarchie složek, geometrie, skutečné rozměry, jednotky a editovatelné anotace. Hodnota rozměru nesmí být odvozena z délky čáry na fotografii. Oddělit číselnou hodnotu od zobrazovaného textu a jednotky, bez tiché ztráty přesnosti.
- **Jednoznačné a verzované soubory:** dokumentované schéma, migrace, bezpečný import starých verzí, práce s neznámými poli, úplnost médií a reference. Golden testovací soubory pro všechny podporované generace dat.
- **Bezpečné ukládání:** atomický zápis, ověření úplnosti, zotavení po pádu/vypnutí, zálohy bez přepisování originálu, žádné souběžné nekontrolované zapisovače.
- **Editor:** oddělená modelová geometrie a vykreslování, jednotný vstup dotyk/pero/myš; příkazy editace a Undo/Redo testovatelné bez UI.
- **Systémové adaptéry:** kamera, soubory, Bluetooth, účet, zabezpečené úložiště, síť a notifikace oddělené od společných pravidel.
- **Přenositelnost:** primárně Android; dlouhodobě možnost Windows, iOS/iPadOS, macOS, Linux, web/ChromeOS a dalších systémů bez předčasného slibu jejich vydání. Neinstalovat všechna možná SDK předem.
- **Soukromí:** bez zákaznických zakázek v testech, chránit tokeny, osobní fotografie a účty, žádné nechtěné cloudové přenosy.
- **Technologické varianty k porovnání:** nativní Kotlin + Jetpack Compose; sdílené modely/testy například Kotlin Multiplatform; případně webový editor s odděleným jádrem. Teprve prototyp přesného úchopu, výkonu, práce s fotografiemi, datové kompatibility a Bluetooth rozhodne, co je vhodné. **Výběr není schválen.**

## 5. Bezpečnostní hranice nové aplikace

1. Nová aplikace používá **jinou testovací identitu/package ID a oddělený datový prostor**. Nesmí se omylem nainstalovat jako aktualizace původní, změnit její podepisování, nahradit její databázi nebo mazat její soubory.
2. **Migrace nejprve jen čtením:** vytvořit zálohu, načíst kopii/export do v2, ověřit fotografie, vazby, přesná čísla a editovatelnost. Žádné mazání ani přepis originálu. Zpětný přenos/obousměrná synchronizace je samostatné rozhodnutí a musí být testována na konflikty.
3. Přenos ze staré verze nesmí smazat neznámá pole a neznámé nové objekty; nepodporované formáty bezpečně odmítnout s vysvětlením.
4. Původní a nová aplikace **nesmějí současně upravovat stejné živé cloudové zakázky**, dokud se kompatibilita protokolů a řešení konfliktů skutečně neprokáže.
5. Žádné „v2 funguje“, dokud neprošla srovnávací funkční matice, datové testy, build a skutečné ověření na zařízení. Tyto úrovně důkazů uvádět odděleně.

## 6. Postup stavby nové aplikace

| Fáze | Co skutečně vznikne | Podmínka pro pokračování |
|---|---|---|
| **A – Přesná inventura v1** | Matice současného chování a požadavků se zdroji a důkazy; nákres obrazovek a průchodu zakázkou | Rozlišeny funkce, chyby, neověřené části a budoucí nápady |
| **B – Technický pokus** | Izolovaný prototyp: foto + přesná editovatelná kóta + úchopy + uložit/zavřít/otevřít + import kopie | Správná geometrie, použitelnost na telefonu/tabletu, bez ztráty dat |
| **C – Nové jádro** | Model zakázek, jednotky, ukládání, testovací data, migrace starého exportu, Undo/Redo | Ověřené přesné hodnoty a obnova při simulovaných chybách |
| **D – Funkční shoda** | Postupně všechny základní nástroje, poznámky, galerie a export | Každá přidaná funkce prokazatelně zachovává předchozí |
| **E – Přístroje a přenos** | Bosch, kamera, bezpečnost, backup/sync teprve podle schváleného a ověřeného kontraktu | Automatické a praktické testy v kombinovaných situacích |
| **F – Srovnání a rozhodnutí** | Porovnání v1/v2: stejné zakázky, hodnoty, fotografie, editor, výkon, stabilita, UX, datové ztráty | Rozhodnutí, zda v2 opravdu přináší více než cílená modernizace v1 |

Všechny fáze lze dělit na malé ověřené celky s průběžným uložením na GitHub. **Neprovádět řadu APK jen kvůli dokumentaci.** Skutečné instalace pro testování prototypu budou vyžadovat zvlášť odsouhlasené a izolované testovací sestavení v2, nikoli vydávací workflow v1.

## 7. Co je potřeba rozhodnout až na základě důkazů

- Zda je **úplně nová v2** lepší než cílené rozdělení a modernizace stávajícího kódu; „od nuly“ samo o sobě není záruka vyšší kvality.
- Který grafický a doménový framework obstojí v přesné geometrii, výkonu slabších zařízení, offline práci, datové migraci a budoucí rozšiřitelnosti.
- Jak velký rozsah první srovnávací v2 verze je rozumný. Jako první je vhodný **jeden úplný průchod zakázkou**, ne hromadné přepisování všech funkcí naráz.
- Jak proběhne pozdější migrace a zda budou obě verze nějakou dobu existovat vedle sebe; teprve po testech řešit stejné distribuční jméno či aktualizaci.

## 8. Nejbližší bezpečný krok

1. **Dokončit oddělený nezávislý audit #39/PR #41 a nepřepisovat běžící práci Codexu.**
2. **Sepsat podrobnou srovnávací matici v1/v2** s prioritami, videoukázkami a akceptačními testy z #13/#28; uživatel nemá znovu diktovat již schválené požadavky.
3. Navrhnout 2–3 varianty technologie a provést **jen malý izolovaný prototyp**, až bude vývoj nové aplikace konkrétně schválen.
4. Výsledky porovnat objektivně, teprve poté rozhodnout, jestli má smysl pokračovat s celým novým Zaměřovačem.

**Tento dokument zachycuje uživatelovu představu „stejná aplikace kompletně nově“, aniž by ji zaměňoval za odsouhlasené okamžité nahrazení stávajícího Zaměřovače.**
