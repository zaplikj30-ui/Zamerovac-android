# Zaměřovač – průběžné testy, dohody a opravy

**Způsob práce schválen 4. 11. 2026.** Tento soubor je pracovní přehled testů a rozhodnutí. Každou kontrolu zapisovat **ihned po domluvě s uživatelem**, nikoli až na konci série. Pro historii podrobností použít související [GitHub issue #13](https://github.com/zaplikj30-ui/Zamerovac-android/issues/13) a podle potřeby samostatná issues.

## Pravidlo „jednička → uložit, dvojka → uložit“

1. Projdeme **test 1**. Zjistíme co funguje, co ne, co je vhodné změnit a **jak se přesně dohodneme**. Pokud si nejsme jistí, zapíšeme nevyjasněné otázky a zeptáme se.
2. **Hned** aktualizuji GitHub – výsledek, dohodu, přílohy a případně nový nápad „možná později“. Potvrdím uživateli úspěšný zápis.
3. Teprve potom **test 2**. Opět domluva → zápis → potvrzení. Takto **každý další test zvlášť**, i když technicky budou v jednom přehledném souboru.
4. **Není nutné vytvářet jedno issue pro každý drobný krok.** Jednotlivé testy budou přehledně oddělené a číslované; rozsáhlejší chybu lze rozpracovat v samostatném issue, na které test odkáže.
5. Po malém počtu hotových testů (zpravidla **pět**) vybereme schválené opravy do jednoho cyklu. Úkol zůstává i po naprogramování otevřený, dokud neověříme chování v testovací APK na zařízení.
6. Když se rozhodnutí změní, opravíme aktuální popis a zanecháme historii v GitHubu. Chyba ze starého videa **není automaticky** současnou chybou; commit **není automaticky** úspěšný uživatelský test.
7. Videa a snímky slouží jako podklad. Zdroj pořadí starých 28 testů: první video `1000093687.mp4`; další přílohy přiřazovat podle obsahu. Soubory nejsou automaticky trvale uchované v GitHubu.

## Každá číslovaná kontrola má tyto údaje

- **Test č. / název / čas nebo verze (pokud známe)**
- **Co se přesně testovalo:** konkrétní kroky a očekávané chování
- **Výsledek na zařízení:** funguje / částečně / chyba / neověřeno
- **Co bylo špatně a co jsme vymysleli:** pozorování a navržené varianty
- **Konečná dohoda:** co se má opravit/zlepšit; odlišit návrh od odsouhlaseného zadání
- **Možná později:** nápady bez závazku implementace
- **Přílohy a důkazy:** názvy příslušných videí/screenshotů, případně odkaz na commit nebo issue
- **Další stav:** čeká na opravu / implementováno / vydáno v APK / uživatelem potvrzeno
- **Další krok / historie případné změny dohody**


## Podrobnost evidence – zachovat každý relevantní detail

**Dohoda z 4. 11. 2026:** „Každý detail se může hodit.“ Při rekonstrukci i nových testech neukládat jen krátké „funguje/nefunguje“ nebo finální opravu. Uložit všechny **věcně relevantní podrobnosti**, které pomohou pochopit problém a předejít jeho návratu:

- Přesné kroky testu a co se stalo proti očekávání; pokud je něco vidět jen částečně, přiznat nejistotu.
- Drobnosti vzhledu a ovládání: ikony, rozložení, velikost, barva, průhlednost, texty, umístění, reakce na dotyk/S Pen, gesta, lupu, přesouvání a přichytávání.
- Navržené varianty, proč se nějaká líbila nebo nelíbila, následná doplnění i opravy původní dohody **kdekoli dále v celém záznamu**.
- Rozlišit, zda jde o potvrzenou chybu, schválené vylepšení, nový schválený prvek, nápad „možná do budoucna“, nebo nejasnost k doptání.
- Ke každému zjištění **odkaz na důkaz**: číslo testu, název videa/fotky, čas ve videu, případně citaci krátké klíčové formulace ze záznamu. Neukládat soukromé fotografie nebo videa přímo do veřejné dokumentace bez potřeby.
- Po jednotlivých testech průběžně ukládat závěry na GitHub, nikoli až po všech 28; před označením za finální projít pozdější dodatky v celém videu.

**Cíl:** z příštího záznamu musí být možné změnu přesně implementovat a otestovat, aniž bychom znovu četli původní dlouhý chat. Současně nevydávat neověřený odhad za fakt.

## Stav rekonstrukce historických 28 kontrol (4. 11. 2026)

**Dosud NEUZAVŘENO.** V deníku [#13](https://github.com/zaplikj30-ui/Zamerovac-android/issues/13) existuje předběžná rekonstrukce některých čísel, která je ještě nutné porovnat s videem původního chatu. Zde nebudeme vymýšlet, že už jsou kompletně hotové.

| Kontroly | Rekonstrukce | Akce |
|---|---|---|
| 1–28 | Postupně z dostupného chatu a příloh, **výsledky ještě neúplné** | Vzít jednotlivě, upřesnit domluvu, uložit **ihned každou** |
| 29 | Původně zamýšlený test offline | Provést až v odpovídající fázi; dosud nezaměňovat za hotový |

## Zápisy jednotlivých testů

*První úplný zápis podle níže uvedené šablony bude přidán teprve po ověření celého kontextu konkrétní kontroly a schválené dohody. Předběžné poznámky zůstávají v #13.*

### Test [číslo] – [název]
- **Předmět testu:**
- **Výsledek:**
- **Chyba / podnět:**
- **Přesná dohoda:**
- **Nápady na později:**
- **Důkazy (názvy souborů):**
- **Stav opravy / verze APK:**
- **Další krok:**

## Kde co hledat
- [START_ZDE.md](START_ZDE.md) – aktuální stav a odkazy
- [Issue #13](https://github.com/zaplikj30-ui/Zamerovac-android/issues/13) – deník a dosavadní předběžná rekonstrukce
- [Issue #12](https://github.com/zaplikj30-ui/Zamerovac-android/issues/12) – původních 49 úprav
- [VIZE_A_PLAN.md](VIZE_A_PLAN.md) – budoucí vize a nápady
- [TESTOVANI_MEDIA_INDEX.md](TESTOVANI_MEDIA_INDEX.md) – evidence videí
