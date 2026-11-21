# ZAMĚŘOVAČ 2 – SAMOSTATNÝ REGISTR NEDOTAŽENÝCH NÁPADŮ

**21. 11. 2026 · seznam pro postupné společné rozhodování.** Neslouží jako automatické zadání programátorovi.

**Důležité rozlišení:** zde jsou i věci, u kterých už je schválen **cíl**, ale ještě chybí konkrétní rozsah nebo způsob provedení. To **neznamená**, že nápad byl odmítnut nebo že první verze dvojky musí vše obsahovat. I dříve odsouhlasené funkce mohou mít nedořešené technické detaily.

**Stavy:** `ROZHODNOUT` – chybí jasná volba; `UPŘESNIT` – známe cíl, ale ne detaily; `TECHNICKY OVĚŘIT` – nejprve malý test/protokol; `POTVRZENÝ CÍL, POZDĚJI` – cíl odsouhlasen, ale bez implementačního GO. Po rozhodnutí záznam přesunout/odkázat do [hlavního seznamu funkcí](ZAMEROVAC_2_KATALOG_FUNKCI.md), nenechávat dublovaný neaktuální závěr.

## 1. Všechny otevřené či nedokončené skupiny – 39 položek

Každý bod obsahuje původní stav a **konkrétní otázku, kterou bude třeba ještě vyřešit**. Zaškrtávací pole zde znamená **téma uzavřeno rozhodnutím**, nikoli naprogramováno.

