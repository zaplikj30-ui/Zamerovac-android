# Zaměřovač 2 – inventura požadavků, nápadů a otevřených rozhodnutí

**21. 11. 2026 · pracovní inventura, PR #234, nikoli GO k programování.** Přenos znalostí z jedničky včetně starších dohod, plánovaných věcí a budoucích nápadů. **Originální zdroje a novější explicitní rozhodnutí mají přednost před tímto přehledem.** Přečíst také [živý návrh v2](ZAMEROVAC_2_ZIVY_NAVRH.md), [hlavní vizi v1](../VIZE_A_PLAN.md), [projektový plán](../PROJEKTOVY_PLAN_ZAMEROVACE.md), [datový kontrakt](../DATOVY_FORMAT_A_PC_KOMPATIBILITA.md).

**Pozor – tato inventura je seznam záměrů, nikoliv porovnání se skutečnou aplikací.** Vlastníkem požadované [porovnání v2 se zdrojovým kódem v1, známými chybami a 44 oblastmi testů](ZAMEROVAC_2_POROVNANI_S_V1.md) je samostatný povinný podklad. **Diagnostika je povinnou součástí prvního funkčního offline prototypu M1**, podle jeho §4, ne nápad do budoucna.

**ZÁVAZNÉ PRAVIDLO PŘEVZETÍ:** Dvojka se bude postupně rozrůstat o prakticky všechny dříve probírané požadavky jedničky, nikoli jen o základní editor. [Úplný registr původních zdrojů a všech dohledaných issues](ZAMEROVAC_2_REGISTR_NAVAZNOSTI_V1.md) průběžně uchovává i nápady, které jsme zatím nedopracovali. Odloženo není zavrženo; každou etapu ale dokončíme, opravíme a ověříme, než začneme další. Aktuálně výslovně vyloučené referenční funkce z vize se nevkládají automaticky zpět.

## 1. Co zde znamená stav

- **ZÁVAZNÝ CÍL / SCHVÁLENÝ SMĚR:** zadání, které musí architektura respektovat. Neznamená hotovou implementaci.
- **DŘÍVE DOHODNUTO:** schválené chování nebo detail z vývoje v1; zachovat znalost při pozdějším návrhu v2, ale automaticky neprogramovat všechny staré funkce najednou.
- **NÁPAD / OTEVŘENO / ODLOŽENO:** bez závazku implementace či termínu. Rozhodnutí a fyzický test budou samostatně.
- **VYLOUČENO:** jen explicitně vyřazené referenční funkce, ne cokoliv, co v přehledu chybí.
- **Kód / build / test / fyzický Android:** čtyři různé úrovně ověření; **Zaměřovač 2 zatím žádný fyzický test nemá.**

## 2. Funkce, které musí mít v2 dohledatelné zadání

