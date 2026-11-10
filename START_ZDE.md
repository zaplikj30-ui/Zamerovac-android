# Zaměřovač – START ZDE

**Stavový rozcestník k 10. 11. 2026 (repo main c604860db4fddeefc077e27411bc1941815f7d94).** Údaj o SHA a PR je časový snímek, nikoli trvale aktuální pravda: **před každou prací znovu načíst GitHub**. Původní dlouhé znění s historickými checkpointy je beze změny v [archivu START_ZDE](docs/historie/START_ZDE-2026-11-10.md).

## Co platí
1. **Pravidla:** [AGENTS.md](AGENTS.md) je krátká pracovní verze, doplňovaná nejnovějšími výslovnými rozhodnutími vlastníka; ostatní staré komentáře a checkpointy jsou evidence, ne dnešní příkazy. [Issue #42](https://github.com/zaplikj30-ui/Zamerovac-android/issues/42) vede rozhodnutí, testy a rizika. [Přehled pravidel a rozporů](https://github.com/zaplikj30-ui/Zamerovac-android/issues/42#issuecomment-6780565443).
2. **Běžné programování po balících:** přibližně **5–10 souvisejících malých oprav v jedné větvi/draft PR**, postupné cílené testy, následně jedna nezávislá kontrola a společná HOME regrese. Oddělené úzké PR jen u zdůvodněných bezpečnostních/P1 situací. **Jedna testovací APK** až po dokončení a schválení celku.
3. **Role dle posledního zadání vlastníka:** **Koordinátor 9** řídí a zapisuje; **Chat 35 = programátor**, **Chat 36 = nezávislý kontrolor**. Dřívější role Chat 33/34 jsou historie. Codex pro složité části až podle jeho reálné dostupnosti; zápis do issue Codex nespouští.
4. **Data a finance:** přesné kóty, jednotky, originální bajty médií, obnovu, koš, konflikty a editovatelnost chránit před tichou ztrátou. **Actions nejvýš 12 USD/měsíc**; cloud jen s výslovným souhlasem; domácí Windows 11, 16 GB RAM, runner pouze důvěryhodný main/owner QA. Bez samovolného merge/vydání.
5. **Nezávazné nápady nejsou schválené funkce.** Plán se týká nynější aplikace, ne nové v2: [PROJEKTOVY_PLAN_ZAMEROVACE.md](PROJEKTOVY_PLAN_ZAMEROVACE.md).

## Aktuální pracovní a bezpečnostní stav (ověřovat znovu)
- **main:** c604860db4fddeefc077e27411bc1941815f7d94. Otevřených bylo **37 draft PR**, většinou řetězených – ne 37 samostatných úkolů k integraci. Nikdo nesmí bez kontroly zasahovat do cizí větve.
- **Synchronizace:** [issue / test-only PR #88](https://github.com/zaplikj30-ui/Zamerovac-android/pull/88) – dvě prokazatelně selhávající **syntetické** diagnostické Drive/SAF pozdní ACK po ztrátě lokální autority; **B16 INTEGRATION HOLD / Stage 3 STOP**. Nejde o potvrzený výpadek reálného Drive. Neopravovat ad hoc.
- **Rozpracované QA importu:** [draft PR #104](https://github.com/zaplikj30-ui/Zamerovac-android/pull/104) parent; [draft PR #105](https://github.com/zaplikj30-ui/Zamerovac-android/pull/105) Chat 35, HEAD 3f2779ec9b5c432296f9db2bad8502cc4ff63588; nový HEAD potřebuje nezávislé re-review Chatu 36. PR #102/#103 zůstávají jiné, oddělené QA úkoly.
- **Externí audity:** Gemini měl chybná tvrzení; Claude dodal tři užitečné, ale **neúplné** části. Ověřené výsledky a nedoložené hypotézy jsou v [#42](https://github.com/zaplikj30-ui/Zamerovac-android/issues/42#issuecomment-6780040990); nejsou povely k opravám.
- **Poslední publikovaná testovací APK podle ověřené historie:** [1.3.0](https://github.com/zaplikj30-ui/Zamerovac-android/releases/tag/test-v1.3.0), package cz.zamerovac.app.preview, Android versionCode 1154. Před dalším vydáním ověř živě skutečně poslední release a kompatibilitu; APK nevydávat kvůli dokumentaci.
- **QA:** dřívější HOME 4/4 PASS na main nebo jiných přesných SHA je historický důkaz, **nikoli test nových draftů**. Samsung/S Pen/Bosch/reálný Drive vždy uvádět podle skutečně provedeného testu.

- **Kontrola úplnosti pravidel:** [Matice platnosti všech původních oddílů](docs/PLATNOST_A_PUVOD_PRAVIDEL.md). Původní detailní **platná** pravidla zůstávají závazná, i když jsou v krátkém rozcestníku jen shrnuta. Historická SHA, role a zastaralé workflow naopak nejsou dnešní příkazy.

## Nejbližší směr
- **HNED:** dokončit již rozpracovanou nezávislou kontrolu PR #105 a držet oddělené bezpečnostní brány; pro **nové běžné opravy** používat jeden balík místo deseti předávek. Nejprve zkontrolovat konflikty s existujícími PR.
- **KODEX, až bude dostupný:** nejprve **audit celé aplikace** bez změn, s prioritním hlubokým sync rozborem proti principům Joplin / WorkManager / oficiálnímu Google Drive API. Poté vlastník schválí architektonickou variantu a bezpečné etapy synchronizace; dále import a ostatní oblasti podle závažnosti.
- **NEMĚNIT bez souhlasu:** sync protokol, data/migrace, release guardy, technologii, jiné repozitáře. Žádné nové cloudové náklady, APK ani merge jen kvůli tomuto rozcestníku.

## Odkazy místo stovek opakovaných checkpointů
[Issue #42 – řízení a bezpečnost](https://github.com/zaplikj30-ui/Zamerovac-android/issues/42) · [#28 – automatické testy](https://github.com/zaplikj30-ui/Zamerovac-android/issues/28) · [#13 – fyzické testy](https://github.com/zaplikj30-ui/Zamerovac-android/issues/13) · [HOME QA preflight](docs/HOME_QA_PREFLIGHT.md) · [staré úplné START_ZDE](docs/historie/START_ZDE-2026-11-10.md) · [staré úplné AGENTS](docs/historie/AGENTS-2026-11-10.md).

**Pozor:** tento přehled nemění již otevřená PR ani stav jejich testů a sám neopravňuje ke sloučení.