### ☐ F01 · Fotografické 360° panorama / skládání více snímků; na panoramatu editovatelné kóty a označení bodů
**Dosavadní stav:** **BUDOUCÍ NÁPAD, upřesněný 21. 11.** · **Práce:** ROZHODNOUT / UPŘESNIT
**Co ještě dořešit:** Klasické slepované široké panorama, nebo jednotlivé fotky s vazbou? Jak pořídit a uložit kotevní body?
**Bezpečná návaznost:** undefined
**Původ:** [Rozhodnutí funkční podoby později; nejdřív malý prototyp gesta](https://github.com/zaplikj30-ui/Zamerovac-android/issues/Rozhodnutí funkční podoby později; nejdřív malý prototyp gesta)

### ☐ F02 · Možné prostorové/3D panorama a propojení kót mezi záběry
**Dosavadní stav:** **OTEVŘENO** · **Práce:** ROZHODNOUT / UPŘESNIT
**Co ještě dořešit:** Je potřeba opravdu prostorový 3D model, nebo stačí otočný 360° obraz? Jak řešit projekci a švy?
**Bezpečná návaznost:** undefined
**Původ:** [Bez dokladu potřeby nebudovat 3D engine](https://github.com/zaplikj30-ui/Zamerovac-android/issues/Bez dokladu potřeby nebudovat 3D engine)

### ☐ F03 · Podpora co nejvíce laserových dálkoměrů různých značek a modelů – Bosch, další podle dostupných protokolů
**Dosavadní stav:** **BUDOUCÍ POŽADOVANÝ SMĚR, NE PODPORA VŠECH** · **Práce:** ROZHODNOUT / UPŘESNIT
**Co ještě dořešit:** Které značky/modely a protokoly jsou veřejně dostupné a které lze fyzicky vyzkoušet?
**Bezpečná návaznost:** undefined
**Původ:** [Nejdřív jeden konkrétní adaptér a ověřené měření](https://github.com/zaplikj30-ui/Zamerovac-android/issues/Nejdřív jeden konkrétní adaptér a ověřené měření)

### ☐ F04 · Samostatný editovatelný půdorys v zakázce, volná kresba, jemné narovnání stěn, šikminy ponechat
**Dosavadní stav:** **SCHVÁLENÝ ZÁMĚR, BEZ IMPLEMENTAČNÍHO GO** · **Práce:** UPŘESNIT SCHVÁLENÝ CÍL
**Co ještě dořešit:** Jaký druh půdorysu: ruční čáry, jemné narovnání, nebo přesné objekty? Zachovat šikmé stěny?
**Bezpečná návaznost:** undefined
**Původ:** [Věrný UX test přímé editace stěn](https://github.com/zaplikj30-ui/Zamerovac-android/issues/Věrný UX test přímé editace stěn)

### ☐ F05 · Nárysy stěn / odkazy mezi místností, půdorysem, fotografií, rozměrem, překážkami
**Dosavadní stav:** **BUDOUCÍ NÁPAD** · **Práce:** ROZHODNOUT / UPŘESNIT
**Co ještě dořešit:** Odkaz ze stěny na nárys/foto; zda použít samostatnou obrazovku nebo společné pracovní plátno?
**Bezpečná návaznost:** undefined
**Původ:** [Nejprve datová vazba bez 3D](https://github.com/zaplikj30-ui/Zamerovac-android/issues/Nejprve datová vazba bez 3D)

### ☐ F06 · Pozdější 2D/3D model místnosti či nábytku, okna/dveře/rozvody/přípojky/překážky
**Dosavadní stav:** **BUDOUCÍ VIZE** · **Práce:** ROZHODNOUT / UPŘESNIT
**Co ještě dořešit:** Budovat 2D a 3D samostatně? Jaké objekty (dveře, okna, instalace, nábytek) mají být editovatelné?
**Bezpečná návaznost:** undefined
**Původ:** [Oddělený návrh po ověření půdorysu](https://github.com/zaplikj30-ui/Zamerovac-android/issues/Oddělený návrh po ověření půdorysu)

### ☐ F07 · Porovnání dvou fotografií vedle sebe; propojení fotografie s místem na půdorysu
**Dosavadní stav:** **NÁPAD** · **Práce:** ROZHODNOUT / UPŘESNIT
**Co ještě dořešit:** Jak se vedle sebe porovnávají snímky a jak se prokazuje odkaz na místo v půdorysu?
**Bezpečná návaznost:** undefined
**Původ:** [Vyjasnit skutečný pracovní scénář](https://github.com/zaplikj30-ui/Zamerovac-android/issues/Vyjasnit skutečný pracovní scénář)

### ☐ F08 · Šablony zakázek, karta zákazníka a profesní profily
**Dosavadní stav:** **NÁPAD** · **Práce:** ROZHODNOUT / UPŘESNIT
**Co ještě dořešit:** Jak má vypadat karta zákazníka, profesní profil, zakázková šablona a přenos nastavení?
**Bezpečná návaznost:** undefined
**Původ:** [Nerozšiřovat M1, navázat na ID](https://github.com/zaplikj30-ui/Zamerovac-android/issues/Nerozšiřovat M1, navázat na ID)

### ☐ F09 · Výměna podkladové fotografie bez ztráty kót
**Dosavadní stav:** **NÁPAD** · **Práce:** ROZHODNOUT / UPŘESNIT
**Co ještě dořešit:** Co přesně znamená výměna fotografie, pokud nová má jinou perspektivu, ořez nebo rozlišení?
**Bezpečná návaznost:** undefined
**Původ:** [Bezpečný návrat a potvrzení kotvení kót](https://github.com/zaplikj30-ui/Zamerovac-android/issues/Bezpečný návrat a potvrzení kotvení kót)

### ☐ F10 · Chytré umístění kót kolem fotky, textové/AI pokyny na vytvoření návrhu kót
**Dosavadní stav:** **NÁPAD, NE DOMYŠLENÉ MĚŘENÍ** · **Práce:** ROZHODNOUT / UPŘESNIT
**Co ještě dořešit:** Automaticky jen rozmisťovat kóty, nebo i vytvářet tvary z textu? Kdo potvrzuje správnost?
**Bezpečná návaznost:** undefined
**Původ:** [AI nesmí domýšlet skutečné délky](https://github.com/zaplikj30-ui/Zamerovac-android/issues/AI nesmí domýšlet skutečné délky)

### ☐ F11 · Průvodce zaměřením, chybějící míry, kontrola součtů kót, rozdíly a upozornění
**Dosavadní stav:** **NÁPAD** · **Práce:** ROZHODNOUT / UPŘESNIT
**Co ještě dořešit:** Jaké kontroly chybějících rozměrů a součtů jsou užitečné pro řemeslníka?
**Bezpečná návaznost:** undefined
**Původ:** [Nejdřív sepsat typické chyby z praxe](https://github.com/zaplikj30-ui/Zamerovac-android/issues/Nejdřív sepsat typické chyby z praxe)

### ☐ F12 · Samsung Notes a samostatné ruční poznámky S Pen
**Dosavadní stav:** **OTEVŘENÁ TECHNICKÁ MOŽNOST** · **Práce:** ROZHODNOUT / UPŘESNIT
**Co ještě dořešit:** Lze Samsung Notes bezpečně propojit veřejným API, nebo bude lepší vlastní ruční blok?
**Bezpečná návaznost:** undefined
**Původ:** [Nezávislé ověření technické možnosti](https://github.com/zaplikj30-ui/Zamerovac-android/issues/Nezávislé ověření technické možnosti)

### ☐ F13 · Rozpoznávání řeči/diktování čísel, textu a příkazů
**Dosavadní stav:** **NÁPAD** · **Práce:** ROZHODNOUT / UPŘESNIT
**Co ještě dořešit:** Diktování jednotlivé hodnoty, textu, nebo příkazů? Jak zabránit záměně čísel a jednotek?
**Bezpečná návaznost:** undefined
**Původ:** [Před zápisem povinné potvrzení](https://github.com/zaplikj30-ui/Zamerovac-android/issues/Před zápisem povinné potvrzení)

### ☐ F14 · Rozšiřitelná knihovna symbolů, kategorie, poslední použité, případné otáčení/změna velikosti
**Dosavadní stav:** **ČÁST DŘÍVE DOHODNUTA, ROTACE OTEVŘENÁ** · **Práce:** ROZHODNOUT / UPŘESNIT
**Co ještě dořešit:** Jaké symboly/kategorie a které transformace jsou závazné? Rotace nebo změna měřítka?
**Bezpečná návaznost:** undefined
**Původ:** [Zachovat původní schválené varianty](https://github.com/zaplikj30-ui/Zamerovac-android/issues/Zachovat původní schválené varianty)

### ☐ F15 · Galerie, vyhledávání, miniatury, změna vzhledu a personalizace lišty
**Dosavadní stav:** **DŘÍVE DOHODNUTO / ČÁST OTEVŘENÁ** · **Práce:** UPŘESNIT SCHVÁLENÝ CÍL
**Co ještě dořešit:** Které změny galerie a lišty už platí z v1 a které se teprve mají schválit?
**Bezpečná návaznost:** undefined
**Původ:** [Nesměšovat opravu s novou funkcí](https://github.com/zaplikj30-ui/Zamerovac-android/issues/Nesměšovat opravu s novou funkcí)

### ☐ F16 · Začátečník/Střední/Expert – úrovně přehlednosti UI, NE tarify
**Dosavadní stav:** **NÁPAD** · **Práce:** ROZHODNOUT / UPŘESNIT
**Co ještě dořešit:** Jaké konkrétní rozdíly mají režimy Začátečník / Střední / Expert?
**Bezpečná návaznost:** undefined
**Původ:** [Jen vzhled a množství nástrojů, ne změna dat](https://github.com/zaplikj30-ui/Zamerovac-android/issues/Jen vzhled a množství nástrojů, ne změna dat)

### ☐ F17 · Úsporné/vyvážené/kvalitní vykreslování na různě výkonném telefonu
**Dosavadní stav:** **NÁPAD** · **Práce:** ROZHODNOUT / UPŘESNIT
**Co ještě dořešit:** Je třeba volit úroveň grafické kvality manuálně, nebo adaptivně? Jak měřit přínos?
**Bezpečná návaznost:** undefined
**Původ:** [Bez vlivu na geometrické](https://github.com/zaplikj30-ui/Zamerovac-android/issues/Bez vlivu na geometrické), [číselné hodnoty](https://github.com/zaplikj30-ui/Zamerovac-android/issues/číselné hodnoty)

### ☐ F18 · Tmavý/světlý/systémový vzhled, barvy, případně decentní pozadí
**Dosavadní stav:** **DŘÍVE DOHODNUTO PRO V1 / ROZSAH V2 OTEVŘENÝ** · **Práce:** UPŘESNIT SCHVÁLENÝ CÍL
**Co ještě dořešit:** Systémový/světlý/tmavý režim je cíl; jak se má kombinovat s volitelným pozadím a barvami?
**Bezpečná návaznost:** undefined
**Původ:** [Schválené úchopy a popisky neměnit](https://github.com/zaplikj30-ui/Zamerovac-android/issues/Schválené úchopy a popisky neměnit)

### ☐ F19 · Přizpůsobení skládacím telefonům, více oken, rotace a různé velikosti
**Dosavadní stav:** **BUDOUCÍ POŽADAVEK** · **Práce:** UPŘESNIT SCHVÁLENÝ CÍL
**Co ještě dořešit:** Jaké skládací formáty, rotace a víceokení režimy mají prioritu?
**Bezpečná návaznost:** undefined
**Původ:** [Zachovat gesto, zoom i neuložená data](https://github.com/zaplikj30-ui/Zamerovac-android/issues/Zachovat gesto, zoom i neuložená data)

### ☐ F20 · Myš, klávesnice, touchpad, Apple Pencil/jiná pera dle cílové platformy
**Dosavadní stav:** **BUDOUCÍ POŽADAVEK** · **Práce:** UPŘESNIT SCHVÁLENÝ CÍL
**Co ještě dořešit:** Co má podporovat myš, klávesnice a Apple Pencil? Který systém nejdřív?
**Bezpečná návaznost:** undefined
**Původ:** [Po skutečném Android základu](https://github.com/zaplikj30-ui/Zamerovac-android/issues/Po skutečném Android základu)

### ☐ F21 · Veřejná aplikace Android/Windows/iOS/iPadOS; regionální jednotky, jazyky a formáty
**Dosavadní stav:** **DLOUHODOBÝ SMĚR** · **Práce:** ROZHODNOUT / UPŘESNIT
**Co ještě dořešit:** Kdy bude smysluplné Windows/iOS, které jednotky a regionální formáty jsou první?
**Bezpečná návaznost:** undefined
**Původ:** [Android první; přesná data přenositelná](https://github.com/zaplikj30-ui/Zamerovac-android/issues/Android první; přesná data přenositelná)

### ☐ F22 · Možné propojení se samostatným Konfigurátorem–Nářezákem a Převaděčem spojitosti
**Dosavadní stav:** **DLOUHODOBÝ SMĚR, NESLUČOVAT NYNÍ** · **Práce:** ROZHODNOUT / UPŘESNIT
**Co ještě dořešit:** Propojené aplikace, společný rozcestník, nebo jednou společná instalace?
**Bezpečná návaznost:** undefined
**Původ:** [Zatím oddělené repozitáře, žádný plugin framework](https://github.com/zaplikj30-ui/Zamerovac-android/issues/Zatím oddělené repozitáře, žádný plugin framework)

### ☐ F23 · Budoucí návrh skříněk, kusovník, nářezák, orientace hran/dekorů
**Dosavadní stav:** **DLOUHODOBÁ VIZE JINÉHO MODULU** · **Práce:** ROZHODNOUT / UPŘESNIT
**Co ještě dořešit:** Rozměry dílců, hrany po stranách, materiál, dekor, kování – jak definovat revizi a vazby?
**Bezpečná návaznost:** undefined
**Původ:** [Přijímat schválená měření vědomě, bez automatického přepsání](https://github.com/zaplikj30-ui/Zamerovac-android/issues/Přijímat schválená měření vědomě, bez automatického přepsání)

### ☐ F24 · Budoucí kalkulace, práce, doprava, marže, nabídky, ceníky, varianty
**Dosavadní stav:** **DLOUHODOBÁ VIZE** · **Práce:** ROZHODNOUT / UPŘESNIT
**Co ještě dořešit:** Jaké náklady a marže, ceníky, nabídky, varianty a DPH? Kdo spravuje sazby?
**Bezpečná návaznost:** undefined
**Původ:** [Oddělit výpočty od měření a časovače](https://github.com/zaplikj30-ui/Zamerovac-android/issues/Oddělit výpočty od měření a časovače)

### ☐ F25 · Budoucí výrobní a montážní režim, kontroly kolizí a revize výstupů
**Dosavadní stav:** **DLOUHODOBÁ VIZE** · **Práce:** ROZHODNOUT / UPŘESNIT
**Co ještě dořešit:** Kdo potvrzuje finální výrobní/montážní výstup a co se stane při změně návrhu?
**Bezpečná návaznost:** undefined
**Původ:** [Zachovat revize, žádné tiché přepočty](https://github.com/zaplikj30-ui/Zamerovac-android/issues/Zachovat revize, žádné tiché přepočty)

### ☐ F26 · Zapínatelné funkční moduly, ale samostatné dnešní aplikace
**Dosavadní stav:** **NÁPAD** · **Práce:** ROZHODNOUT / UPŘESNIT
**Co ještě dořešit:** Stačí skrývat nástroje, nebo mají být instalovatelné moduly? Kdy má spojení skutečný přínos?
**Bezpečná návaznost:** undefined
**Původ:** [Neprogramovat nyní pluginy](https://github.com/zaplikj30-ui/Zamerovac-android/issues/Neprogramovat nyní pluginy)

### ☐ F27 · Volitelná monetizace: zdarma, jednorázově, placené funkce, licence, předplatné, reklamy/bez reklam, promo kódy
**Dosavadní stav:** **OTEVŘENÝ OBCHODNÍ MODEL** · **Práce:** ROZHODNOUT / UPŘESNIT
**Co ještě dořešit:** Jednorázová koupě, předplatné, reklamy, placené moduly nebo kombinace?
**Bezpečná návaznost:** undefined
**Původ:** [Neomezit vlastnictví dat ani offline práci](https://github.com/zaplikj30-ui/Zamerovac-android/issues/Neomezit vlastnictví dat ani offline práci)

### ☐ F28 · Google Play/App Store – možné veřejné vydání, soukromí a licence
**Dosavadní stav:** **OTEVŘENÝ SMĚR** · **Práce:** ROZHODNOUT / UPŘESNIT
**Co ještě dořešit:** Co je prvním cílem veřejného vydání, Android Google Play nebo další obchody?
**Bezpečná návaznost:** undefined
**Původ:** [Licenční a zákonné podmínky před vydáním](https://github.com/zaplikj30-ui/Zamerovac-android/issues/Licenční a zákonné podmínky před vydáním)

### ☐ F29 · Vzdálený tisk a promítání/TV/projektor
**Dosavadní stav:** **BUDOUCÍ MOŽNOST, ČÁST POŽADOVANÁ** · **Práce:** ROZHODNOUT / UPŘESNIT
**Co ještě dořešit:** Stačí tisk hotového PDF, nebo i síťová tiskárna a zobrazení na TV/projektoru?
**Bezpečná návaznost:** undefined
**Původ:** [Oddělit tisk](https://github.com/zaplikj30-ui/Zamerovac-android/issues/Oddělit tisk), [výstup od editoru](https://github.com/zaplikj30-ui/Zamerovac-android/issues/výstup od editoru)

### ☐ F30 · Volitelné biometrické zamykání a QR kódy pro zakázky
**Dosavadní stav:** **NÁPAD** · **Práce:** ROZHODNOUT / UPŘESNIT
**Co ještě dořešit:** Má se biometrikou odemykat aplikace, zakázka či část dat? Co bude v QR?
**Bezpečná návaznost:** undefined
**Původ:** [Bezpečně validovat QR a oprávnění](https://github.com/zaplikj30-ui/Zamerovac-android/issues/Bezpečně validovat QR a oprávnění)

### ☐ F31 · Hlasové/hmatové pomůcky a další zařízení a komunikace USB/Wi-Fi dle protokolu
**Dosavadní stav:** **NÁPAD** · **Práce:** ROZHODNOUT / UPŘESNIT
**Co ještě dořešit:** Hlasové/hmatové pomůcky, USB/Wi-Fi měřidla – jaká konkrétní zařízení?
**Bezpečná návaznost:** undefined
**Původ:** [Adaptér až pro ověřený protokol](https://github.com/zaplikj30-ui/Zamerovac-android/issues/Adaptér až pro ověřený protokol)

### ☐ F32 · Historie variant zakázky odlišná od běžného Undo, crash recovery a sync
**Dosavadní stav:** **DLOUHODOBÝ POŽADAVEK, ROZSAH OTEVŘENÝ** · **Práce:** UPŘESNIT SCHVÁLENÝ CÍL
**Co ještě dořešit:** Jaký rozsah historie a variant má být dostupný nad rámec Undo a záloh?
**Bezpečná návaznost:** undefined
**Původ:** [Nevytvářet neomezené snapshoty při tahu](https://github.com/zaplikj30-ui/Zamerovac-android/issues/Nevytvářet neomezené snapshoty při tahu)

### ☐ F33 · Evidence práce zákazníka / zakázky: zvolit zákazníka, jeho hodinovou sazbu, Start → Pauza/Pokračovat → Stop, zaznamenat odpracovaný čas, datum, činnost a historii všech pracovních úseků, vypočítat součet hodin a cenu; možnost ruční opravy se záznamem
**Dosavadní stav:** **POTVRZENÝ BUDOUCÍ FUNKČNÍ ZÁMĚR, NENÍ SCHVÁLENÁ IMPLEMENTACE** · **Práce:** UPŘESNIT SCHVÁLENÝ CÍL
**Co ještě dořešit:** Jeden časovač nebo více? Co dělat při restartu, změně sazby a ruční opravě hodin?
**Bezpečná návaznost:** undefined
**Původ:** [Zachovat datum](https://github.com/zaplikj30-ui/Zamerovac-android/issues/Zachovat datum), [čas, starou sazbu a historii úseků](https://github.com/zaplikj30-ui/Zamerovac-android/issues/čas, starou sazbu a historii úseků)

### ☐ F34 · Vystavování faktur / pracovní výkazy, návaznost na zákazníka, práci, materiál, dopravu, přehled k zaplacení, možnost samostatné účetní/fakturační aplikace nebo bezpečného předání do existujícího nástroje
**Dosavadní stav:** **POTVRZENÝ BUDOUCÍ NÁPAD, ROZSAH NEROZHODNUT** · **Práce:** ROZHODNOUT / UPŘESNIT
**Co ještě dořešit:** Vlastní fakturace, účetní modul, nebo export do jiné aplikace? Jaké právní a daňové náležitosti?
**Bezpečná návaznost:** undefined
**Původ:** [Finanční doklad oddělený od času a Zaměřovače](https://github.com/zaplikj30-ui/Zamerovac-android/issues/Finanční doklad oddělený od času a Zaměřovače)

### ☐ F35 · Editovatelné univerzální i zakázkové instalační plány / šablony pro vodu, odpad, elektro, nábytek a montáž, přehledné PDF
**Dosavadní stav:** **SCHVÁLENÝ VYSOCE PRIORITNÍ POŽADAVEK; IMPLEMENTACE NEZAČALA** · **Práce:** UPŘESNIT SCHVÁLENÝ CÍL
**Co ještě dořešit:** Pořadí šablon (kuchyně/koupelna/skříňky), verzování a rozdíl orientační vs schválená?
**Bezpečná návaznost:** undefined
**Původ:** [Schválená vysoká priorita; čas po stabilním jádru](https://github.com/zaplikj30-ui/Zamerovac-android/issues/Schválená vysoká priorita; čas po stabilním jádru)

### ☐ F36 · Zákaznický portál / jen pro čtení vybraných částí a schválené revize zakázky
**Dosavadní stav:** **OTEVŘENÝ NEDOPRACOVANÝ NÁPAD** · **Práce:** ROZHODNOUT / UPŘESNIT
**Co ještě dořešit:** Zabezpečený webový portál, nebo malá aplikace? Co smí klient skutečně vidět?
**Bezpečná návaznost:** undefined
**Původ:** [Výchozí stav nic nezveřejňovat](https://github.com/zaplikj30-ui/Zamerovac-android/issues/Výchozí stav nic nezveřejňovat)

### ☐ F37 · Přímé sdílení okótované fotografie přes systém Androidu (Quick Share, WhatsApp apod.)
**Dosavadní stav:** **BUDOUCÍ NÁPAD** · **Práce:** ROZHODNOUT / UPŘESNIT
**Co ještě dořešit:** Sdílet PNG či PDF přímo z editoru nebo i galerie? Bez ručního ukládání kam?
**Bezpečná návaznost:** undefined
**Původ:** [Vědomá uživatelská akce, ne automatický sync](https://github.com/zaplikj30-ui/Zamerovac-android/issues/Vědomá uživatelská akce, ne automatický sync)

### ☐ F38 · Osobní/promo kód pro bezplatný dočasný či trvalý přístup z Google Play
**Dosavadní stav:** **OTEVŘENÝ NÁPAD K MONETIZACI** · **Práce:** ROZHODNOUT / UPŘESNIT
**Co ještě dořešit:** Promo kódy Google Play, nebo vlastní licence? Dočasný/trvalý přístup a obnovování?
**Bezpečná návaznost:** undefined
**Původ:** [Licence nikdy nesmí smazat či uzamknout vlastní data](https://github.com/zaplikj30-ui/Zamerovac-android/issues/Licence nikdy nesmí smazat či uzamknout vlastní data)

### ☐ F39 · Pozdější automatická diagnostická kontrola na syntetických datech a jeden anonymní ZIP report
**Dosavadní stav:** **V JEDNIČCE SCHVÁLENÝ ZÁMĚR PILOTU; VE DVOJCE ZATÍM ODLOŽIT** · **Práce:** UPŘESNIT SCHVÁLENÝ CÍL
**Co ještě dořešit:** Stačí M1 lehký záznamník, nebo kdy přidat oddělený automatický testovací pilot?
**Bezpečná návaznost:** undefined
**Původ:** [M1 pouze vlaječka; syntetický tester až později](https://github.com/zaplikj30-ui/Zamerovac-android/issues/M1 pouze vlaječka; syntetický tester až později)

## 2. Zvlášť vysoko prioritní otevřené věci

- **#72 Instalační plány:** cíl už je schválený a má vysokou praktickou prioritu. Rozhodnout jen konkrétní první šablony, editovatelnost, přesná označení a pozici po stabilizaci M1. [Původ](https://github.com/zaplikj30-ui/Zamerovac-android/issues/72)
- **#120 Panorama:** schválený směr diskuse, nikoli zvolená technická podoba. Široké panorama versus otočný 360° pohled, a jak ukotvit kóty. [Původ](https://github.com/zaplikj30-ui/Zamerovac-android/issues/120)
- **#224 Propojené moduly:** Zaměřovač, Konfigurátor, Kusovník, Nářezák a účetnictví mají budoucí návaznost, ale samostatné projekty se teď neslučují. [Původ](https://github.com/zaplikj30-ui/Zamerovac-android/issues/224)
- **#226 Automatická kontrola:** v jedničce schválený nápad testovacího pilotu. U dvojky se majitel mezitím rozhodl pro jednoduchou diagnostiku od M1; automatický tester zůstává oddělenou případnou etapou. [Původ](https://github.com/zaplikj30-ui/Zamerovac-android/issues/226)

## 3. Přesný postup uzavření nápadu

1. Přečíst původní issue/dokument a jeho novější upřesnění (nové rozhodnutí může změnit starý návrh).
2. Označit **Co už chceme / Co ještě chybí / Jak souvisí s ostatními / Jaké je riziko chyb či ztráty dat**.
3. Připravit maximálně 2–3 jednoduché varianty, vybrat malý ověřovací test při podstatné nejistotě.
4. Po rozhodnutí vlastníka doplnit do hlavního katalogu stav a cílovou etapu. **Bez tohoto rozhodnutí nepsat velkou implementaci.**
5. Vlastní SOURCE/SECURITY kontrola → jiný nezávislý kontrolor → fyzický Android test, když relevantní; nikdy nevyhlašovat runtime PASS jen ze zdrojů.

## 4. Nezachycené diskuse a průběžné doplňování

[Registr všech dohledaných původních issues](ZAMEROVAC_2_REGISTR_NAVAZNOSTI_V1.md) nyní indexuje **55 issues**. [Historická vize](../VIZE_A_PLAN.md), [rozhodnutí z testů](../ROZHODNUTI_A_NAPADY_Z_TESTU.md), [plán](../PROJEKTOVY_PLAN_ZAMEROVACE.md) a [Konfigurátor–Nářezák](https://github.com/zaplikj30-ui/Konfigurator-Narezak-Android) jsou samostatné zdroje. **Neproběhla úplná kontrola všech komentářů všech PR a veškerých minulých chatů.** Proto je tento registr živý, nelze poctivě prohlásit, že zachytil 100 % celé historie. Nově nalezené nápady zapisovat s původem a stavem, nemazat jen proto, že nejsou na dnešní roadmapě.
