# Zaměřovač 2 – registr všech dosavadních záměrů a návazností jedničky

**Záznam rozhodnutí vlastníka 21. 11. 2026. STAV: průběžný závazný produktový registr, ne seznam funkcí první APK.**

## A. Základní pravidlo – nic neztrácet, ale postupovat pomalu

**Zaměřovač 2 má být postupně vybudován tak, aby zahrnoval prakticky všechny uživatelem diskutované, schválené a nedořešené potřeby Zaměřovače 1**, včetně návrhu nábytku, Konfigurátoru, Kusovníku, Nářezáku, instalačních plánů, hodin a faktur, panoramatu a případných budoucích modulů. Nejde o pokyn naprogramovat vše hned či prohlásit každý otevřený nápad za hotovou specifikaci.

- **NEVYHAZOVAT:** nápady, technické možnosti a nedokončené návrhy z původních dokumentů, issues, PR a testů. Dokud je vlastník výslovně neodmítne, zůstávají evidované pro pozdější posouzení.
- **ROZLIŠOVAT:** (1) požadavek/schválené chování, (2) budoucí nápad, (3) otevřená otázka, (4) zavržený návrh po výslovném rozhodnutí, (5) implementováno, (6) skutečně fyzicky ověřeno. **Nápad ≠ GO k programování**, ale ani „později“ ≠ „už nikdy“.
- **BEZ RYCHLÝCH SKOKŮ:** jedna malá ověřitelná etapa, reálné gesta a data, cílená regrese a bezpečnost, vlastní kontrola + jiný nezávislý kontrolor; teprve pak další funkce. Neslučovat neověřené velké balíky.
- **NASTAVIT SPRÁVNÉ VAZBY:** už od M0 zachovat stabilní zakázku/dokumenty/ID, přesné jednotky, geometrii, originály médií a revize; do výrobního systému lze **jednou vědomě převzít schválená měření**, nesmí však přepsat hotový konstrukční návrh, kusovník, nářez nebo fakturu bez potvrzení a historie.
- **DNEŠNÍ HRANICE:** Zaměřovač 2 samostatně, Kotlin/Compose Android/offline první; [Konfigurátor–Nářezák](https://github.com/zaplikj30-ui/Konfigurator-Narezak-Android) a Převaděč spojitosti zůstávají **samostatné produkty**. Budoucí propojení, jedna aplikace či vypínatelné moduly jsou otevřené volby, nikoli dnešní povolení ke sloučení. Nezakládat prázdné plugin/3D/účetní frameworky „pro jistotu“.

**Výjimka:** v historické [vizi](../VIZE_A_PLAN.md) jsou některé konkrétní funkce ImageMeteru **výslovně vyloučené**; bez nového rozhodnutí se tímto obecným pravidlem nevkládají zpět. Nový záměr vlastníka má přednost, pokud jej výslovně změní.

## B. Ověřené důležité věci, které se nesmějí znovu přehlédnout

| Požadavek nebo nápad | Dnešní stav a zdroj | Návrhová návaznost ve v2 |
|---|---|---|
| **Univerzální i zakázkové editovatelné instalační plány** (voda/odpad/elektro, PDF, šablony, revize) | [#72](https://github.com/zaplikj30-ui/Zamerovac-android/issues/72) – **schválený vysoce prioritní požadavek**, nikoli hotová funkce | Samostatný dokument/plátno a šablona s editovatelnými symboly; nezaměňovat orientační plán za schválený k realizaci; zařadit brzy po stabilním základu |
| **Zákaznický portál s přísným výběrem publikované revize** | [#73](https://github.com/zaplikj30-ui/Zamerovac-android/issues/73) – **nedopracovaný nápad** | Oddělená veřejná a interní data; v základu jen bezpečný výběr konkrétních výstupů; přístupový systém později |
| **Fotopanorama, 360° místnost, kótování při rozhlížení** | [#120](https://github.com/zaplikj30-ui/Zamerovac-android/issues/120) – **dvě otevřené varianty** (široké panorama / 360°) | Rozlišovat obrazové souřadnice od měřených hodnot, uchovat editovatelné kotvy; engine později |
| **Pracovní časovač, sazba zákazníka, historie a faktury** | [#214](https://github.com/zaplikj30-ui/Zamerovac-android/issues/214), [#224](https://github.com/zaplikj30-ui/Zamerovac-android/issues/224) – budoucí záměr, účetní řešení otevřeno | Zákazník/zakázka/časový záznam/pracovní výkaz, faktura oddělený modul/napojení; účetnictví teď nepsat |
| **Konfigurátor → Kusovník → Nářezák → výroba/montáž, cena, revize** | [Vize § dlouhodobé propojení](../VIZE_A_PLAN.md), [#224](https://github.com/zaplikj30-ui/Zamerovac-android/issues/224), [samostatný projekt](https://github.com/zaplikj30-ui/Konfigurator-Narezak-Android) | **Výslovně součást dlouhodobého cíle systému**, nikoli automaticky součást prvního balíku Zaměřovače 2. Vědomý import naměřené hodnoty, žádné tiché převracení rozměrů/hran/dekoru |
| **Přímé sdílení okótované fotografie** | [#216](https://github.com/zaplikj30-ui/Zamerovac-android/issues/216) – otevřený nápad | Android systémová nabídka sdílení, jen vědomé odeslání; nezaměňovat se sync |
| **Promo/aktivační kódy a monetizace** | [#217](https://github.com/zaplikj30-ui/Zamerovac-android/issues/217) – otevřený nápad, [Vize](../VIZE_A_PLAN.md) | Licence oddělená od zákaznických dat, bez serveru či plateb v M1 |
| **Jednoduchá diagnostická vlaječka od M1** | [porovnání §4](ZAMEROVAC_2_POROVNANI_S_V1.md), historická [#226](https://github.com/zaplikj30-ui/Zamerovac-android/issues/226), [#228](https://github.com/zaplikj30-ui/Zamerovac-android/issues/228) | Nyní **jen** zap/vyp, historie, vybrat více, hromadně sdílet/smazat; větší automatický tester z v1 nepřebírat automaticky do M1 |
| **Další měřidla, jazykové verze, Windows/iOS** | [#34](https://github.com/zaplikj30-ui/Zamerovac-android/issues/34), [#14](https://github.com/zaplikj30-ui/Zamerovac-android/issues/14), [Vize](../VIZE_A_PLAN.md) | Vstup měření mimo značku a UI, přesná data mimo přístroj/displej, platformy krokově |

## C. Kde hledat původní dohodu – nehledat jen ve VIZI

1. [VIZE_A_PLAN.md](../VIZE_A_PLAN.md): všechny dlouhodobé cíle, otevřené možnosti a výslovně vyloučené referenční funkce.
2. [ROZHODNUTI_A_NAPADY_Z_TESTU.md](../ROZHODNUTI_A_NAPADY_Z_TESTU.md): dříve schválené ergonomické podrobnosti, odložené náměty, upřesnění.
3. [PROJEKTOVY_PLAN_ZAMEROVACE.md](../PROJEKTOVY_PLAN_ZAMEROVACE.md) a [DATOVY_FORMAT_A_PC_KOMPATIBILITA.md](../DATOVY_FORMAT_A_PC_KOMPATIBILITA.md): data, architektura, výrobní návaznosti a bezpečné jednotky.
4. [Issue #12](https://github.com/zaplikj30-ui/Zamerovac-android/issues/12), [#13](https://github.com/zaplikj30-ui/Zamerovac-android/issues/13), [#28](https://github.com/zaplikj30-ui/Zamerovac-android/issues/28), [#42](https://github.com/zaplikj30-ui/Zamerovac-android/issues/42): původní 49 detailů, testy, regrese a povinná ochrana dat.
5. [REKONSTRUKCE_TESTU_01_10.md](../REKONSTRUKCE_TESTU_01_10.md), [11–20](../REKONSTRUKCE_TESTU_11_20.md), [21–28](../REKONSTRUKCE_TESTU_21_28.md): 28 historických pracovních scénářů a odlišnosti chování.
6. [KOMPATIBILITA_ZARIZENI.md](../KOMPATIBILITA_ZARIZENI.md), [LOKALIZACE_PLAN.md](../LOKALIZACE_PLAN.md), [TESTY_A_OPRAVY.md](../TESTY_A_OPRAVY.md): hardware, další jazyky, testování.
7. [Původní návrh v2](../NAVRH_NOVEHO_ZAMEROVACE_OD_NULY.md), [inventura v2](ZAMEROVAC_2_INVENTURA_POZADAVKU.md), [skutečné porovnání v1/v2](ZAMEROVAC_2_POROVNANI_S_V1.md), [strom vývoje](ZAMEROVAC_2_STROM_VYVOJE.md): současné cíle, rozdíly, postup.
8. [GitHub Issues](https://github.com/zaplikj30-ui/Zamerovac-android/issues?q=is%3Aissue): originální komentáře a rozhodnutí. [GitHub PR](https://github.com/zaplikj30-ui/Zamerovac-android/pulls): další související technické diskuse; PR komentáře nebyly všechny jednotlivě pročteny.
9. [Konfigurátor–Nářezák samostatný repozitář](https://github.com/zaplikj30-ui/Konfigurator-Narezak-Android) a [jeho issue #2](https://github.com/zaplikj30-ui/Konfigurator-Narezak-Android/issues/2) – samostatný zdroj pro výrobu; nevyhlašovat za hotovou výrobní integraci.

## D. Odkazy na všechna aktuálně dohledaná issues – zachovat kontext

**Kontrola GitHub Issues 21. 11. 2026: 52 otevřených a 3 uzavřená issues = 55.** Následující odkazy jsou index **všech vrácených issue**; nerozhodují o jejich schválení a už vůbec nezaručují přečtení každého komentáře. Pro práci na konkrétní funkci je třeba otevřít původní issue a jeho poslední rozhodnutí.

### Budoucí nebo otevřené funkční požadavky

- [#72 – VYSOKÁ PRIORITA: univerzální a zakázkové editovatelné instalační plány a dokumentace nábytku](https://github.com/zaplikj30-ui/Zamerovac-android/issues/72)
- [#73 – NÁPAD: zákaznický portál – vybrané náhledy zakázky s řízeným přístupem](https://github.com/zaplikj30-ui/Zamerovac-android/issues/73)
- [#120 – NÁPAD do budoucna: panorama a 360° místnost s editovatelnými kótami](https://github.com/zaplikj30-ui/Zamerovac-android/issues/120)
- [#25 – NÁPAD do budoucna: pracovní plátno a klikací nárysy stěn podle Bosch MeasureOn](https://github.com/zaplikj30-ui/Zamerovac-android/issues/25)
- [#16 – NÁPAD do budoucna: automatické rozmístění kót a kótování pomocí textu / AI](https://github.com/zaplikj30-ui/Zamerovac-android/issues/16)
- [#44 – Budoucí funkce: hlasové diktování rozměrů kót a textových poznámek](https://github.com/zaplikj30-ui/Zamerovac-android/issues/44)
- [#214 – NÁPAD DO BUDOUCNA: pracovní výkaz, časovač hodinovky a náklady zakázky](https://github.com/zaplikj30-ui/Zamerovac-android/issues/214)
- [#224 – NÁPAD do budoucna: volitelné moduly (Zaměřovač, Nářezák, Konfigurátor, účetnictví)](https://github.com/zaplikj30-ui/Zamerovac-android/issues/224)
- [#217 – NÁPAD: aktivační kódy pro bezplatný přístup zákazníků z Google Play](https://github.com/zaplikj30-ui/Zamerovac-android/issues/217)
- [#216 – NÁPAD: přímé systémové sdílení okótované fotografie (Quick Share, WhatsApp)](https://github.com/zaplikj30-ui/Zamerovac-android/issues/216)
- [#14 – Lokalizace pro desítky jazyků – nyní jen čeština v Nastavení](https://github.com/zaplikj30-ui/Zamerovac-android/issues/14)
- [#34 – Příští aktualizace: univerzální názvy dialogu Bluetooth měřiče místo „Měřič Bosch“](https://github.com/zaplikj30-ui/Zamerovac-android/issues/34)
- [#38 – Zaměřovač: obousměrná automatická synchronizace telefonu a tabletu (Google Disk jen prostředník)](https://github.com/zaplikj30-ui/Zamerovac-android/issues/38)
- [#40 – Zálohování na Google Disk: oddělená historie telefonu/tabletu, žádné přepisování nebo nechtěné mazání](https://github.com/zaplikj30-ui/Zamerovac-android/issues/40)
- [#226 – Schválený návrh: automatická kontrola aplikace v diagnostice + jeden anonymní ZIP report](https://github.com/zaplikj30-ui/Zamerovac-android/issues/226)
- [#228 – (ROZHODNOUT TEĎ) Diagnostika PREVIEW a cílený záznam gest; oddělení RELEASE](https://github.com/zaplikj30-ui/Zamerovac-android/issues/228)
- [#29 – Nápověda v hlavním menu: úplný český offline návod ke všem funkcím](https://github.com/zaplikj30-ui/Zamerovac-android/issues/29)

### Historické funkční a ergonomické kontrakty

- [#12 – Zaměřovač – kontrola úprav (8 oblastí, stav a poznámky)](https://github.com/zaplikj30-ui/Zamerovac-android/issues/12)
- [#17 – Společná aktualizace po testování v1.2.147 – opravy, schválené UX a zákaznický PDF export](https://github.com/zaplikj30-ui/Zamerovac-android/issues/17)
- [#22 – Zákaznické PDF: fotografie z poznámek pod hlavní fotografií, oddělené podle poznámek](https://github.com/zaplikj30-ui/Zamerovac-android/issues/22)
- [#24 – Bosch BLE 1.2.149: nespolehlivé první připojení, historie v otevřené kótě a dočasné odpojení](https://github.com/zaplikj30-ui/Zamerovac-android/issues/24)
- [#48 – Zaměřovač: obloukové horní šipky a čtyřsměrný střed – zachovat původní vzhled pro návrat](https://github.com/zaplikj30-ui/Zamerovac-android/issues/48)
- [#26 – Otočení obrazovky: roztažené ikony a deformované rozložení na šířku](https://github.com/zaplikj30-ui/Zamerovac-android/issues/26)
- [#47 – Zaměřovač 1.3.0: ikona hlasové poznámky překrývá text – přesun mimo detailní fotografii](https://github.com/zaplikj30-ui/Zamerovac-android/issues/47)
- [#37 – Galerie 1.2.152: oříznutý text poznámky oproti editoru a odstranit spodní návod](https://github.com/zaplikj30-ui/Zamerovac-android/issues/37)
- [#36 – Galerie 1.2.152: při přiblížení a posouvání fotografie ujíždí mimo obrazovku](https://github.com/zaplikj30-ui/Zamerovac-android/issues/36)
- [#35 – Galerie 1.2.152: při posunu přiblížené fotografie lze celý obraz odtáhnout mimo plochu](https://github.com/zaplikj30-ui/Zamerovac-android/issues/35)
- [#50 – P1: Zaměřovač 1.3.0 – v galerii jsou kóty a jejich hodnoty téměř nečitelné](https://github.com/zaplikj30-ui/Zamerovac-android/issues/50)
- [#196 – (P2)(UX) Nepřehledné nastavení – pět kategorií bez Bosch jako hlavní položky](https://github.com/zaplikj30-ui/Zamerovac-android/issues/196)
- [#194 – (P2)(Android 1.4.1) Druhé tlačítko + zůstává fotografie místo poslední použité akce](https://github.com/zaplikj30-ui/Zamerovac-android/issues/194)

### Regrese, data a bezpečnost – poučení pro nový základ

- [#221 – Regrese od 1.4.0: kumulativní sekání kót přežívá restart a zasahuje druhou fotografii – Codex diagnostika a postupná oprava](https://github.com/zaplikj30-ui/Zamerovac-android/issues/221)
- [#191 – (P1)(Android 1.4.1) Editor se zasekává a kóty nejdou spolehlivě uchopit](https://github.com/zaplikj30-ui/Zamerovac-android/issues/191)
- [#195 – (P2)(Android 1.4.1) Vytvoření složky se zdá pomalé; prověřit ukládání a kontroly nahrávek](https://github.com/zaplikj30-ui/Zamerovac-android/issues/195)
- [#197 – (P1)(Android 1.4.1) + → Hlasová poznámka v přehledu tiše nic nevytvoří](https://github.com/zaplikj30-ui/Zamerovac-android/issues/197)
- [#190 – (P1)(Android 1.4.1) Opakovaná výstraha uchovaných nahrávek a možné zpomalování při ukládání](https://github.com/zaplikj30-ui/Zamerovac-android/issues/190)
- [#192 – (P2)(Android 1.4.1) Při práci v editoru opakovaně vyskakuje chyba spárování/synchronizace](https://github.com/zaplikj30-ui/Zamerovac-android/issues/192)
- [#207 – F5: CAS reconcile může uložit nový záznam pod souběžně smazanou či zamčenou složku](https://github.com/zaplikj30-ui/Zamerovac-android/issues/207)
- [#53 – Pomalé ukládání existující připomínky – „Ukládám…“ přibližně 12 sekund](https://github.com/zaplikj30-ui/Zamerovac-android/issues/53)
- [#46 – Zaměřovač 1.3.0: při úpravě některých poznámek se nečekaně otevírá výběr fotografie/souborů](https://github.com/zaplikj30-ui/Zamerovac-android/issues/46)
- [#21 – Po otevření fotografie v 1.2.149 nejprve probliknou kóty bez fotografie](https://github.com/zaplikj30-ui/Zamerovac-android/issues/21)
- [#20 – Video v Zaměřovači 1.2.149: bez miniatury a při otevření nekonečné načítání](https://github.com/zaplikj30-ui/Zamerovac-android/issues/20)
- [#23 – Kóta se při klepání/úpravě náhle přestane zobrazovat – video z testu 1.2.149](https://github.com/zaplikj30-ui/Zamerovac-android/issues/23)
- [#39 – Větší společná aktualizace po 1.2.152: bezpečnost, synchronizace, galerie, editor a ovládání](https://github.com/zaplikj30-ui/Zamerovac-android/issues/39)
- [#33 – Audit Claude 1.2.150 → ověřeno proti 1.2.152: WebView Native, souběh cloudu a integrita záloh](https://github.com/zaplikj30-ui/Zamerovac-android/issues/33)

### Kontroly, postupy a testovací návaznosti

- [#42 – Dlouhodobě zvyšovat kvalitu Zaměřovače: modulární kód, bezpečný refaktoring a ověřování](https://github.com/zaplikj30-ui/Zamerovac-android/issues/42)
- [#28 – Automatické vizuální a funkční testy editoru: kreslit, ověřit obrys a ukládání před APK](https://github.com/zaplikj30-ui/Zamerovac-android/issues/28)
- [#13 – Zaměřovač – průběžný deník testování a předávání mezi chaty](https://github.com/zaplikj30-ui/Zamerovac-android/issues/13)
- [#183 – Spouštět schválené GitHub Actions z ChatGPT bez ručního klikání (testy i APK)](https://github.com/zaplikj30-ui/Zamerovac-android/issues/183)
- [#213 – Údržba GitHub Actions: přechod z Node.js 20 a setup-java v4 (po PR #212)](https://github.com/zaplikj30-ui/Zamerovac-android/issues/213)
- [#184 – Oddělit SESTAVIT → VYDAT → INSTALOVAT A FYZICKY TESTOVAT APK](https://github.com/zaplikj30-ui/Zamerovac-android/issues/184)
- [#177 – DESIGN/SECURITY: jednoduché GitHub-hosted Chromium 23/96 bez P/Q/E bran – před implementací](https://github.com/zaplikj30-ui/Zamerovac-android/issues/177)
- [#157 – DESIGN/SECURITY: jednorázová read-only Chromium inventura na GitHub-hosted Linuxu](https://github.com/zaplikj30-ui/Zamerovac-android/issues/157)

### Uzavřené issues jako historický zdroj, nikoli aktuální zadání

- [#185 – Build APK: Maven Central 429 v GitHub-hosted Gradle při sestavení 1.4.0](https://github.com/zaplikj30-ui/Zamerovac-android/issues/185)
- [#43 – Trvalá kvalita Zaměřovače: postupná modularizace, ochrana dat a bezpečný vývoj](https://github.com/zaplikj30-ui/Zamerovac-android/issues/43)
- [#31 – Historie změn a oprav po skutečných verzích – opravit chybně přiřazené novinky](https://github.com/zaplikj30-ui/Zamerovac-android/issues/31)

## E. Každá další etapa musí mít jasnou trasu z vize do reality

Před **M0, M1, M2...** se otevře jen relevantní skupina původních zdrojů a vytvoří se u konkrétní funkce řádek:
**požadavek / původní rozhodnutí → otevřený detail → skutečný kód a chování v1 → návrh jednoduché v2 → relevantní test → fyzický výsledek → stav a další návaznost**.

Výsledek může být **TEĎ / POZDĚJI / JEŠTĚ PROBRAT / VÝSLOVNĚ VYŘAZENO**. Pouhé odložení funkce nesmí vést ke ztrátě zápisu. Před M1 prověřit ochranu budoucího modelu zakázky/dokumentu; až při každé budoucí etapě ověřit její **konkrétní** potřebu, nikoliv programovat preventivně celé systémy.

**MEZERA/NEOVĚŘENO:** tento index pokrývá hlavní dokumenty a všechny právě vrácené Issues; **nebyly postupně přečteny všechny komentáře každého issue, všechny uzavřené PR ani celé historické chaty**, takže zatím není pravdivé tvrdit „100 % všeho, o čem jsme kdy mluvili“. Registr je živý: další dohledaná dohoda se doplní s odkazem, stavem a návazností. Doplněný registr **sám nemění nastavení ChatGPT projektu**.
