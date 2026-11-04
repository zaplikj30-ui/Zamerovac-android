# Zaměřovač – živá vize aplikace a plán do budoucna
*Založeno 4. 11. 2026. Tento dokument je pracovní představa, **nikoli neměnná specifikace**. Může se průběžně měnit po domluvě s uživatelem.*

## 1. Hlavní smysl
Praktická samostatná Android aplikace pro zaměřování zakázkového nábytku: od založení zakázky přes fotografie, kóty a poznámky až po předání podkladů pro návrh a výrobu. Minimalizovat přepínání mezi aplikacemi, neztrácet naměřená data a udržet snadné ovládání přímo na stavbě/montáži.

**Principy:** rychlost, čitelnost i na mobilu, použití na Samsung Galaxy S24 Ultra a Galaxy Tab S11 Ultra, S Pen a laser Bosch přes Bluetooth, funkčnost i bez internetu, bezpečná aktualizace bez smazání zakázek. ImageMeter je inspirace pro ovládání, ne zdroj převzatého kódu či grafiky.

## 2. Představa, jak má aplikace vypadat a ovládat se
- Tmavé fialovo-antracitové prostředí, možnost akcentní barvy, čitelné žluté kóty a přehledné ovládání (dosavadní směr z README).
- Zakázky / složky / podsložky s fotografiemi, přílohami a poznámkami, intuitivní galerie a editor.
- Fotografie zůstávají čitelné i s kótami a symboly; v galerii bezpečné prohlížení bez nechtěných úprav, v editoru přesné uchopování a lupa.
- Přiměřeně velké, poloprůhledné úchopy kolem čar a hrotů, nepřekrývají důležité kóty; přesun celé kóty za střed, konce zvlášť.
- Název případné cílové složky pro export či zálohu nemá být natvrdo „Zaměřovač“; má vycházet z aktuálního názvu aplikace (příklad při přejmenování: „Měřák – Zapletal“). Návrh do budoucna, vyžaduje návrh migrace/potvrzení.
- Funkce mají být vysvětlené srozumitelnými názvy/popisky, ne jen nejasnými ikonami.


