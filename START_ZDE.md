# Zaměřovač – START ZDE (aktuální stav, rozhodnutí a další práce)

> **Jediný rozcestník pro navázání v novém chatu.** GitHub je trvalý pracovní záznam. Nespoléhat na paměť ChatGPT ani nutnost znovu procházet dlouhé chaty.
>
> Poslední dohoda o způsobu práce: **4. listopadu 2026**. Tento dokument je živý, stav níže se musí při dalších krocích aktualizovat.

## 0. Společná práce přes ChatGPT i Codex

**Závazný postup je v [AGENTS.md](AGENTS.md#společný-pracovní-protokol-chatgpt--codex--github-závazné).** Na projektu se střídají klasické chaty ChatGPT i Codex. **GitHub je jediný sdílený trvalý zdroj aktuálního stavu**; nepočítat s tím, že druhý chat vidí náš rozhovor.

**Než kdokoli začne další práci**, musí znovu ověřit tento rozcestník, `AGENTS.md`, poslední commity a aktivní PR, relevantní issues **včetně nových komentářů** (zejména #13, #12, #14), aktuální stav Actions a Releases. Před zápisem znovu ověřit změněné soubory/SHA, aby se nepřepsala práce druhého chatu nebo Codexu.

**Předávání bez kopírování chatu:** přesné nové dohody, schválené úpravy, výsledky testů, rozpracovaný kód, otevřené blokátory i nezávazné nápady průběžně hned ukládat ke správnému issue nebo dokumentu. V tomto souboru udržovat **hotovo / zbývá / nerozhodnuto / další konkrétní krok** a odkazy. Odlišit **nápad → schválené → v kódu → APK vydaná → fyzicky ověřená**. Samotný commit, zelené CI ani APK neprokazují reálné ověření.

**Současný další konkrétní krok – AKTUALIZACE SCHVÁLENA 4. 11. 2026:** uživatel po dokončení testů 1–9 a souvisejících fyzických kontrol rozhodl **„Teď bych ale provedl aktualizaci už“** a **„Neuděláme i ty nápady ... rovnou?“**. Implementovat souhrnný aktualizační úkol [**issue #17 – společná aktualizace oprav a UX i vymezených nápadů**](https://github.com/zaplikj30-ui/Zamerovac-android/issues/17): přesná zadání a regresní kritéria jsou v issue #17, podrobné důkazy v [issue #13](https://github.com/zaplikj30-ui/Zamerovac-android/issues/13). **Jedna společná APK až po dokončení všech dohodnutých úprav a kontrolách.** Výchozí vydání [v1.2.147](https://github.com/zaplikj30-ui/Zamerovac-android/releases/tag/test-v1.2.147); **nová APK dosud neexistuje**. Před prací znovu ověřit AGENTS, START, commity, issues/PR, Actions a stav druhého chatu/Codexu; nepřepisovat novější práci. **Neověřené mimo tuto sérii**: samostatný [test 29 – offline](https://github.com/zaplikj30-ui/Zamerovac-android/blob/main/REKONSTRUKCE_TESTU_21_28.md#co-následuje-po-historické-kontrole-28), reálné Bluetooth měření Bosch (4. 11. nebylo použito), některé další body původních 28 kontrol/#12. Nenahrazovat fyzický test zeleným buildem; po nové APK cíleně otestovat i regresi dat. **Rozsáhlé dlouhodobé nápady AI/iOS/Windows/cloud/Samsung Notes nejsou součástí schválené aktualizace.**

## Aktuální implementace issue #17 – 4. 11. 2026

- Výchozí main `474c841`; při zahájení žádné otevřené PR, poslední vydaná APK 1.2.147, vydávací Actions úspěšné. Schválená společná aktualizace je rozpracovaná, nová APK zatím nevydána.
- **Nová dohoda o jednotkách nahrazuje předchozí přesun dolů:** malé rozbalovací políčko s aktuální jednotkou (mm/cm/m/in, u příslušných typů m²/°) **vedle pole Rozměr**, které zabere většinu řádku. U každého úseku samostatně. Zachovat uložené hodnoty, jednotky, přesnost i napojení Bosch.
- [Zápis rozhodnutí a zahájení v issue #17](https://github.com/zaplikj30-ui/Zamerovac-android/issues/17#issuecomment-6635760943).
- **První část v kódu:** ukládání rozpracovaných řetězců, přesné nápovědy, kompaktní jednotky u rozměru, souřadnice kruhu/elipsy, orientace lomené čáry, priority úchopů, přepínání +, refresh koše, názvy importní kopie, volitelné pozadí. Lichoběžník: obrys při správné vrstvě v prohlížeči funguje; nástroj nově aktivuje svou skrytou vrstvu (reprodukované úchopy bez obrysu). Původní příčina na telefonu není prokázaná. Dosavadní JS testy a cílené nové regrese prošly, fyzický retest čeká.
- Další krok: doplnit zákaznický PDF ZIP a celkové automatické kontroly celé #17, průběžně uložit, až poté jedna APK. Bosch a offline test 29 nejsou fyzicky ověřené.

## 1. Co právě řešíme

| Oblast | Aktuální stav | Kde je podrobnost |
|---|---|---|
| Název aplikace | **Aktuální název pro uživatele: Zaměřovač**, bez přídomku „TEST“. Označení „testovací verze“ patří jen k typu vydání, **nikoli k názvu aplikace**. Budoucí nový název vymyslíme a schválíme později; zatím nic nepřejmenovávat v balíčku ani nepřepisovat uživatelská data. | [Sestavení](.github/workflows/build-apk.yml) · [Android konfigurace](app/build.gradle) |
| Rekonstrukce starých testů 1–28 | **Všech 28 je rozepsáno z hlavního videa včetně pozdějších dodatků** do tří částí. Nejde o doslovně ověřený kompletní přepis každého znaku, ani ověření aktuální APK. | [1–10](REKONSTRUKCE_TESTU_01_10.md) · [11–20](REKONSTRUKCE_TESTU_11_20.md) · [21–28](REKONSTRUKCE_TESTU_21_28.md) |
| Přílohy k testování | Hlavní video `1000093687.mp4` určuje číslování; ostatní videa/fotky byly přiřazeny podle obsahu. Původní číselná jména videí nejsou vždy 1:1 prokázána. | [Důkazní mapa](ROZHODNUTI_A_NAPADY_Z_TESTU.md#4-přehled-důkazů-a-dosud-nepotvrzených-identit-videí) · [Index médií](TESTOVANI_MEDIA_INDEX.md) |
| Základní sada požadavků | 49 položek z dřívějšího seznamu; jejich stav nelze automaticky považovat za splněný. | [Seznam úprav #12](https://github.com/zaplikj30-ui/Zamerovac-android/issues/12) |
| Dlouhodobá představa | Vzhled, schopnosti, možnosti „možná později“; lze měnit. | [Vize a plán](VIZE_A_PLAN.md) |
| Statický audit kódu proti 28 testům | **Dokončen** s odkazy na konkrétní zdrojové soubory. **Není to test funkčnosti na telefonu.** | [AUDIT_KODU_PROTI_28_TESTUM.md](AUDIT_KODU_PROTI_28_TESTUM.md) |
| Společná aktualizace podle 28 kontrol | **TEST 1.2.147 sestavena a vydána**; automatické kontroly a podpis prošly, **fyzické testy na telefonu/tabletu teprve čekají**. Pokračovat po cca pěti krocích, každý výsledek hned zapisovat. | [APK 1.2.147](https://github.com/zaplikj30-ui/Zamerovac-android/releases/tag/test-v1.2.147) · [Mapa implementace](IMPLEMENTACE_A_TESTOVANI_28.md) · [Testy #13](https://github.com/zaplikj30-ui/Zamerovac-android/issues/13) |
| Sjednocená dlouhodobá vize včetně průvodce zaměřením | **Devět oblastí zkontrolováno.** Průvodce zaměřením a kontroly úplnosti kót jsou pouze budoucí možnost; propojení s Konfigurátorem a Windows není nynější implementace. | [Stav a rozcestník devíti oblastí](VIZE_A_PLAN.md#kontrola-sjednocení-dlouhodobých-požadavků--co-platí-nyní-a-co-později) · [Vize Konfigurátoru](https://github.com/zaplikj30-ui/Konfigurator-Narezak-Android/blob/main/VIZE_A_PLAN.md) |
| Budoucí iPhone/iPad | **Nezávazná možnost.** Nyní pouze Android; přenositelné datové modely a oddělené systémové adaptéry mají případnou iOS/iPadOS verzi umožnit bez nutnosti dnešního přepisu. | [VIZE_A_PLAN.md](VIZE_A_PLAN.md) · [Datový formát](DATOVY_FORMAT_A_PC_KOMPATIBILITA.md) |
| Evidence kompatibility Android | **Nové testy tím nejsou prokázány.** Registr rozlišuje skutečné testy, předpoklad a nekompatibilitu. | [KOMPATIBILITA_ZARIZENI.md](KOMPATIBILITA_ZARIZENI.md) |
| Budoucí plnohodnotná PC verze | **Dlouhodobý směr, nikoliv zahájený vývoj.** Windows 11 má později pracovat se stejnými editovatelnými zakázkami a bezpečně přenášet změny mezi PC a Androidem. | [Vize](VIZE_A_PLAN.md) · [Datový formát a PC kompatibilita](DATOVY_FORMAT_A_PC_KOMPATIBILITA.md) |
| Verze APK | Na GitHubu **vydána testovací sestava 1.2.147**. Zda je nainstalována a co skutečně funguje, ověřit na zařízení; historický screenshot není důkaz. | [GitHub Releases](https://github.com/zaplikj30-ui/Zamerovac-android/releases) |


- **Příprava na vícejazyčnost (první česká implementace ve v1.2.147, čeká na ověření na zařízení):** [Plán lokalizace](LOKALIZACE_PLAN.md) · [Úkol #14](https://github.com/zaplikj30-ui/Zamerovac-android/issues/14). Nyní zůstává vše v češtině; jazykové klíče se budou bezpečně přidávat jen k nově opravovaným funkcím. **Nově implementovaná položka Nastavení „Jazyk aplikace“** má nabídnout pouze „🇨🇿 Čeština“; architektura musí podporovat desítky jazyků, budoucí vyhledávání a RTL, ale další jazyky a skutečné přepínání nejsou nyní v rozsahu.

## Dokončené podklady k původní sadě 28 testů

- **[Testy 1–10 – přesné požadavky, průběh a důkazy](REKONSTRUKCE_TESTU_01_10.md)**
- **[Testy 11–20 – přesné požadavky, průběh a důkazy](REKONSTRUKCE_TESTU_11_20.md)**
- **[Testy 21–28 – přesné požadavky, průběh a důkazy](REKONSTRUKCE_TESTU_21_28.md)**
- **[Samostatné schválené změny, odložené nápady a mapování příloh](ROZHODNUTI_A_NAPADY_Z_TESTU.md)**

**Dále:** [statický audit původního kódu proti všem 28 testům](AUDIT_KODU_PROTI_28_TESTUM.md) vedl ke [společné implementaci](IMPLEMENTACE_A_TESTOVANI_28.md) a vydání 1.2.147. **Následuje reálné ověření funkcí na telefonu/tabletu a případné opravy podle výsledků**, zejména bezpečnosti dat. Nejasné části nepovažovat za hotové; zelené automatické testy nenahrazují fyzické.

## 2. Nejdůležitější pravidlo: ukládat průběžně, nikoli zpětně

**Každé věcně důležité zjištění nebo rozhodnutí zapisovat na GitHub už v tom rozhovoru, ve kterém vzniklo**, po upřesnění jeho významu. Nečekat na konec několika desítek testů. To platí pro:

- pozorované **chyby a výsledky testů**;
- **přesné dohody** o požadovaném chování, vzhledu, prioritě, omezeních;
- **rozpracované kroky**, co bylo změněno v kódu, co zůstává;
- **plánovanou práci** a pořadí další dávky;
- **nápady a možnosti do budoucna**, i když uživatel řekne „možná“, „uvidíme“, „necháme na později“, „ještě nevím“;
- **změnu názoru**, odložení, zamítnutí či nahrazení staršího rozhodnutí, s důvodem;
- **vydané APK a následné reálné ověření** na telefonu/tabletu;
- **otevřené otázky** – co zatím nevíme a na co se musíme doptat.

**Co je jen neurčitá úvaha, nesmí být označeno jako schválený úkol.** Oprava v kódu nebo vydání APK samo o sobě není potvrzený úspěch testu.

### Jeden čitelný záznam o každé věci

Větší samostatné věci ukládat jako **GitHub Issue** (s odkazem z tohoto rozcestníku nebo z deníku #13). Menší kroky, komentáře a výsledky přidávat k existujícímu issue. Neduplikovat tutéž věc pod jiným číslem.

**Šablona:**
- **ID / název / oblast:**
- **Typ:** chyba · test · schválená změna · nápad „možná později“ · plán · rozhodnutí
- **Stav:** k prověření · návrh · čeká na rozhodnutí · dohodnuto · plánováno · rozpracováno · v kódu · vydáno v APK · ověřeno na zařízení · odloženo · zrušeno
- **Co uživatel pozoroval/řekl; jak to má fungovat:**
- **Co jsme skutečně odsouhlasili a co ještě není rozhodnuté:**
- **Závislosti / další konkrétní krok:**
- **Důkaz:** číslo testu, název videa nebo screenshotu, relevantní commit, verze aplikace – jen pokud známe
- **Historie změn rozhodnutí:** datum, co a proč se změnilo

GitHub změny uchovává v historii; starší rozhodnutí u významnějších změn zachovat také v komentáři nebo v historii daného issue, aby bylo jasné, co platí nyní.

**Potvrzení uložení:** až po úspěšném zápisu poslat uživateli přímý odkaz. Pokud GitHub není dostupný nebo se zápis nezdaří, **otevřeně říct, že zatím uložený není**. Nikdy neslibovat automatické průběžné ukládání na pozadí, když chat neběží.

## 3. Malé uzavřené vývojové cykly

### Testování 1.2.147 – vždy jeden test

Upřesněná dohoda 4. 11. 2026: Ukazovat vždy **jen jeden konkrétní test** s krátkým návodem a výběrem **Funguje správně / Nefunguje – chyba / Funguje částečně / Nešlo vyzkoušet**. **Nenabízet ani nevyžadovat pole pro ručně psané poznámky.** Po odeslání samotného výsledku asistent **počká**: uživatel následně poskytne video, hlasové vysvětlení nebo další zprávy. **Nepřecházet na další test a neuzavírat finální záznam podle samotné volby.** Teprve až uživatel dokončí předání podkladů, asistent výsledek i zjištěné chování shrne, uloží do existujícího issue #13, ověří zápis, pošle odkaz a až potom zadá další jediný test. Při neúspěšném zápisu na to výslovně upozornit. Dávky pěti úkolů patří vývoji, nikoli zobrazení uživatelských testů. **Uzavřený uživatelský průchod testem 22 – Koš (v1.2.147): Částečně; podklady již dodány, výsledek a otevřená chyba zapsány do [issue #13](https://github.com/zaplikj30-ui/Zamerovac-android/issues/13#issuecomment-6632603703). Fotografie je obnovena, ale seznam původní složky se neaktualizuje do odchodu a návratu. Oprava dosud neprovedena; úplné zachování kót není tímto videem samostatně doloženo. Test 26 – ZIP export jedné fotografie **funguje v provedeném rozsahu**, uživatel ZIP našel a potvrdil soubory, viz [zápis v issue #13](https://github.com/zaplikj30-ui/Zamerovac-android/issues/13#issuecomment-6632755508). Zpětný import a integrita všech kót ještě nejsou potvrzené. **Test 27 – ZIP import (v1.2.147): Částečně.** Import a fotografie fungují, ale nová kořenová složka se jmenuje jen „Obnovená záloha + datum“, takže nejde poznat původní soubor či zakázku. [Důkazy, přesné zadání a odkaz na původ v kódu](https://github.com/zaplikj30-ui/Zamerovac-android/issues/13#issuecomment-6632844550). **Zlepšit název importní kopie podle původní fotografie nebo složky, neohrozit původní data; dosud pouze zapsáno, neimplementováno.** **Test 21 – Zámky složek: Funguje správně, bez požadavku na změnu**, uživatel potvrdil bez dalších příloh. [Uložený výsledek testu 21](https://github.com/zaplikj30-ui/Zamerovac-android/issues/13#issuecomment-6632951748). **Test 16 – Magnet a bílé úchopy: Částečně; video a slovní podklady dodány.** Opět se při dotyku u konce přesune celá čára místo koncového bodu; oblast pro uchopení středu je příliš blízko koncům. Navíc není dost výrazně vizuálně zvýrazněný zapnutý stav funkcí na spodní liště. [Přesná evidence + odkazy na pravděpodobné místo v kódu](https://github.com/zaplikj30-ui/Zamerovac-android/issues/13#issuecomment-6633071444). Oprava vyžaduje schválenou společnou aktualizaci a fyzický retest; dosud neprovedena. **Test 9 – Kruh a elipsa: NEFUNGUJE.** Uživatel dodal video `1000093771.mp4`: zobrazují se pouze bílé úchopy, barevné obrysy obou tvarů nejsou vidět. Podle kódu jde pravděpodobně o záměnu souřadnic fotografie a obrazovky při vykreslování (`ellipseGeometry` oproti `drawItem`); přesná diagnóza, regresní test a oprava jsou otevřené. [Ověřený zápis v issue #13](https://github.com/zaplikj30-ui/Zamerovac-android/issues/13#issuecomment-6633178317). **Test 8 – Obdélník: ČÁSTEČNĚ.** Posun celého tvaru, čtyři rohové úchopy, pravoúhlost a zobrazení obsahu v m² fungují. Schválená drobná úprava pro další aktualizaci: z dialogu odstranit pouze nadbytečné pole „Kóta / rozměr (volitelné)“, ponechat šířku, výšku, jejich texty a vlastní popisek; obsah počítat jen z platné šířky/výšky, nikoli ze staré obecné hodnoty. Přiřazení Bosch měření k šířce/výšce udělat jednoznačné, nemazat stará data. [Zápis výsledku testu 8 a podklady](https://github.com/zaplikj30-ui/Zamerovac-android/issues/13#issuecomment-6633605220). **Test 7 – Lichoběžník: NEFUNGUJE – CHYBA.** Uživatel poslal snímek `1000093778.jpg`: zobrazují se čtyři bílé rohové úchopy, ale barevný obrys lichoběžníku vůbec ne. Stejný příznak jako u kruhu/elipsy (test 9), příčina však zatím neověřena; potřeba opravit vykreslování a provést regresní test. [Ověřený zápis testu 7 v issue #13](https://github.com/zaplikj30-ui/Zamerovac-android/issues/13#issuecomment-6633736926). **Test 6 – Úhel: FUNGUJE SPRÁVNĚ.** Uživatel potvrdil testování a poté požádal o pokračování bez dalších připomínek. Námět na rozlišení číselných kót a textových popisků zůstává zvlášť jako budoucí návrh, ne jako chyba úhlu. [Zápis testu 6 v issue #13](https://github.com/zaplikj30-ui/Zamerovac-android/issues/13#issuecomment-6633968016). **Test 5 – Kumulativní řetězec: uzavřen uživatelský test ČÁSTEČNĚ (4. 11. 2026).** Po videu `1000093780.mp4` a dvou připomínkách uživatel výslovně uvedl „OK, další test“ a připomněl, že do příští skutečné aktualizace mají vstoupit **všechny projednané věci**, nikoliv zůstat jen jako poznámky. **Otevřené implementační požadavky:** (1) prověřit dvě stejné/téměř stejné kumulativní kóty po kliknutí, rozlišit případný náhled od existujících úseků a neopomenout přesnost kumulativního měření; (2) přidat malou nápovědu **dole**: před prvním bodem přesně **„Označ výchozí bod“**, po něm **„Klepni pro další kótu“**. [Detailní zadání, hypotézy a regresní kritéria pro Codex v issue #13](https://github.com/zaplikj30-ui/Zamerovac-android/issues/13#issuecomment-6634115993). **Jen evidence, dosud NEIMPLEMENTOVÁNO, bez nové APK a bez retestu; opravit v další uživatelem schválené společné aktualizaci a pak fyzicky ověřit.** **Test 4 – Dimenzní řetězec: NEFUNGUJE – CHYBA.** VIDEO `1000093783.mp4` a opakované výslovné potvrzení: po naklikání kót stačí na spodní liště **vypnout režim přidávání dalších kót (přepnout na výběr)** a celý rozpracovaný řetězec **zmizí, protože se vůbec neuloží do fotografie**. Pravděpodobný mechanismus: `setTool()` zahodí `polylineDraft` bez `completePolyline()`; **po vypnutí nástroje se musí dosavadní řetězec od 2 bodů dokončit a trvale uložit**, bez komplikovaných dialogů, bez duplicity bodů či ztráty dat; následně ověřit po kliknutí mimo a znovuotevření fotky. [Přesný, uživatelem opravený a ověřený zápis pro Codex v issue #13](https://github.com/zaplikj30-ui/Zamerovac-android/issues/13#issuecomment-6634317445). Zatím **NEIMPLEMENTOVÁNO**, žádný nový build ani retest. **Další schválená úprava z testu 4: změnit ikonu „Dimenzní řetězec“**, protože má nyní úplně stejný znak ↔ jako obyčejný „Rozměr“. Uživatel chce výrazně odlišnou ikonu **podobnou blesku či klikaté šipce**; na malé spodní liště i v nabídce nástrojů musí být rozpoznatelná. Nezaměnit s kumulativním řetězcem, neměnit chování nástroje ani uložená data. [Přesné zadání doplněno v testu 4 na GitHubu](https://github.com/zaplikj30-ui/Zamerovac-android/issues/13#issuecomment-6634317445). **Zatím pouze evidováno, neimplementováno – zařadit do příští společné aktualizace.** **Schválená nápověda z testu 4 – Dimenzní řetězec:** malý text dole **„Vyber počáteční bod“** před prvním dotykem; potom **„Klepni pro další navazující kótu“**. Druhý text musí zůstat **stejný po každé další navazující kótě** (i po druhé, třetí a dalších), dokud režim kreslení pokračuje; po ukončení zmizí nebo se pro nové kreslení vrátí na úvodní výzvu. Ukončení musí zároveň řetězec trvale uložit, viz chyba testu 4. [Detail v issue #13](https://github.com/zaplikj30-ui/Zamerovac-android/issues/13#issuecomment-6634317445). **Jen zapsáno, dosud neimplementováno.** **Test 3 – Lomená čára: FUNGUJE ČÁSTEČNĚ.** Uživatel ověřil, že **dvojité poklepání na poslední bod funguje** a žlutá lomená čára se vykresluje, ale na snímku `1000093784.jpg` je nápis **„500 mm · Ahoj“ stále vodorovný**, i když příslušný úsek čáry je šikmý. **Opravit zobrazení všech úsekových popisků včetně rozměru a textu tak, aby se natáčely podle konkrétního úseku** (vodorovně/svisle/šikmo, bez textu vzhůru nohama), zachovat údaje, posuny a editaci. Uživatel také žádá **stejné ukončení dvojklepnutím** pro kumulativní i dimenzní řetězec: v aktuálním `stageDown()` je tato logika pro oba již zapsaná, ale nutno **ověřit, sjednotit a případně opravit** její fyzické chování a ukládání; nepovažovat ji za nově chybějící funkci. Respektovat dřívější chybu testu 4 s úplnou ztrátou rozpracovaného řetězce po vypnutí nástroje. [Úplný ověřený zápis pro Codex – test 3 v issue #13](https://github.com/zaplikj30-ui/Zamerovac-android/issues/13#issuecomment-6634689226). **Dosud jen evidováno, žádná nová APK ani retest.** **Test 2 – Čára: UZAVŘEN – FUNKČNĚ FUNGUJE, OVLÁDÁNÍ S PŘIPOMÍNKAMI (4. 11. 2026).** Uživatel po doplňující kontrole výslovně potvrdil „Všechno funguje na to, co jsi ptal. Nebo ten test číslo dva je funkční.“ **Potvrzeno na telefonu:** nakreslení čáry, ruční zápis rozměru a textu, přesun jednoho koncového bodu bez změny druhého, zachování celé anotace po odznačení, zavření a opětovném otevření fotografie. **Není tím zvlášť ověřen přenos přes Bluetooth Bosch.** Všechny dřívější připomínky trvají: (1) lépe oddělit užší středovou dotykovou oblast pro přesun celé čáry od uchopení konců, přitom neměnit zbytečně vzhled kroužků a nezhoršit citlivost; (2) **každé relevantní menu**, zejména +, zavírat jak opětovným klepnutím na totéž tlačítko, tak Android tlačítkem Zpět, bez zavírání fotografie nebo ztráty kreslení; (3) jen **zmenšit velikost výrazné a kontrastní značky pravítka** na miniatuře fotografie, nezmenšovat její výraznost. **Připomínky jsou dosud NEIMPLEMENTOVANÉ, žádná nová APK.** [Ověřený závěrečný zápis testu 2 pro Codex v issue #13](https://github.com/zaplikj30-ui/Zamerovac-android/issues/13#issuecomment-6634965696). **Volitelné vzory pozadí a zákaznický ZIP s ne-editovatelnými PDF jsou pouze budoucí nápady ve `VIZE_A_PLAN.md`.**

**Test 1 – Šipka: FUNKČNĚ FUNGUJE SPRÁVNĚ (4. 11. 2026).** Uživatel na zařízení potvrdil kreslení, pohyb šipky a textu, jejich přesné umístění a **zachování všeho po zavření fotografie, opuštění i zavření aplikace a následném návratu**. **Společné upřesnění VŠECH dnešních testů v1.2.147: Bluetooth Bosch NEZKOUŠEN; rozměry i text zadávány výhradně ručně.** V příštím testovacím cyklu ověřit přenos z laseru samostatně, dnes jej neoznačovat jako funkční/nefunkční.

**Schválené úpravy UX z testu 1 pro nejbližší společnou aktualizaci (NEIMPLEMENTOVÁNO):** (1) **pro šipku, čáru, kótu a ostatní podobné anotace univerzálně** upravit oblast uchopení **celého objektu kolem středu** tak, aby nezasahovala příliš ke koncovým bodům, kde uživatel potřebuje uchopit a přemístit konkrétní konec / změnit orientaci; v souladu s testem 2 a 16. Nezmenšovat plošně vizuální bílé kroužky, neměnit neopodstatněně citlivost ani přesnost kót. (2) **Ve všech editačních formulářích, které nabízí volbu jednotek mm/cm/m/in (případně m² či °), posunout výběr jednotky až na konec souvisejících vstupních polí pod Rozměr a Popisek** (u vícesegmentových dialogů na konec příslušného úseku); zachovat výběr, již uložené jednotky/hodnoty, převody a případný Bosch. [Podrobnosti, rozsah ověření, technická místa a regresní kritéria v issue #13](https://github.com/zaplikj30-ui/Zamerovac-android/issues/13#issuecomment-6635332688). **Test 1 funkčně uzavřen, UX změny čekají; žádná nová APK ani retest.** **Dalším krokem už není test 1: uživatel schválil implementaci společné aktualizace podle [issue #17](https://github.com/zaplikj30-ui/Zamerovac-android/issues/17).**



1. Z připraveného seznamu vybrat **přibližně 5 podobných úkolů** (u složitějších méně).
2. Před implementací ujasnit jejich přesné zadání a průběžně jej uložit.
3. Opravit kód a spustit potřebné cílené testy; zaznamenat commity a zbývající otázky.
4. **Na pokyn uživatele** vydat **jedno společné testovací APK** pro danou dávku.
5. Uživatel provede krátké testy na zařízení; zaznamenat výsledek každého úkolu. Chyby se opraví, neověřené věci zůstanou otevřené.
6. Před další dávkou nebo změnou chatu aktualizovat tento soubor: **poslední verze, co je hotové, chyby, rozdělaná práce, následující úkol**.

**Výjimka pro nynější obnovu historie:** všech 28 existujících testů rekonstruovat najednou a promítnout do příští společné aktualizace; až další testovací cykly po aktualizaci vést po zhruba pěti. Nikdy nezůstávat u výsledků jen v chatu.

## 4. Jak rychle pokračovat v úplně novém chatu nebo Codexu

> „Pracujeme na Zaměřovači. Nejdřív načti aktuální `AGENTS.md`, `START_ZDE.md`, poslední commity/PR, issues včetně komentářů a nejnovější Releases. Zkontroluj, co mezitím změnil jiný chat nebo Codex. Připomeň skutečný stav, otevřené otázky a jediný další krok. Každou ujasněnou dohodu a výsledek ihned ulož na GitHub.“

Nemusí se znovu kopírovat celý původní chat. Neznámé informace ověřit z primárních zdrojů nebo se zeptat; nevymýšlet.

## 5. Přímé odkazy a rozdělení odpovědností

- **[Jednotlivé testy a opravy](TESTY_A_OPRAVY.md):** test 1 → domluva → okamžitý zápis; poté test 2 → domluva → zápis; postupně každý další test. Při každém testu zapisovat výsledky, opravy, nápady i důkazy.

- **Tento soubor:** aktuální stav a rozcestník. Musí se aktualizovat při změně fáze, zvolené dávky nebo důležitého rozhodnutí.
- **[Podrobná rekonstrukce 1–10](REKONSTRUKCE_TESTU_01_10.md), [11–20](REKONSTRUKCE_TESTU_11_20.md), [21–28](REKONSTRUKCE_TESTU_21_28.md):** aktuální podklady pro pozdější audit zdrojového kódu.
- **[Katalog dohodnutých změn a nápadů](ROZHODNUTI_A_NAPADY_Z_TESTU.md):** schválené novinky i nápady „možná později“.
- **[Datový formát a budoucí Windows editor](DATOVY_FORMAT_A_PC_KOMPATIBILITA.md):** současné schéma 1 a ZIP jsou zdokumentované; PC/synchronizace dosud neexistují. Nenahrazovat zálohování synchronizací bez samostatného návrhu.
- **[Statický audit 28 testů](AUDIT_KODU_PROTI_28_TESTUM.md):** konkrétní rozdíly v kódu a priorita oprav před vydáním APK.
- **[Testovací deník #13](https://github.com/zaplikj30-ui/Zamerovac-android/issues/13):** výsledky kontrol, průběžné dohody a konkrétní kroky; během rekonstrukce 28 testů primární evidence.
- **[49 původních úprav #12](https://github.com/zaplikj30-ui/Zamerovac-android/issues/12):** původní základní zadání; nesmazat jen proto, že už vznikla další evidence.
- **[Vize a plán](VIZE_A_PLAN.md):** dlouhodobý vzhled a funkce, budoucí a zatím nezávazné nápady.
- **[Seznam mediálních důkazů](TESTOVANI_MEDIA_INDEX.md):** názvy a záznamy souborů, deduplikace; originální soukromé přílohy nepublikovat do repozitáře.
- **[Vydání APK](https://github.com/zaplikj30-ui/Zamerovac-android/releases):** skutečně sestavené verze.

## 6. Historie dohod a poslední předání

**4. 11. 2026 – uživatel:** „Důležité je ukládat všechny kroky na GitHub ... co budeme dělat, chceme dělat, nebo na čem jsme se dohodli ... a rychle dohledatelné.“

**Výsledek:** Tento rozcestník a pravidlo okamžitého průběžného zápisu; nevydávat ChatGPT paměť za spolehlivé úložiště projektu. **Tentýž den dokončena rekonstrukce všech testů 1–28 i [statický audit zdrojového kódu](AUDIT_KODU_PROTI_28_TESTUM.md)**. Opravy podle auditu, český výběr jazyka, sestavení a fyzický retest ještě neproběhly. Schváleno: lokalizační architektura pro desítky jazyků; aktivní pouze čeština. Další dlouhodobé cíle: možné veřejné vydání na Google Play a **možná plnohodnotná Windows 11 aplikace** s editovatelnými společnými zakázkami; ani jedno se nyní nevyvíjí. Při dalších fázích aktualizovat přehled i příslušné issues.

**Pozdější ověřený stav (4. 11. 2026):** Následující původní historický zápis zachycuje stav *před* společnou aktualizací; nenechat se zmást tvrzením, že kód ani APK nebyly sestaveny. Vydání **test-v1.2.147 již existuje**, změny podle 28 testů jsou v kódu, ale **jejich fyzické ověření na telefonu/tabletu stále není doloženo**. Nové návrhy půdorysu a případných profilů ovládání/vykreslování jsou v [VIZE_A_PLAN.md](VIZE_A_PLAN.md), zatím nejsou povel k implementaci. **Další krok:** pokračovat testy a zápisem výsledků do #13, přičemž před prací kontrolovat novější commity druhého chatu/Codexu.
