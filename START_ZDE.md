# Zaměřovač – START ZDE (aktuální stav, rozhodnutí a další práce)

> **Jediný rozcestník pro navázání v novém chatu.** GitHub je trvalý pracovní záznam. Nespoléhat na paměť ChatGPT ani nutnost znovu procházet dlouhé chaty.
>
> Poslední dohoda o způsobu práce: **4. listopadu 2026**. Tento dokument je živý, stav níže se musí při dalších krocích aktualizovat.

## 1. Co právě řešíme

| Oblast | Aktuální stav | Kde je podrobnost |
|---|---|---|
| Obnova starých testů 1–28 | **Probíhá, neúplné.** Neslučovat staré chyby s aktuálními bez důkazu. | [Deník testování #13](https://github.com/zaplikj30-ui/Zamerovac-android/issues/13) |
| Přílohy k testování | Videa a screenshoty slouží ke kontrolám 1–28; mohou být duplicitní. První video `1000093687.mp4` je záznam chatu, hlavní vodítko pro číslování. | [Index médií](TESTOVANI_MEDIA_INDEX.md) |
| Základní sada požadavků | 49 položek z dřívějšího seznamu; jejich stav nelze automaticky považovat za splněný. | [Seznam úprav #12](https://github.com/zaplikj30-ui/Zamerovac-android/issues/12) |
| Dlouhodobá představa | Vzhled, schopnosti, možnosti „možná později“; lze měnit. | [Vize a plán](VIZE_A_PLAN.md) |
| Další aktualizace APK | **Zatím nespouštět.** Nejprve doplnit a roztřídit 28 testů, společně vybrat první malou dávku. | [Dohodnutý postup #13](https://github.com/zaplikj30-ui/Zamerovac-android/issues/13) |
| Verze APK | Reálnou **aktuálně používanou** verzi ověřit před dalším cyklem; historický screenshot není důkaz aktuálního vydání. | [GitHub Releases](https://github.com/zaplikj30-ui/Zamerovac-android/releases) |

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

1. Z připraveného seznamu vybrat **přibližně 5 podobných úkolů** (u složitějších méně).
2. Před implementací ujasnit jejich přesné zadání a průběžně jej uložit.
3. Opravit kód a spustit potřebné cílené testy; zaznamenat commity a zbývající otázky.
4. **Na pokyn uživatele** vydat **jedno společné testovací APK** pro danou dávku.
5. Uživatel provede krátké testy na zařízení; zaznamenat výsledek každého úkolu. Chyby se opraví, neověřené věci zůstanou otevřené.
6. Před další dávkou nebo změnou chatu aktualizovat tento soubor: **poslední verze, co je hotové, chyby, rozdělaná práce, následující úkol**.

Nedělat znovu jednu velkou sérii 28 kontrol s výsledky jen v chatu.

## 4. Jak rychle pokračovat v úplně novém chatu

> „Pracujeme na Zaměřovači. Otevři `START_ZDE.md`, deník #13 a příslušná issues na GitHubu. Připomeň poslední stav a pokračuj dalším úkolem. Nové dohody hned zapisuj na GitHub.“

Nemusí se znovu kopírovat celý původní chat. Neznámé informace ověřit z primárních zdrojů nebo se zeptat; nevymýšlet.

## 5. Přímé odkazy a rozdělení odpovědností

- **Tento soubor:** aktuální stav a rozcestník. Musí se aktualizovat při změně fáze, zvolené dávky nebo důležitého rozhodnutí.
- **[Testovací deník #13](https://github.com/zaplikj30-ui/Zamerovac-android/issues/13):** výsledky kontrol, průběžné dohody a konkrétní kroky; během rekonstrukce 28 testů primární evidence.
- **[49 původních úprav #12](https://github.com/zaplikj30-ui/Zamerovac-android/issues/12):** původní základní zadání; nesmazat jen proto, že už vznikla další evidence.
- **[Vize a plán](VIZE_A_PLAN.md):** dlouhodobý vzhled a funkce, budoucí a zatím nezávazné nápady.
- **[Seznam mediálních důkazů](TESTOVANI_MEDIA_INDEX.md):** názvy a záznamy souborů, deduplikace; originální soukromé přílohy nepublikovat do repozitáře.
- **[Vydání APK](https://github.com/zaplikj30-ui/Zamerovac-android/releases):** skutečně sestavené verze.

## 6. Poslední zapsaná dohoda

**4. 11. 2026 – uživatel:** „Důležité je ukládat všechny kroky na GitHub ... co budeme dělat, chceme dělat, nebo na čem jsme se dohodli ... a rychle dohledatelné.“

**Výsledek:** Tento rozcestník a pravidlo okamžitého průběžného zápisu; nevydávat ChatGPT paměť za spolehlivé úložiště projektu. Při dalších fázích aktualizovat přehled i příslušné issues.
