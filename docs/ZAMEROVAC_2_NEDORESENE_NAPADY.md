# ZAMĚŘOVAČ 2 – SAMOSTATNÝ REGISTR NEDOTAŽENÝCH NÁPADŮ

**21. 11. 2026 · seznam pro postupné společné rozhodování.** Neslouží jako automatické zadání programátorovi.

**Důležité rozlišení:** zde jsou i věci, u kterých už je schválen **cíl**, ale ještě chybí konkrétní rozsah nebo způsob provedení. To **neznamená**, že nápad byl odmítnut nebo že první verze dvojky musí vše obsahovat. I dříve odsouhlasené funkce mohou mít nedořešené technické detaily.

**Stavy:** `ROZHODNOUT` – chybí jasná volba; `UPŘESNIT` – známe cíl, ale ne detaily; `TECHNICKY OVĚŘIT` – nejprve malý test/protokol; `POTVRZENÝ CÍL, POZDĚJI` – cíl odsouhlasen, ale bez implementačního GO. Po rozhodnutí záznam přesunout/odkázat do [hlavního seznamu funkcí](ZAMEROVAC_2_KATALOG_FUNKCI.md), nenechávat dublovaný neaktuální závěr.

## 1. Všechny otevřené či nedokončené skupiny – 39 položek

Každý bod obsahuje původní stav a **konkrétní otázku, kterou bude třeba ještě vyřešit**. Zaškrtávací pole zde znamená **téma uzavřeno rozhodnutím**, nikoli naprogramováno.

