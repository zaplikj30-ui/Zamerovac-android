# Projektový plán Zaměřovače – uspořádání stávající aplikace jako při zahájení vývoje

**Založeno:** 6. 11. 2026  
**Stav:** schválený směr dokumentace; **první verze projektového plánu**, další inventura a vizuální schémata zbývají.  
**Platí pro:** současnou aplikaci **Zaměřovač** v repozitáři `zaplikj30-ui/Zamerovac-android`. **Nejde o projekt Zaměřovač 2, nový vývoj od nuly, přepis, migraci, změnu technologie ani povel k sestavení APK.**

## 1. Jaké rozhodnutí tento dokument zaznamenává

Uživatel chce **kompletní, přehledný projektový plán pro aplikaci, kterou už skutečně vyvíjíme**, sestavený **jako při návrhu nového profesionálního produktu**, ale se zapracováním všeho, co je hotové, rozpracované, rozbité, ověřené a plánované. **Nic nemažeme a nezačínáme znovu.** Předmětem je analýza, uspořádání a dokumentace současného Zaměřovače, nikoli nová aplikace.

**Nezaměňovat s** [NAVRH_NOVEHO_ZAMEROVACE_OD_NULY.md](NAVRH_NOVEHO_ZAMEROVACE_OD_NULY.md): ten zachycuje samostatný starší *námět* na případnou druhou aplikaci. Jeho existence **neznamená schválení ani zahájení jejího programování**. Pokud některá původní formulace „projektový plán“ vyzněla jako povel k v2, toto upřesnění má přednost.

**Smysl plánu:** popsat **jak má celý Zaměřovač vypadat, fungovat a vyvíjet se**, aby se v něm orientoval uživatel i další ChatGPT, Work či Codex; usnadnit rozhodování, předcházet konfliktům funkcí a mít měřitelná kritéria kvality.

## 2. Pravdivý výchozí stav