| ID | Funkční oblast | Stav požadavku | Co musí architektura umožnit už nyní | Zdroj |
|---|---|---|---|---|
| J1 | Zakázky a strom složek, podsložky, adresy, hledání, třídění, zámky, hromadné přesuny a kopie | **DŘÍVE DOHODNUTO** | ANO – stabilní ID, relace parentId, transakční akce | [Plán §11](../PROJEKTOVY_PLAN_ZAMEROVACE.md), [#12](https://github.com/zaplikj30-ui/Zamerovac-android/issues/12), [rozhodnutí](../ROZHODNUTI_A_NAPADY_Z_TESTU.md) |
| J2 | Foto, video, PDF, zvuk, textové/kreslené/foto poznámky a přílohy, originály a editovatelné anotace | **ZÁVAZNÝ CÍL** | ANO – dokumenty, média odděleně, stable IDs | [Vize](../VIZE_A_PLAN.md), [datový kontrakt](../DATOVY_FORMAT_A_PC_KOMPATIBILITA.md) |
| J3 | Fotografický editor: kóty/čáry/šipky/úhly, řetězce, kruh, elipsa, lichoběžník, obdélník, plochy, volná ruka, symboly | **DŘÍVE DOHODNUTO** | ANO – editovatelné geometrické typy a vykreslování odděleně | [#12](https://github.com/zaplikj30-ui/Zamerovac-android/issues/12), [testy 1–20](../REKONSTRUKCE_TESTU_01_10.md) |
| J4 | Gesta prstem/perem, úchopy konců/středu/textu, lupa, výběr, magnet/mřížka, zoom, posun, styly, Undo/Redo | **ZÁVAZNÝ CÍL** | ANO – gesture-command-model, rozlišení screen/image/world | [Rozhodnutí](../ROZHODNUTI_A_NAPADY_Z_TESTU.md), [#12](https://github.com/zaplikj30-ui/Zamerovac-android/issues/12) |
| J5 | Galerie a režim prohlížení bez editace, rychlé miniatury, označení upravených fotografií | **DŘÍVE DOHODNUTO** | ANO – samostatný renderer pro viewer | [Rozhodnutí](../ROZHODNUTI_A_NAPADY_Z_TESTU.md) |
| J6 | Bluetooth laser Bosch: aktivní kóta, historie, párování, přesné jednotky; ruční vstup vždy dostupný | **DŘÍVE DOHODNUTO** | ANO – měření oddělené od konkrétního protokolu | [#12](https://github.com/zaplikj30-ui/Zamerovac-android/issues/12), [KOMPATIBILITA](../KOMPATIBILITA_ZARIZENI.md) |
| J7 | Lokální offline save, jedna aktuální + jedna předchozí bezpečná verze, obnova, koš, přerušení, originály | **ZÁVAZNÝ CÍL** | ANO – SQLite preferovaná zkouška, recovery kontrakt | [Ústava dat](ZAMEROVAC_2_USTAVA_DAT.md), [#221](https://github.com/zaplikj30-ui/Zamerovac-android/issues/221) |
| J8 | Rozlišení import/export editovatelného ZIP vs zákaznické PDF/JPG/ZIP; původní média nepoškozená | **DŘÍVE DOHODNUTO** | ANO – data/output kontrakty nezávislé na rendereru | [Vize](../VIZE_A_PLAN.md), [datový formát](../DATOVY_FORMAT_A_PC_KOMPATIBILITA.md), [#17](https://github.com/zaplikj30-ui/Zamerovac-android/issues/17) |
| J9 | Podpora telefonů/tabletů různých značek a výkonů; prst, S Pen, jiné pero, myš/klávesnice podle fáze | **ZÁVAZNÝ CÍL** | ANO – platformní vstup oddělit, testovací matice | [KOMPATIBILITA](../KOMPATIBILITA_ZARIZENI.md), [Vize](../VIZE_A_PLAN.md) |
| J10 | Kotlin + Compose pro první Android/offline prototyp; přenositelnost domény pro Windows/iOS | **SCHVÁLENO JAKO SMĚR PROTOTYPU** | ANO – nevázat logiku na Compose UI | [V2 živý návrh](ZAMEROVAC_2_ZIVY_NAVRH.md) |
| J11 | Bezpečná budoucí sync telefon–tablet, Google Disk pro sync a oddělenou obnovitelnou zálohu | **SCHVÁLENÝ CÍL, POZDĚJŠÍ ETAPA** | ANO – identity, revize, sdílení až později | [#40](https://github.com/zaplikj30-ui/Zamerovac-android/issues/40), [V2 živý návrh](ZAMEROVAC_2_ZIVY_NAVRH.md) |
| J12 | Čeština, první další jazyk angličtina, různé jednotky a locale; offline nápověda | **SCHVÁLENÝ SMĚR** | ANO – UI překlady mimo uložená data | [LOKALIZACE](../LOKALIZACE_PLAN.md), [Vize](../VIZE_A_PLAN.md) |

## 3. Budoucí a nedořešené nápady – zachovat, neimplementovat všechny nyní

| ID | Nápad / představa | Stav | Co neuzavřít špatně na začátku | Původ |
|---|---|---|---|---|
| F01 | **Z více překrývajících se fotografií vodorovně kolem místnosti sestavit otočné 360° panorama, ve kterém lze přirozeně přibližovat/oddalovat, otáčet se do stran a přímo kreslit/editovat kóty** | **FUNKČNÍ ZADÁNÍ UPŘESNĚNO VLASTNÍKEM 21. 11. 2026; REALIZACE POZDĚJI** | Strop a podlahu není nutné zvlášť fotit; žádná povinná úplná sféra nebo 3D model. Zobrazení má vypadat přirozeně, nikoli jako extrémní rybí oko či zakřivené stěny: zvážit perspektivní výřez z horizontálního/cylindrického panoramatu a omezit příliš široký zorný úhel, přesné limity až z UX prototypu. Zoom plynule gestem, vhodně i +/−; měněná projekce/zoom/pohled nesmí posouvat kotevní body ani měnit přesné ruční/laserové hodnoty. Vyřešit šev 0°/360°, spojení snímků, původní bajty, export a návrat po restartu. | [#120](https://github.com/zaplikj30-ui/Zamerovac-android/issues/120), [upřesnění F01](ZAMEROVAC_2_NEDORESENE_NAPADY.md) |
| F02 | **Plnohodnotná sférická 360° fotografie místnosti (360° vodorovně × až 180° svisle)**: člověk stojí v jednom bodě, rozhlíží se doleva/doprava, nahoru/dolů a případně naklání pohled; přímo kótuje a používá existující poznámky s fotografiemi | **SAMOSTATNÝ FUNKČNÍ ZÁMĚR UPŘESNĚN VLASTNÍKEM 21. 11. 2026; NEJDE O DUPLICITU F01, IMPLEMENTACE POZDĚJI** | F01 je horizontální pás/rozhlížení především do stran, bez nutného stropu a podlahy. F02 je sférická fotografie zobrazující i strop a podlahu; pro **úplnou sféru** je nutné je také nafotit či mít již obsažené v importované 360° fotografii. Není to skutečný 3D model umožňující fyzicky měnit pozici. Ukotvit kóty v souřadnicích sféry nezávisle na natočení/zoomu, zachovat přesná ruční/laserová čísla a původní média. Pro další záběry/hotová panoramata uchovat vazby; schopnost vedeného pořízení/stitchingu, výkon, švy, pohodlí vertikálního kótování a slučitelnost s F01 ověřit malým prototypem. | [#120](https://github.com/zaplikj30-ui/Zamerovac-android/issues/120), [upřesnění F02](ZAMEROVAC_2_NEDORESENE_NAPADY.md), [formát sférického panoramatu](https://developers.google.com/streetview/android) |
| F03 | Podpora co nejvíce laserových dálkoměrů různých značek a modelů – Bosch, další podle dostupných protokolů | **BUDOUCÍ POŽADOVANÝ SMĚR, NE PODPORA VŠECH** | ANO – malé rozhraní měření + adaptéry pro konkrétní Bluetooth BLE/Classic, případně USB/Wi-Fi; evidovat reálně otestované modely | [Vize](../VIZE_A_PLAN.md), [Plán §11](../PROJEKTOVY_PLAN_ZAMEROVACE.md) |
| F04 | Samostatný editovatelný půdorys v zakázce, volná kresba, jemné narovnání stěn, šikminy ponechat | **SCHVÁLENÝ ZÁMĚR, BEZ IMPLEMENTAČNÍHO GO** | ANO – druh dokumentu nad sdílenými geometrickými objekty | [Vize – půdorys](../VIZE_A_PLAN.md) |
| F05 | Nárysy stěn / odkazy mezi místností, půdorysem, fotografií, rozměrem, překážkami | **BUDOUCÍ NÁPAD** | ANO – reference objektu s kontextem, bez hotového 3D enginu | [Plán §11](../PROJEKTOVY_PLAN_ZAMEROVACE.md), [#25](https://github.com/zaplikj30-ui/Zamerovac-android/issues/25) |
| F06 | Pozdější 2D/3D model místnosti či nábytku, okna/dveře/rozvody/přípojky/překážky | **BUDOUCÍ VIZE** | ANO – neomezovat dokumentový formát na jediný JPG | [Vize](../VIZE_A_PLAN.md) |
| F07 | Porovnání dvou fotografií vedle sebe; propojení fotografie s místem na půdorysu | **NÁPAD** | JEN DATOVÉ VAZBY, obrazovka později | [Vize](../VIZE_A_PLAN.md) |
| F08 | Šablony zakázek, karta zákazníka a profesní profily | **NÁPAD** | ID/metadata mají umožnit rozšíření bez pevné tabulky dnes | [Vize](../VIZE_A_PLAN.md), [Plán §11](../PROJEKTOVY_PLAN_ZAMEROVACE.md) |
| F09 | Výměna podkladové fotografie bez ztráty kót | **NÁPAD** | Oddělit originál, transformace a anotace; ověřit geometrii před realizací | [Vize](../VIZE_A_PLAN.md) |
| F10 | Chytré umístění kót kolem fotky, textové/AI pokyny na vytvoření návrhu kót | **NÁPAD, NE DOMYŠLENÉ MĚŘENÍ** | Příkazy nad doménou a potvrzení uživatele; žádné skutečné mm z pixelů | [#16](https://github.com/zaplikj30-ui/Zamerovac-android/issues/16), [Vize](../VIZE_A_PLAN.md) |
| F11 | Průvodce zaměřením, chybějící míry, kontrola součtů kót, rozdíly a upozornění | **NÁPAD** | Kontrola nad přesnými hodnotami; bez automatických destruktivních změn | [Vize](../VIZE_A_PLAN.md) |
| F12 | Samsung Notes a samostatné ruční poznámky S Pen | **OTEVŘENÁ TECHNICKÁ MOŽNOST** | Nezávislý model poznámky; API Samsung nejdřív ověřit | [Rozhodnutí](../ROZHODNUTI_A_NAPADY_Z_TESTU.md) |
| F13 | Rozpoznávání řeči/diktování čísel, textu a příkazů | **NÁPAD** | Vstupní adaptér; data měření potvrdit | [#44](https://github.com/zaplikj30-ui/Zamerovac-android/issues/44) |
| F14 | Rozšiřitelná knihovna symbolů, kategorie, poslední použité, případné otáčení/změna velikosti | **ČÁST DŘÍVE DOHODNUTA, ROTACE OTEVŘENÁ** | Typ symbolu, geometrie a styly odděleně | [#12](https://github.com/zaplikj30-ui/Zamerovac-android/issues/12), [Rozhodnutí](../ROZHODNUTI_A_NAPADY_Z_TESTU.md) |
| F15 | Galerie, vyhledávání, miniatury, změna vzhledu a personalizace lišty | **DŘÍVE DOHODNUTO / ČÁST OTEVŘENÁ** | Uložení preferencí mimo zakázky; editor zůstává stabilní | [Rozhodnutí](../ROZHODNUTI_A_NAPADY_Z_TESTU.md), [Vize](../VIZE_A_PLAN.md) |
| F16 | **Nastavení → Přizpůsobení nástrojů:** uživatel si jednotlivými přepínači zapne/vypne **zobrazení** funkcí a nástrojů v nabídce (například jen fotografie, kóty, poznámky a galerie, později panorama, půdorys, pokročilá geometrie). Lze libovolně měnit, případně zobrazit všechny dostupné nástroje. | **VLASTNÍKEM POTVRZENÝ FUNKČNÍ CÍL A NÁZEV 21. 11. 2026; IMPLEMENTACE POZDĚJI** | **Skrytí nabídky ≠ odstranění funkce či dat.** Existující kóty, poznámky, dokumenty zůstanou zobrazené, bezpečně zachované a po opětovném zapnutí nástroje editovatelné. Uložit nastavení mimo zakázku; přepínat bez ztráty rozpracované práce. Začátečník/Střední/Expert zůstává **samostatná otevřená možnost rychlých předvoleb**, nikoli povinný režim. Rozlišit od grafického výkonu F17. | [Vize](../VIZE_A_PLAN.md), [#224](https://github.com/zaplikj30-ui/Zamerovac-android/issues/224) |
| F17 | Úsporné/vyvážené/kvalitní vykreslování na různě výkonném telefonu | **NÁPAD** | Kvalita rendereru nesmí měnit skutečné číslo ani jednotku | [Vize](../VIZE_A_PLAN.md) |
| F18 | Tmavý/světlý/systémový vzhled, barvy, případně decentní pozadí | **DŘÍVE DOHODNUTO PRO V1 / ROZSAH V2 OTEVŘENÝ** | Zobrazovací tokeny, žádný zásah do originálů | [Vize](../VIZE_A_PLAN.md), [#17](https://github.com/zaplikj30-ui/Zamerovac-android/issues/17) |
| F19 | Přizpůsobení skládacím telefonům, více oken, rotace a různé velikosti | **BUDOUCÍ POŽADAVEK** | Responzivní UI a zachování stavu editoru | [Vize](../VIZE_A_PLAN.md) |
| F20 | Myš, klávesnice, touchpad, Apple Pencil/jiná pera dle cílové platformy | **BUDOUCÍ POŽADAVEK** | Jednotné editační příkazy, platformní vstupy zvlášť | [Vize](../VIZE_A_PLAN.md) |
| F21 | Veřejná aplikace Android/Windows/iOS/iPadOS; regionální jednotky, jazyky a formáty | **DLOUHODOBÝ SMĚR** | Přenosné přesné datové kontrakty; žádný falešný multiplatformní PASS | [Vize](../VIZE_A_PLAN.md), [datový kontrakt](../DATOVY_FORMAT_A_PC_KOMPATIBILITA.md) |
| F22 | Možné propojení se samostatným Konfigurátorem–Nářezákem a Převaděčem spojitosti | **DLOUHODOBÝ SMĚR, NESLUČOVAT NYNÍ** | Stabilní ID/revize, otevřený verzovaný export, žádná sdílená živá DB nyní | [Vize](../VIZE_A_PLAN.md), [datový kontrakt](../DATOVY_FORMAT_A_PC_KOMPATIBILITA.md) |
| F23 | Budoucí návrh skříněk, kusovník, nářezák, orientace hran/dekorů | **DLOUHODOBÁ VIZE JINÉHO MODULU** | Neměnit navazující výrobu bez výslovného souhlasu | [Vize](../VIZE_A_PLAN.md) |
| F24 | Budoucí kalkulace, práce, doprava, marže, nabídky, ceníky, varianty | **DLOUHODOBÁ VIZE** | Oddělené výrobní/obchodní údaje, žádné cenové schéma dnes | [Vize](../VIZE_A_PLAN.md) |
| F25 | Budoucí výrobní a montážní režim, kontroly kolizí a revize výstupů | **DLOUHODOBÁ VIZE** | Vazby na schválené revize bez samovolného přepočtu | [Vize](../VIZE_A_PLAN.md) |
| F26 | **Budoucí propojení modulů a samostatné Experimentální funkce:** současné Nastavení → Přizpůsobení nástrojů pouze skrývá/zobrazuje běžné nástroje; volitelné testovací novinky mít **odděleně jako Experimentální funkce** s jednotlivým vědomým zapnutím a varováním před limity/kompatibilitou. | **ROZHODNUTÝ PRINCIP ODDĚLENÉHO TESTOVACÍHO REŽIMU 21. 11. 2026; SKUTEČNÉ PLUGINY JEN NÁPAD** | Neodzkoušené funkce výchozí vypnuté; dostupnost konkrétních zařízení a bezpečná deaktivace ověřit před zařazením. Nezpřístupňovat potenciálně destruktivní změny pomocí jedné vlaječky; žádná výjimka z ochrany zákaznických dat, přesnosti a ukládání. Skrytí ikony samo nešetří výpočetní výkon. Konfigurátor–Nářezák a Převaděč spojitosti nadále oddělené projekty; bez plugin runtime nyní. | [#224](https://github.com/zaplikj30-ui/Zamerovac-android/issues/224), [Vize](../VIZE_A_PLAN.md) |
| F27 | Volitelná monetizace: zdarma, jednorázově, placené funkce, licence, předplatné, reklamy/bez reklam, promo kódy | **OTEVŘENÝ OBCHODNÍ MODEL** | Data a export nejsou závislá na případné licenci; žádné SDK nyní | [Vize](../VIZE_A_PLAN.md), [V2 §16](ZAMEROVAC_2_ZIVY_NAVRH.md) |
| F28 | Google Play/App Store – možné veřejné vydání, soukromí a licence | **OTEVŘENÝ SMĚR** | Bez předčasné registrace a plateb; podmínky ověřit až při vydání | [Vize](../VIZE_A_PLAN.md) |
| F29 | Vzdálený tisk a promítání/TV/projektor | **BUDOUCÍ MOŽNOST, ČÁST POŽADOVANÁ** | Oddělit finální vykreslení, tisk a sdílení od editace | [Vize](../VIZE_A_PLAN.md) |
| F30 | Volitelné biometrické zamykání a QR kódy pro zakázky | **NÁPAD** | Bezpečný přístup, bez ztráty exportu, validace QR | [Vize](../VIZE_A_PLAN.md) |
| F31 | Hlasové/hmatové pomůcky a další zařízení a komunikace USB/Wi-Fi dle protokolu | **NÁPAD** | Adaptéry pro vstup a transport, bez falešné kompatibility | [Vize](../VIZE_A_PLAN.md) |
| F32 | Historie variant zakázky odlišná od běžného Undo, crash recovery a sync | **DLOUHODOBÝ POŽADAVEK, ROZSAH OTEVŘENÝ** | Nepřidávat neomezené snapshoty při pohybu; účely odděleně | [Vize](../VIZE_A_PLAN.md), [#221](https://github.com/zaplikj30-ui/Zamerovac-android/issues/221) |
| F33 | **Evidence práce zákazníka / zakázky:** zvolit zákazníka, jeho hodinovou sazbu, **Start → Pauza/Pokračovat → Stop**, zaznamenat odpracovaný čas, datum, činnost a historii všech pracovních úseků, vypočítat součet hodin a cenu; možnost ruční opravy se záznamem | **POTVRZENÝ BUDOUCÍ FUNKČNÍ ZÁMĚR, NENÍ SCHVÁLENÁ IMPLEMENTACE** | Stabilní ID zákazníka/zakázky, samostatné časové úseky a sazba platná při práci; po změně sazby neměnit staré výkazy, přesná měna/desetinné počty, offline bez vymyšleného času; bez běžícího časovače v editoru fotografií | [#214](https://github.com/zaplikj30-ui/Zamerovac-android/issues/214) |
| F34 | **Vystavování faktur / pracovní výkazy**, návaznost na zákazníka, práci, materiál, dopravu, přehled k zaplacení, možnost samostatné účetní/fakturační aplikace nebo bezpečného předání do existujícího nástroje | **POTVRZENÝ BUDOUCÍ NÁPAD, ROZSAH NEROZHODNUT** | Oddělit měření a pracovní záznamy od fakturačních dokladů; přesné peněžní výpočty, možnost neměnných vystavených verzí a exportu; daňové/účetní povinnosti, formát a provázání řešit zvlášť | [#214](https://github.com/zaplikj30-ui/Zamerovac-android/issues/214), [#224](https://github.com/zaplikj30-ui/Zamerovac-android/issues/224) |
| F35 | **Editovatelné univerzální i zakázkové instalační plány / šablony** pro vodu, odpad, elektro, nábytek a montáž, přehledné PDF | **SCHVÁLENÝ VYSOCE PRIORITNÍ POŽADAVEK; IMPLEMENTACE NEZAČALA** | Samostatný dokument a revize, orientační vs. konkrétní, editovatelné značky i rozměry; šablona zůstává nedotčená; odborná bezpečnost | [#72](https://github.com/zaplikj30-ui/Zamerovac-android/issues/72) |
| F36 | **Zákaznický portál / jen pro čtení vybraných částí a schválené revize zakázky** | **OTEVŘENÝ NEDOPRACOVANÝ NÁPAD** | Výchozí stav nic nesdílet, žádné interní ceny/marže/fotografie bez výběru, oprávnění a důkladné zabezpečení až při realizaci | [#73](https://github.com/zaplikj30-ui/Zamerovac-android/issues/73) |
| F37 | **Přímé sdílení okótované fotografie přes systém Androidu** (Quick Share, WhatsApp apod.) | **BUDOUCÍ NÁPAD** | Oddělit explicitní jednorázový export od synchronizace; vybrat konkrétní fotku/výsledek, nesdílet původní neveřejná data automaticky | [#216](https://github.com/zaplikj30-ui/Zamerovac-android/issues/216) |
| F38 | **Osobní/promo kód pro bezplatný dočasný či trvalý přístup z Google Play** | **OTEVŘENÝ NÁPAD K MONETIZACI** | Není totéž co přístup k zákaznickým zakázkám; vlastní data nesmazat po expiraci licence, žádný server/obchodní SDK v M1 | [#217](https://github.com/zaplikj30-ui/Zamerovac-android/issues/217) |
| F39 | **Pozdější automatická diagnostická kontrola** na syntetických datech a jeden anonymní ZIP report | **V JEDNIČCE SCHVÁLENÝ ZÁMĚR PILOTU; VE DVOJCE ZATÍM ODLOŽIT** | M1 zůstává jen malá diagnostická vlaječka + výběr/zapnutí/sdílení/smazání; izolované testy a přísná ochrana dat před případnou pozdější integrací | [#226](https://github.com/zaplikj30-ui/Zamerovac-android/issues/226), [#228](https://github.com/zaplikj30-ui/Zamerovac-android/issues/228) |

**Výslovně k práci a fakturaci (F33/F34):** Uživatel znovu výslovně požádal o časovač odpracovaných hodin **pro konkrétního zákazníka**. Zákazník/zakázka má nastavitelnou hodinovou sazbu; uživatel spustí **Start**, případně **Pauza/Pokračovat**, a **Stop**. Zůstanou uložené jednotlivé pracovní úseky a jejich historie, součty a účtovaná práce. Později může přibýt přehled materiálu a nákladů, pracovní výkaz a faktura. Vystavení faktury **není totožné s časovačem**: rozhodnout, zda vlastní modul, samostatná aplikace nebo export do existující služby; až následně posoudit náležitosti, zákony, účetní identitu a soukromí. **Teď žádné účty, účetnictví ani fakturační knihovny.** Bezpečný vztah na zákazníka v datovém návrhu ano, ale nevytvářet teď tabulky pro účetní systém „pro jistotu“.

**Výslovně k panoramatu (F01/F02):** Vlastník 21. 11. 2026 upřesnil **funkční podobu F01**: postupné vodorovné fotografování překrývajících se záběrů okolo celé místnosti, složení do souvislého **360° horizontálního panoramatu** a otáčení pohledu jako zevnitř válce, **bez povinného zvláštního focení stropu a podlahy**. Přímo v něm půjde kótovat, kóty zůstanou na stejných místech při otočení, přiblížení/oddálení, exportu i po znovuotevření. **Povinně přirozený obraz bez přehnaného zakulacení/rybího oka**; pravděpodobnou jednoduchou cestou je perspektivní výřez z horizontálního panoramatu s rozumně omezeným zorným úhlem a plynulým zoomem; konečné zobrazení ověřit na telefonu, protože optické/stitch zkreslení nemusí zmizet úplně. **F02 skutečné 3D** zůstává samostatně otevřeným budoucím nápadem. Hodnoty kót jsou uživatelsky zadané či přenesené z měřidla, nikdy odhadnuté z panoramatických pixelů. **Technicky stále otevřeno:** jak bude aplikace snímky pořizovat/skládat a zda umožní import hotového panoramatu, překryvy a šev 0°/360°, výkon, export. Funkce není schválením implementace nyní ani výběrem 3D frameworku; datový základ nesmí natvrdo vyloučit panoramatický dokument a jeho vlastní kotevní souřadnice.
**Samostatné doplnění F02 od vlastníka 21. 11. 2026:** Původní pracovní název „prostorové 3D“ znamená **fotografické sférické panorama**, nikoli prostorový model skříněk či místnosti. F02 má dovolovat rozhlížení **ve všech směrech z jednoho pevného fotografovaného bodu** (včetně stropu a podlahy, pokud jsou nafocené), při zachování kotvení kót a přirozeného perspektivního zobrazení. **NESLUČOVAT F02 s F01**: F01 = vodorovný panoramatický pás, F02 = úplnější foto-sféra; později mohou sdílet systém poznámek/kót a část ovládání. Volný pohyb po místnosti mezi různými pozicemi by vyžadoval další fotografie, navigaci či 3D model a zůstává jinou technickou otázkou. Technická proveditelnost běžných telefonů a zachování přesnosti anotací zatím **NOT RUN**.

**Výslovně k dálkoměrům (F03):** Cíl je časem **co nejširší reálně ověřená podpora trhu**, nikoliv předstírané „všechny modely“. Některé značky/modely nepodporují veřejně dostupné programové spojení. Základní model měření `hodnota + jednotka + identita zdroje + cílová kóta` musí být nezávislý na Boschi. Zvláštní adaptér a test s konkrétním přístrojem lze přidat později. **Žádná vývojová práce na všech značkách nyní.**

## 4. Úplný původní očíslovaný seznam 49 kontrol (#12)

**Přesně 49 očíslovaných položek**, přeneseno z [issue #12](https://github.com/zaplikj30-ui/Zamerovac-android/issues/12). Původní nezaškrtnuté položky neznamenají automatický dnešní FAIL ani současný stav v2. Novější opravy názvů a chování mají přednost (např. „Lichoběžník“, „Směřovat“, vyřazené velké koncové tečky).

### 1. Kóty, čáry a úchopy
- **1.1** Zvětšit pouze vzhled bílých úchopových kroužků. Dotykovou oblast a citlivost neměnit.
- **1.2** Kroužky mají být poloprůhledné a nemají překrývat žluté čáry nebo hroty.
- **1.3** Uchopením středu čáry nebo kóty přesunout celý objekt.
- **1.4** Uchopením koncového bodu přesouvat jen daný konec.
- **1.5** Opravit magnetické přichytávání, aby šly body snadno oddělit.
- **1.6** Vypnutí přichytávání musí vypnout všechny jeho režimy.
- **1.7** Text přidaný k šipce zobrazovat nad její čárou.
- **1.8** Zachovat přesnou lupu při umisťování a přesouvání bodů.

### 2. Kreslení a měření
- **2.1** Plocha: čtyři nezávisle pohyblivé rohy, nepravidelné tvary a rozměry stran.
- **2.2** Plocha: prostředním úchopem přesouvat celý tvar.
- **2.3** Obdélník ponechat jako samostatný jednoduchý nástroj.
- **2.4** Kruh: přesun za střed, změna velikosti za obvod, průměr Ø / poloměr R.
- **2.5** Elipsa: přesouvání celku a dvě nezávisle upravitelné osy.
- **2.6** Lomená čára: jednotlivé vrcholy spojené rovnými úsečkami, včetně jejich úprav.
- **2.7** Volná ruka musí plynule kopírovat pohyb prstu nebo S Penu.
- **2.8** Inteligentní kreslení: samostatný nástroj pro narovnání ručního náčrtu půdorysu.

### 3. Řetězce a úhly
- **3.1** Dimenzní řetězec: zobrazovat rozměr každého jednotlivého úseku.
- **3.2** Kumulativní řetězec: zobrazovat vzdálenosti od společného počátečního bodu.
- **3.3** Oba řetězce: odlišné ikony, přidávání, přesouvání a mazání bodů.
- **3.4** Oba řetězce: ruční zadávání délek a přenos měření z laseru Bosch.
- **3.5** Úhel: společný vrchol a dvě upravitelná ramena podle ImageMeteru.
- **3.6** Sklon čáry: zachovat i naši současnou variantu zobrazení úhlu.

### 4. Poznámky
- **4.1** Prázdná poznámka: ponechat výchozí text „Klikněte pro zadání textu“.
- **4.2** Po vložení fotografie zobrazovat fotografii místo výchozího textu.
- **4.3** Vlastní text a fotografie se zobrazují a přesouvají společně.
- **4.4** U hlasové poznámky zobrazit malou ikonu mikrofonu.
- **4.5** Klepnutím na text i fotografii otevřít stejnou úplnou nabídku poznámky.
- **4.6** Zachovat fotografie, videa, hlasové nahrávky a další přílohy.
- **4.7** Spojovací šipka: v klidu pouze žlutý hrot, bez viditelné tečky.
- **4.8** Při přesouvání hrotu zobrazit větší bílý úchop; hrot přesouvat samostatně.
- **4.9** Po prvním povolení mikrofonu automaticky začít nahrávat bez druhého klepnutí.

### 5. Galerie a prohlížení
- **5.1** V galerii zobrazovat fotografie se všemi kótami, poznámkami a symboly.
- **5.2** V galerii zamknout úpravy objektů, aby šlo bezpečně listovat prstem.
- **5.3** Po otevření editoru znovu umožnit běžné úpravy všech objektů.
- **5.4** Stejné chování zajistit i ve druhém prohlížeči fotografií.
- **5.5** Po návratu z editoru zobrazovat aktuálně uložené anotace.

### 6. Grafické symboly
- **6.1** Rozšířit knihovnu symbolů pro elektroinstalaci, půdorysy a další použití.
- **6.2** Přidat přehledné kategorie a vyhledávání symbolů.
- **6.3** Přidat naposledy použité symboly.
- **6.4** Umožnit vlastní text u symbolu a zachovat rychlé předvolby.

### 7. Bluetooth laser Bosch
- **7.1** Opravit skutečný přenos naměřených hodnot z Bosch GLM 100-25 C.
- **7.2** Přenášet hodnoty do právě aktivní kóty nebo rozměrového pole.
- **7.3** Zprovoznit historii naměřených hodnot.
- **7.4** Zjednodušit nalezení laseru a jeho opětovné připojení.

### 8. Export a zachování funkcí
- **8.1** Odstranit duplicitní export z rozbalené nástrojové lišty.
- **8.2** Zachovat ostatní možnosti exportu.
- **8.3** Přidat export celé zvolené složky včetně podsložek a příloh.
- **8.4** Při aktualizaci zachovat uložené zakázky, fotografie, kóty a poznámky.
- **8.5** Zachovat dosavadní funkční ovládání všude, kde nebyla požadována změna.

## 5. Historických 28 testů uživatele – odkazy na celé scénáře

**Přeneseno všech 28 čísel testů**, ale jen názvy a odkazy: v původních souborech zůstávají **podrobné úchopy, gesta, gesta perem, popisky, pozdější změny a nejistoty videí**, které nelze bezpečně zkrátit na jeden řádek. Před implementací konkrétního nástroje přečíst jeho celý detail.

| Test | Předmět | Podrobnosti |
|---|---|---|
| 1 | Šipka | [Detail](../REKONSTRUKCE_TESTU_01_10.md) |
| 2 | Čára | [Detail](../REKONSTRUKCE_TESTU_01_10.md) |
| 3 | Lomená čára | [Detail](../REKONSTRUKCE_TESTU_01_10.md) |
| 4 | Dimenzní řetězec | [Detail](../REKONSTRUKCE_TESTU_01_10.md) |
| 5 | Kumulativní řetězec | [Detail](../REKONSTRUKCE_TESTU_01_10.md) |
| 6 | Úhel | [Detail](../REKONSTRUKCE_TESTU_01_10.md) |
| 7 | Plocha → pozdější finální název Lichoběžník | [Detail](../REKONSTRUKCE_TESTU_01_10.md) |
| 8 | Obdélník | [Detail](../REKONSTRUKCE_TESTU_01_10.md) |
| 9 | Kruh **i elipsa** | [Detail](../REKONSTRUKCE_TESTU_01_10.md) |
| 10 | Volná ruka | [Detail](../REKONSTRUKCE_TESTU_01_10.md) |
| 11 | Poznámka | [Detail](../REKONSTRUKCE_TESTU_11_20.md) |
| 12 | Symbol | [Detail](../REKONSTRUKCE_TESTU_11_20.md) |
| 13 | Laser Bosch a historie měření | [Detail](../REKONSTRUKCE_TESTU_11_20.md) |
| 14 | Zpět a Znovu | [Detail](../REKONSTRUKCE_TESTU_11_20.md) |
| 15 | Úprava spodní lišty nástrojů | [Detail](../REKONSTRUKCE_TESTU_11_20.md) |
| 16 | Magnetické přichytávání a úchopy kót | [Detail](../REKONSTRUKCE_TESTU_11_20.md) |
| 17 | Barva a tloušťka čar | [Detail](../REKONSTRUKCE_TESTU_11_20.md) |
| 18 | Směřovat (správný název!) | [Detail](../REKONSTRUKCE_TESTU_11_20.md) |
| 19 | Fotografie: přiblížení, posun, přizpůsobení | [Detail](../REKONSTRUKCE_TESTU_11_20.md) |
| 20 | Procházení fotografií | [Detail](../REKONSTRUKCE_TESTU_11_20.md) |
| 21 | Zamykání souborů a složek | [Detail](../REKONSTRUKCE_TESTU_21_28.md) |
| 22 | Koš a obnovení souborů | [Detail](../REKONSTRUKCE_TESTU_21_28.md) |
| 23 | Vyhledávání souborů a poznámek | [Detail](../REKONSTRUKCE_TESTU_21_28.md) |
| 24 | Řazení souborů | [Detail](../REKONSTRUKCE_TESTU_21_28.md) |
| 25 | Přejmenování a přesouvání souborů + další schválené funkce | [Detail](../REKONSTRUKCE_TESTU_21_28.md) |
| 26 | Export ZIP, struktura obsahu a pojmenování | [Detail](../REKONSTRUKCE_TESTU_21_28.md) |
| 27 | Import ZIP / obnovení zálohy | [Detail](../REKONSTRUKCE_TESTU_21_28.md) |
| 28 | Zachování dat po restartu aplikace | [Detail](../REKONSTRUKCE_TESTU_21_28.md) |

Samostatné schválené dodatky ke starým testům: **hromadný výběr/přesun/kopie/export, odznak upravené fotky, ZIP jedné editovatelné fotografie, stoh fotografií v poznámce, pravidla priority úchopů, názvy „Směřovat“ a „Lichoběžník“, nastavení barvy objektu a bezpečná galerie.** Vše detailně [ROZHODNUTI_A_NAPADY_Z_TESTU.md](../ROZHODNUTI_A_NAPADY_Z_TESTU.md). Odložené drobnosti zde zůstávají nápady, ne automatické implementační úkoly.

## 6. 44 oblastí existujícího kódu a testů – pouze mapa, nikoli PASS v2

Existuje [qa/coverage-v1.json](../qa/coverage-v1.json), v něm **44 oblastí**. Je označen `syntheticOnly=true`, `fullApplicationVerified=false`; nejde o kompletní runtime potvrzení v1 ani žádný PASS v2.

- **Obrazovky / editor / data:** `confirmed-storage`, `folders-bulk-locks`, `drawing-and-exact-values`, `handles-loupe-selection`, `undo-redo-history`, `snap-grid-and-zoom`, `landscape-toolbar`, `gallery`, `photo-loading`, `video`, `notes-checklist-sketch`, `rich-notes-detail`, `voice-recording`, `provider-media-import`, `trash-and-shared-media`, `bosch-values-and-history`, `address-and-external-map`, `webview-boundary`, `customer-export`, `full-zip-backup`, `historical-backup`.
- **Offline / online / zabezpečení / provoz:** `causal-format-and-conflicts`, `durable-queue-and-transfer`, `tls-and-mutual-pairing`, `lan-and-wifi-direct`, `direct-service-lifecycle`, `sync-during-live-editor`, `signed-cloud-sync`, `provider-deadline-and-inbox`, `cloud-scan-batches`, `route-network-and-job-cancel`, `help`, `release-history`, `local-feedback`, `drive-rest-boundary`, `drive-authorization-and-account-binding`, `sync-frequency`, `route-arbitration-and-cloud-progress`, `drive-preview-registration`, `audit39-data-safety`, `p1-hybrid-protected-revisions`, `pending-audio-retention`, `sync-core-b-ledger-adapters-content`, `sync-ack-recoverable-obligations`.

Při rozšiřování v2 se musí pro každou příslušnou oblast vytvořit nový adekvátní test cílového Kotlin/Compose kódu, **ne připsat PASS starých JavaScript/Chromium testů**.

## 7. Závazná rozhodnutí už dnes – aby budoucí funkce nevyžadovaly přestavbu

1. **Model dokumentu a geometrie:** datové typy zakázka, hierarchie, fotografie/příloha/poznámka/plátno, oddělená číselná hodnota a jednotka, souřadnice a styl; stabilní ID a verzované formáty. Panorama/půdorys/3D jsou budoucí typy/pohledy, **neimplementovat nyní jejich modely či renderery bez testu**, ale neblokovat je natvrdo v základních strukturách.
2. **Renderer a vstup:** oddělit model od zobrazení a gest; stejně přesná data musí jít zobrazit jako foto, náhled v galerii, PDF, jednou potenciálně panorama/půdorys. Dotyk/S Pen/myš mohou mít různá gesta bez měnění uloženého měření.
3. **Laser a měření:** jeden jednoduchý kontrakt pro ruční údaj a měření z přístroje; konkrétní Bluetooth/protokoly až v adaptérech. Žádná pevná závislost ve výpočtech na jediném výrobci.
4. **Úložiště:** Kotlin/Compose Android prototyp, SQLite preferovaný kandidát; změna jednoho záznamu nemá způsobovat zpracování všech zakázek ani ukládat historii každého tahu. Oddělit editaci, Undo/Redo, recovery, koš a budoucí sync; ochrana originálních bajtů je povinná.
5. **Zabezpečení a offline:** bezpečně pracovat bez cloudu; později Google Disk záloha **jiný účel** než živá synchronizace mezi zařízeními; žádný tichý konflikt, přepis starších daty, ztráta neodeslaných médií. První M1 offline.
6. **Rozšiřitelné oblasti:** logické moduly/funkční hranice ano, ale **žádný plugin engine, licenční server, 3D engine, sync systém nebo globální multiplatformní infrastruktura „pro jistotu“**.
7. **Široká zařízení a platformy:** Android od začátku na více velikostech/OEM třídách; data nezávislá na displeji a jazyku. Budoucí Windows/iOS přes pozdější adaptéry a případný Kotlin Multiplatform. Žádná neověřená kompatibilita.
8. **Nápověda, testy, lokalizace a monetizace:** od začátku oddělit texty, obchodní oprávnění (budoucnost) od projektových dat; diagnostika nesmí blokovat UI a nesmí sbírat zákaznická data. První prototyp bez reklam, účtu a plateb.

## 8. Čemu se vědomě vyhnout

- **Pět vyřazených funkcí ImageMeteru:** referenční měřítko, perspektivní reference, perspektivní délka, počítadlo objektů a výsledková listina. ImageMeter použít jen jako funkční referenci, ne kopírovat cizí kód/grafiku ([Vize – zachované podmínky](../VIZE_A_PLAN.md)).
- Neslučovat nyní Zaměřovač, Konfigurátor–Nářezák ani Převaděč spojitosti, nezavádět předčasně pluginy.
- Neměnit schválené úchopy, šipky, čáry a lupu bez výslovného schválení.
- Nepovažovat historické „bylo naprogramováno“, „bylo ve videu“, „PR byl zelený“ za fyzické potvrzení aktuálního Androidu.
- Nedovolit budoucím placeným funkcím či nefunkčnímu internetu uzamknout/zničit vlastní zakázky.

## 9. Co zatím NENÍ dořešeno – a bez čeho nezačínat velkou implementaci

**První průchod z hlavních dokumentů je dokončen, nikoli záruka, že byly přečteny všechny komentáře a změny v každém z historických issues.** Konkrétní zbývající práce:

- **Doplnit per-feature statusovou matici** podle aktuálního kódu na přesném SHA: požadavek / poslední dohoda / fungovalo v1 / aktuální chyba / věrný test / stav v2. K tomu dotčené otevřené issues, zejména #12, #13, #28, #42, #221, #40, testovací dokumenty, poznámky a návazné PR. **Nezaměňovat s tímto přehledem.**
- **Upřesnit panorama:** 360 fotografie vs. spojování snímků vs. 3D prostor, uložení kotev/transformací a jak se měření ověřuje. Jde o **otevřenou otázku**, nikoliv důvod teď přidat 3D engine.
- **Zmapovat laserové protokoly a ověřit dostupnost API konkrétních modelů**, případně licenci SDK; bez fyzických přístrojů a uživatelských testů neclaimovat univerzální kompatibilitu.
- **Technické rozhodnutí M0:** přesné datové typy, měření, jednotky, souřadnice, ukládání a crash-obnova, pravidla migrace a exportu. Bez toho nepsat rozsáhlý editor. Zvážit nejmenší prototyp a cílený test sporných hran.
- **Dokončit design/security oponenturu**, až po konkrétním návrhu implementace; autorské celé SOURCE/SECURITY review finálního SHA a pak jiné nezávislé review; žádné merge/APK bez GO.

**Nezávazná rozvojová posloupnost:** M0 závazné hranice/model/testovací kontrakty → M1 malý funkční offline editor foto–kóta–uložení → další geometrické nástroje, fotografie a poznámky, galerie/zakázky → import/export a Bosch → budoucí pan/2D/3D, další lasery, sync a moduly až po samostatné prioritizaci.

## 10. Původní referenční zdroje, které NESMÍ katalog nahradit

- [VIZE_A_PLAN.md](../VIZE_A_PLAN.md) – funkční cíle, dlouhodobé směry, schválené a otevřené nápady včetně monetizace, Windows/iOS, promítání, kót, půdorysu, výrobních modulů
- [PROJEKTOVY_PLAN_ZAMEROVACE.md](../PROJEKTOVY_PLAN_ZAMEROVACE.md) – mapa obrazovek, typy dat, 13 funkčních oblastí, bezpečné hranice, technický přenos
- [DATOVY_FORMAT_A_PC_KOMPATIBILITA.md](../DATOVY_FORMAT_A_PC_KOMPATIBILITA.md) – skutečný schema 1 / ZIP, ID, měření, import vs. sync, Windows/iOS kontrakty
- [ROZHODNUTI_A_NAPADY_Z_TESTU.md](../ROZHODNUTI_A_NAPADY_Z_TESTU.md) – samostatné schválené doplňky, změny názvů, gesta, nejisté a odložené nápady
- [TESTY_A_OPRAVY.md](../TESTY_A_OPRAVY.md), [issue #13](https://github.com/zaplikj30-ui/Zamerovac-android/issues/13), [issue #28](https://github.com/zaplikj30-ui/Zamerovac-android/issues/28) – historické testy, fyzické neúspěchy a závazná testovací metodika
- [Issue #12](https://github.com/zaplikj30-ui/Zamerovac-android/issues/12) – 49 očíslovaných detailů, kontrolní stavy a odpovědi
- [qa/coverage-v1.json](../qa/coverage-v1.json) – 44 oblastí současné automatické a zdrojové kontroly, nikoliv fyzický důkaz
- [KOMPATIBILITA_ZARIZENI.md](../KOMPATIBILITA_ZARIZENI.md), [LOKALIZACE_PLAN.md](../LOKALIZACE_PLAN.md) – skutečná zařízení/lasery a budoucí jazyky
- [#40](https://github.com/zaplikj30-ui/Zamerovac-android/issues/40), [#42](https://github.com/zaplikj30-ui/Zamerovac-android/issues/42), [#221](https://github.com/zaplikj30-ui/Zamerovac-android/issues/221) – sync a zálohy, kvalitní modulární hranice, dlouhodobá plynulost při narůstání zakázek
- [Navrh v2](../NAVRH_NOVEHO_ZAMEROVACE_OD_NULY.md), [živý plán](ZAMEROVAC_2_ZIVY_NAVRH.md), [ústava dat](ZAMEROVAC_2_USTAVA_DAT.md) – bezpečný start nové aplikace

**Rozsah nynější práce:** jen dokumentační inventura. Žádné nové programování, SDK, licenční systém, cloud, fyzický Android, Actions, merge ani APK.
