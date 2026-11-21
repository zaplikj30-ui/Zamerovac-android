# ZAMĚŘOVAČ 2 – ÚPLNÝ PRACOVNÍ SEZNAM FUNKCÍ

**21. 11. 2026 · kontrolní seznam pro dlouhodobý postup, nikoli schválení všech funkcí k okamžité implementaci.**

**Jak číst:** `☐` znamená **nesplněno nebo ve v2 neověřeno** – nikoli, že v jedničce funkce neexistovala. `DŘÍVE DOHODNUTO` = původní požadované chování, `SCHVÁLENÝ ZÁMĚR` = produktový cíl bez implementačního GO, `NÁPAD / OTEVŘENO` = nejdřív rozhodnout detaily. Stav každé položky aktualizovat až po skutečných důkazech (SOURCE, CI, fyzický Android zvlášť).

**Původ a jistota:** převzato z [inventury](ZAMEROVAC_2_INVENTURA_POZADAVKU.md), [původních 49 bodů #12](https://github.com/zaplikj30-ui/Zamerovac-android/issues/12), [vize](../VIZE_A_PLAN.md), [samostatných nápadů](../ROZHODNUTI_A_NAPADY_Z_TESTU.md) a [registru 55 issues](ZAMEROVAC_2_REGISTR_NAVAZNOSTI_V1.md). Není tvrzeno, že byly přečteny všechny staré chaty, komentáře a PR. Při doplnění nového podkladu přidat bod s původem a stavem; nic nedělat jen z paměti.

## 1. PEVNÉ ZÁKLADY – PROCHÁZEJÍ VŠEMI ETAPAMI

- ☐ **D01** Přesná čísla, metrické/imperiální jednotky a geometrie oddělené od obrazu. Hodnotu laseru nikdy neodvozovat z pixelů. [Vize](../VIZE_A_PLAN.md)
- ☐ **D02** Stabilní identifikátory zakázka–složka–dokument–foto–anotace–médium; vazby nepřepisovat ani neduplikovat. [Ústava dat](ZAMEROVAC_2_USTAVA_DAT.md)
- ☐ **D03** Původní bajty fotografií/videa/zvuku bez změn; editovatelné anotace zvlášť; bezpečná oprávnění. [Datový kontrakt](../DATOVY_FORMAT_A_PC_KOMPATIBILITA.md)
- ☐ **D04** Lokální offline ukládání, potvrzený transakční stav, obnova při pádu/plném disku, předchozí bezpečný stav, neztrácet starší zakázky. [Ústava dat](ZAMEROVAC_2_USTAVA_DAT.md)
- ☐ **D05** Undo/Redo oddělit od běžných záloh, koše, historie variant a budoucí synchronizace. [#221](https://github.com/zaplikj30-ui/Zamerovac-android/issues/221)
- ☐ **D06** Samostatná diagnostika **od M1**: přesunutelná vlaječka, zap/vyp, historie sezení, vybrat více, sdílet a hromadně mazat; nesbírat údaje zákazníků. [Porovnání §4](ZAMEROVAC_2_POROVNANI_S_V1.md)
- ☐ **D07** Malé funkční kroky; při změně gesta zachovat schválený vzhled čar, šipek, úchopů a lupy; nevymýšlet na začátku všechny budoucí moduly. [#42](https://github.com/zaplikj30-ui/Zamerovac-android/issues/42)
- ☐ **D08** Funkční test každého celku: pozitivní, negativní, hraniční, výkon, obnova, fyzický Android podle rizika; autor opraví nálezy, nezávislý kontrolor pak znovu posoudí diff. [#28](https://github.com/zaplikj30-ui/Zamerovac-android/issues/28)
- ☐ **D09** Kotlin + Compose jako první malý Android prototyp; datová logika oddělená pro budoucí Windows/iOS; žádný předčasný C++ nebo plugin engine. [Plán](ZAMEROVAC_2_ZIVY_NAVRH.md)
- ☐ **D10** Předání dat do budoucí výroby jen po potvrzení, verzované návrhy, zachování hran a směru dekoru; **Konfigurátor–Nářezák zůstává samostatný**. [Vize](../VIZE_A_PLAN.md)

## 2. HLAVNÍ FUNKČNÍ BLOKY – 12 oblastí

| Stav v2 | ID | Oblast a požadované chování | Cílová etapa | Původní postavení |
|---|---|---|---|---|
| ☐ | J1 | Zakázky a strom složek, podsložky, adresy, hledání, třídění, zámky, hromadné přesuny a kopie | M2 | **DŘÍVE DOHODNUTO** |
| ☐ | J2 | Foto, video, PDF, zvuk, textové/kreslené/foto poznámky a přílohy, originály a editovatelné anotace | M2–M3 | **ZÁVAZNÝ CÍL** |
| ☐ | J3 | Fotografický editor: kóty/čáry/šipky/úhly, řetězce, kruh, elipsa, lichoběžník, obdélník, plochy, volná ruka, symboly | M1–M3 | **DŘÍVE DOHODNUTO** |
| ☐ | J4 | Gesta prstem/perem, úchopy konců/středu/textu, lupa, výběr, magnet/mřížka, zoom, posun, styly, Undo/Redo | M1 | **ZÁVAZNÝ CÍL** |
| ☐ | J5 | Galerie a režim prohlížení bez editace, rychlé miniatury, označení upravených fotografií | M2 | **DŘÍVE DOHODNUTO** |
| ☐ | J6 | Bluetooth laser Bosch: aktivní kóta, historie, párování, přesné jednotky; ruční vstup vždy dostupný | M5 | **DŘÍVE DOHODNUTO** |
| ☐ | J7 | Lokální offline save, jedna aktuální + jedna předchozí bezpečná verze, obnova, koš, přerušení, originály | M0–M1 | **ZÁVAZNÝ CÍL** |
| ☐ | J8 | Rozlišení import/export editovatelného ZIP vs zákaznické PDF/JPG/ZIP; původní média nepoškozená | M4 | **DŘÍVE DOHODNUTO** |
| ☐ | J9 | Podpora telefonů/tabletů různých značek a výkonů; prst, S Pen, jiné pero, myš/klávesnice podle fáze | M1+ | **ZÁVAZNÝ CÍL** |
| ☐ | J10 | Kotlin + Compose pro první Android/offline prototyp; přenositelnost domény pro Windows/iOS | M0 | **SCHVÁLENO JAKO SMĚR PROTOTYPU** |
| ☐ | J11 | Bezpečná budoucí sync telefon–tablet, Google Disk pro sync a oddělenou obnovitelnou zálohu | B1–B2 | **SCHVÁLENÝ CÍL, POZDĚJŠÍ ETAPA** |
| ☐ | J12 | Čeština, první další jazyk angličtina, různé jednotky a locale; offline nápověda | M2+ | **SCHVÁLENÝ SMĚR** |

## 3. DETAILNÍ PŮVODNÍ KONTROLNÍ SEZNAM – 49 bodů

**Jednotlivé body pocházejí z [#12](https://github.com/zaplikj30-ui/Zamerovac-android/issues/12).** U detailu zachovat poslední rozhodnutí (např. pozdější změnu názvu či tvaru úchopu); nepovažovat starou formulaci za pokyn vrátit odstraněnou věc.

### Kóty, čáry a úchopy
- ☐ **1.1** Zvětšit pouze vzhled bílých úchopových kroužků. Dotykovou oblast a citlivost neměnit.
- ☐ **1.2** Kroužky mají být poloprůhledné a nemají překrývat žluté čáry nebo hroty.
- ☐ **1.3** Uchopením středu čáry nebo kóty přesunout celý objekt.
- ☐ **1.4** Uchopením koncového bodu přesouvat jen daný konec.
- ☐ **1.5** Opravit magnetické přichytávání, aby šly body snadno oddělit.
- ☐ **1.6** Vypnutí přichytávání musí vypnout všechny jeho režimy.
- ☐ **1.7** Text přidaný k šipce zobrazovat nad její čárou.
- ☐ **1.8** Zachovat přesnou lupu při umisťování a přesouvání bodů.
### Kreslení a geometrie
- ☐ **2.1** Plocha: čtyři nezávisle pohyblivé rohy, nepravidelné tvary a rozměry stran.
- ☐ **2.2** Plocha: prostředním úchopem přesouvat celý tvar.
- ☐ **2.3** Obdélník ponechat jako samostatný jednoduchý nástroj.
- ☐ **2.4** Kruh: přesun za střed, změna velikosti za obvod, průměr Ø / poloměr R.
- ☐ **2.5** Elipsa: přesouvání celku a dvě nezávisle upravitelné osy.
- ☐ **2.6** Lomená čára: jednotlivé vrcholy spojené rovnými úsečkami, včetně jejich úprav.
- ☐ **2.7** Volná ruka musí plynule kopírovat pohyb prstu nebo S Penu.
- ☐ **2.8** Inteligentní kreslení: samostatný nástroj pro narovnání ručního náčrtu půdorysu.
### Řetězce a úhly
- ☐ **3.1** Dimenzní řetězec: zobrazovat rozměr každého jednotlivého úseku.
- ☐ **3.2** Kumulativní řetězec: zobrazovat vzdálenosti od společného počátečního bodu.
- ☐ **3.3** Oba řetězce: odlišné ikony, přidávání, přesouvání a mazání bodů.
- ☐ **3.4** Oba řetězce: ruční zadávání délek a přenos měření z laseru Bosch.
- ☐ **3.5** Úhel: společný vrchol a dvě upravitelná ramena podle ImageMeteru.
- ☐ **3.6** Sklon čáry: zachovat i naši současnou variantu zobrazení úhlu.
### Poznámky a přílohy
- ☐ **4.1** Prázdná poznámka: ponechat výchozí text „Klikněte pro zadání textu“.
- ☐ **4.2** Po vložení fotografie zobrazovat fotografii místo výchozího textu.
- ☐ **4.3** Vlastní text a fotografie se zobrazují a přesouvají společně.
- ☐ **4.4** U hlasové poznámky zobrazit malou ikonu mikrofonu.
- ☐ **4.5** Klepnutím na text i fotografii otevřít stejnou úplnou nabídku poznámky.
- ☐ **4.6** Zachovat fotografie, videa, hlasové nahrávky a další přílohy.
- ☐ **4.7** Spojovací šipka: v klidu pouze žlutý hrot, bez viditelné tečky.
- ☐ **4.8** Při přesouvání hrotu zobrazit větší bílý úchop; hrot přesouvat samostatně.
- ☐ **4.9** Po prvním povolení mikrofonu automaticky začít nahrávat bez druhého klepnutí.
### Galerie a prohlížení
- ☐ **5.1** V galerii zobrazovat fotografie se všemi kótami, poznámkami a symboly.
- ☐ **5.2** V galerii zamknout úpravy objektů, aby šlo bezpečně listovat prstem.
- ☐ **5.3** Po otevření editoru znovu umožnit běžné úpravy všech objektů.
- ☐ **5.4** Stejné chování zajistit i ve druhém prohlížeči fotografií.
- ☐ **5.5** Po návratu z editoru zobrazovat aktuálně uložené anotace.
### Symboly
- ☐ **6.1** Rozšířit knihovnu symbolů pro elektroinstalaci, půdorysy a další použití.
- ☐ **6.2** Přidat přehledné kategorie a vyhledávání symbolů.
- ☐ **6.3** Přidat naposledy použité symboly.
- ☐ **6.4** Umožnit vlastní text u symbolu a zachovat rychlé předvolby.
### Laser Bosch
- ☐ **7.1** Opravit skutečný přenos naměřených hodnot z Bosch GLM 100-25 C.
- ☐ **7.2** Přenášet hodnoty do právě aktivní kóty nebo rozměrového pole.
- ☐ **7.3** Zprovoznit historii naměřených hodnot.
- ☐ **7.4** Zjednodušit nalezení laseru a jeho opětovné připojení.
### Export a zachování dat
- ☐ **8.1** Odstranit duplicitní export z rozbalené nástrojové lišty.
- ☐ **8.2** Zachovat ostatní možnosti exportu.
- ☐ **8.3** Přidat export celé zvolené složky včetně podsložek a příloh.
- ☐ **8.4** Při aktualizaci zachovat uložené zakázky, fotografie, kóty a poznámky.
- ☐ **8.5** Zachovat dosavadní funkční ovládání všude, kde nebyla požadována změna.

## 4. DALŠÍ FUNKCE A DLOUHODOBÉ MOŽNOSTI – 39 skupin

**Důležité:** zde jsou vedle sebe schválené záměry, otevřené návrhy i dřívější dílčí dohody. Číslo F neznamená, že je funkce již vytvořena ani že se má programovat hned. Otevřené otázky řeší [samostatný seznam nedotažených nápadů](ZAMEROVAC_2_NEDORESENE_NAPADY.md).

| Stav v2 | ID | Funkce / myšlenka | Dosavadní rozhodnutí | Zdroj |
|---|---|---|---|---|
| ☐ | F01 | **Vodorovné 360° panorama místnosti z více překrývajících se fotografií, otáčení pohledu do stran jako ze středu místnosti; část z okraje postupně přijíždí a srovnává se čelně uprostřed, plynulý zoom, minimální rušivé zakřivení/rybí oko; editovatelné kóty stále na místě** | **PODOBA FUNKCE F01 UPŘESNĚNA VLASTNÍKEM; TECHNICKY OVĚŘIT, PROGRAMOVAT POZDĚJI** | [#120](https://github.com/zaplikj30-ui/Zamerovac-android/issues/120), [detail F01](ZAMEROVAC_2_NEDORESENE_NAPADY.md) |
| ☐ | F02 | Možné prostorové/3D panorama a propojení kót mezi záběry | **OTEVŘENO** | [#221](https://github.com/zaplikj30-ui/Zamerovac-android/issues/221#issuecomment-7061788627), [Vize](../VIZE_A_PLAN.md) |
| ☐ | F03 | Podpora co nejvíce laserových dálkoměrů různých značek a modelů – Bosch, další podle dostupných protokolů | **BUDOUCÍ POŽADOVANÝ SMĚR, NE PODPORA VŠECH** | [Vize](../VIZE_A_PLAN.md), [Plán §11](../PROJEKTOVY_PLAN_ZAMEROVACE.md) |
| ☐ | F04 | Samostatný editovatelný půdorys v zakázce, volná kresba, jemné narovnání stěn, šikminy ponechat | **SCHVÁLENÝ ZÁMĚR, BEZ IMPLEMENTAČNÍHO GO** | [Vize – půdorys](../VIZE_A_PLAN.md) |
| ☐ | F05 | Nárysy stěn / odkazy mezi místností, půdorysem, fotografií, rozměrem, překážkami | **BUDOUCÍ NÁPAD** | [Plán §11](../PROJEKTOVY_PLAN_ZAMEROVACE.md), [#25](https://github.com/zaplikj30-ui/Zamerovac-android/issues/25) |
| ☐ | F06 | Pozdější 2D/3D model místnosti či nábytku, okna/dveře/rozvody/přípojky/překážky | **BUDOUCÍ VIZE** | [Vize](../VIZE_A_PLAN.md) |
| ☐ | F07 | Porovnání dvou fotografií vedle sebe; propojení fotografie s místem na půdorysu | **NÁPAD** | [Vize](../VIZE_A_PLAN.md) |
| ☐ | F08 | Šablony zakázek, karta zákazníka a profesní profily | **NÁPAD** | [Vize](../VIZE_A_PLAN.md), [Plán §11](../PROJEKTOVY_PLAN_ZAMEROVACE.md) |
| ☐ | F09 | Výměna podkladové fotografie bez ztráty kót | **NÁPAD** | [Vize](../VIZE_A_PLAN.md) |
| ☐ | F10 | Chytré umístění kót kolem fotky, textové/AI pokyny na vytvoření návrhu kót | **NÁPAD, NE DOMYŠLENÉ MĚŘENÍ** | [#16](https://github.com/zaplikj30-ui/Zamerovac-android/issues/16), [Vize](../VIZE_A_PLAN.md) |
| ☐ | F11 | Průvodce zaměřením, chybějící míry, kontrola součtů kót, rozdíly a upozornění | **NÁPAD** | [Vize](../VIZE_A_PLAN.md) |
| ☐ | F12 | Samsung Notes a samostatné ruční poznámky S Pen | **OTEVŘENÁ TECHNICKÁ MOŽNOST** | [Rozhodnutí](../ROZHODNUTI_A_NAPADY_Z_TESTU.md) |
| ☐ | F13 | Rozpoznávání řeči/diktování čísel, textu a příkazů | **NÁPAD** | [#44](https://github.com/zaplikj30-ui/Zamerovac-android/issues/44) |
| ☐ | F14 | Rozšiřitelná knihovna symbolů, kategorie, poslední použité, případné otáčení/změna velikosti | **ČÁST DŘÍVE DOHODNUTA, ROTACE OTEVŘENÁ** | [#12](https://github.com/zaplikj30-ui/Zamerovac-android/issues/12), [Rozhodnutí](../ROZHODNUTI_A_NAPADY_Z_TESTU.md) |
| ☐ | F15 | Galerie, vyhledávání, miniatury, změna vzhledu a personalizace lišty | **DŘÍVE DOHODNUTO / ČÁST OTEVŘENÁ** | [Rozhodnutí](../ROZHODNUTI_A_NAPADY_Z_TESTU.md), [Vize](../VIZE_A_PLAN.md) |
| ☐ | F16 | **Nastavení → Přizpůsobení nástrojů**: samostatné přepínače pro zobrazení/skrytí jednotlivých nástrojů (základ foto–kóta–poznámka–galerie, volitelně další funkce); možnost ukázat všechny nástroje. Skrytí nic nemaže. | **FUNKČNÍ POŽADAVEK A NÁZEV POTVRZENY; V2 ZATÍM NEIMPLEMENTOVÁNO**. Předvolby Začátečník/Střední/Expert jsou případná pozdější ergonomická možnost. | [Vize](../VIZE_A_PLAN.md), [#224](https://github.com/zaplikj30-ui/Zamerovac-android/issues/224) |
| ☐ | F17 | Úsporné/vyvážené/kvalitní vykreslování na různě výkonném telefonu | **NÁPAD** | [Vize](../VIZE_A_PLAN.md) |
| ☐ | F18 | Tmavý/světlý/systémový vzhled, barvy, případně decentní pozadí | **DŘÍVE DOHODNUTO PRO V1 / ROZSAH V2 OTEVŘENÝ** | [Vize](../VIZE_A_PLAN.md), [#17](https://github.com/zaplikj30-ui/Zamerovac-android/issues/17) |
| ☐ | F19 | Přizpůsobení skládacím telefonům, více oken, rotace a různé velikosti | **BUDOUCÍ POŽADAVEK** | [Vize](../VIZE_A_PLAN.md) |
| ☐ | F20 | Myš, klávesnice, touchpad, Apple Pencil/jiná pera dle cílové platformy | **BUDOUCÍ POŽADAVEK** | [Vize](../VIZE_A_PLAN.md) |
| ☐ | F21 | Veřejná aplikace Android/Windows/iOS/iPadOS; regionální jednotky, jazyky a formáty | **DLOUHODOBÝ SMĚR** | [Vize](../VIZE_A_PLAN.md), [datový kontrakt](../DATOVY_FORMAT_A_PC_KOMPATIBILITA.md) |
| ☐ | F22 | Možné propojení se samostatným Konfigurátorem–Nářezákem a Převaděčem spojitosti | **DLOUHODOBÝ SMĚR, NESLUČOVAT NYNÍ** | [Vize](../VIZE_A_PLAN.md), [datový kontrakt](../DATOVY_FORMAT_A_PC_KOMPATIBILITA.md) |
| ☐ | F23 | Budoucí návrh skříněk, kusovník, nářezák, orientace hran/dekorů | **DLOUHODOBÁ VIZE JINÉHO MODULU** | [Vize](../VIZE_A_PLAN.md) |
| ☐ | F24 | Budoucí kalkulace, práce, doprava, marže, nabídky, ceníky, varianty | **DLOUHODOBÁ VIZE** | [Vize](../VIZE_A_PLAN.md) |
| ☐ | F25 | Budoucí výrobní a montážní režim, kontroly kolizí a revize výstupů | **DLOUHODOBÁ VIZE** | [Vize](../VIZE_A_PLAN.md) |
| ☐ | F26 | **Samostatné Experimentální funkce**: každou novou, ještě neověřenou možnost povolit vědomě; jasně ukázat omezení konkrétního telefonu a možnost vypnutí. Budoucí volitelné moduly aplikací zůstávají zvláštní nápad. | **ODDĚLENÍ BĚŽNÝCH NÁSTROJŮ A EXPERIMENTŮ POTVRZENO; PLUGINOVÉ MODULY NEROZHODNUTY.** Experimenty nesmějí rozbít přesná měření/ukládání. | [#224](https://github.com/zaplikj30-ui/Zamerovac-android/issues/224), [Vize](../VIZE_A_PLAN.md) |
| ☐ | F27 | Volitelná monetizace: zdarma, jednorázově, placené funkce, licence, předplatné, reklamy/bez reklam, promo kódy | **OTEVŘENÝ OBCHODNÍ MODEL** | [Vize](../VIZE_A_PLAN.md), [V2 §16](ZAMEROVAC_2_ZIVY_NAVRH.md) |
| ☐ | F28 | Google Play/App Store – možné veřejné vydání, soukromí a licence | **OTEVŘENÝ SMĚR** | [Vize](../VIZE_A_PLAN.md) |
| ☐ | F29 | Vzdálený tisk a promítání/TV/projektor | **BUDOUCÍ MOŽNOST, ČÁST POŽADOVANÁ** | [Vize](../VIZE_A_PLAN.md) |
| ☐ | F30 | Volitelné biometrické zamykání a QR kódy pro zakázky | **NÁPAD** | [Vize](../VIZE_A_PLAN.md) |
| ☐ | F31 | Hlasové/hmatové pomůcky a další zařízení a komunikace USB/Wi-Fi dle protokolu | **NÁPAD** | [Vize](../VIZE_A_PLAN.md) |
| ☐ | F32 | Historie variant zakázky odlišná od běžného Undo, crash recovery a sync | **DLOUHODOBÝ POŽADAVEK, ROZSAH OTEVŘENÝ** | [Vize](../VIZE_A_PLAN.md), [#221](https://github.com/zaplikj30-ui/Zamerovac-android/issues/221) |
| ☐ | F33 | **Evidence práce zákazníka / zakázky:** zvolit zákazníka, jeho hodinovou sazbu, **Start → Pauza/Pokračovat → Stop**, zaznamenat odpracovaný čas, datum, činnost a historii všech pracovních úseků, vypočítat součet hodin a cenu; možnost ruční opravy se záznamem | **POTVRZENÝ BUDOUCÍ FUNKČNÍ ZÁMĚR, NENÍ SCHVÁLENÁ IMPLEMENTACE** | [#214](https://github.com/zaplikj30-ui/Zamerovac-android/issues/214) |
| ☐ | F34 | **Vystavování faktur / pracovní výkazy**, návaznost na zákazníka, práci, materiál, dopravu, přehled k zaplacení, možnost samostatné účetní/fakturační aplikace nebo bezpečného předání do existujícího nástroje | **POTVRZENÝ BUDOUCÍ NÁPAD, ROZSAH NEROZHODNUT** | [#214](https://github.com/zaplikj30-ui/Zamerovac-android/issues/214), [#224](https://github.com/zaplikj30-ui/Zamerovac-android/issues/224) |
| ☐ | F35 | **Editovatelné univerzální i zakázkové instalační plány / šablony** pro vodu, odpad, elektro, nábytek a montáž, přehledné PDF | **SCHVÁLENÝ VYSOCE PRIORITNÍ POŽADAVEK; IMPLEMENTACE NEZAČALA** | [#72](https://github.com/zaplikj30-ui/Zamerovac-android/issues/72) |
| ☐ | F36 | **Zákaznický portál / jen pro čtení vybraných částí a schválené revize zakázky** | **OTEVŘENÝ NEDOPRACOVANÝ NÁPAD** | [#73](https://github.com/zaplikj30-ui/Zamerovac-android/issues/73) |
| ☐ | F37 | **Přímé sdílení okótované fotografie přes systém Androidu** (Quick Share, WhatsApp apod.) | **BUDOUCÍ NÁPAD** | [#216](https://github.com/zaplikj30-ui/Zamerovac-android/issues/216) |
| ☐ | F38 | **Osobní/promo kód pro bezplatný dočasný či trvalý přístup z Google Play** | **OTEVŘENÝ NÁPAD K MONETIZACI** | [#217](https://github.com/zaplikj30-ui/Zamerovac-android/issues/217) |
| ☐ | F39 | **Pozdější automatická diagnostická kontrola** na syntetických datech a jeden anonymní ZIP report | **V JEDNIČCE SCHVÁLENÝ ZÁMĚR PILOTU; VE DVOJCE ZATÍM ODLOŽIT** | [#226](https://github.com/zaplikj30-ui/Zamerovac-android/issues/226), [#228](https://github.com/zaplikj30-ui/Zamerovac-android/issues/228) |

## 5. Postup a skutečný stav

| Etapa | Krok | Stav |
|---|---|---|
| M0 | Datový model, přesnost, úložiště, architektonické hranice, review | ROZPRACOVÁNO / návrh |
| M1 | Offline foto–kóta–gesta–Undo/Redo–bezpečný save a obnova + diagnostická vlaječka | NEROZBĚHNUTO |
| M2 | Zakázky, galerie, složky, koš, miniatury | NEROZBĚHNUTO |
| M3 | Tvary, symboly, poznámky, média | NEROZBĚHNUTO |
| M4 | Import/export, verze dat, ZIP, zákaznické PDF a případný import v1 | NEROZBĚHNUTO |
| M5 | Bosch měřák a následně jiné ověřené značky | NEROZBĚHNUTO |
| B | Záloha, sync, panorama, šablony/instalační plány, pracovní čas, fakturace, Konfigurátor/Kusovník/Nářezák, klientský portál, licence, Windows/iOS | PLÁN / jednotlivé priority a termíny OTEVŘENÉ |

**Zvláštní pozornost:** [#72](https://github.com/zaplikj30-ui/Zamerovac-android/issues/72) editovatelné instalační plány mají vysokou praktickou prioritu po stabilizaci základu; [#73](https://github.com/zaplikj30-ui/Zamerovac-android/issues/73) zákaznický portál je nedořešený nápad. Zaměřovač 2 nemá být redukován na editor, ale nemá se také naráz změnit v nářezák, fakturační systém a 3D editor.

**Povinné další podklady:** [strom vývoje](ZAMEROVAC_2_STROM_VYVOJE.md) · [skutečné porovnání v1/v2](ZAMEROVAC_2_POROVNANI_S_V1.md) · [samostatný registr nápadů k rozhodnutí](ZAMEROVAC_2_NEDORESENE_NAPADY.md) · [výchozí historické dokumenty](ZAMEROVAC_2_REGISTR_NAVAZNOSTI_V1.md).