- **Poslední skutečně vydaná testovací APK:** [Zaměřovač 1.3.0](https://github.com/zaplikj30-ui/Zamerovac-android/releases/tag/test-v1.3.0). APK vznikla po velkém balíku [#39](https://github.com/zaplikj30-ui/Zamerovac-android/issues/39) a opravách šesti problémů auditu v [#42](https://github.com/zaplikj30-ui/Zamerovac-android/issues/42). Verze 1.3.0 samostatně zavedla smysluplné číslování, nikoli novou sadu funkcí.
- **Automatické kontroly:** před vydáním úspěšné; jejich podrobnosti a limity jsou v [START_ZDE.md](START_ZDE.md) a [#42](https://github.com/zaplikj30-ui/Zamerovac-android/issues/42).
- **Fyzická akceptace na S24 Ultra a Tab S11 Ultra:** k založení dokumentu **není potvrzena** pro celou 1.3.0, zejména instalace přes předchozí verzi, zachování dat, reálný Google Drive, obě zařízení, Bosch Bluetooth a některé chybové situace. Do plánu proto nepatří označení „bezchybné“ ani „hotové profesionální vydání“.
- **Práce:** po každém dalším chatu znovu ověřit stav GitHubu a případné změny jiného chatu/Codexu. Zde uvedené verze jsou historický checkpoint, ne neomylná předpověď dalšího vývoje.

## 3. Cílový produkt

Profesionální nástroj pro zaměřování zakázek v terénu, zejména pro truhláře, montážníky a nábytkáře, s možným budoucím využitím v zahraničí.

**Jeden bezpečný pracovní postup:** založit zakázku → uspořádat fotografie a podklady → přesně kótovat a přidat poznámky → případně použít laser → uložit a bezpečně obnovit → zkontrolovat úplnost → předat zákazníkovi či výrobě export. Telefon/tablet primárně offline; cloud a další zařízení jako volitelné podpůrné nástroje. Budoucí propojení s Konfigurátorem–Nářezákem je samostatná vize, **ne dnešní společná implementace**.

**Neměnné požadavky:** originální fotografie a zakázky neztratit; kóty uchovat jako editovatelné objekty a přesná čísla; nevypočítávat výrobní rozměr z velikosti grafické čáry; žádné tiché změny jednotek, orientace, vazeb médií či materiálů; obnova a export mají být ověřitelné.

## 4. Mapa obrazovek (první návrh, vyžaduje inventuru skutečného UI)

| Oblast | Očekávaný uživatelský účel | Co je potřeba zdokumentovat/ověřit |
| --- | --- | --- |
| Zakázky a složky | Založení, otevření, hledání, řazení, práce s košem a obnova | Skutečný tok, názvy tlačítek, chování při chybách |
| Detail zakázky | Fotografie, případně video, náčrty, poznámky | Hierarchie, přidávání/odebírání, návrat |
| Editor fotografie | Kóty, čáry, šipky, řetězce, tvary, texty, kresba a úchopy | Přesné umísťování, nástroje, posun, lupa, zoom, Undo/Redo |
| Galerie a náhled | Bezpečné prohlížení anotovaných podkladů bez jejich náhodné úpravy | Navigace a věrnost zobrazení |
| Laser a měření | Párování Bosch, stav spojení a bezpečný přenos hodnot do správné kóty | BLE/Classic, výpadky, historie měření |
| Export a předání | Obrázky/PDF, zákaznické výstupy, ZIP zakázek | Co obsahují, přesnost a práva přístupu |
| Synchronizace a zálohy | Offline, dvě zařízení, historie, zálohování a obnova | Realita Google účtu/Drive a konfliktů, ochrana originálu |
| Nastavení a diagnostika | Jazyk, vzhled, pomůcky, experimenty, historie vydání, nápověda | Které volby skutečně existují a jak působí |

**Další výstup:** skutečný diagram navigace **podle existujícího kódu i praktických testů**, ne hypotetické nové obrazovky. Rozlišit uživatelské (telefon), tabletové a budoucí PC rozvržení.

## 5. Mapa funkcí a jejich stavy

Pro každou funkci vytvořit podrobný, dohledatelný záznam:

| Pole | Co zapisujeme |
| --- | --- |
| Funkce a místo | Přesný název, obrazovka, podnabídka, odkaz na kód |
| Požadované chování | Krátce v jazyce uživatele, ideálně příklad zaměřování |
| Stav | **Prokázáno na zařízení / automaticky testováno / implementováno neověřeno / chyba / částečně / schváleno k pozdější práci / pouze nápad** |
| Závislosti a rizika | Co může ovlivnit: kóty, fotografie, Undo/Redo, úložiště, export, synchronizace |
| Důkazy | Issue/PR/commit, test, příslušné video nebo snímek |
| Další krok | Jaký test či rozhodnutí umožní funkci uzavřít |

**Skupiny pro inventuru:** zakázky/složky/koš; fotografie/video; editor (všechny kóty, tvary, úchopy, zoom/lupa, symboly a popisky); text/foto/hlasové poznámky; laser; historie a Undo/Redo; offline uložení a ochrana dat; export/import a PDF; synchronizace/zálohy; hledání/adresy; nastavení, jazyk, přístupnost, nápověda; různé výkony zařízení.

Základní podklady: [testovací deník #13](https://github.com/zaplikj30-ui/Zamerovac-android/issues/13), [testovací registr #28](https://github.com/zaplikj30-ui/Zamerovac-android/issues/28), [živá vize](VIZE_A_PLAN.md), [technické požadavky AGENTS.md](AGENTS.md) a konkrétní issues. **Nevydávat přání nebo nepřezkoumaný kód za fyzicky fungující funkci.**

## 6. Model celé zakázky – co musí plán explicitně zachytit

1. **Vznik zakázky** – stabilní identita a pojmenování, hierarchie složek, originální média.
2. **Práce v editoru** – geometrie kóty oddělená od její číselné hodnoty a jednotky; uchování přesné editovatelnosti, anotací a médií.
3. **Změny v čase** – automatické ukládání, návrat, Undo/Redo, případně historie verzí; co se stane při pádu a vypnutí.
4. **Sdílení a souběh** – kdy je editace lokální, co jde do cloudu, která verze má přednost, co se děje při konfliktu a offline režimu.
5. **Výstup z pracoviště** – náhled, zákaznické PDF/fotografie, úplný archiv a prokazatelná obnova; originál zůstává zachovaný.
6. **Budoucí návaznost na výrobu** – případné předání naměřených hodnot jinému samostatnému modulu, vždy s potvrzením změn a bez automatických výrobních přepočtů.

Později doplnit **schéma průchodu zakázkou**, mapu dat, obrazovky a interakce a tabulku chybových větví (např. nedostatek místa, přerušený import, nedostupná síť, konflikt úprav). Konkrétní formáty ověřovat proti [DATOVY_FORMAT_A_PC_KOMPATIBILITA.md](DATOVY_FORMAT_A_PC_KOMPATIBILITA.md) a aktuálnímu kódu.

## 7. Technický plán současné aplikace – bez výměny technologie

Vysvětlit a zmapovat nynější Android aplikaci a její WebView/editor, nativní přístup ke kameře, souborům, Bluetooth, síti, podepisování a externím službám. Rozlišit:

- **Společná pravidla:** zakázky, identita, přesná čísla, jednotky, geometrie, historie, datové formáty a validace.
- **Uživatelské rozhraní:** obrazovky, vykreslování, dotyk, stylus, budoucí myš/klávesnice.
- **Integrace zařízení:** Android úložiště, kamera, laser, Google účet/Drive, síť.
- **Testy a diagnostika:** reprodukce chyb, měřitelné výsledky, bezpečná regresní sada a protokol testu na zařízení.

Toto je **architektonická mapa existujícího systému**, ne příkaz k refaktoringu nebo přechodu na Kotlin/Flutter/KMP. Případnou větší změnu schvalovat samostatně po doložení přínosu a rizik. Zohlednit budoucí Windows, iOS/iPadOS a jazyky, ale neimplementovat je nyní automaticky.

## 8. Vývojová cesta (dokumentační projekt, nikoli nové programování)

| Etapa | Konkrétní výsledek | Kritérium dokončení |
| --- | --- | --- |
| A. Inventura skutečnosti | Matice obrazovek, funkcí, kódu, požadavků, chyb a důkazů | Každá hlavní funkce má stav a zdroj |
| B. Zákaznický/pracovní průchod | Diagram zakázky od založení přes měření až po export a obnovu | Pokryty běžné i selhávající scénáře |
| C. Obrazovky a použitelnost | Přehled navigace, wireframy **aktuálního** rozhraní a požadovaná vylepšení zvlášť | Nezaměněna realita s budoucím návrhem |
| D. Architektura a data | Srozumitelná mapa modulů, přesné číselné modely, cesty uložit/načíst/sync | Známe kritické hranice ochrany dat |
| E. Kvalita a priority | Rizika, automatické i fyzické testy, přehled oprav a postupných balíků | Jasné P1/P2/P3 a pořadí bez zbytečného přepisu |
| F. Dlouhodobá mapa produktu | Oddělené okamžité požadavky, schválené budoucí funkce a nápady, platformy a možná mezinárodní dostupnost | U každé položky je zřejmé, co je jen vize |

**Pořadí:** mapování a dokumentace mohou probíhat bez čekání na další APK; stav „ověřeno na zařízení“ doplnit až po skutečném testování 1.3.0. Širokou inventuru a schémata je vhodné zpracovat v ChatGPT **Work** s přístupem k relevantním souborům; kontrolu GitHubu a koordinaci drobných dokumentačních změn lze dělat přímo v ChatGPT. Codex je potřeba až při konkrétním programování nebo testovacích zásazích, které vyžadují práci se zdroji. Výběr režimu sám nic nespouští.

### 8.1 Úsporné řízení vývoje – rozdělení ChatGPT / Codex / Work (7. 11. 2026)

Uživatel schválil nové rozdělení práce kvůli rychlému vyčerpání týdenního limitu Codexu a nejistým nákladům na další kredity. Cíl je efektivita **bez kompromisu v přesnosti, bezpečném ukládání, automatických testech a kvalitě**. Trvalé prováděcí pravidlo: [AGENTS.md](AGENTS.md#úsporné-rozdělení-práce-a-ochrana-limitů-codexu-rozhodnutí-7-11-2026).

| Práce | Výchozí odpovědnost |
| --- | --- |
| Čtení issues, PR, GitHub, CI; plánování, rozhodnutí, nálezy, dokumentace, nápověda, hodnocení | ChatGPT |
| Menší a středně složité oddělitelné opravy, pokud je lze skutečně změnit a dostatečně ověřit | ChatGPT |
| Složité provázané změny editoru/geometrie, ukládání, příloh, synchronizace, nativního Androidu a iterace testů | Codex |
| Rozsáhlejší samostatná vícekroková analýza souborů, jen pokud skutečně zlepší výsledek | Work |
| Automatické regresní testy | Existující infrastruktura/CI, průběžně v rámci příslušné implementace |
| Nezávislá kontrola změn a koordinace jediné APK | Přednostně jiný kontrolor než autor změny + CI; ChatGPT koordinuje, fyzické testy zvlášť |

**Před předáním Codexu** ChatGPT nejprve posoudí, zda může danou opravu samo naprogramovat a otestovat; jinak zkontroluje aktuální repozitář a rozpracovanou práci a připraví jediné konkrétní české zadání s odkazy a akceptačními testy. Požadovat dokončitelnou etapu, ne opakované široké audity. Codex před změnou sám ověří aktuální HEAD a pravidla. Výsledky, skutečnou spotřebu kreditů (pokud je dostupná) a testy využít k dalšímu rozdělení. Kreditový ceník **není zárukou ceny celé aktualizace**.

**Checkpoint 7. 11. 2026:** týdenní limit Codexu uživatele vyčerpán; nákup resetu nebyl nabídnut v dostupném rozhraní, placené kredity jsou alternativou, ale žádný nákup ani automatické dobíjení nejsou schválené. [Draft PR #51](https://github.com/zaplikj30-ui/Zamerovac-android/pull/51) zůstává rozpracované a **nebylo sloučeno**; N4 stále FAIL a Android emulátorový průchod neprokázal úplnou fyzickou akceptaci. Pokračovat nezávislou koordinací a bezpečnými úpravami mimo rozpracovanou větev; Codex naváže po dostupnosti limitu, pokud by nebyl schválen nákup. **Nevydávat další APK nyní.**

## 9. Co již nyní považujeme za dohodnuté

- Plán se vztahuje k **existujícímu Zaměřovači**. Nic nemažeme, nespouštíme druhý projekt, nepřepisujeme program od nuly.
- Neztratit starou dokumentaci a historii. Tento dokument je **rozcestník a pracovní specifikace**, ne duplicita všech issues a testovacích logů.
- Budoucí návrhy výslovně odlišit od schválených změn. Žádné nové funkce, APK, nový repozitář ani refaktoring nevyplývají jen z plánování.
- **První další konkrétní dokumentační krok:** dokončit etapu A (skutečná inventura) na základě kódu, issues a testů; pak odvodit diagram obrazovek a průchod zakázkou. Paralelně pokračuje schválené praktické testování již vydané APK 1.3.0.

## 10. Zdroje a trvalé předání

- [START_ZDE.md](START_ZDE.md) – poslední skutečný stav a nejbližší praktický krok.
- [AGENTS.md](AGENTS.md) – technická a bezpečnostní pravidla.
- [VIZE_A_PLAN.md](VIZE_A_PLAN.md) – požadavky a dlouhodobá vize.
- [#13 – deník testování](https://github.com/zaplikj30-ui/Zamerovac-android/issues/13) a [#28 – automatické testy](https://github.com/zaplikj30-ui/Zamerovac-android/issues/28).
- [#42 – kvalita/architektura](https://github.com/zaplikj30-ui/Zamerovac-android/issues/42) a [verzování](docs/verzovani.md).
- [NAVRH_NOVEHO_ZAMEROVACE_OD_NULY.md](NAVRH_NOVEHO_ZAMEROVACE_OD_NULY.md) – **samostatný námět**, není rozpracovanou fází tohoto plánu.

**Rozlišovat:** tento dokument je **založený projektový plán s osnovou a výchozím stavem**. Není dosud kompletní hotovou inventurou ani vizuálním návrhem všech obrazovek a není podložený fyzickými testy tam, kde nejsou zaznamenané.


## 11. Budoucí možnosti a rozhodnutí potřebná už dnes – rozšíření inventury 6. 11. 2026

**Výslovné upřesnění uživatele:** při **postupné vnitřní přestavbě současné aplikace** počítat i s návrhy typu „možná“, „někdy“, „ještě probereme“, aby budoucí rozšíření nevyžadovala další rozsáhlý přepis. **Nemusí se nyní upřesnit vzhled a chování každé neschválené funkce.** Je nutné dnes navrhnout jen stabilní **hranice** a identifikovat rozhodnutí, která by později ohrožovala přesné hodnoty, data nebo kompatibilitu. Nezaměňovat architektonickou připravenost s implementačním souhlasem. Platí společně s [#42](https://github.com/zaplikj30-ui/Zamerovac-android/issues/42).

### 11.1 Katalog hlavních dnešních a budoucích oblastí

**Stav každého řádku je stav požadavku/směru, nikoli tvrzení o dokončení v APK.** Podrobné podfunkce a případná pozdější změna rozhodnutí zůstávají v prolinkovaných zdrojích; pro každé budoucí programování je nutná kontrola proti aktuální implementaci a posledním komentářům.

| Oblast | Dnes zachovat / napravit | Zohlednit jako možnost, neschvalovat automaticky | Architektonický důsledek nyní |
| --- | --- | --- | --- |
| Zakázky a dokumenty | Stabilní strom zakázek/složek, adresy, hledání, koš, zámky, přesuny a hromadné operace, originální foto/video/PDF, import/export | Šablony zakázek, karta zákazníka, porovnání dvou fotografií, výměna podkladu bez ztráty kót, více různých druhů položek | Obecné stabilní ID, verzovaný typ dokumentu a vazby na média; zvlášť data zakázky a nastavení UI |
| Kóty/geometrie | Přesné číselné řetězce s jednotkou; kóty, šipky, čáry, lomené, řetězce, úhel, kruh/elipsa, plocha/obdélník, kresba, lupa, úchopy, magnet, Undo/Redo | Chytré rozmístění/úpravy kót, zadávání textem nebo AI, matematické kontroly, nové tvary, ruční i automatické kreslení půdorysů | Oddělit význam měření, geometrii, styly, transformace a nástroje; stabilní typy/ID prvků; neodvozovat skutečné mm z pixelů |
| Editor/galerie/export | Shodný obsah a ostré čitelné kóty, bez úprav v galerii; současná P1 vada [#50](https://github.com/zaplikj30-ui/Zamerovac-android/issues/50); správné PDF, zákaznické výstupy | Více zobrazení téže scény, 2D plán, nárysy stěn, případné 3D, externí obrazovky/tisk | Jediná geometrická a sémantická definice; **více nezávislých rendererů/pohledů**, každý s vlastním kontextem, měřítkem a určením (editace/prohlížení/tisk) |
| Fotografie, poznámky, přílohy | Oddělené kotvy šipek, textu a přemístitelného detailu, stohy fotografií, hlasové nahrávky, videa, editovatelné vnořené kóty; opravy [#46](https://github.com/zaplikj30-ui/Zamerovac-android/issues/46) a [#47](https://github.com/zaplikj30-ui/Zamerovac-android/issues/47) | Samostatný poznámkový blok/S Pen, možná Samsung Notes integrace, diktování textu a čísla [#44](https://github.com/zaplikj30-ui/Zamerovac-android/issues/44) | Model přílohy a vazby na objekt oddělit od způsobu vstupu; dialog/IME/picker mají explicitní stav a vlastnictví |
| Měření a hardware | Bosch BLE/Classic, přesun jen do skutečně aktivní kóty, historie a opravy spojení; pracovat i bez laseru | Další značky a modely laserů, hlasový vstup, jiné ovladače, myš, klávesnice, S Pen i jiná pera | Převod na ověřené `měření + jednotka + zdroj + cílový objekt`; adaptér pro zařízení/protokol, bez závislosti modelu na Boschi |
| Půdorys/prostor | Dnešní fotoeditor a existující plátno; nic nerozbít | Editovatelný půdorys rukou s jemným narovnáním a magnetem, klikací nárysy stěn jako Bosch MeasureOn [#25](https://github.com/zaplikj30-ui/Zamerovac-android/issues/25), okna/dveře/přípojky/překážky, perspektiva/2D/3D | Uvažovat dokument-scénu s více pohledy a vztahy stěna ↔ rozměr ↔ fotografie, **bez zavedení nepřipraveného 3D engine** |
| Offline, záloha a zařízení | Lokální bezpečný stav, úplné originály, ZIP včetně integrity, historie, konflikty, dva přístroje, Google Drive bez falešného „hotovo“ [#38](https://github.com/zaplikj30-ui/Zamerovac-android/issues/38) [#40](https://github.com/zaplikj30-ui/Zamerovac-android/issues/40) | Budoucí Windows/iOS klient, více zařízení a účastníků, volitelná další přenosová média | Jediný důvěryhodný místní stav, revize/identity, oddělené synchronizační a zálohovací kontrakty; žádné skryté poslední-přepsání-vyhrává |
| Propojení druhé aplikace | Zachovat **dva nezávislé projekty** Zaměřovač a Konfigurátor–Nářezák | Jedna zakázka napříč zaměřením, návrhem skříněk, kusovníkem, nářezem, kalkulací, montáží; případně jedno modulární uživatelské prostředí | Stabilní a verzovatelné výměnné rozhraní měření, identit, jednotek, revizí; **nikdy automaticky nepřepisovat schválenou výrobu**; neimplementovat teď společnou databázi |
| Cizí jazyky a země | Zachovat češtinu a schválenou přípravu volby jazyka [#14](https://github.com/zaplikj30-ui/Zamerovac-android/issues/14) | Desítky jazyků, RTL, autonyma, místní jednotky, formáty, zahraniční adresy, mezinárodní název | Přeložitelné texty a metadatové jednotky mimo data kót; lokalizace mění prezentaci, ne přesně uložené hodnoty |
| Ovládání a vzhled | Přehledná lišta, úchopy, adaptivní Android displeje, nápověda, přístupnost, experimenty | Úrovně Začátečník/Střední/Expert, profily profesí (elektro/voda/stavba/nábytek/domácnost), vlastní lišta a „+“, tmavý/světlý/systém, pozadí, výkonové režimy, projekce | Konfigurovatelné zobrazení/nástroje bez různých verzí dat a pravidel měření; motiv a grafické preference nejsou součástí výpočtů |
| Pokročilá pomoc | Současné ruční kótování a validace, nápověda | Chytré rozmístění kót a AI/textové příkazy [#16](https://github.com/zaplikj30-ui/Zamerovac-android/issues/16), průvodce zaměřením, kontrola chybějících rozměrů, hlas [#44](https://github.com/zaplikj30-ui/Zamerovac-android/issues/44) | Volitelný návrh změn nad kontrolovatelným modelem; uživatel musí rozhodnout o jejich potvrzení; možnost fungovat i plně offline |
| Výkon, zařízení, dostupnost | Zachovat funkce na telefonu/tabletu a rozumnou výkonnost, žádná degradace kvality měřených čísel | Levnější Androidy, různá rozlišení/velikosti, širší veřejnost, Play Store / App Store | Render podle zařízení, bezpečné paměťové limity, nezávislé funkční jádro a cílené testy; nepředpokládat hardware Samsungu |
| Obchodní/produktové možnosti | Nyní bez monetizace, bez omezení pracovních dat | Volitelné moduly/licence, jednorázový nákup, předplatné, reklama/bez reklam, jiné obchodní modely | Nepropojovat data a výpočty s budoucí licencí; **žádná platební SDK, reklamní sledování ani tarifní logika dnes** |

Podrobnosti ke všem dnes evidovaným **40 oblastem testů**, jejich implementaci a mezerám: [qa/coverage-v1.json](qa/coverage-v1.json). Historické **28 kroků**, kompletní seznam aktuálně nahlášených drobností **#12**, uživatelské průběžné video výsledky **#13**, uživatelská rozhodnutí a nápady **ROZHODNUTI_A_NAPADY_Z_TESTU.md**, celá [VIZE_A_PLAN.md](VIZE_A_PLAN.md) a **všechny komentáře** jsou součástí povinné inventury; **tato souhrnná matice je nepřepisuje a nesmí být označena za 100% kompletní detailní funkční specifikaci**.

### 11.2 Co je potřeba rozhodnout už při přestavbě – bez čekání na nové funkce

1. **Kontrakt současných dat:** stabilní ID objektu/zakázky/média, přesná hodnota a jednotka zvlášť od libovolného textu, image/world/screen souřadnice, vztahy objekt ↔ zdroj; zachovat současné skutečné `schema:1`, ZIP v2 a aktuální sync protokol, dokud není bezpečně doložená a schválená migrace.
2. **Kdo vlastní stav:** jedno místo pro správu zakázek a transakčně potvrzené ukládání; UI, renderer, dialog a přenos nesmějí nezávisle přepisovat živá data.
3. **Renderovací kontrakt:** pozice podle geometrie, písmo/tloušťka/úchopy podle výsledného prostoru pixelů, nezávislé kontexty editoru, galerie a exportu. Přenos do jiných rozlišení/platforem nemění uložené body ani hodnoty.
4. **Rozhraní doplnitelných částí:** nástroj/anotace, druh dokumentu a pohled, médium, zdroj měření, platformní vstup, přenos/synchronizace, lokalizace. Jen minimální skutečně potřebné rozhraní; nevytvářet generický systém pro hypotetické pluginy.
5. **Vazby a revize:** budoucí půdorysy, nárysy, více obrazovek a druhá aplikace budou potřebovat referencovat stejný ověřený údaj, nikoliv udržovat nebezpečné nezávislé kopie. Nyní otestovat existující data, navrhnout zpětně kompatibilní model **bez okamžité nové struktury databáze**.
6. **Kontroly kvality jako brána změny:** reprodukce P1 na staré verzi → FAIL, po opravě → PASS, skutečné pixely/screenshoty, negativní dotykové scénáře, uložení/obnova, Undo/Redo, import/export, přerušení a platformní zkoušky. Nezaměňovat CI, APK a fyzické zařízení.

### 11.3 Co se nyní NAOPAK rozhodovat nemusí

- Jak přesně bude vypadat budoucí 3D nárys, workflow a kreslicí nástroje půdorysu; geometrické toleranční prahy inteligentního narovnání.
- Zda vůbec použijeme AI, rozpoznávání hlasu, projekci, Samsung Notes propojení, placené funkce či reklamu.
- Názvy a počet profesních profilů, přesné rozdělení režimů pro začátečníky, koncová nabídka jazyků, značek laserů a platformní technologie Windows/iOS.
- Zda se samostatné současné aplikace někdy fyzicky sloučí do jedné instalace.

Rozhodovat až podle prototypu, dostupnosti API, nákladů, bezpečnosti a **výslovného schválení**; nevytvářet prázdné moduly, spekulativní tabulky DB ani nová SDK „pro jistotu“.

### 11.4 Bezpečné pořadí přestavby – praktické QA chrání práci od první etapy (7. 11. 2026)

**Rozhodnutí:** automatické praktické testování není samostatná poslední etapa ani nová technologie. Je to **průběžná podmínka všech etap** selektivní modernizace **stávající** aplikace (varianta B). Využít existující Node/Playwright, pixelové Chromium E2E, JVM a ručně spustitelný Android-emulator smoke; další framework ani placenou službu nezavádět bez prokázané mezery. Podrobné už schválené scénáře a metodika jsou v [#28](https://github.com/zaplikj30-ui/Zamerovac-android/issues/28#issuecomment-6700646604); nepsat je znovu jako paralelní zadání Codexu.

**Etapa 0 – před prvním zásahem: zachytit výchozí chování a kritické testy.**
- Navázat na současnou mapu [qa/coverage-v1.json](qa/coverage-v1.json), historické testy [#13](https://github.com/zaplikj30-ui/Zamerovac-android/issues/13) a plán obrazovek; přidat mapu skutečně dosažitelných akcí (obrazovka → nabídka/tlačítko/gesto → očekávaný výsledek → test nebo NOT RUN). Zahrnout zakázky/složky, fotografie a galerii, editor, kóty/tvary, poznámky/připomínky, koš, nastavení, import/export, zálohy a relevantní systémové dialogy. Netvrdit, že proklikání několika obrazovek znamená 100% pokrytí všech kombinací.
- Pro kritické operace zapsat **neměnné podmínky**: originální média a zakázky nezmizí, kóty a výrobní hodnoty zůstanou přesné a editovatelné, Undo/Redo vrací správný stav, uložit → zavřít → obnovit → export/import nepoškodí data. Důležité známé vady nejdřív prokazatelně reprodukovat testem, který na původní verzi selže.
- **Před optimalizací** naměřit výchozí odezvu pro malé/velké fotografie, galerii a jednoduché/obrazové připomínky včetně [#53](https://github.com/zaplikj30-ui/Zamerovac-android/issues/53). Měřit od uživatelské akce k použitelnému obrazu nebo **potvrzenému trvalému uložení**, se vstupy, prostředím, opakováním a prvním/opakovaným spuštěním. Mezní časy stanovit podle dat, nikoli odhadem.

**Etapa 1 – první skutečné opravy a renderer, současně první automatická akceptační brána.**
- Bezpečně vypořádat rozpracovaná draft PR [#51](https://github.com/zaplikj30-ui/Zamerovac-android/pull/51) (galerie) a [#52](https://github.com/zaplikj30-ui/Zamerovac-android/pull/52) (regresní testy/poznámka/laser), včetně jejich dosud **červeného CI**. Jejich opravy a testy **koordinovat**, neslučovat naslepo a nevytvářet konkurenční implementaci. [#49](https://github.com/zaplikj30-ui/Zamerovac-android/pull/49) (vzhled úchopů) zachovat odděleně do ověření.
- Již při přestavbě galerie vyžadovat skutečně viditelné tahy, hroty a dostatečně čitelné hodnoty v pixelech displeje, správné pozice při fit/zoom/pan a nezměněný stav editoru. Po opravě PASS nové reprodukce i dosavadní editor/galerie/export testy; kontrola asynchronních chyb a návratu ze zobrazení.
- Pro poznámky/IME/picker, Undo existující poznámky a přesný laser kontrolovat nejen pozitivní akci, ale i **nežádoucí vedlejší efekty** (klávesnice, systémový picker, dvojklik, Back, opožděný callback, zaokrouhlení). Nevyřešené osiřelé přílohy (#42/N4) ponechat jako skutečný FAIL do bezpečné opravy vlastnictví/retence; nikdy je nemazat bez kontroly historie a synchronizace.

**Etapa 2 – každá další malá etapa přestavby: aktualizovat a spustit odpovídající praktické testy.**
- Při změně modelu měření, editorového stavu, kreslení, dialogů, médií nebo ukládání nejprve doplnit cílený selhávající/ochranný scénář, pak změnu, potom související **funkční, pixelovou, regresní a datovou** kontrolu. Kritické invarianty musí běžet i při následných etapách; nečekat s nimi na závěr projektu.
- Průběžně rozšiřovat reprezentativní automatické průchody ovládáním (reálné kliknutí/dotyk, změna/návrat, opětovné otevření, ukládání), včetně jednotlivých funkcí dosud bez testu. Testy pro Android/WebView/IME a picker provést na existujícím emulátoru, pokud to daný postup vyžaduje a prostředí je dostupné; browser simulaci nevydávat za skutečný Android.
- Při úpravě načítání či ukládání zopakovat měření odezvy i **kontrolu skutečně trvalého uložení**. Otestovat pomalé I/O, zrušení, přerušení/background, dvojklik, souběh, velké vstupy a následné otevření; rychlost nezlepšovat odstraněním potvrzení zápisu nebo bezpečných záloh. Výkonnostní regresi posuzovat proti reprodukovatelné baseline a odůvodněným limitům, nikoli podle náhodných výsledků jediného běhu.

**Etapa 3 – po propojení opravených částí: souvislý průchod celou aplikací.**
- Projít udržovanou mapu funkcí od hlavní obrazovky: vytvořit zakázku a fotografii → kóta/tvar/poznámka → měnit a přesouvat → Undo/Redo → uložit → zavřít/znovu otevřít → galerie → export/import/záloha → ověřit hodnoty, editovatelnost i původní soubory; rozšířit o nabídky, koš a nastavení. Kontrolovat obraz/screenshoty a měřené odezvy, ne pouze přítomnost objektů v JSON.
- Zaznamenat po jednotlivých oblastech **PASS / FAIL / SKIP / NOT RUN** s důkazem, platformou a verzí. Fyzické ověření Bosch, S Pen, fotoaparátu, Samsung IME, živého Drive a výkonu konkrétního zařízení nepředstírat jako hotový automatický test. Známá kritická selhání neskrývat pomocí expected-fail či přepsání očekávání.

**Etapa 4 – společná vydávací brána a až potom jedna testovací APK.**
- Až po dokončení schváleného balíku a vypořádání blokujících FAIL spustit odpovídající plnou regresi, zhodnotit obrazové artefakty, naměřené odezvy a ochranu dat. Samostatná zelená kompilace nebo 58/58 starých browser testů **nestačí** k tvrzení o použitelnosti. Neúspěšný/emulátorem neověřený kritický postup výslovně blokuje předání, dokud není bezpečně prověřen nebo jednoznačně omezen rozsah.
- Teprve potom **jedna společná testovací APK** podle existujících pravidel podpisu/verze a bezpečného návratu. Uživatel provede jen krátkou cílenou poslední praktickou zkoušku na Galaxy S24 Ultra, potom na tabletu, s Bosch tam, kde jde o hardware; nepožadovat běžně další videa a dlouhé popisy jako náhradu automatické QA.
- Výsledek každé dokončené aktualizace objektivně zhodnotit podle projektových pravidel včetně toho, co prošlo, selhalo a **nebylo provedeno**, a bez duplicit jej uložit na správný GitHub.

**Oddělené nápady a rozsah:** více pohledů/stěn, Windows/iOS, 3D a Konfigurátor–Nářezák jsou budoucí možnosti, nikoliv automaticky schválené změny. Při tomto plánu **nepřepisovat od nuly**, neměnit bez důkazu schema/protokoly/úložiště a nepořizovat další testovací frameworky. Výchozí ověřený stav při této úpravě plánu: main `f543af7`, draft PR #49/#51/#52; u #51 a #52 je rychlé CI FAIL, nativní CI #52 SUCCESS; žádná nová aplikace ani APK.

**Stav zápisu:** technická inventura a architektonická dohoda; **nikoli dokončený audit všech detailů, provedená přestavba, zelené CI, vytvořená APK či fyzické ověření.**

**Provedení první etapy 7. 11. 2026:** zahájeno v existujícím draft PR #51, nikoli v nové aplikaci. Konkrétní hranice rendereru, převzetí #52, skutečné testy/měření a nevyřešené N4 jsou v [navazujícím protokolu](docs/qa-professional-20261107.md#etapa-b1--pokračování-galerie-v-pr-51-7-11-2026). Jde o implementaci první omezené etapy; ne o dokončení všech etap či fyzické ověření. Nové upřesnění testovacího provozu main `3de1d53` zachováno.