- **Příprava na vícejazyčnost (schválená, zatím bez změny kódu):** [Plán lokalizace](LOKALIZACE_PLAN.md) · [Úkol #14](https://github.com/zaplikj30-ui/Zamerovac-android/issues/14). Nyní zůstává vše v češtině; jazykové klíče se budou bezpečně přidávat jen k nově opravovaným funkcím. **Nově schválená položka Nastavení „Jazyk aplikace“** nabídne pouze „🇨🇿 Čeština“, ale architektura bude připravena na desítky jazyků v jejich vlastních názvech a písmech, vyhledávání, různá locale a případné RTL. Další jazyky nyní nejsou dostupné.

## 3. Co má umět – cílový funkční celek
- **Zakázky a data:** vytvořit zakázku a adresu, členit do složek, ukládat původní fotografie/PDF/video a editovatelné anotace, hledat, zálohovat, exportovat/importovat včetně podsložek; přežít restart a aktualizaci.
- **Kótování a kreslení:** běžné kóty, čáry, šipky, nepravidelná plocha, obdélník, kruh/elipsa, lomená čára, volná ruka, úhly, dimenzní i kumulativní řetězce; S Pen, přesné posouvání a přichytávání s možností úplného vypnutí.
- **Poznámky a přílohy:** textové, hlasové a fotografické poznámky přímo u místa ve snímku, včetně příloh a případné vlastní kresby.
- **Bosch:** přímý přenos naměřené hodnoty do vybrané kóty/úseku a historie; chování reálně ověřit s fyzickým měřidlem a příslušným protokolem.
- **Prohlížení a symboly:** galerie kótovaných fotografií, přepínání mezi editací a jen prohlížením; rozšiřitelná knihovna symbolů v kategoriích.
- **Offline a synchronizace:** plně použitelné bez internetu; možnost přenášet zakázky mezi telefonem a tabletem bezpečným způsobem, bez ztráty místních úprav. Google Disk vyžaduje samostatné ověření přenosu.
- **Další aplikace:** S Pen poznámky/skici uvnitř Zaměřovače; uživatel by ideálně chtěl kontinuitu se Samsung Notes, avšak plná obousměrná automatická synchronizace není potvrzena jako technicky dostupná.

## 4. Možná do budoucna – dobrý nápad, rozhodneme později
Tento seznam obsahuje dříve zmíněné nebo odložené směry. O přesném provedení a prioritě rozhodneme zvlášť.
**Význam této kategorie:** „Možná dobrý nápad“, „uvidíme“, „necháme na později“, „zatím se nerozhodnu“. Tyto položky **nejsou ani zamítnuté, ani schválené pro vývoj**. Žádný termín ani automatické programování. U každé větší možnosti uvést varianty, klady/zápory a poslední doslovně podloženou dohodu. Až uživatel rozhodne, přesunout do schváleného plánu.

- Propojení fotografií s půdorysem místnosti.
- Porovnávání dvou fotografií vedle sebe.
- Šablony zakázek, karta zákazníka.
- Další pokročilé chování magnetického přichytávání.
- Výměna podkladové fotografie se zachováním editovatelných kót.
- Lepší práce s poznámkami/S Pen a hledání možností propojení se Samsung Notes, pouze pokud to dostupná rozhraní umožní.
- Vylepšené srozumitelné popisky/editor a změna názvu aplikace/složek, pokud se na tom dohodneme.

### Dlouhodobý směr: propojení Zaměřovače a Konfigurátoru–Nářezáku

**Dohoda 4. 11. 2026. Stav: DLOUHODOBÁ VIZE, nikoli schválení slučování aplikací či okamžité implementace.** Zaměřovač a [Konfigurátor – Nářezák Android](https://github.com/zaplikj30-ui/Konfigurator-Narezak-Android) jsou **dva samostatné projekty**, které se nyní vyvíjejí, testují, ukládají a aktualizují nezávisle. Nezaměňovat je ani s projektem „Převaděč spojitosti“. Cílovou možností je **jeden profesionální systém pro zakázkovou výrobu nábytku**, na Androidu (telefon/tablet) a Windows PC. O skutečném sloučení, technologii a termínu se rozhodne později.

#### Jedna zakázka – od zaměření po výrobu
V jednom přehledném uživatelském celku má být možné:
1. **Zaměření:** založit zakázku, vytvořit strukturu prostorů a složek, uložit původní fotografie, kóty, rozměry, náčrty, poznámky, přílohy a měření laserem.
2. **Návrh:** na základě zvolených zaměřených rozměrů navrhovat a dále upravovat jednotlivé skříňky a další nábytek (rozměry, konstrukce, dveře, zásuvky, návaznosti na místnost).
3. **Kusovník:** z platné konstrukce získat přesné jednotlivé dílce, množství, materiály, tloušťky, hrany, směr dekoru, kování a další potřebný materiál.
4. **Nářezák:** převzít schválené dílce do nářezového plánu, kontrolovat a optimalizovat formáty tabulí, prořez, orientaci dekoru a proveditelnost skutečného řezání.
5. **Výrobní dokumentace:** vygenerovat či exportovat přehledné podklady pro výrobu a montáž včetně rozměrů, kusovníku, hranování a nářezů; zachovat vazby na konkrétní revizi konstrukce.
6. **Pokračovat na stejném projektu** z telefonu, tabletu a později i plnohodnotného Windows PC editoru, nikoli pouze prohlížeče či exportéru.

**Princip modulárního uživatelského řešení:** možné budoucí oblasti **Zaměření / Návrh / Kusovník / Nářezák**, propojené přes jednu zakázku a jasně definované datové vazby. Výsledné UI může být jiné na telefonu, tabletu a PC; funkční význam a editovatelnost údajů zůstávají stejné. **Toto není rozhodnutí, že se musejí oba současné repozitáře nebo kódy nyní spojit.**

#### Závazné zásady už při současných opravách
- **Zachovat oba programy samostatné a funkční.** Bez přímé runtime závislosti na druhé aplikaci, bez společného balíčku, předčasného API či přesunu zdrojového kódu jen kvůli možné integraci.
- **Sdílený koncept zakázky a stabilní identity – pouze návrhové pravidlo do budoucna.** Zakázka, místnost, zaměřený bod, fotografie, anotace, návrh skříňky, dílec, materiál, kování a výrobní výstup mají být jednoznačně identifikovatelné a provázané. Současná data **nepřečíslovávat** bez samostatně schválené a otestované migrace.
- **Otevřené, dokumentované a verzované datové kontrakty:** přenositelné schéma bez závislosti na Android UI nebo budoucím Windows UI. Jasné jednotky, souřadnicové systémy, význam rozměrů (nominální/skutečné, čisté/hraněné), materiály a orientace dílců. Nepředpokládat, že geometrická vzdálenost v pixelech fotografie = skutečný výrobní rozměr.
- **Přenos bez ztráty editovatelnosti:** zachovat originální fotografie, geometrické objekty, jejich ID/souřadnice/kóty, poznámky, přílohy i změnové údaje. Měřené hodnoty se případně přenášejí s kontextem, jednotkou, zdrojem a návazností na konkrétní návrh, nikoli jako neidentifikovaný řetězec.
- **Jasná hranice mezi měřením, návrhem a výrobou:** použití rozměru z fotografie pro skříňku musí být **vědomá uživatelská volba**; pozdější změna zaměření **nesmí bez potvrzení** přepočítat hotovou skříňku, kusovník, nářez či exportovanou výrobní dokumentaci. Před případným přepočtem ukázat dopad a zachovat předchozí revizi.
- **Bezpečná obousměrná práce Android ↔ PC a offline:** návrh do budoucna počítá se synchronizací, přerušeným přenosem, konflikty, verzováním, kontrolou úplnosti a prevencí tichého přepsání souběžných změn. **Konkrétní cloud/LAN/offline protokol a způsob řešení konfliktů zatím nevybrán.**
- **Kompatibilita:** při změně interních datových struktur dnešních aplikací zachovat čtení starých projektů a ZIP záloh; nové přenosy/závislosti vyžadují testy a bezpečnou migraci. Žádné rozsáhlé zásahy do hotových funkcí bez skutečné potřeby.
- **Výrobní bezpečnost:** automatické kusovníky a nářezy nesmějí být označené za správné bez rozměrových kontrol, referenčních modelů, reálné proveditelnosti a uživatelského ověření; propojení samo o sobě správnost výroby nedokazuje.

#### Co dnes existuje a co je zatím představa
| Oblast | Stav |
|---|---|
| Zaměřovač na Androidu, editovatelné anotace, JSON `schema: 1`, ZIP zálohy | **Existující kód**, konkrétní známé chyby a chybějící funkce popsány v [auditu 28 testů](AUDIT_KODU_PROTI_28_TESTUM.md); není vše dozkoušené na zařízení |
| Konfigurátor–Nářezák Android | **Samostatně rozvíjený projekt**; [vlastní vize](https://github.com/zaplikj30-ui/Konfigurator-Narezak-Android/blob/main/VIZE_A_PLAN.md) a README výslovně neoznačují výrobní výpočty a nářezák za ověřené |
| Společné datové schéma a identita stejné zakázky v obou aplikacích | **NENAVRŽENO jako hotový závazný kontrakt, NEIMPLEMENTOVÁNO** |
| Automatické předávání kót → skříněk → dílců → nářezů | **BUDOUCÍ VIZE, NEIMPLEMENTOVÁNO** |
| Jeden integrovaný program/moduly, Windows PC editor a společná synchronizace | **BUDOUCÍ VIZE, NEIMPLEMENTOVÁNO** |

**Podrobnosti k současnému JSON/ZIP a budoucím vazbám:** [DATOVY_FORMAT_A_PC_KOMPATIBILITA.md](DATOVY_FORMAT_A_PC_KOMPATIBILITA.md). **Druhý samostatný projekt:** [Konfigurátor – Nářezák Android](https://github.com/zaplikj30-ui/Konfigurator-Narezak-Android).

**Povinnost upozornit:** Když při nynějších opravách narazíme na návrh, který by zásadně komplikoval budoucí propojení (např. přepis původních fotografií, ztráta identity/editovatelnosti, nedefinované jednotky, nevratné exporty, tichá změna hotového nářezu), vysvětlit konkrétní riziko a navrhnout přiměřenou variantu. **Současná priorita zůstává stabilita, bezpečnost dat a dokončení schválených oprav každé aplikace.**

### Upřesněná dlouhodobá vize: jeden systém pro celý proces zakázkové výroby

**Upřesnění 4. 11. 2026. Stav: DLOUHODOBÁ VIZE, NIKOLI SCHVÁLENÍ OKAMŽITÉ IMPLEMENTACE.** Předchozí [vize propojení Zaměřovače a Konfigurátoru–Nářezáku](https://github.com/zaplikj30-ui/Konfigurator-Narezak-Android/blob/main/VIZE_A_PLAN.md) zůstává v platnosti, ale její cílový rozsah se **rozšiřuje o návrh místnosti, půdorys, 3D a čelní pohledy, kalkulaci ceny, výrobní/montážní režim, kontroly chyb a historii revizí**. Má vzniknout možnost profesionálního pracovního prostředí pro zakázkovou výrobu nábytku na Android telefonu, tabletu a plnohodnotném Windows PC; konkrétní technologie, podoba jedné aplikace / propojených modulů, termín a synchronizace jsou **nerozhodnuté**.

#### 1. Jedna zakázka pro celý výrobní proces
Uživatel v budoucnu založí např. **„Kuchyň Novákovi“** a bez opakovaného ručního zadávání údajů postupuje v téže zakázce:
1. **Zaměření a záznam podkladů:** místnost/nábytek, fotografie, laserové i ruční kóty, poznámky, přílohy, překážky a instalační body.
2. **Návrh prostoru:** skutečný **2D půdorys**, volně prohlížitelný **3D návrh místnosti** a samostatný **čelní/nástěnný pohled na každou stěnu** s okny, dveřmi, zásuvkami, vodou, odpadem, výklenky, skříňkami a dalšími prvky. Tyto pohledy jsou **budoucí požadavek**, nikoli potvrzená schopnost současného Zaměřovače.
3. **Návrh nábytku:** skříňky, konstrukce, dílce, materiály, hrany, dekory, kování, pracovní desky, sokly a související součásti.
4. **Kusovník a seznam materiálů:** automaticky odvozený seznam všech dílců, rozměrů, množství, olepených hran, materiálů, kování a potřebných položek pro konkrétní návrh.
5. **Nářez a výroba:** převod dílců do nářezáku, optimalizace rozložení a respektování skutečné proveditelnosti řezů, prořezu, orientace dekoru a hran; výrobní dokumentace.
6. **Kalkulace a nabídky:** ocenění skutečných položek a práce pomocí **uživatelsky nastavitelných pravidel**, porovnání variant, předpokládaný zisk a cenová nabídka.
7. **Příprava výroby a montáž:** přehled skříněk, dílců, hran, nářezů, montážních rozměrů, poznámek a podkladů i **bez internetu**.
8. **Pokračování v téže zakázce** na telefonu, tabletu nebo Windows PC se zachováním samostatně editovatelných podkladů.

#### 2. Bezpečné propojení zaměření a návrhu
- Převzít lze zvolené délky stěn a další míry, **polohy oken, dveří, zásuvek, vody, odpadu, instalací a překážek**, s příslušným bodem/stranou, orientací a jednotkou.
- Uživatel určí, **který údaj použít** pro konkrétní objekt návrhu. Automatický přenos smí zrychlit práci, ale nemá nahrazovat kontrolu místa, směru, jednotek a geometrické návaznosti.
- **Pozdější změna zaměření nesmí bez potvrzení změnit již schválený návrh.** Systém může upozornit na rozdíly a nabídnout aktualizaci s přehledem dopadu.

#### 3. Kusovník a nářezák vázané na revizi návrhu
- Z parametrické konstrukce vznikají jednotlivé dílce s typem, rozměry, množstvím, materiálem, tloušťkou, hranami **podle konkrétní strany**, orientací dekoru a kováním. Kusovník musí mít jasnou návaznost na skříňku, zakázku a revizi.
- Dílce se **bez ručního přepisování** předají do nářezáku; nářezový plán zná původní dimenze a skutečné výrobní podmínky.
- Po změně rozměru skříňky systém zjistí **dotčené dílce**, zobrazí **návrh** změny kusovníku a nářezu a vyžádá schválení před zásahy do hotových výrobních výstupů. Historie předchozí varianty zůstane dostupná.
- **NIKDY automaticky nepřehazovat délku a šířku jen podle větší hodnoty**, nepřevracet související hrany a nerespektovat směr dekoru. Zachovat uživatelem definovanou orientaci, bez níž by se mohly chybně vyrobit dílce.

#### 4. Budoucí modul kalkulací – otevřený, nastavitelný model
Počítat s volitelným budoucím naceněním podle **skutečně použitých materiálů, dílců, kování a všech dalších položek**, nikoli s jediným natvrdo zakódovaným způsobem ceny. Možnosti:
- více dodavatelů, ceníků, cenových období a variant materiálů;
- skutečné **nákupní ceny**, individuální slevy, prodejní ceny a rozdíly mezi nimi;
- součet materiálových nákladů včetně hran, kování a ostatních položek;
- ocenění vlastní **práce**, času, dopravy, spotřebního materiálu a dalších nákladů;
- **vlastní přirážky, koeficienty, pravidla výpočtu, náklady a marže**, upravitelné dle konkrétní zakázky;
- porovnání alternativních variant a přehled předpokládaného **zisku**;
- tvorbu a export přehledných **cenových nabídek** zákazníkovi.
**Bez současného zavedení modulu, bez povinného dodavatele a bez pevně zakódované cenové formule.** Daňové režimy, pravidla kalkulace, ceny a marže se nesmějí v datovém formátu zaměnit.

#### 5. Historie, varianty a bezpečné přepočty
- Budoucí **revize zakázky, zaměření, návrhu, kusovníku, nářezového plánu a kalkulace**; přehled rozdílů mezi variantami a případné obnovení staršího stavu.
- Výrobní dokument má odkazovat na konkrétní **schválenou revizi**. Při změně vstupních měření nebo konstrukce předložit dopady a **nepřepsat tiše vydaný nářez, kusovník, nabídku či montážní podklady**.
- Automatická nabídka přepočtu je v pořádku; **automatická destruktivní změna bez potvrzení není**.

#### 6. Budoucí offline režim výroby a montáže
- Pracovní přehled pro výrobu, pilu a montáž: identifikace skříněk, dílců, všech hran, materiálů, rozmístění, nářezové plány, montážní míry, postupy, přílohy a poznámky.
- Podklady použitelné **offline** a konzistentní s revizí zakázky, bez nechtěného přepsání při pozdější synchronizaci.
- Uživatel si může kontrolovat stav výroby/montáže; konkrétní pracovní tok a ovládání zatím nejsou rozhodnuté.

#### 7. Automatické kontroly a upozorňování na chyby
Jako **budoucí možnost** prověřovat alespoň:
- neshodné součty navazujících rozměrových kót;
- chybějící míry, neúplné zaměření a nejasné podklady;
- **kolize skříněk** s konstrukcí místnosti, okny, dveřmi, instalacemi a překážkami;
- chybějící nebo nesprávně přiřazený **materiál, hrana, orientace** či kování;
- rozpor mezi aktuálním **návrhem, kusovníkem a nářezovým plánem**.
Kontrola má **upozornit a vysvětlit konkrétní nesrovnalost**. Bez výslovného rozhodnutí uživatele nesmí opravou automaticky změnit výchozí data, návrh ani výrobní podklady.

#### 8. Společný technický základ – zásady pro dnešní i budoucí vývoj
**Závazné pravidlo současných změn je neblokovat budoucí propojení, ne rovnou vytvářet společnou databázi:**
- jednoznačná identita zakázek, místností, měření, fotografií, grafických objektů, skříněk, sestav, dílců, materiálů a výstupů; možnost propojení s přesně definovaným původem dat;
- dokumentované a **verzované** datové struktury a migrace; oddělení datových modelů od Android/Windows UI a jazykových textů;
- originální média, grafické prvky, parametry skříněk a poznámky **samostatně editovatelné**, nikoli jen rasterizované náhledy;
- přesně definované jednotky, orientace, referenční body, rozměry a pravidla převodu;
- možnost **Android ↔ Windows PC**, offline práce a budoucí bezpečné synchronizace s detekcí konfliktů a bez tiché ztráty dat;
- možnost rozdílných uživatelských rozhraní a modulů nad společným sémantickým základem;
- **import/export do jiných programů**, aby se data nestala uzamčenými v jednom dodavatelském řešení; konkrétní formáty a rozsah budou vybrány později.
**Nyní se nezavádí sdílené schéma/databáze ani cloudový server a nemění se existující `schema: 1` bez bezpečné migrace a testů.** Detailní přenositelnost je v [DATOVY_FORMAT_A_PC_KOMPATIBILITA.md](DATOVY_FORMAT_A_PC_KOMPATIBILITA.md).

#### 9. Samostatnost a budoucí moduly
- **Zaměřovač** i **Konfigurátor – Nářezák** zůstávají samostatně spustitelné, použitelné a testované Android aplikace.
- Budoucí části **Zaměření, Návrh, Kusovník, Nářezák**, případně **Kalkulace, Výroba a Montáž, Kontroly**, se mohou jednou stát moduly jedné aplikace nebo propojenými programy. **Forma propojení není rozhodnutá.**
- Návrh **půdorysu/3D/stěnových pohledů** a návaznosti na jiný samostatný projekt nelze považovat za hotovou implementaci nebo za pokyn nyní spojovat třetí repozitář.
- Jiní dodavatelé, systémy a výměnné formáty mohou být později napojeny přes záměrně oddělené rozhraní; dnes bez předčasného API a závislostí.

#### 10. Stav, priorita a pravidla pro další práci
| Oblast | Současná skutečnost / stav rozhodnutí |
|---|---|
| Zaměřovač Android (zakázky, fotografie, anotace, lokální data a ZIP) | **Částečný existující kód, některé známé chyby.** Podrobnosti v [auditu](AUDIT_KODU_PROTI_28_TESTUM.md); funkčnost každé části vyžaduje reálný test. |
| Konfigurátor–Nářezák Android (návrh, dílce a nářezák) | **Samostatně vyvíjený projekt.** Plnohodnotné výrobní výpočty a použitelný nářez nejsou tímto zápisem prokázané. |
| Bezpečnost dat, identifikátory, exporty, editovatelnost při dnešních opravách | **Schválené průřezové zásady**, dodržovat při prováděných změnách, neotevírat bezdůvodnou migraci. |
| Jedna společná zakázka, 2D/3D/stěny, automatické propojení zaměření → návrh → kusovník → nářez | **Budoucí funkční vize – NENAPROGRAMOVAT bez další dohody.** |
| Kalkulace, ceníky, zisk, nabídky, historie revizí, výrobní/montážní režim, automatické kontroly | **Budoucí možnosti – NEIMPLEMENTOVANÉ, bez závazného pořadí či termínu.** |
| Windows 11 plnohodnotný editor, bezpečný Android/PC sync a multi-platformní konfliktové řízení | **Budoucí možnost – NEROZHODNUTÁ technologie, bez zahájení vývoje.** |
| Vícejazyčnost, možnost veřejného Google Play | **Schválená postupná česká lokalizační příprava** podle [Issue #14](https://github.com/zaplikj30-ui/Zamerovac-android/issues/14); další jazyky a Google Play jsou dlouhodobé možnosti. |
| Aktuální další krok | **Přednostně domluvené opravy a testování obou samostatných aplikací.** Nic z budoucích modulů nepřidávat bez výslovného odsouhlasení. |

**Povinnost vývojáře:** objeví-li se při současné práci rozhodnutí, které výrazně ztíží propojení (nevratná serializace, přepis originálních fotografií, chybějící ID, nedefinovaná orientace hran, nepřenosné formáty, neřízené přepočty), **upozornit na konkrétní důsledek a navrhnout bezpečnější řešení**. Vždy držet prioritu **spolehlivost → bezpečnost dat → přesnost a funkčnost → jednoduché ovládání**, teprve pak nové ambice.

### Dlouhodobý směr: plnohodnotný Zaměřovač pro Windows 11 a společné zakázky

**Zapsáno 4. 11. 2026. Stav: SCHVÁLENÁ DLOUHODOBÁ VIZE / SMĚR, NIKOLI SCHVÁLENÉ ZAHÁJENÍ VÝVOJE PC APLIKACE.** Cílová platforma je primárně **Windows 11**. Konkrétní technický stack, rozsah první PC verze, metoda synchronizace a termín se rozhodnou až později. **Nyní se PC aplikace nezačíná vyvíjet a Android se kvůli ní zásadně nepřepisuje.**

#### Co znamená „plnohodnotná PC verze“
1. **Stejné zakázky** jako na Android telefonu či tabletu: otevření celé stromové struktury složek, názvů, fotografií, médií a dalších příloh.
2. **Skutečný editor, ne prohlížeč:** na PC vytvářet a upravovat nové i převzaté fotografie a jejich kóty, čáry, šipky, kruhy, elipsy, texty, poznámky, symboly a další grafické prvky.
3. **Zachování editovatelnosti:** každá kóta a anotace zůstane samostatným objektem, nikoli vypálenou vrstvou do obrázku. Lze zadat či změnit hodnotu, posouvat jednotlivý bod i celý objekt, doplnit, odstranit či změnit vzhled; zachovat správnou geometrii i informaci o rozměrech.
4. **Samostatná práce na PC:** zakládat nové zakázky a složky a přidávat fotografie a přílohy přímo z Windows.
5. **Obousměrný přenos:** změny provedené na PC se musí dát přenést do Androidu a opačně; neztratit původní snímek, editovatelné vrstvy, kóty, poznámky, historii a přílohy, které jsou součástí zakázky.
6. **Cílově co nejméně ručních kroků:** do budoucna preferovat synchronizaci bez opakovaného exportu/importu. Cloud, lokální síť, souborové balíčky, účet a případná šifrování/technologie **zatím nejsou rozhodnuté**.
7. **Práce offline:** Android i PC musí umět bezpečně pokračovat bez internetu a později přenést vlastní změny.
8. **Žádné tiché přepsání nebo ztráta práce:** počítat se současnými změnami stejné zakázky na více zařízeních, konflikty, neúplnými přenosy, duplicitami a rozdílnými verzemi aplikace. Neřešit je naivně pravidlem „poslední přepis vyhrává“ bez bezpečnostních opatření.
9. **Rozdílné ovládání je v pořádku:** PC může mít myš/klávesnici a jiné rozložení než dotykové zařízení/S Pen. Obě aplikace však musejí **stejná data interpretovat stejně**; přesnost kót a geometrie nesmí záviset na platformě.
10. **Není cílem jen export hotového JPG/PDF:** bitmapové nebo tiskové výstupy jsou doplňkem, nesmějí nahradit editovatelné údaje zakázky.

#### Pravidla pro dnešní vývoj Androidu, která pomohou bez velkého přepisování
- **Datový formát nezávislý na Androidu:** ukládat originální fotografie odděleně od editovatelných prvků; používat přenositelné a zdokumentované struktury a jasně definované jednotky, souřadnicové systémy, typy a vlastnosti objektů.
- **Stabilní identita:** zakázky, složky, fotografie, anotace i přílohy mají mít jednoznačné a při budoucí výměně dohledatelné identifikátory. Na PC musí být možné rozhodnout, zda jde o tentýž objekt nebo o nezávislou kopii.
- **Verzování a migrace:** vést verzi datového formátu, držet zpětnou kompatibilitu, testovat otevření starších projektů a nikdy neměnit význam polí tiše. **Neměnit současné `schema: 1` bez návrhu otestované migrace.**
- **Přenos a bezpečnost:** vždy chránit strukturu složek, metadata, kompletní mediální vazby a všechny úpravy; ověřovat konzistenci a použitelnost záloh a později i obnovu po přerušeném přenosu.
- **Budoucí souběh úprav:** nyní pouze neblokovat možnost bezpečné synchronizace, teprve později rozhodnout postup detekce a řešení konfliktů, slučování a historie změn.
- **Nezaměňovat import zálohy a synchronizaci:** současný import ZIP na Androidu vytváří nové identifikátory a obnovenou kopii. To je **jiná operace** než pozdější aktualizace stejné zakázky mezi zařízeními. Nesmí se bez návrhu pokoušet obě funkce ztotožnit.
- **Průběžná dokumentace a testy:** při skutečně prováděné změně datového formátu zkontrolovat staré projekty a export/import; zapisovat změnu do [DATOVY_FORMAT_A_PC_KOMPATIBILITA.md](DATOVY_FORMAT_A_PC_KOMPATIBILITA.md). Připravovat přenositelnost postupně, zejména při současných opravách ZIP, poznámek, objektů a obnovy.

**Technická poznámka k dnešnímu stavu (statická inspekce):** [DATOVY_FORMAT_A_PC_KOMPATIBILITA.md](DATOVY_FORMAT_A_PC_KOMPATIBILITA.md) rozlišuje současnou podobu `schema: 1`, `records`, `items` a ZIP `projects.json` / `media-meta.json` / `media/` od **nedořešených** podmínek budoucího PC přenosu. Není to ještě standard synchronizace ani hotový veřejný formát.

**Pravidlo upozornění:** Pokud při opravách Androidu vznikne návrh, který by zásadně blokoval přesnou editaci na PC, společné zakázky, bezpečnou migraci či obousměrný přenos, **upozornit předem** na konkrétní riziko a nabídnout kompatibilní variantu s rozumným rozsahem zásahu. Nevydávat budoucí PC verzi za důvod k rozsáhlému současnému přepisu.

**Aktuální priorita:** opravit a otestovat domluvených 28 kontrol Zaměřovače a schválené doplňky, bezpečně zachovat data a češtinu. **Žádný PC build, synchronizační služba ani nový datový formát nejsou tímto zadáním schválené k okamžité implementaci.**

### Možný dlouhodobý cíl: veřejné vydání na Google Play (nezávazné)

**Zapsáno 4. 11. 2026. Stav: MOŽNOST DO BUDOUCNA – NENÍ SCHVÁLENÉ VYDÁNÍ, TERMÍN, PRIORITA ANI ZÁVAZEK.** Smyslem projektu je především **profesionální, stabilní, přesný a spolehlivý Zaměřovač pro zaměřování nábytku**, vhodný i pro každodenní vlastní práci. Veřejné vydání na **Google Play** je pouze jedna z možností, o které se může uživatel rozhodnout až později. Neusilovat o vydání za každou cenu ani pod časovým tlakem.

**Pořadí priorit (závazné pro současná vývojová rozhodnutí):**

**Spolehlivost → bezpečnost zákaznických dat → přesnost a funkčnost → jednoduché ovládání → kompatibilita → případné veřejné vydání.**

**Pravidla kompatibilního, ale přiměřeného vývoje:**

1. **Bez zbytečného přepisování:** nové funkce navrhovat s ohledem na možnost veřejné distribuce, ale neměnit stabilní části aplikace jen kvůli hypotetickému Google Play. Současné domluvené opravy, ověřování a každodenní použitelnost mají přednost.
2. **Lokalizace a rozměry displeje:** pokračovat v architektuře [LOKALIZACE_PLAN.md](LOKALIZACE_PLAN.md) pro desítky jazyků, různá písma, délky textů, místní formáty a případně RTL; dnes jen čeština. Přizpůsobivé rozložení pro telefony i tablety, různé úhlopříčky a hustoty pixelů, včetně S Pen tam, kde je dostupný.
3. **Android ekosystém:** vyhýbat se neodůvodněným závislostem na jednom výrobci, verzi Androidu nebo specifické nadstavbě. Testovat na dostupných zařízeních; kompatibilitu s jinými značkami a verzemi Androidu označit za ověřenou **až po skutečném testu**, nikoli jen proto, že aplikace používá standardní Android API.
4. **Rozšiřitelné měřicí přístroje:** oddělit obecné rozhraní měření (připojit, odpojit, naměřená hodnota, jednotka, stav, historie/chyby) od adaptérů jednotlivých výrobců a modelů. **Nepředpokládat jediný univerzální Bluetooth protokol.** Každý podporovaný laser může mít jiné BLE služby, charakteristiky, způsob párování, oprávnění, příkazy a chování při výpadku. **Ověřeno pro konkrétní model** uvést jen po reálném testování s tímto modelem; nevytvářet nepravdivý seznam kompatibility.
5. **Zákaznická data jsou přednější než nové funkce:** zachovávat bezpečné lokální ukládání, konzistentní transakční operace, obnovu z koše, bezpečné zámky, ZIP export/import, úplnost příloh, zpětnou kompatibilitu a aktualizace bez ztráty fotografií, kót, zakázek, poznámek či měření. Změny datového formátu vyžadují otestovaný migrační a návratový postup.
6. **Automatické a regresní testy:** postupně doplňovat jednotkové, integrační a uživatelské scénáře včetně bezpečnosti dat, kreslení, úchopů, laseru, offline režimu, obnovy, aktualizace a rozličných obrazovek/Android API. Jasně oddělovat *kód existuje*, *test běžel*, *test prošel* a *ověřeno na fyzickém zařízení*.
7. **Rozumná připravenost na Play:** u nového kódu preferovat standardní Android API a obecně správné oprávnění, zásady přístupu k souborům, zabezpečení a ochranu soukromí. Konkrétní aktuální požadavky Google Play (např. cílová API úroveň, formuláře, pravidla publikování) **ověřit až při případném rozhodování o vydání**; mohou se měnit. Nepřizpůsobovat dnešní vývoj neověřeným budoucím pravidlům.
8. **Budoucí produkční distribuce:** neplést interní testovací/debug sestavení a jeho podpis s produkčním vydáním. Pokud se rozhodneme pro zveřejnění, samostatně připravit produkční sestavení a bezpečnou správu podpisových klíčů, minimální potřebná oprávnění, přístupnost, informace o ochraně soukromí a distribuci; teď tím nezatěžovat každodenní vývoj. Testovací podpisové údaje z repozitáře **nikdy nepoužívat jako produkční tajemství**.
9. **Bez komerčních/právních kroků předem:** **nyní nezakládat vývojářský účet** jen kvůli této možnosti, nezavádět reklamy, předplatné, platby, povinnou registraci, analytiku ani jiné funkce, které aplikace nepotřebuje. Případný obchodní model a pravidla ochrany soukromí se budou řešit až po samostatném rozhodnutí.
10. **Neomezovat současného uživatele:** nevypínat funkce, nepřidávat omezení ani neměnit způsob používání jen kvůli hypotetickému veřejnému vydání. Jednoduché offline používání a kontinuita stávajících zakázek musí zůstat zachované.

**Pravidlo upozornění na budoucí problém:** Jestliže se při další opravě nebo architektonické volbě ukáže řešení, které by **významně ztížilo případné zveřejnění** (např. nevratný datový formát, nepřenosná vazba na jediný hardware, zbytečně široká oprávnění, nebezpečné podepisování či pevné české texty v nové logice), upozornit uživatele **konkrétně na riziko**, nabídnout přiměřenou alternativu a vyčíslit kompromis v rozsahu práce. **Nepoužívat hypotetické Play jako záminku k rozsáhlému refaktoringu bez domluvy.**

**K případnému přechodu do plánu vydání** dojde teprve po výslovném rozhodnutí uživatele a samostatné kontrole stability, kompatibility, právních/obchodních požadavků, zásad obchodu a skutečných testů. Do té doby je toto **nezávazný dlouhodobý směr, nikoli úkol „vydat APK na Google Play“.**

## 5. Aktuálně zaznamenané otevřené body a testování
- Podrobný kontrolní seznam 49 úprav: [Issue #12](https://github.com/zaplikj30-ui/Zamerovac-android/issues/12).
- Průběžný testovací deník: [Issue #13](https://github.com/zaplikj30-ui/Zamerovac-android/issues/13).
- Rekonstrukce 28 historických testů je dokončena ve třech souborech; implementaci a funkčnost aktuální APK je potřeba ověřit samostatným auditem a retestem.
- K dalšímu praktickému testu byl domluven **test 29 – offline**.
- Při dosavadním zkoušení bylo hlášeno, že ZIP není vidět ve výběru importu; zapsat jako otevřený problém k ověření/opravě, nikoliv jako hotovou opravu.

## 6. Jak budeme tento dokument udržovat
- Při novém nápadu zapsat do „Nápady / možnost do budoucna“; nápad **není automaticky závazek**.
- Po společném rozhodnutí přesunout do „Dohodnuto / plán“ a napsat přesně očekávané chování, prioritu, návaznosti a rozhodnutí.
- Implementace a testování se sledují samostatně v issues: **Nápad → Probráno → Dohodnuto → V plánu → Implementováno → Ověřeno na zařízení**; také „Odloženo“ nebo „Zrušeno“.
- Vše podstatné včetně toho, **proč jsme se rozhodli**, zapisovat při aktivní práci na GitHub a poslat odkaz. Po cca 5–8 kontrolách nebo před změnou chatu aktualizovat stav.
- Když se vize změní, **aktualizovat současnou podobu** a přidat krátkou změnu do historie. Historické dohody nezaměňovat za platný plán.
- Tento soubor popisuje **cílový směr, ne potvrzení, že všechny vyjmenované funkce již fungují**.

## 7. Historie rozhodnutí o směru
| Datum | Co bylo dohodnuto |
|---|---|
| 2026-11-04 | Udržovat také dlouhodobou podobu aplikace, budoucí nápady, plánované změny a rozhodnutí. Vize se může měnit. |
| 2026-11-04 | Schválena bezpečná příprava vícejazyčnosti, řádek „Jazyk aplikace“ s jedinou volbou 🇨🇿 Čeština; bez samostatné APK. [Issue #14](https://github.com/zaplikj30-ui/Zamerovac-android/issues/14). |
| 2026-11-04 | Nové upřesnění: škálovat na desítky jazyků, vyhledávání, autonyma, různé skripty/formáty a RTL; v příští aktualizaci pouze česká volba, ostatní opravy mají přednost. |
| 2026-11-04 | Možné budoucí vydání na Google Play pouze jako nezávazný směr. Vývoj má přednostně zajistit spolehlivost, bezpečnost dat, přesnost, jednoduché ovládání a kompatibilitu; bez termínu, reklamy, registrace nebo zbytečných změn kvůli publikování. |
| 2026-11-04 | Doplněna plnohodnotná budoucí PC verze pro Windows 11, stejná editovatelná data a bezpečná obousměrná výměna zakázek. Jde o dlouhodobý směr bez zahájení vývoje, technologického rozhodnutí či termínu. [Technický podklad](DATOVY_FORMAT_A_PC_KOMPATIBILITA.md). |
| 2026-11-04 | Doplněna dlouhodobá vize propojení samostatných projektů Zaměřovač a Konfigurátor–Nářezák do modulárního systému Zaměření → Návrh → Kusovník → Nářezák pro Android i PC. Bez nynějšího slučování či vývoje společné aplikace; důraz na data, jednotky, editovatelnost, bezpečné předávání a ruční schválení změn hotové výroby. |
| 2026-11-04 | Rozšířena vize společného systému: jedna zakázka zahrnuje zaměření, 2D/3D a pohledy na stěny, návrh, kusovník, nářez, nastavitelnou kalkulaci ceny, revize, výrobu/montáž a automatické kontroly; beze změn stávajících aplikací a dat, bez schválení implementace těchto budoucích modulů. |

## 8. Další dohledané drobné náměty a ověřované detaily z testování
Tyto body jsou rozdělené podle původního kontextu; **nesmí se automaticky vydávat za hotové**.
- **Návrh na vylepšení:** barevná ikona výběru fotografie v poznámce; při více fotografiích ukázat první a části dalších náhledů pod ní (test 16).
- **Dohodnuté očekávané ovládání:** samostatně přesouvat text/rozměr při práci se šipkou, nezávisle přesouvat rám poznámky a hrot, mít jemné průhledné označení kóty.
- **K opravě/ověření:** pohyb volné kresby, úchopy kruhu a elipsy, lupa s vycentrovaným bodem, černá plocha při hlášení chyby, import ZIP.
- **Plánovaný test:** obousměrná synchronizace Google Disk, reálný offline provoz a navazující test 29.
- Podrobné výsledky podle čísel jsou v [rekonstrukci 1–28](START_ZDE.md) a statická kontrola současného kódu je v [auditu](AUDIT_KODU_PROTI_28_TESTUM.md); ani jedno nenahrazuje test nové APK.
