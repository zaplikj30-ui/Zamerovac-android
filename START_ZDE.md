# Zaměřovač – START ZDE (živý rozcestník)

> **Platná pravidla a brány:** [AGENTS.md](AGENTS.md), [projektový plán](PROJEKTOVY_PLAN_ZAMEROVACE.md) a poslední rozhodnutí v [issue #42](https://github.com/zaplikj30-ui/Zamerovac-android/issues/42). Tento krátký soubor nenahrazuje historii ani důkazy. **Před vývojovou prací vždy ověř aktuální HEAD, relevantní issues a komentáře, PR, CI, dotčené soubory a Releases.** Před zápisem ověř HEAD a kolize znovu.

## Rozpracovaná implementace synchronizace B (12. 11. 2026)

Vlastní větev `implement/sync-core-b-20261112`, base main `cf7807905f77f6fd8478c137b1b41aca6ebc3275`. Převzaty ochrany #100–#102 a návaznosti audia #107 bez změn workflow. [Implementace, příčiny, průběžné testy a povinné brány](docs/sync-core-b.md). Stav [DRAFT PR #116](https://github.com/zaplikj30-ui/Zamerovac-android/pull/116); závěrečný HEAD a přesné testy jsou v PR a checkpointu #42. Nejde o merge ani APK. Další krok: dokončit a doložit společnou regresi a předat Kontrolorovi 40.

## Poslední ověřený přehled (11. 11. 2026, historický snapshot)

- `main` při této revizi: `c604860db4fddeefc077e27411bc1941815f7d94`. **Není zaručeno, že je to dnešní nejnovější HEAD.**
- **Pracovní priority**: bezpečné HOME QA na Windows 11/16 GB, ochrana dat a přesných hodnot, stabilizace/editor. Úplné aktuální pořadí, rozhodnutí a předání: [#42](https://github.com/zaplikj30-ui/Zamerovac-android/issues/42). [Souhrn nových pravidel](https://github.com/zaplikj30-ui/Zamerovac-android/issues/42#issuecomment-6808420454).
- **Souběžné návrhy**: [otevřená PR](https://github.com/zaplikj30-ui/Zamerovac-android/pulls?q=is%3Apr+is%3Aopen). V době této revize jsou relevantní [#104](https://github.com/zaplikj30-ui/Zamerovac-android/pull/104), [#105](https://github.com/zaplikj30-ui/Zamerovac-android/pull/105), [#107](https://github.com/zaplikj30-ui/Zamerovac-android/pull/107), [#110](https://github.com/zaplikj30-ui/Zamerovac-android/pull/110) (přílohy, ukládání a testy); [#108](https://github.com/zaplikj30-ui/Zamerovac-android/pull/108) (samostatné zpřesnění ImageMeteru) a [#109](https://github.com/zaplikj30-ui/Zamerovac-android/pull/109) (HOME QA). Jejich stav a SHA před rozhodnutím **ověř znovu**.
- **Otevřená datová rizika**: [QA-107-03](https://github.com/zaplikj30-ui/Zamerovac-android/issues/42#issuecomment-6807481158) – při selhání zápisu může být ztracena dokončená hlasová nahrávka. [Synchronizace #88](https://github.com/zaplikj30-ui/Zamerovac-android/issues/88) – dvě známé chyby vyžadují ucelené posouzení včetně Joplin, WorkManager a oficiálního Drive API, bez slepého řetězení záplat.
- **Testy**: čti skutečné výsledky z relevantních PR, [#28](https://github.com/zaplikj30-ui/Zamerovac-android/issues/28), [#42](https://github.com/zaplikj30-ui/Zamerovac-android/issues/42) a [Actions](https://github.com/zaplikj30-ui/Zamerovac-android/actions). Cloud PASS ≠ HOME PASS; starý SHA ≠ nový SHA; zdrojové review není běh na zařízení.
- **Poslední vydání** vždy ověř přímo v [Releases](https://github.com/zaplikj30-ui/Zamerovac-android/releases). Historický checkpoint k 8. 11. uváděl 1.3.0 / `versionCode 1154`; nelze to bez nové kontroly vydávat za aktuální poslední vydání. Žádná nová společná APK bez celé bezpečnostní/testovací brány a výslovného souhlasu vlastníka.

## Trvalý postup pro další chat i Codex

1. Načti aktuální GitHub (AGENTS, tento rozcestník, plán, související issues/komentáře, HEAD/commity, PR, CI, Releases), zjisti aktivní role a kolize. Rozhodnutí, prokázané chyby, testy, prostředí, konkrétní SHA, rizika a další krok ulož do již existujícího issue/PR; jeden autor zapisuje do své větve. Merge ani zásadní změny bez souhlasu vlastníka.
2. **Každou dotčenou funkci testuj přiměřeně riziku**, aby automatika zachytila i jednoduché chyby: skutečné tlačítko/gesto, kreslení/pixely, viditelnost kót/čar/tvarů, galerie, poznámky a návaznosti. U ukládání, obnovy, přesných hodnot, médií, importu/exportu a synchronizace také negativní scénáře a původní bajty. Před jednou společnou APK širší regrese. PASS jen pro skutečně provedené testy na uvedeném SHA a prostředí.
3. **Domácí QA a vydání jsou odlišné kroky.** Technické sestavení APK není publikace; GitHub Actions účet do 12 USD/měsíc, žádné automatické platby, nedůvěryhodné PR nikdy na domácím runneru. Fyzický Android/S Pen/Bosch a reálný Drive neoznačuj PASS bez testování na daném zařízení/službě.
4. **ImageMeter je funkční reference, ne vizuální předloha.** Vlastní moderní profesionální design Zaměřovače je priorita; schválená podoba kót/úchopů/lupy se mění jen se souhlasem. Angličtina je první další jazyk před budoucím mezinárodním vydáním; nyní připravovat texty pro lokalizaci bez plošného překladu ([#14](https://github.com/zaplikj30-ui/Zamerovac-android/issues/14)).
5. **Nespouštěj sestavení změnou `.github/apk-build-request.txt`.** Tento soubor je historický; aktuální `build-apk.yml` je ruční, s vlastníkovým schválením. Před jakýmkoli workflow ověř živé podmínky, triggery, skutečný stav QA a poslední publikovanou verzi.

**Dlouhodobá návaznost na výrobu:** Zaměřování zakázkového nábytku je významný výchozí obor; Zaměřovač je však použitelný i pro další řemesla. [Konfigurátor–Nářezák](https://github.com/zaplikj30-ui/Konfigurator-Narezak-Android) zůstává **samostatnou aplikací a repozitářem**. Budoucí propojení je dlouhodobý cíl, nikoli nynější implementace: chránit možnost verzovaného předání přesných hodnot, jednotek a identit; nikdy tiše nepřepočítávat schválené výrobní podklady. Podrobnosti: [projektový plán](PROJEKTOVY_PLAN_ZAMEROVACE.md) a [vize](VIZE_A_PLAN.md).

## Historie bez ztráty podkladů

**[Úplný původní START_ZDE.md, archiv do 11. 11. 2026](START_ZDE_ARCHIV_DO_2026-11-11.md)** zachovává **doslovně celý původní text** včetně historických checkpointů, testů 1–28, SHA, výsledků a odkazů. Výrazy „aktuálně“ a „další krok“ v archivu znamenají tehdejší stav, ne dnešní úkol.

**Archivace neruší platné požadavky ani rozhodnutí.** U relevantní funkce dohledat původní schválení a pozdější upřesnění v [#13](https://github.com/zaplikj30-ui/Zamerovac-android/issues/13), [#28](https://github.com/zaplikj30-ui/Zamerovac-android/issues/28), [#42](https://github.com/zaplikj30-ui/Zamerovac-android/issues/42) a navazujících issues/PR. Další trvalé zdroje: [vize](VIZE_A_PLAN.md), [plán](PROJEKTOVY_PLAN_ZAMEROVACE.md) a [lokalizace](LOKALIZACE_PLAN.md).
