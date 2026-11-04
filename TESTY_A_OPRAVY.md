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

## Povinná kontrola úplnosti před označením testu za dokončený

**Závazná metodika z 4. 11. 2026 po zjištění nepřesností v předběžných výtazích.** Dříve použitý stručný popis **není technická specifikace**. Žádný ze starých 28 testů neoznačovat jako plně zrekonstruovaný, dokud není splněno vše níže.

1. **Primární zdroj**: celé video záznamu chatu `1000093687.mp4`, nikoli volná interpretace předchozího shrnutí. V případě potřeby kontrolovat jednotlivé snímky ve větším rozlišení. Nečitelný úsek označit s časem a vyžádat si původní screenshot či video.
2. **Dvě průchodové fáze**: (A) souvisle identifikovat všech 28 testů a všechny další samostatné nápady v celém videu, (B) *pro každý test znovu projít celý záznam* a vyhledat každý pozdější návrat, doplněk, změnu či zrušení dohody. Neuzavírat test po prvním výskytu.
3. **Podrobný důkazní zápis**: zachovat věcné formulace v jejich významu; u podstatných sporných detailů případně krátkou přesnou citaci. Uložit časový úsek, číslo testu a konkrétní název videosouboru/fotografie odkazované v záznamu. Soubory spárovat se skutečnými přílohami a neodvozovat souvislosti jen z podobného tématu.
4. **Úplnost funkce**: vypsat (a) existující a fungující chování, které se nesmí rozbít, (b) jednotlivé pozorované závady, (c) cílové chování *každého* úchopu, gesta, popisku, tvaru, velikosti a nastavení, (d) vyzkoušené/nevyzkoušené okrajové situace, (e) jednotlivé navržené alternativy, (f) **poslední platnou dohodu**.
5. **Přesnost názvů a rozsahu**: používat uživatelem opravené označení **„Směřovat“**, nikoli „Směrovat“. Problém s úchopy se týkal **kruhu i elipsy**, ne pouze elipsy. To jsou již známé chyby původní sumarizace; všechny ostatní záznamy proto také znovu ověřit a nebrat je automaticky za správné.
6. **Rozlišit jednotlivé stavy**: historické pozorování ≠ dohodnutý požadavek ≠ nápad možná později ≠ commit ≠ vydané APK ≠ otestováno a funguje na zařízení. Neodhadovat verzi APK ani datum implementace.
7. **Kontrola proti kódu**: až po sestavení skutečné specifikace dohledat odpovídající implementaci/commity a výslovně popsat, zda požadavek už kód pokrývá, částečně pokrývá, nebo stav nelze potvrdit. Zároveň neplést technické statické testy s uživatelským testem.
8. **Samostatné návrhy mimo čísla testů**: zachytit každou relevantní změnu ikony, textu, zobrazení a přidanou funkci; u nejasného „změníme ikonu“ dohledat *kterou* ikonu a *jak*, jinak otevřenou otázku. Neztrácet nápady zvažované pro budoucnost.
9. **Zápis a kontrola**: u každého dokončeného testu uložit podrobnou kapitolu na GitHub, zkontrolovat obsah zápisu po uložení a poslat uživateli odkaz. **Nepřipravovat zjednodušené zadání k implementaci, dokud nebude tato úplnost potvrzena.**

### Kontrolní karta pro každý z 28 testů
- [ ] Původní zadání, přesné číslo a název doložené videem
- [ ] Všechny výskyty v celém hlavním videu dohledané, včetně pozdějších doplnění
- [ ] Odpovídající externí videa/fotky propojené názvem, obsahem a časem, pokud existují
- [ ] Podrobné očekávané a skutečné chování rozepsané včetně toho, co funguje
- [ ] Každý návrh/alternativa a konečná dohoda oddělené
- [ ] Stav implementace vyhodnocený samostatně, bez neověřeného tvrzení
- [ ] Nejasnosti pojmenované; nečitelný snímek určen časem pro opětovné dodání
- [ ] Zápis GitHubu zkontrolován a propojen s odpovídajícím issue

**Poznámka k nynějším předběžným souhrnům:** Některá starší přiřazení čísel a závěrů se již ukázala chybná. Považovat je pouze za pracovní stopy, **ne za schválené kompletní výsledky**.

## Výsledek rekonstrukce historických 28 kontrol (4. 11. 2026)

**Všech 28 testů bylo rozepsáno do detailních historických protokolů.** Nejde o stoprocentně ověřený doslovný přepis, protože některé pasáže rychle posouvaného videa jsou částečně překryté. Jde o průběžné technické podklady z čitelných částí a z doplňujících příloh. Před implementací porovnat se skutečným aktuálním kódem a nejasnosti se zeptat; žádný odhad neprohlašovat za potvrzený.

| Kontroly | Kde jsou rozepsané | Další stav |
|---|---|---|
| **1–10** | [REKONSTRUKCE_TESTU_01_10.md](REKONSTRUKCE_TESTU_01_10.md) | Sepsáno z videa, implementace/retest nezávisle neověřeny |
| **11–20** | [REKONSTRUKCE_TESTU_11_20.md](REKONSTRUKCE_TESTU_11_20.md) | Sepsáno z videa, implementace/retest nezávisle neověřeny |
| **21–28** | [REKONSTRUKCE_TESTU_21_28.md](REKONSTRUKCE_TESTU_21_28.md) | Sepsáno z videa, implementace/retest nezávisle neověřeny |
| **Mimo čísla testů** | [ROZHODNUTI_A_NAPADY_Z_TESTU.md](ROZHODNUTI_A_NAPADY_Z_TESTU.md) | Schválené novinky i neodsouhlasené „možná později“ |
| **29** | Plánovaný test provozu bez internetu | Nezařazovat do 28; není potvrzen jako splněný |

**Dohoda o cyklech:** nyní použít všech 28 historických bodů jako podklad pro společnou další aktualizaci. Teprve **po ní** pokračovat s novými testy a opravami po skupinách přibližně pěti; jednotlivé výsledky však ukládat na GitHub hned po každé domluvě.

## Zápisy jednotlivých testů

*Původní historické zápisy všech 28 testů jsou nyní ve třech propojených detailních dokumentech výše. Tato šablona zůstává pro nové testy a budoucí krátké cykly.*

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
- [ROZHODNUTI_A_NAPADY_Z_TESTU.md](ROZHODNUTI_A_NAPADY_Z_TESTU.md) – schválená rozšíření, odložené nápady a důkazní přílohy