### ☐ F01 · Vodorovné otočné 360° panorama místnosti s editovatelnými kótami a přirozeným zoomem
**Dosavadní stav:** **Dohodnuta uživatelská podoba F01, 21. 11. 2026.** · **Práce:** FUNKČNÍ CÍL UPŘESNĚN, TECHNICKY OVĚŘIT; IMPLEMENTACE AŽ POZDĚJI
**Co ještě dořešit:** Jakým způsobem telefon pořídí a spojí vodorovnou řadu překrývajících se snímků, případně přijme hotové panorama? Jaký zorný úhel a zoom budou působit přirozeně a bez rušivého zakřivení? Jak se vyřeší šev na 0°/360°, objekty blízko fotoaparátu a export?
**Bezpečná návaznost:** Rozhodnutí funkční podoby později; nejdřív malý prototyp gesta
**Původ:** [#120](https://github.com/zaplikj30-ui/Zamerovac-android/issues/120), [původní upřesnění](https://github.com/zaplikj30-ui/Zamerovac-android/issues/221#issuecomment-7061788627)

**Dohodnuté chování F01:** Uživatel vyfotografuje místnost sérií překrývajících se snímků vodorovně kolem sebe. Z nich vznikne otočné 360° panorama **bez povinného fotografování stropu/podlahy**. Pohled se otáčí jako hlava člověka stojícího uprostřed. **Střed obrazovky ukazuje právě sledovanou část přirozeně čelně; nová část přijíždí z okraje obrazovky a jak se otáčí pohled, srovnává se do čelního zobrazení**. Nejde o pouhé rolování dlouhého plochého obrázku. Uživatel zoomuje dvěma prsty a vhodně i +/−; příliš široký pohled/efekt rybího oka se má omezit. Kóty a poznámky zůstávají ukotvené i při otočení, zoomu, přes 0°/360° šev, po uložení a obnovení. Skutečné rozměry jsou ruční/laserové, **nikoli odvozené z pixelů nebo zdánlivého úhlu pohledu**. F02, skutečné prostorové 3D, zůstává jiným budoucím otevřeným tématem.
**Srozumitelné přirovnání vlastníka:** panorama se na telefonu má chovat jako **nekonečný vodorovný film nebo pás fotografie spojený do kruhu**. Obrazovka je pevné okno do tohoto pásu. Při pohybu prstem další část místnosti **vyjíždí z levého/pravého okraje**, uprostřed se **srovnává do přirozeného rovného pohledu**, a po 360° pokračuje plynule bez konce. Nesmí se jen zobrazovat extrémně zakulacený nebo roztažený celý dlouhý snímek. Zoom nemění uložené souřadnice kót. Toto je požadavek na **vzhled a chování**, nikoli předem vybraná projekční knihovna; věrnost bude nutné potvrdit malým interaktivním prototypem na telefonu.

**Technický návrh k malému testu (ne definitivní závěr):** běžná perspektivní kamera zobrazující výřez z cylindrického/horizontálního panoramatu, s omezením extrémního zorného úhlu a s plynulým zoomem. To pomůže přirozenému vzhledu; spojovací a perspektivní artefakty z fotografií nezmizí automaticky. V nejmenším prototypu ověřit rovné stěny uprostřed, plynulý příjezd z okraje, kresbu a přesun kót, šev 360°, výkon a restart na skutečném zařízení.

### ☐ F02 · Možné prostorové/3D panorama a propojení kót mezi záběry
**Dosavadní stav:** **OTEVŘENO** · **Práce:** ROZHODNOUT / UPŘESNIT
**Co ještě dořešit:** Je potřeba opravdu prostorový 3D model, nebo stačí otočný 360° obraz? Jak řešit projekci a švy?
**Bezpečná návaznost:** Bez dokladu potřeby nebudovat 3D engine
**Původ:** [#221](https://github.com/zaplikj30-ui/Zamerovac-android/issues/221#issuecomment-7061788627), [Vize](../VIZE_A_PLAN.md)

### ☐ F03 · Podpora co nejvíce laserových dálkoměrů různých značek a modelů – Bosch, další podle dostupných protokolů
**Dosavadní stav:** **BUDOUCÍ POŽADOVANÝ SMĚR, NE PODPORA VŠECH** · **Práce:** ROZHODNOUT / UPŘESNIT
**Co ještě dořešit:** Které značky/modely a protokoly jsou veřejně dostupné a které lze fyzicky vyzkoušet?
**Bezpečná návaznost:** Nejdřív jeden konkrétní adaptér a ověřené měření
**Původ:** [Vize](../VIZE_A_PLAN.md), [Plán §11](../PROJEKTOVY_PLAN_ZAMEROVACE.md)

### ☐ F04 · Samostatný editovatelný půdorys v zakázce, volná kresba, jemné narovnání stěn, šikminy ponechat
**Dosavadní stav:** **SCHVÁLENÝ ZÁMĚR, BEZ IMPLEMENTAČNÍHO GO** · **Práce:** UPŘESNIT SCHVÁLENÝ CÍL
**Co ještě dořešit:** Jaký druh půdorysu: ruční čáry, jemné narovnání, nebo přesné objekty? Zachovat šikmé stěny?
**Bezpečná návaznost:** Věrný UX test přímé editace stěn
**Původ:** [Vize – půdorys](../VIZE_A_PLAN.md)

### ☐ F05 · Nárysy stěn / odkazy mezi místností, půdorysem, fotografií, rozměrem, překážkami
**Dosavadní stav:** **BUDOUCÍ NÁPAD** · **Práce:** ROZHODNOUT / UPŘESNIT
**Co ještě dořešit:** Odkaz ze stěny na nárys/foto; zda použít samostatnou obrazovku nebo společné pracovní plátno?
**Bezpečná návaznost:** Nejprve datová vazba bez 3D
**Původ:** [Plán §11](../PROJEKTOVY_PLAN_ZAMEROVACE.md), [#25](https://github.com/zaplikj30-ui/Zamerovac-android/issues/25)

### ☐ F06 · Pozdější 2D/3D model místnosti či nábytku, okna/dveře/rozvody/přípojky/překážky
**Dosavadní stav:** **BUDOUCÍ VIZE** · **Práce:** ROZHODNOUT / UPŘESNIT
**Co ještě dořešit:** Budovat 2D a 3D samostatně? Jaké objekty (dveře, okna, instalace, nábytek) mají být editovatelné?
**Bezpečná návaznost:** Oddělený návrh po ověření půdorysu
**Původ:** [Vize](../VIZE_A_PLAN.md)

### ☐ F07 · Porovnání dvou fotografií vedle sebe; propojení fotografie s místem na půdorysu
**Dosavadní stav:** **NÁPAD** · **Práce:** ROZHODNOUT / UPŘESNIT
**Co ještě dořešit:** Jak se vedle sebe porovnávají snímky a jak se prokazuje odkaz na místo v půdorysu?
**Bezpečná návaznost:** Vyjasnit skutečný pracovní scénář
**Původ:** [Vize](../VIZE_A_PLAN.md)

### ☐ F08 · Šablony zakázek, karta zákazníka a profesní profily
**Dosavadní stav:** **NÁPAD** · **Práce:** ROZHODNOUT / UPŘESNIT
**Co ještě dořešit:** Jak má vypadat karta zákazníka, profesní profil, zakázková šablona a přenos nastavení?
**Bezpečná návaznost:** Nerozšiřovat M1, navázat na ID
**Původ:** [Vize](../VIZE_A_PLAN.md), [Plán §11](../PROJEKTOVY_PLAN_ZAMEROVACE.md)

### ☐ F09 · Výměna podkladové fotografie bez ztráty kót
**Dosavadní stav:** **NÁPAD** · **Práce:** ROZHODNOUT / UPŘESNIT
**Co ještě dořešit:** Co přesně znamená výměna fotografie, pokud nová má jinou perspektivu, ořez nebo rozlišení?
**Bezpečná návaznost:** Bezpečný návrat a potvrzení kotvení kót
**Původ:** [Vize](../VIZE_A_PLAN.md)

### ☐ F10 · Chytré umístění kót kolem fotky, textové/AI pokyny na vytvoření návrhu kót
**Dosavadní stav:** **NÁPAD, NE DOMYŠLENÉ MĚŘENÍ** · **Práce:** ROZHODNOUT / UPŘESNIT
**Co ještě dořešit:** Automaticky jen rozmisťovat kóty, nebo i vytvářet tvary z textu? Kdo potvrzuje správnost?
**Bezpečná návaznost:** AI nesmí domýšlet skutečné délky
**Původ:** [#16](https://github.com/zaplikj30-ui/Zamerovac-android/issues/16), [Vize](../VIZE_A_PLAN.md)

### ☐ F11 · Průvodce zaměřením, chybějící míry, kontrola součtů kót, rozdíly a upozornění
**Dosavadní stav:** **NÁPAD** · **Práce:** ROZHODNOUT / UPŘESNIT
**Co ještě dořešit:** Jaké kontroly chybějících rozměrů a součtů jsou užitečné pro řemeslníka?
**Bezpečná návaznost:** Nejdřív sepsat typické chyby z praxe
**Původ:** [Vize](../VIZE_A_PLAN.md)

### ☐ F12 · Samsung Notes a samostatné ruční poznámky S Pen
**Dosavadní stav:** **OTEVŘENÁ TECHNICKÁ MOŽNOST** · **Práce:** ROZHODNOUT / UPŘESNIT
**Co ještě dořešit:** Lze Samsung Notes bezpečně propojit veřejným API, nebo bude lepší vlastní ruční blok?
**Bezpečná návaznost:** Nezávislé ověření technické možnosti
**Původ:** [Rozhodnutí](../ROZHODNUTI_A_NAPADY_Z_TESTU.md)

### ☐ F13 · Rozpoznávání řeči/diktování čísel, textu a příkazů
**Dosavadní stav:** **NÁPAD** · **Práce:** ROZHODNOUT / UPŘESNIT
**Co ještě dořešit:** Diktování jednotlivé hodnoty, textu, nebo příkazů? Jak zabránit záměně čísel a jednotek?
**Bezpečná návaznost:** Před zápisem povinné potvrzení
**Původ:** [#44](https://github.com/zaplikj30-ui/Zamerovac-android/issues/44)

### ☐ F14 · Rozšiřitelná knihovna symbolů, kategorie, poslední použité, případné otáčení/změna velikosti
**Dosavadní stav:** **ČÁST DŘÍVE DOHODNUTA, ROTACE OTEVŘENÁ** · **Práce:** ROZHODNOUT / UPŘESNIT
**Co ještě dořešit:** Jaké symboly/kategorie a které transformace jsou závazné? Rotace nebo změna měřítka?
**Bezpečná návaznost:** Zachovat původní schválené varianty
**Původ:** [#12](https://github.com/zaplikj30-ui/Zamerovac-android/issues/12), [Rozhodnutí](../ROZHODNUTI_A_NAPADY_Z_TESTU.md)

### ☐ F15 · Galerie, vyhledávání, miniatury, změna vzhledu a personalizace lišty
**Dosavadní stav:** **DŘÍVE DOHODNUTO / ČÁST OTEVŘENÁ** · **Práce:** UPŘESNIT SCHVÁLENÝ CÍL
**Co ještě dořešit:** Které změny galerie a lišty už platí z v1 a které se teprve mají schválit?
**Bezpečná návaznost:** Nesměšovat opravu s novou funkcí
**Původ:** [Rozhodnutí](../ROZHODNUTI_A_NAPADY_Z_TESTU.md), [Vize](../VIZE_A_PLAN.md)

### ☐ F16 · Nastavení → Přizpůsobení nástrojů (zobrazit/skrýt jednotlivé funkce)
**Dosavadní stav:** **NÁZEV A PRINCIP JEDNOTLIVÝCH PŘEPÍNAČŮ POTVRZEN VLASTNÍKEM 21. 11. 2026; V2 ZATÍM NEIMPLEMENTOVÁNO.** · **Práce:** ZÁKLADNÍ UX DOHODNUTO, DOŘEŠIT DETAILY POZDĚJI
**Co ještě dořešit:** Přesný výchozí výběr nástrojů při první instalaci, logické skupiny v nastavení a případné rychlé předvolby Začátečník/Střední/Expert. Samotné přepínání nástrojů po jednom je dohodnuté.
**Bezpečná návaznost:** Nastavení skrývá pouze nástroje v nabídce; nezahazuje funkce, nemění měření, neschovává už uložené objekty tak, aby se nedaly otevřít, a nic nemaže. Změna nastavení se zapamatuje a neovlivní rozpracovanou zakázku.
**Původ:** [Vize](../VIZE_A_PLAN.md)

### ☐ F17 · Úsporné/vyvážené/kvalitní vykreslování na různě výkonném telefonu
**Dosavadní stav:** **NÁPAD** · **Práce:** ROZHODNOUT / UPŘESNIT
**Co ještě dořešit:** Je třeba volit úroveň grafické kvality manuálně, nebo adaptivně? Jak měřit přínos?
**Bezpečná návaznost:** Bez vlivu na geometrické
**Původ:** [Vize](../VIZE_A_PLAN.md)

### ☐ F18 · Tmavý/světlý/systémový vzhled, barvy, případně decentní pozadí
**Dosavadní stav:** **DŘÍVE DOHODNUTO PRO V1 / ROZSAH V2 OTEVŘENÝ** · **Práce:** UPŘESNIT SCHVÁLENÝ CÍL
**Co ještě dořešit:** Systémový/světlý/tmavý režim je cíl; jak se má kombinovat s volitelným pozadím a barvami?
**Bezpečná návaznost:** Schválené úchopy a popisky neměnit
**Původ:** [Vize](../VIZE_A_PLAN.md), [#17](https://github.com/zaplikj30-ui/Zamerovac-android/issues/17)

### ☐ F19 · Přizpůsobení skládacím telefonům, více oken, rotace a různé velikosti
**Dosavadní stav:** **BUDOUCÍ POŽADAVEK** · **Práce:** UPŘESNIT SCHVÁLENÝ CÍL
**Co ještě dořešit:** Jaké skládací formáty, rotace a víceokení režimy mají prioritu?
**Bezpečná návaznost:** Zachovat gesto, zoom i neuložená data
**Původ:** [Vize](../VIZE_A_PLAN.md)

### ☐ F20 · Myš, klávesnice, touchpad, Apple Pencil/jiná pera dle cílové platformy
**Dosavadní stav:** **BUDOUCÍ POŽADAVEK** · **Práce:** UPŘESNIT SCHVÁLENÝ CÍL
**Co ještě dořešit:** Co má podporovat myš, klávesnice a Apple Pencil? Který systém nejdřív?
**Bezpečná návaznost:** Po skutečném Android základu
**Původ:** [Vize](../VIZE_A_PLAN.md)

### ☐ F21 · Veřejná aplikace Android/Windows/iOS/iPadOS; regionální jednotky, jazyky a formáty
**Dosavadní stav:** **DLOUHODOBÝ SMĚR** · **Práce:** ROZHODNOUT / UPŘESNIT
**Co ještě dořešit:** Kdy bude smysluplné Windows/iOS, které jednotky a regionální formáty jsou první?
**Bezpečná návaznost:** Android první; přesná data přenositelná
**Původ:** [Vize](../VIZE_A_PLAN.md), [datový kontrakt](../DATOVY_FORMAT_A_PC_KOMPATIBILITA.md)

### ☐ F22 · Možné propojení se samostatným Konfigurátorem–Nářezákem a Převaděčem spojitosti
**Dosavadní stav:** **DLOUHODOBÝ SMĚR, NESLUČOVAT NYNÍ** · **Práce:** ROZHODNOUT / UPŘESNIT
**Co ještě dořešit:** Propojené aplikace, společný rozcestník, nebo jednou společná instalace?
**Bezpečná návaznost:** Zatím oddělené repozitáře, žádný plugin framework
**Původ:** [Vize](../VIZE_A_PLAN.md), [datový kontrakt](../DATOVY_FORMAT_A_PC_KOMPATIBILITA.md)

### ☐ F23 · Budoucí návrh skříněk, kusovník, nářezák, orientace hran/dekorů
**Dosavadní stav:** **DLOUHODOBÁ VIZE JINÉHO MODULU** · **Práce:** ROZHODNOUT / UPŘESNIT
**Co ještě dořešit:** Rozměry dílců, hrany po stranách, materiál, dekor, kování – jak definovat revizi a vazby?
**Bezpečná návaznost:** Přijímat schválená měření vědomě, bez automatického přepsání
**Původ:** [Vize](../VIZE_A_PLAN.md)

### ☐ F24 · Budoucí kalkulace, práce, doprava, marže, nabídky, ceníky, varianty
**Dosavadní stav:** **DLOUHODOBÁ VIZE** · **Práce:** ROZHODNOUT / UPŘESNIT
**Co ještě dořešit:** Jaké náklady a marže, ceníky, nabídky, varianty a DPH? Kdo spravuje sazby?
**Bezpečná návaznost:** Oddělit výpočty od měření a časovače
**Původ:** [Vize](../VIZE_A_PLAN.md)

### ☐ F25 · Budoucí výrobní a montážní režim, kontroly kolizí a revize výstupů
**Dosavadní stav:** **DLOUHODOBÁ VIZE** · **Práce:** ROZHODNOUT / UPŘESNIT
**Co ještě dořešit:** Kdo potvrzuje finální výrobní/montážní výstup a co se stane při změně návrhu?
**Bezpečná návaznost:** Zachovat revize, žádné tiché přepočty
**Původ:** [Vize](../VIZE_A_PLAN.md)

### ☐ F26 · Samostatné Experimentální funkce a budoucí volitelné moduly
**Dosavadní stav:** **ODDĚLENÉ EXPERIMENTÁLNÍ FUNKCE POTVRZENY VLASTNÍKEM 21. 11. 2026; INSTALOVATELNÉ MODULY ZŮSTÁVAJÍ NÁPADEM.** · **Práce:** EXPERIMENTÁLNÍ REŽIM VYMEZEN, TECHNICKY OVĚŘIT KOMPATIBILITU
**Co ještě dořešit:** Jak zobrazit konkrétní nepodporované telefony, upozornění na omezení a dostupnost jednotlivých experimentů. Zda budou aplikace někdy propojené nebo skutečně instalovatelnými moduly, se rozhodne zvlášť; nesouvisí to se skrýváním nástrojů.
**Bezpečná návaznost:** Experimenty jsou výchozí vypnuté a zapínají se jednotlivě, odděleně od Nastavení → Přizpůsobení nástrojů. Zpřístupnění experimentu nesmí ohrozit kóty, originální média a ukládání; při vypnutí nic nesmazat. Neprogramovat teď plugin engine ani neslučovat samostatné aplikace.
**Původ:** [Plán §11](../PROJEKTOVY_PLAN_ZAMEROVACE.md)

### ☐ F27 · Volitelná monetizace: zdarma, jednorázově, placené funkce, licence, předplatné, reklamy/bez reklam, promo kódy
**Dosavadní stav:** **OTEVŘENÝ OBCHODNÍ MODEL** · **Práce:** ROZHODNOUT / UPŘESNIT
**Co ještě dořešit:** Jednorázová koupě, předplatné, reklamy, placené moduly nebo kombinace?
**Bezpečná návaznost:** Neomezit vlastnictví dat ani offline práci
**Původ:** [Vize](../VIZE_A_PLAN.md), [V2 §16](ZAMEROVAC_2_ZIVY_NAVRH.md)

### ☐ F28 · Google Play/App Store – možné veřejné vydání, soukromí a licence
**Dosavadní stav:** **OTEVŘENÝ SMĚR** · **Práce:** ROZHODNOUT / UPŘESNIT
**Co ještě dořešit:** Co je prvním cílem veřejného vydání, Android Google Play nebo další obchody?
**Bezpečná návaznost:** Licenční a zákonné podmínky před vydáním
**Původ:** [Vize](../VIZE_A_PLAN.md)

### ☐ F29 · Vzdálený tisk a promítání/TV/projektor
**Dosavadní stav:** **BUDOUCÍ MOŽNOST, ČÁST POŽADOVANÁ** · **Práce:** ROZHODNOUT / UPŘESNIT
**Co ještě dořešit:** Stačí tisk hotového PDF, nebo i síťová tiskárna a zobrazení na TV/projektoru?
**Bezpečná návaznost:** Oddělit tisk
**Původ:** [Vize](../VIZE_A_PLAN.md)

### ☐ F30 · Volitelné biometrické zamykání a QR kódy pro zakázky
**Dosavadní stav:** **NÁPAD** · **Práce:** ROZHODNOUT / UPŘESNIT
**Co ještě dořešit:** Má se biometrikou odemykat aplikace, zakázka či část dat? Co bude v QR?
**Bezpečná návaznost:** Bezpečně validovat QR a oprávnění
**Původ:** [Vize](../VIZE_A_PLAN.md)

### ☐ F31 · Hlasové/hmatové pomůcky a další zařízení a komunikace USB/Wi-Fi dle protokolu
**Dosavadní stav:** **NÁPAD** · **Práce:** ROZHODNOUT / UPŘESNIT
**Co ještě dořešit:** Hlasové/hmatové pomůcky, USB/Wi-Fi měřidla – jaká konkrétní zařízení?
**Bezpečná návaznost:** Adaptér až pro ověřený protokol
**Původ:** [Vize](../VIZE_A_PLAN.md)

### ☐ F32 · Historie variant zakázky odlišná od běžného Undo, crash recovery a sync
**Dosavadní stav:** **DLOUHODOBÝ POŽADAVEK, ROZSAH OTEVŘENÝ** · **Práce:** UPŘESNIT SCHVÁLENÝ CÍL
**Co ještě dořešit:** Jaký rozsah historie a variant má být dostupný nad rámec Undo a záloh?
**Bezpečná návaznost:** Nevytvářet neomezené snapshoty při tahu
**Původ:** [Vize](../VIZE_A_PLAN.md), [#221](https://github.com/zaplikj30-ui/Zamerovac-android/issues/221)

### ☐ F33 · Evidence práce zákazníka / zakázky: zvolit zákazníka, jeho hodinovou sazbu, Start → Pauza/Pokračovat → Stop, zaznamenat odpracovaný čas, datum, činnost a historii všech pracovních úseků, vypočítat součet hodin a cenu; možnost ruční opravy se záznamem
**Dosavadní stav:** **POTVRZENÝ BUDOUCÍ FUNKČNÍ ZÁMĚR, NENÍ SCHVÁLENÁ IMPLEMENTACE** · **Práce:** UPŘESNIT SCHVÁLENÝ CÍL
**Co ještě dořešit:** Jeden časovač nebo více? Co dělat při restartu, změně sazby a ruční opravě hodin?
**Bezpečná návaznost:** Zachovat datum
**Původ:** [#214](https://github.com/zaplikj30-ui/Zamerovac-android/issues/214)

### ☐ F34 · Vystavování faktur / pracovní výkazy, návaznost na zákazníka, práci, materiál, dopravu, přehled k zaplacení, možnost samostatné účetní/fakturační aplikace nebo bezpečného předání do existujícího nástroje
**Dosavadní stav:** **POTVRZENÝ BUDOUCÍ NÁPAD, ROZSAH NEROZHODNUT** · **Práce:** ROZHODNOUT / UPŘESNIT
**Co ještě dořešit:** Vlastní fakturace, účetní modul, nebo export do jiné aplikace? Jaké právní a daňové náležitosti?
**Bezpečná návaznost:** Finanční doklad oddělený od času a Zaměřovače
**Původ:** [#214](https://github.com/zaplikj30-ui/Zamerovac-android/issues/214), [#224](https://github.com/zaplikj30-ui/Zamerovac-android/issues/224)

### ☐ F35 · Editovatelné univerzální i zakázkové instalační plány / šablony pro vodu, odpad, elektro, nábytek a montáž, přehledné PDF
**Dosavadní stav:** **SCHVÁLENÝ VYSOCE PRIORITNÍ POŽADAVEK; IMPLEMENTACE NEZAČALA** · **Práce:** UPŘESNIT SCHVÁLENÝ CÍL
**Co ještě dořešit:** Pořadí šablon (kuchyně/koupelna/skříňky), verzování a rozdíl orientační vs schválená?
**Bezpečná návaznost:** Schválená vysoká priorita; čas po stabilním jádru
**Původ:** [#72](https://github.com/zaplikj30-ui/Zamerovac-android/issues/72)

### ☐ F36 · Zákaznický portál / jen pro čtení vybraných částí a schválené revize zakázky
**Dosavadní stav:** **OTEVŘENÝ NEDOPRACOVANÝ NÁPAD** · **Práce:** ROZHODNOUT / UPŘESNIT
**Co ještě dořešit:** Zabezpečený webový portál, nebo malá aplikace? Co smí klient skutečně vidět?
**Bezpečná návaznost:** Výchozí stav nic nezveřejňovat
**Původ:** [#73](https://github.com/zaplikj30-ui/Zamerovac-android/issues/73)

### ☐ F37 · Přímé sdílení okótované fotografie přes systém Androidu (Quick Share, WhatsApp apod.)
**Dosavadní stav:** **BUDOUCÍ NÁPAD** · **Práce:** ROZHODNOUT / UPŘESNIT
**Co ještě dořešit:** Sdílet PNG či PDF přímo z editoru nebo i galerie? Bez ručního ukládání kam?
**Bezpečná návaznost:** Vědomá uživatelská akce, ne automatický sync
**Původ:** [#216](https://github.com/zaplikj30-ui/Zamerovac-android/issues/216)

### ☐ F38 · Osobní/promo kód pro bezplatný dočasný či trvalý přístup z Google Play
**Dosavadní stav:** **OTEVŘENÝ NÁPAD K MONETIZACI** · **Práce:** ROZHODNOUT / UPŘESNIT
**Co ještě dořešit:** Promo kódy Google Play, nebo vlastní licence? Dočasný/trvalý přístup a obnovování?
**Bezpečná návaznost:** Licence nikdy nesmí smazat či uzamknout vlastní data
**Původ:** [#217](https://github.com/zaplikj30-ui/Zamerovac-android/issues/217)

### ☐ F39 · Pozdější automatická diagnostická kontrola na syntetických datech a jeden anonymní ZIP report
**Dosavadní stav:** **V JEDNIČCE SCHVÁLENÝ ZÁMĚR PILOTU; VE DVOJCE ZATÍM ODLOŽIT** · **Práce:** UPŘESNIT SCHVÁLENÝ CÍL
**Co ještě dořešit:** Stačí M1 lehký záznamník, nebo kdy přidat oddělený automatický testovací pilot?
**Bezpečná návaznost:** M1 pouze vlaječka; syntetický tester až později
**Původ:** [#226](https://github.com/zaplikj30-ui/Zamerovac-android/issues/226), [#228](https://github.com/zaplikj30-ui/Zamerovac-android/issues/228)

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
