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
