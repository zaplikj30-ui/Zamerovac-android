# Kontrola platnosti původních pravidel – PR #106

**Výchozí main:** `c604860db4fddeefc077e27411bc1941815f7d94`. **Návrh** pro nezávislou kontrolu; neznamená merge ani schválení nové funkce. Původní plné dokumenty jsou identické Git blob objekty v [AGENTS archivu](historie/AGENTS-2026-11-10.md) a [START archivu](historie/START_ZDE-2026-11-10.md).

## Pravidlo pro každý další chat
- **PLATÍ:** i původní podrobné pravidlo je stále závazné, pokud ho novější explicitní rozhodnutí vlastníka konkrétně nezměnilo. Stručný souhrn ho nezrušil.
- **PLATÍ PODMÍNĚNĚ:** povinnost se uplatní v uvedené situaci, neznamená automatické spuštění QA.
- **SMÍŠENÉ:** historické SHA/role/CI triggery neplatí, ale dlouhodobé bezpečnostní zásady ano; čti živé workflow a #42.
- **HISTORIE:** doklad dřívějšího stavu, není to příkaz. **NÁPAD:** záměr pro budoucnost, ne dnes schválená implementace.
- U pochybností ověř novější výslovné rozhodnutí vlastníka a stav GitHubu; před nevratným krokem zastav, nehádej. **Žádné bezpečnostní stop/finanční/testovací omezení tímto přehledem neoslabuj.**

## AGENTS.md – kontrola všech 33 původních tematických oddílů

