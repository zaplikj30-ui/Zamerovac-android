# Zaměřovač – START ZDE (aktuální stav, rozhodnutí a další práce)

> **Jediný rozcestník pro navázání v novém chatu.** GitHub je trvalý pracovní záznam. Nespoléhat na paměť ChatGPT ani nutnost znovu procházet dlouhé chaty.
>
> Poslední dohoda o způsobu práce: **4. listopadu 2026**. Tento dokument je živý, stav níže se musí při dalších krocích aktualizovat.

## 0. Společná práce přes ChatGPT i Codex

**Závazný postup je v [AGENTS.md](AGENTS.md#společný-pracovní-protokol-chatgpt--codex--github-závazné).** Na projektu se střídají klasické chaty ChatGPT i Codex. **GitHub je jediný sdílený trvalý zdroj aktuálního stavu**; nepočítat s tím, že druhý chat vidí náš rozhovor.

**Než kdokoli začne další práci**, musí znovu ověřit tento rozcestník, `AGENTS.md`, poslední commity a aktivní PR, relevantní issues **včetně nových komentářů** (zejména #13, #12, #14), aktuální stav Actions a Releases. Před zápisem znovu ověřit změněné soubory/SHA, aby se nepřepsala práce druhého chatu nebo Codexu.

**Předávání bez kopírování chatu:** přesné nové dohody, schválené úpravy, výsledky testů, rozpracovaný kód, otevřené blokátory i nezávazné nápady průběžně hned ukládat ke správnému issue nebo dokumentu. V tomto souboru udržovat **hotovo / zbývá / nerozhodnuto / další konkrétní krok** a odkazy. Odlišit **nápad → schválené → v kódu → APK vydaná → fyzicky ověřená**. Samotný commit, zelené CI ani APK neprokazují reálné ověření.

**Současný další konkrétní krok:** navázat na [testovací deník #13](https://github.com/zaplikj30-ui/Zamerovac-android/issues/13) a na [mapu 28 testů](IMPLEMENTACE_A_TESTOVANI_28.md), bezpečně ověřovat vydání [v1.2.147](https://github.com/zaplikj30-ui/Zamerovac-android/releases/tag/test-v1.2.147) po menších dávkách; nejprve záloha testovacích dat. **Půdorys, profily ovládání a výkonu jsou dosud návrhy k pozdějšímu rozhodnutí**, ne automaticky aktuální programovací úkoly.

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

Upřesněná dohoda 4. 11. 2026: Ukazovat vždy **jen jeden konkrétní test** s krátkým návodem a výběrem **Funguje správně / Nefunguje – chyba / Funguje částečně / Nešlo vyzkoušet**. **Nenabízet ani nevyžadovat pole pro ručně psané poznámky.** Po odeslání samotného výsledku asistent **počká**: uživatel následně poskytne video, hlasové vysvětlení nebo další zprávy. **Nepřecházet na další test a neuzavírat finální záznam podle samotné volby.** Teprve až uživatel dokončí předání podkladů, asistent výsledek i zjištěné chování shrne, uloží do existujícího issue #13, ověří zápis, pošle odkaz a až potom zadá další jediný test. Při neúspěšném zápisu na to výslovně upozornit. Dávky pěti úkolů patří vývoji, nikoli zobrazení uživatelských testů. **Uzavřený uživatelský průchod testem 22 – Koš (v1.2.147): Částečně; podklady již dodány, výsledek a otevřená chyba zapsány do [issue #13](https://github.com/zaplikj30-ui/Zamerovac-android/issues/13#issuecomment-6632603703). Fotografie je obnovena, ale seznam původní složky se neaktualizuje do odchodu a návratu. Oprava dosud neprovedena; úplné zachování kót není tímto videem samostatně doloženo. Další jediný test: 26 – ZIP export.**



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