| Řádky v původním AGENTS | Původní oddíl | Status | Interpretace |
|---|---|---|---|
| 3–6 | Účel a kontext | **PLATÍ** | Oddělený projekt, čeština, legální reference |
| 7–12 | Závazný standard jednorázové domácí QA (po schváleném začlenění) | **PLATÍ PODMÍNĚNĚ** | Pro nové owner-only qa/* schválený generátor a strict lint, ne automatický běh |
| 13–24 | Úsporné rozdělení práce a ochrana limitů Codexu (rozhodnutí 7. 11. 2026) | **PLATÍ** | ChatGPT vs Codex podle rizika a limitů |
| 25–35 | Praktické omezení spotřeby Codexu – 7. 11. 2026 | **PLATÍ** | Nejmenší ověřitelný rozsah, jeden testovaný SHA |
| 36–39 | NEPŘEHLÉDNOUT – aplikace je dosud pouze testovací (uživatel opakovaně potvrdil 7. 11. 2026) | **PLATÍ** | Testovací data nejsou ostrá, přesto chránit budoucí data |
| 40–50 | Povinná rozhodovací brána před významnou přestavbou (7. 11. 2026) | **PLATÍ** | Před přestavbou porovnat varianty a schválit |
| 51–64 | Povinná kontrola kolizí funkcí a proaktivní péče o architekturu (5. 11. 2026) | **PLATÍ** | Hlídat kolize UI/dat a návazné testy |
| 65–73 | Povinné porovnání architektury se seznamem funkcí a nápadů (5. 11. 2026) | **PLATÍ** | Vizi zohlednit při architektuře, nápady nejsou pokyny |
| 74–88 | Připravenost na změny a doplnění technologií (5. 11. 2026) | **PLATÍ** | Kompatibilita, plán migrace, návrat při selhání |
| 89–98 | Výhledová nezávislost na technologiích, promítání a vzdálený tisk (5. 11. 2026) | **SMÍŠENÉ** | Oddělit data od technologií; tisk/promítání nejsou dnes úkoly |
| 99–106 | Nezávislé ovládání prstem, perem a myší (upřesnění 5. 11. 2026) | **PLATÍ** | Prst musí fungovat i bez S Pen |
| 107–123 | Budoucí rozšiřitelnost – ovládání, integrace, obnova a diagnostika (doplněno 5. 11. 2026) | **NÁPAD** | Budoucí profily, tisk, QR a biometrie nejsou k implementaci |
| 124–131 | Budoucí funkce jsou zamýšlené, nikoli odepsané (upřesnění 5. 11. 2026) | **PLATÍ PRO PLÁN** | Budoucí cíle zachovat, ale nespouštět automaticky |
| 132–143 | Povinné testování selhání a ochrany dat u každé změny (5. 11. 2026) | **PLATÍ** | Pozitivní a negativní testy ochrany dat |
| 144–149 | Povinná historie změn podle skutečného vydání (5. 11. 2026) | **PLATÍ** | Changelog až pro skutečné vydání a správnou verzi |
| 150–157 | Povinná průběžná aktualizace nápovědy při KAŽDÉ změně aplikace (4. 11. 2026) | **PLATÍ** | Offline help.js aktualizovat ve stejném balíku |
| 158–166 | Trvalá předávka a automatické testy napříč nástroji (4. 11. 2026) | **PLATÍ** | GitHub trvalý handoff, #28 testy, SHA a limity |
| 167–174 | Doporučení modelu, úrovně a postup při nízkém limitu (4. 11. 2026) | **PLATÍ** | Doporučit skutečně dostupný model a úsilí |
| 175–179 | ZÁVAZNÝ VÝCHOZÍ PRINCIP: ImageMeter je funkční referenční aplikace | **PLATÍ** | ImageMeter jako ovládací referenční aplikace |
| 180–188 | Povinný postup při přizpůsobování funkce | **PLATÍ** | Ověřit referenční snímky/video/legální APK, rozlišit pozorování |
| 189–196 | Priorita verzí referenčního ImageMeteru | **PLATÍ** | Hlavní 26.6.1, doplňková 26.5.0, starší 3.9.15 |
| 197–206 | Schválené požadavky | **PLATÍ PRO CÍL** | Funkce jsou cíle, ne povel vše vyvinout teď |
| 207–213 | Výslovně vyřazené funkce | **PLATÍ** | Pět konkrétně vyřazených funkcí |
| 214–219 | Současný testovací režim – zálohy nejsou podmínkou (výslovné upřesnění uživatele 4. 11. 2026) | **PLATÍ** | Zkušební data bez nutného backup ZIP |
| 220–227 | Stav projektu a omezení | **SMÍŠENÉ** | Java/WebView stále platí; starý push trigger APK již NEPLATÍ |
| 228–241 | Společný pracovní protokol ChatGPT ↔ Codex ↔ GitHub (závazné) | **PLATÍ** | Ověřovat GitHub/HEAD a zapisovat testy bez duplicit |
| 242–251 | Proaktivní technické vedení uživatele – začátečníka | **PLATÍ** | Koordinátor technicky vede uživatele |
| 252–260 | Kdy sám navrhnout úpravu pokynů projektu ChatGPT a užitečné nastavení | **PLATÍ** | Proaktivně navrhovat i změny Pokynů ChatGPT, GitHub je nezmění |
| 261–278 | Rozdělení práce mezi ChatGPT a Codex – rozhoduje asistent | **PLATÍ** | ChatGPT vs Codex rozhoduje koordinátor; spouštění Codexu neimprovizovat |
| 279–286 | Doporučený způsob práce | **PLATÍ** | První kód, cílené testy, QA až po balíku |
| 287–293 | Jednoduchý provoz pro uživatele — koordinuje ChatGPT/Codex | **SMÍŠENÉ** | Balíkový postup platí; starý trigger .github/apk-build-request.txt neplatí |
| 294–299 | Přirozené pokyny k aktualizaci a sestavení APK | **SMÍŠENÉ** | Schválený balík a APK až po bráně/souhlasu; staré technické triggery neplatí |
| 300–311 | Výběr režimu ChatGPT: Chat / Work / Codex (dohoda 6. 11. 2026) | **PLATÍ** | Chat/Work/Codex podle rizika, ne podle zvyku |

## START_ZDE.md – kontrola všech 15 původních oddílů

| Řádky v původním START_ZDE | Původní oddíl | Status | Interpretace |
|---|---|---|---|
| 78–89 | 0. Společná práce přes ChatGPT i Codex | **HISTORIE** | Staré main a QA SHA nejsou dnešní stav |
| 90–93 | Automatické testování celé aplikace #28 – rozpracováno | **PLATÍ** | Předávání práce přes GitHub |
| 94–104 | Aktivní společná aktualizace po 1.2.149 – implementace Codexu | **SMÍŠENÉ** | Registr #28 platí, starý stav QA ne |
| 105–111 | Aktuální stav: vydána APK 1.2.149 (ověřeno 4. 11. 2026) | **HISTORIE** | Historické předání Codexu |
| 112–134 | Historie implementace po 1.2.148 – E + F + G a značka miniatury | **HISTORIE** | Starší vydání, dnes 1.3.0 |
| 135–144 | Aktuální implementace issue #17 – 4. 11. 2026 | **HISTORIE** | Historická implementace, ověř live main |
| 145–164 | 1. Co právě řešíme | **HISTORIE** | Issue #17 zdroj, ne dnešní úkol |
| 165–173 | Dokončené podklady k původní sadě 28 testů | **HISTORIE** | Tehdejší priorita, nahradit aktuálním rozhodnutím |
| 174–188 | 2. Nejdůležitější pravidlo: ukládat průběžně, nikoli zpětně | **HISTORIE** | Testy relevantní, staré PASS ne |
| 189–206 | Jeden čitelný záznam o každé věci | **PLATÍ** | Průběžně zapisovat fakta a rozhodnutí |
| 207–208 | 3. Malé uzavřené vývojové cykly | **PLATÍ** | Jeden dohledatelný záznam, bez duplicit |
| 209–227 | Testování 1.2.147 – vždy jeden test | **SMÍŠENÉ** | Jednotlivý test 1.2.147 historie; programování po balících |
| 228–233 | 4. Jak rychle pokračovat v úplně novém chatu nebo Codexu | **PLATÍ** | Nový chat načte aktuální HEAD/PR |
| 234–248 | 5. Přímé odkazy a rozdělení odpovědností | **SMÍŠENÉ** | Předchozí role historie, nyní 35/36 |
| 249–258 | 6. Historie dohod a poslední předání | **HISTORIE** | Archivní chronologie, ne dnešní instrukce |

## Konkrétní opravy zjištěné při ověřování

1. První krátká verze **opomněla výslovně uvést** referenční ImageMeter 26.6.1/26.5.0, pět vyřazených funkcí a nepodmíněné ovládání prstem. Nyní výslovně v AGENTS §7.
2. Chyběla **povinnost porovnat tři architektonické varianty** a integrované testy návazností. Nyní AGENTS §8.
3. Chyběla **aktivní odpovědnost koordinátora** za doporučování změn Pokynů projektu ChatGPT; GitHub je sám neupravuje. Nyní §8.
4. Archiv obsahuje zastaralé pokyny k APK přes `.github/apk-build-request.txt` (původní AGENTS § Stav projektu a § Jednoduchý provoz). Živý `.github/workflows/build-apk.yml` na main má pouze ruční `workflow_dispatch` se schvalovacími podmínkami. **Staré triggery nepřebírat.**
5. Původní START_ZDE mluví o testech jednoho uživatelského kroku 1.2.147; **neznamená dnes programovat každou malou opravu v samostatném PR**. Běžný schválený postup je balík asi 5–10 souvisejících oprav se společnou regresí.
6. Původní archiv zůstává **beze změny**. Při jeho čtení nezaměňovat archivní stav main, staré role nebo historické odkazy za živý repo stav.

## Brána nezávislého review

Každý řádek matice musí kontrolor ověřit proti zdrojovému oddílu, zejména ochranu přesných dat, médií, referenčního ovládání, testů, HOME runneru/CI nákladů, nápovědy, release a souhlasů. **Tato samo-kontrola autorem nemůže nahradit nezávislé review**. Pokud některý konkrétní detail omylem označujeme za historii, před merge ho opravíme ve stejném PR.

**Runtime/home/Android/Drive:** NOT RUN (pouze dokumentační statická kontrola). Bez APK, cloudových běhů a změn aplikace.
