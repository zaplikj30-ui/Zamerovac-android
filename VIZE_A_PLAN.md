# Zaměřovač – živá vize aplikace a plán do budoucna
*Založeno 4. 11. 2026. Tento dokument je pracovní představa, **nikoli neměnná specifikace**. Může se průběžně měnit po domluvě s uživatelem.*

## Dlouhodobý technický plán: předcházet chybám a vzájemným konfliktům funkcí (potvrzeno 5. 11. 2026)

**Výslovná priorita uživatele:** vedle požadovaných funkcí má mít Zaměřovač hlavně profesionální a trvale kvalitní vnitřní stavbu. Nové funkce se nesmějí vzájemně rušit, poškodit uložené zakázky, změnit naměřené hodnoty ani znemožnit další rozvoj. Technické zlepšení má ChatGPT navrhovat proaktivně, ne až po upozornění jinou AI. **Uživatel připouští i větší přepracování a opakované testování**, pokud je to objektivně potřebné pro dlouhodobou kvalitu; **konkrétní zásah tím ještě neschvaluje**.

**Pořadí technických kroků (podmíněné skutečnými nálezy, bez termínů):**
1. **Dokončit probíhající #39/PR #41**, zhodnotit ochranu dat, přesnost kót, souběhy a skutečný stav ověření. Nerozbíhat souběžně konkurující přepis rozpracovaných souborů.
2. **Zmapovat, kde se funkce kříží:** zejména editor/galerie, výběr a úchopy, lupa/zoom, Undo/Redo, ukládání a obnova, media, export, Bluetooth měření, koš, synchronizace a přechody mezi obrazovkami. Ověřit existující kombinované scénáře, zanést chybějící do registru testů [#28](https://github.com/zaplikj30-ui/Zamerovac-android/issues/28). Každou hypotézu o chybě potvrdit testem nebo kontrolou konkrétního kódu.
3. **Stanovit hranice společných částí:** samostatný model zakázek, měření a jednotek, geometrie a editovatelných objektů, bezpečné ukládání, soubory a přenos; ovládání telefonu, PC a iPhonu/iPadu řešit odděleně. Předem posoudit kompatibilitu stávajících dat, budoucí Windows a iOS a vhodnost Java/Kotlin/JS/Kotlin Multiplatform či jiných možností podle důkazů.
4. **Zlepšovat postupně i společně s opravami:** vždy nejmenší rozumný bezpečný celek, test původního chování, změna, automatické pozitivní a negativní testy, **kombinované testy spolupráce funkcí**, zhodnocení dopadu na výkon a data. Opravovat důležité chyby hned; nečekat, až bude kompletní přestavba hotová.
5. **Při doložené systémové slabině zvážit větší přepracování:** stručně porovnat postupné úpravy versus cílenou výraznější přestavbu, vysvětlit výhody, rizika, cenu/čas, postup migrace a bezpečného návratu. Vybrat technicky udržitelnou variantu a před zásadní změnou schválit rozsah. Nepřepisovat všechno jen proto, že by nový kód vypadal moderněji.
6. **Kontrola po každé aktualizaci:** zpráva o zlepšeních, zbývajících problémech, kolizích funkcí, přesnosti, ochraně dat, testech a skutečném ověření; objektivní hodnocení a alespoň dva prioritizované návrhy. Uchovávat výsledky a rozhodnutí v [#42](https://github.com/zaplikj30-ui/Zamerovac-android/issues/42), detaily testů v #28, bez duplicit.

**Stav:** schválený dlouhodobý technický směr a pracovní pravidla. **Žádný nový kód, migrace frameworku, rozsáhlý přepis ani APK nejsou touto dohodou samostatně spuštěné.** Cílem je nižší riziko regresí, ochrana reálných dat a dobře udržovatelný základ pro Android, Windows i iPhone/iPad.

### Připravenost na budoucí nové technologie a funkce (upřesnění 5. 11. 2026)

**Požadovaný výsledek:** Nové funkce, technologické výměny nebo další platformy mají být dlouhodobě přidatelné **bez zbytečných regresí, datových ztrát a plošného přepisování**. Není reálné zaručit nulový problém při každé migraci; cílem je promyšlená stavba aplikace, která takové změny usnadní a dovolí bezpečně otestovat i vrátit. Společné datové formáty, kóty, rozměry a pravidla musí zůstat přenositelné mezi Androidem, Windows a iPhone/iPadem; části ovládání nebo připojení k zařízení mohou mít jiné provedení.

**Jak poznáme dobrý návrh:** Nový modul má jasnou odpovědnost; lze ho samostatně otestovat a případně vyměnit; nemění bez důvodu jiné funkce; staré zakázky dál načítá; důležité společné scénáře (uložení, návrat, změna hodnot, export, synchronizace, výpadek) procházejí pozitivními i negativními kontrolami. Technologie volit podle reálné použitelnosti, ne módy. V případě prokázaných zásadních slabin je možné po samostatném odsouhlasení připravit i větší přepracování se záložní cestou a opakovanými testy.

**Stav:** dlouhodobá zásada, ne povel k okamžité migraci ani k vytvoření nové APK. Navazuje na [pravidla kvality #42](https://github.com/zaplikj30-ui/Zamerovac-android/issues/42).

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

### Budoucí samostatné nastavení složitosti ovládání a výkonu vykreslování (námět, nikoli hotová funkce)

**Námět uživatele 4. 11. 2026:** Dva **nezávislé** přepínače v Nastavení, aby budoucí rozsáhlé aplikace vyhovovaly začátečníkům, pokročilým uživatelům i profesionálům a současně výkonným i slabším telefonům. Přesné názvy a počty stupňů se rozhodnou až při návrhu UX.

1. **Složitost ovládání (např. Jednoduché / Běžné / Pokročilé; uživatelská alternativa „amatér / střední / profesionál“):** mění pouze přehlednost, počet zobrazených pokročilých nástrojů, rozsah nápovědy a způsob nabídky funkcí. Nejde o hodnocení schopností člověka, automatické zařazování uživatelů ani o cenový tarif. **Neměnit výpočty, přesnost, obsah zakázek či uložená data.** Pokročilé funkce mají být dostupné na vyžádání a přechod mezi režimy nesmí ztratit nebo skrýt editovatelná data tak, že je nepůjde bezpečně upravovat. Nabídnout jednoduchý přechod bez zakládání nové zakázky a bez restartu, pokud je to technicky možné.
2. **Kvalita / náročnost vykreslování (např. Automaticky [výchozí] / Úsporně / Vyváženě / Vysoká kvalita):** nezávisle na úrovni ovládání dovolí nastavit zátěž 2D/3D vykreslování, náhledů, animací a detailů. Automatika volí rozumné zatížení podle reálných schopností a aktuálních podmínek zařízení (paměť, plynulost, případně teplota/úsporný režim, pokud je lze bezpečně zjistit); neodvozovat výkon jen z označení nebo ceny telefonu. Ruční volba může snížit grafickou náročnost, ale nesmí obejít bezpečnostní limity zařízení ani způsobit pád kvůli vysokému nastavení.
3. **Co se nikdy nesmí změnit:** naměřené délky, rozměry dílců, hrany, orientace dekoru, přesnost kót, výstupy kusovníku/nářezu, originály fotografií, exporty, rozpracované změny a bezpečnost ukládání. Úsporný režim může zjednodušit **pouze vizuální zobrazení**, nikoli výpočet či obsah výrobní dokumentace.
4. **Společné testování v budoucnu:** různé výkonnostní třídy telefonů/tabletů; velké fotky, dlouhé projekty, přepnutí úrovně ovládání i grafiky u otevřené zakázky, restart/obnovení, offline provoz, zachování přiblížení a dat; automatika vs. ruční předvolba a reakce na nedostatek paměti. Obě nastavení ukládat zvlášť mimo zakázková data.

**Stav: jen návrh k pozdějšímu posouzení, žádné aktuální programování, povinné omezení funkcí, rozdělení podle ceny ani sestavení APK.** Zatím zachovat současné jednoduché ovládání a postupné opravy. Budoucí propojení samostatných aplikací je stále pouze vize.

### Nastavení vzhledu: podle systému / tmavý / světlý (nový požadavek k pozdějšímu naplánování)

**Přání uživatele 4. 11. 2026:** Aplikace má v budoucnu nabídnout v Nastavení přepínání mezi **Podle systému**, **Tmavý režim** a **Světlý režim**. Volba **Podle systému** má reagovat na aktuální světlý/tmavý režim zařízení (i při změně za běhu, pokud to platforma podporuje); ruční volba má mít před systémem přednost. Nastavení se má zachovat při dalším spuštění.

**Bezpečnost a ovládání:**
- Přepnutí motivu **nesmí mazat data, restartovat rozpracovaný editor ani měnit hodnoty kót, výroby, fotografie, jejich obsah, barvy původních snímků nebo význam uložených anotací**. Uživatelské barvy a dobře viditelné pracovní čáry musí zůstat čitelné na každém pozadí.
- Zajistit dobrý kontrast textů, ikon, dialogů a kót, včetně viditelnosti ovládacích úchopů, podporovaných systémových lišt, velkého písma a různých telefonů/tabletů.
- Vizuální barvy oddělovat od výpočtů, uložených zakázek a funkční logiky; používat udržovatelné sdílené barevné role místo nahodilých pevných barev.
- **Současný osvědčený tmavý vzhled nezměnit nečekaně** při aktualizaci. Výchozí chování pro nové a stávající instalace (případně nejprve tmavý pro stávající, systémový pro nové) zvolit až při přípravě implementace a otestovat.
- Postupovat s ohledem na budoucí různé platformy, ale bez vynuceného přepisu rámce či současného kódu.

**Stav:** požadavek do dlouhodobé vize, **není schváleno automatické zařazení do nyní rozpracované aktualizace**. Nejdříve navrhnout rozsah a rizika, vyžádat potvrzení pro konkrétní implementaci, před vydáním otestovat editor, ukládání, offline práci a přepínání motivů. **Nyní pouze dokumentace, bez sestavení APK.**

### Jemný vzor pozadí jako volitelná úprava vzhledu (námět 4. 11. 2026)

**Přání uživatele:** kromě dříve plánovaných možností „Podle systému / Tmavý / Světlý“ mít případně **volitelný jednoduchý, jemný vzor či decentní pozadí v prostředí aplikace**. Nejde o přikreslování vzoru do zdrojových zaměřovacích fotografií, exportů ani do podkladů zákazníka. Konkrétní vzhled a umístění vzoru doladit až před realizací podle uživatelových ukázek.

**Důležité:** zachovat čitelnost textů, náhledů, kót, ikon a ovládání; žádná ztráta dat ani změna skutečných rozměrů. **Nové rozhodnutí uživatele 4. 11. 2026:** do nynější společné aktualizace výslovně zahrnout **úzkou, bezpečnou variantu volitelného decentního pozadí / vzoru aplikace**; výchozí stávající vzhled nezměnit, nezasahovat do fotografií, editoru ani exportů. [Přesný rozsah pro Codex v issue #17](https://github.com/zaplikj30-ui/Zamerovac-android/issues/17). **Zatím schváleno k implementaci, nikoli hotovo; samostatná plná přepínací témata podle systému / světlý / tmavý zde nejsou automaticky schválena.**

### Zákaznický export: ZIP s PDF fotografiemi a zapečenými kótami (námět 4. 11. 2026)

**Uživatelský nápad (4. 11. 2026):** přidat **samostatný typ exportu pro zákazníka**, který uživatel jednoduše pošle jako **ZIP obsahující fotografie ve formátu PDF**, s viditelnými rozměry/kótami, čárami a případnými popisky. **Zákazník nemá dostat editovatelné projekty Zaměřovače** a nemá v aplikaci měnit kóty ani jiné anotace.

**Rozlišení dvou různých exportů, zásadní kvůli datům:**
- **Stávající zálohovací / přenosový ZIP Zaměřovače:** ponechat zachovanou plnohodnotnou obnovu dat a editovatelnost. Nezměnit význam současného tlačítka/exportu ani strukturu zálohy.
- **Nový zákaznický export do ZIP:** PDF se **sloučeným („zapečeným“) výsledným vzhledem** fotografie a všech viditelných anotací, bez vnitřního editovatelného JSON, historie měření, interních poznámek nebo zdrojových projektových dat. Fotografie a kóty mají být v PDF v takové podobě, jak je uživatel schválil k předání. Nesmí dojít ke změně číselných hodnot, jednotek, orientace ani rozložení anotací.
- **Pozor na výraz „nepůjde upravovat“:** znamená **bez editovatelných objektů Zaměřovače**, nikoliv absolutní nemožnost upravit PDF v externím editoru. Nepřislibovat technicky nemožnou ochranu proti všem úpravám souborů.
- Při přípravě implementace doladit **rozvržení výstupu**: jedno PDF za fotografii versus jeden společný PDF dokument (v obou případech výstupní ZIP), řazení stránek/fotografií, názvy souborů, rozlišení a zda přidávat datum, název zakázky či jiné údaje. Nevkládat automaticky osobní nebo interní informace.
- **Regresní požadavky pro pozdější realizaci:** zákaznický export nepoškodí uložená data ani stávající ZIP pro obnovu; exportované PDF skutečně ukazuje všechny zvolené fotografie a správně vykreslené, jasně čitelné kóty i popisky; skutečný výstup prověřit v běžném PDF prohlížeči a ZIP lze normálně rozbalit.

**Nové rozhodnutí uživatele 4. 11. 2026:** schváleno zařazení do **jedné nejbližší společné aktualizace** v bezpečně vymezené základní podobě: **jedno PDF se zapečeným vzhledem na jednu fotografii, více PDF v zákaznickém ZIP, bez interních editovatelných dat**. Původní zálohovací ZIP a jeho obnova zůstávají zcela beze změny; nesmí dojít ke ztrátě nebo změně kót. Přesné zadání a regresní testy: [issue #17](https://github.com/zaplikj30-ui/Zamerovac-android/issues/17). **Schváleno k implementaci, nikoli implementováno nebo sestaveno.**

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

### Samostatný půdorys v zakázce – kreslení rukou s jemným inteligentním narovnáním

**Dohoda k návrhu funkce (4. 11. 2026):** Uživatel chce **samostatnou položku „Půdorys“** ve struktuře zakázky, vedle fotografií, poznámek a složek (např. **+ → Vytvořit půdorys**). V půdorysu má jít kreslit místnost **volně prstem nebo perem** a následně stěny **okótovat ručním zadáním i Bluetooth laserem Bosch**. Podrobně upřesněné pravidlo je **kompromis mezi volným tahem a pomáháním s rovností a pravými úhly** — nikoli násilná změna všech stěn na pravoúhlé.

**Požadované chování narovnávání (výslovně odsouhlasený směr):**

1. **Narovnat nepřesný tah na čistou úsečku**, ale ponechat její **směr a přibližné umístění podle skutečného kreslení**. Volně vedená šikmá stěna zůstane šikmá; narovnání čáry není totéž jako narovnání úhlu na 90°.
2. **Jemné přichytávání k vodorovné, svislé a pravému úhlu:** pokud je záměr z tahu zřejmý a odchylka opravdu malá, aplikace může nenápadně pomoci. Pokud je kresba očividně šikmá nebo je změna směru výraznější, **nesmí ji násilně přetočit**.
3. **Žádné samovolné podstatné zkreslení obrysu:** aplikace nesmí kvůli pravoúhlosti přetáhnout stěnu na nechtěné místo, vytvořit jiné proporce, zrušit šikminu nebo ztratit důležité rohy. Pokud je geometrie nejasná, dát přednost věrnému narovnání jednotlivých tahů před agresivní automatickou úpravou celého půdorysu.
4. **Oprava po nakreslení:** zůstanou editovatelné koncové body, rohy a stěny. Uživatel může změnit konkrétní úhel či bod; vhodný je vypínatelný/přepínatelný jemný magnet. Přesná citlivost přichytávání (úhlový práh, toleranci v pixelech, případně chování při zoomu) se **rozhodne podle prototypu a reálného testování**, nejde o schválené pevné číslo.
5. **Rozměry oddělené od kreslicí nepřesnosti:** ke konkrétní stěně/kótě lze zadat skutečnou délku **ručně nebo přes Bosch**; nerozhodovat o reálných milimetrech pouze podle délky čáry na displeji. Případné automatické přepočítávání geometrie půdorysu podle zadaného rozměru musí být **kontrolované a nesmí bez potvrzení nechtěně přemístit ostatní stěny**.
6. **Samostatný editovatelný dokument:** uložit půdorys jako položku zakázky, se strukturou bodů, stěn, jejich vztahů, rozměrů, kót a případných poznámek; **ne jako jediný nevratný obrázek**. Uložená data musí být přenositelná a připravená k budoucímu použití v návrháři nábytku a na PC.
7. **Budoucí rozšíření (nyní nerozhodnutý rozsah):** dveře, okna, zásuvky, voda, odpad, překážky, pomůcky při zaměřování a pozdější napojení na 2D/3D návrh a Konfigurátor–Nářezák. Nezaměňovat s již schválenou implementací těchto modulů.

**Návrh ovládání – jeden editor, kontextové nástroje (otevřené k doladění):**

- **Znovu využít stávající editor fotografií/anotací**, nevyvíjet druhý kompletní editor. Po zvolení **+ → Vytvořit půdorys** se má otevřít stejná editační plocha a stejná infrastruktura kót, objektů, výběru, úchopů, zoomu, Zpět/Znovu, stylu a Bosch měření, ale **bez podkladové fotografie**. V aktuálním kódu již existuje samostatná položka **„Nové plátno“** typu `canvas` a `openEditor()` otevírá fotky i plátna – využití jako základ je **technicky pravděpodobné**, funkce půdorysu zatím **není implementovaná**.
- **Nový režim/nástroj kreslení stěn**: po volném tahu odfiltrovat chvění ruky, vytvořit editovatelnou rovnou úsečku ve směru tahu, jen při malé odchylce nabídnout jemné vodorovné/svislé/90° přichycení; šikminy zachovat. Kóty zadávané ručně/Boschem mohou upřesňovat délky, ale nesmějí bez kontroly měnit další stěny.
- **Rozhodnutí k nástrojům půdorysu (4. 11. 2026): zatím ponechat VŠECHNY nástroje stávajícího editoru dostupné a viditelné stejně jako při práci s fotografií** – včetně kruhu, elipsy, volné ruky, šipek, symbolů, kót a dalších funkcí. **Nyní nic neskrývat, neodebírat, nepřeuspořádávat ani nezakládat omezenou sadu nástrojů pro půdorys.** Přibýt má pouze budoucí způsob kreslení stěn s jemným narovnáním. **O případných odlišných lištách, prioritách, zobrazení či seskupování nástrojů se rozhodne později** podle používání; nejedná se o současný implementační úkol.
- **Nezničit existující personalizaci:** vlastní pořadí lišty, barev a nástrojů, které uživatel používá při práci s fotografiemi, nesmí automatické přepnutí do půdorysu nechtěně přepsat. Prozatím **společná plná nabídka nástrojů bez automatického skrývání**; jakékoli budoucí odlišné výchozí sady jsou pouze otevřená možnost k samostatnému odsouhlasení.
- **Zachovat samostatnost a data:** půdorys by byl novou editovatelnou položkou zakázky s vlastním obrysem/stěnami, ne obyčejnou bitmapou. Před vytvořením typu `floorplan` nebo rozšířením `canvas` nejprve vyhodnotit zpětnou kompatibilitu schématu, import/export ZIP a pokračování na PC. **Žádné zásahy do kódu v této návrhové fázi.**

**Stav:** **záměr funkce a princip jemného narovnávání jsou zaznamenané**, ale **neexistuje schválený termín, finální UX ani přesná technická specifikace pro okamžitou implementaci**. V tomto kroku se **nemění Android kód, nevytváří nová APK a nezasahuje do probíhajících oprav ani do starých zakázek**. Před implementací bude potřeba samostatně dohodnout podrobnosti interakce a otestovat přesnost na prstu i stylusu.

### Chytré rozmístění kót do fotografie a textové / AI pokyny – budoucí námět

**Nápad uživatele 4. 11. 2026, upřesněn: hlavně editor FOTOGRAFIÍ, teprve případně i Půdorys.** Podrobnosti v [Issue #16](https://github.com/zaplikj30-ui/Zamerovac-android/issues/16). **Stav: NÁPAD, ne schválená implementace; detaily se doladí později.**

- **Jedno tlačítko v editoru fotografie:** navrhnout přehledné grafické umístění kót **nahoře, dole, vlevo a vpravo** do fotografie místnosti či nábytku (případně úseky), pokud možno bez překryvů. Jak určovat přesné koncové body, uživatelská označení a význam „chytře“, se teprve dohodne. Uživatel doplní skutečné naměřené rozměry ručně nebo Bosch laserem.
- **Textový pokyn, případně AI nad fotografií:** uživatel napíše např. „Okótuj horní a spodní část fotky“ či „Kóty nahoru, dolů, vlevo a vpravo“ a program vytvoří návrh, který lze upravit a potvrdit. Offline příkazy vs. volnější AI, případný cloud, cena i soukromí se posoudí až při rozhodnutí o vývoji.
- **Povinná bezpečnost:** nikdy neodhadovat skutečné milimetry z pixelů, nevymýšlet naměřené hodnoty, nezasahovat bez potvrzení do stávajících kót či fotografie. Náhled před potvrzením, vrácení změny a všechny nové kóty samostatně editovatelné. Neodesílat zákaznická data externím AI službám bez výslovného rozhodnutí a vhodné ochrany soukromí.
- **Návaznost:** později případně zpřístupnit i v plánovaném modulu **Půdorys**, ale nenahrazuje jej ani nápad Průvodce zaměřením. Nic nyní neprogramovat, neslučovat projekty ani nesestavovat APK.

### Průvodce zaměřením – budoucí možnost, nikoli současná úprava

**Stav: NÁPAD / BUDOUCÍ MOŽNOST K POZDĚJŠÍMU ROZHODNUTÍ.** Není to potvrzená funkce stávající APK, nepatří automaticky do nejbližší aktualizace a neznamená příkaz nyní vytvořit novou obrazovku. Doplňuje již zaznamenanou budoucí možnost automatických kontrol chyb při zaměření a navrhování nábytku.

**Cíl:** pomoct při skutečném zaměřování místnosti a přípravě zakázky zabránit tomu, aby se zapomnělo na podstatný rozměr nebo vznikly vzájemně rozporné kóty. Průvodce má být pomocník, nikoli překážka při volném zaměřování.

- **Evidence potřebných měření:** podle konkrétní místnosti/typu zakázky přehledně evidovat zvolené délky stěn, výšky, šířky, důležité odstupy a polohy otvorů či instalací (okna, dveře, zásuvky, voda, odpad, překážky), včetně fotky, poznámky, referenčního bodu nebo stěny. **Konečný povinný seznam měření není stanoven** a musí být později upravitelný podle zakázky.
- **Přehled úplnosti:** rozlišit naměřeno / chybí / není potřeba / nutno ověřit; upozornit na chybějící údaj, neúplnou skupinu měření či nejasné přiřazení k místnosti. Pokud se odvozuje rozměr, označit jej jako **odvozený**, nikoli přímo naměřený.
- **Kontrola navazujících kót:** porovnávat např. součet dílčích rozměrů se skutečně změřeným celkovým rozměrem včetně správných jednotek a směru; zřetelně ukázat **konkrétní rozdíl a dotčené kóty**. Tolerance, zaokrouhlování a pravidla geometrického vyhodnocení jsou **otázky pro budoucí návrh**, nesmějí být nyní domyšleny jako schválená konstanta.
- **Kontrola bez nechtěných změn:** doporučit doplnění nebo opětovné přeměření, ale **neopravovat automaticky hodnoty, fotografie, anotace ani návazné schválené návrhy a výrobní podklady**. Rozhodnutí o převzetí a případném přepočtu zůstává na uživateli.
- **Použitelnost a budoucí návaznost:** průvodce může pracovat offline, zachovat editovatelnost jednotlivých kót a být později zdrojem ověřených údajů pro půdorys, návrh skříněk a kontroly kolizí. **Nyní nevytvářet závislost Zaměřovače na Konfigurátoru.**

**Otevřeno pro další domluvu:** seznam povinných položek, práce s typy místností, toleranční pravidla, pořadí kroků, způsob zobrazení i míra automatizace. Tyto detaily nejsou nyní schváleným zadáním k programování.

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

- **Širší cílová skupina – budoucí možnost:** systém může jednou sloužit nejen pro vlastní zakázky, ale také dalším truhlářům, nábytkářům, montážníkům a příbuzným řemeslům v ČR i zahraničí. Dnes to nemění zaměření aplikace ani neznamená závazek veřejného či komerčního vydání.
- **Jen potřebné funkce:** budoucí uživatel může pracovat jen se Zaměřovačem, jen s návrhem, kusovníkem či nářezákem, nebo s jejich kombinací, bez povinného absolvování ostatních kroků. Rozhraní má přednostně ukazovat funkce relevantní pro jeho práci, aby pokročilé možnosti neznepřehlednily základní použití; konkrétní způsob výběru a skrytí funkcí zatím není rozhodnutý.
- **Mezinárodní místní nastavení:** vedle překladu textů do budoucna počítat s různými jednotkami, desetinnými oddělovači, formáty data a dalšími regionálními zvyklostmi. Ukládané hodnoty a výměnné soubory musí zachovávat jednoznačný význam a přesnost výrobních rozměrů bez tichých změn nebo zaokrouhlení při přepnutí jazyka či jednotek.

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

### Široká kompatibilita Android telefonů a tabletů – průřezový požadavek

**Upřesnění 4. 11. 2026. Stav: SCHVÁLENÝ SMĚR A PRAVIDLO PŘI BĚŽNÝCH ÚPRAVÁCH; NEZNAMENÁ OVĚŘENOU PODPORU VŠECH ZAŘÍZENÍ.** Cílem je, aby aplikace nebyla svázaná pouze s aktuálně používaným Samsungem, ale byla dlouhodobě dobře použitelná na **širokém spektru Android telefonů a tabletů různých výrobců, velikostí i výkonnostních tříd**. Přesný seznam podporovaných modelů a verzí Androidu bude stanoven a ověřován postupně, podle reálných testů a požadavků aplikace; nyní jej nevymýšlet.

- **Výrobci a Android:** navrhovat s využitím standardních Android API, bez zbytečné závislosti na Samsung/One UI; počítat s různými nadstavbami, správci souborů, oprávněními a chováním systémových dialogů. Kompatibilitu uvádět pouze pro skutečně ověřené kombinace zařízení a OS.
- **Rozmanité displeje:** responzivní a přístupné rozhraní pro menší i větší telefon, kompaktní i velký tablet, portrét/krajinu, různá rozlišení, poměry stran, hustoty pixelů, systémové měřítko a velikost písma; důležité prvky a dialogy se nesmějí ztrácet, překrývat nebo vyžadovat konkrétní rozlišení.
- **Způsoby ovládání:** plná základní použitelnost **prstem**, s podporou pera tam, kde je dostupné (S Pen či jiný kompatibilní stylus). Pero a specifické Samsung funkce nesmějí být podmínkou základních operací; na budoucím PC zvlášť myš/klávesnice.
- **Výkon a stabilita (i pro méně výkonné telefony):** přiměřená spotřeba paměti, procesoru a energie; plynulá práce s většími fotografiemi a zakázkami i na méně výkonném zařízení. Při růstu počtu funkcí a případném propojení Zaměřovače s Konfigurátorem načítat a spouštět náročné moduly **až při skutečném použití**, nepřipouštět zbytečný souběh 3D vykreslování, optimalizace nářezu a základního zaměřování. V galeriích používat malé náhledy, originály zachovat pro editaci/export, bezpečně uvolňovat paměť. Výpočetně náročné úlohy nesmějí blokovat dotykové ovládání; případné zjednodušení vykreslování podle schopností zařízení nesmí snižovat přesnost uložených rozměrů, hran, kót ani kvalitu uložených originálů. **Při paměťové zátěži nebo ukončení procesu bezpečně zachovat rozpracovaná data.** Skutečnou kompatibilitu, odezvu a zatížení ověřovat testy na slabším telefonu, střední třídě a výkonném zařízení, včetně větší zakázky a dlouhodobé práce; nelze předem garantovat všechny telefony. Nezavádět zbytečná omezení ani rozsáhlý přepis nynějších aplikací kvůli hypotetické univerzální kompatibilitě. **Zatím pouze požadavek na způsob budoucího vývoje, bez aktuálního slučování aplikací, velkých optimalizačních zásahů a nového APK.**
- **Bluetooth a okolní služby:** počítat s různými implementacemi Bluetooth, oprávnění a správci připojení; jednotlivé značky/modely měřáků mohou používat jiné protokoly. **Funkčnost konkrétního laseru a telefonu potvrdit pouze po reálném testu**; při nepodporované funkci nesmí přestat fungovat ruční zadávání.
- **Souborové operace a data:** import/export, ZIP, fotografie, oprávnění úložiště, sdílení, obnovení dat a případné aktualizace nesmějí předpokládat jeden konkrétní systémový dialog nebo jediného výrobce. Testy chrání editovatelnost i zpětnou kompatibilitu na různých zařízeních.
- **Postupné testování:** budovat matici **model × verze Androidu × velikost displeje × důležité funkce**, automatické UI/regresní testy, emulátory pro různé konfigurace a fyzické ověření vybraných zařízení. **Test emulátoru ani statická kontrola kódu nesmějí být uváděny jako potvrzený test konkrétního telefonu/tabletu**.
- **Rozsah nyní:** při schválených opravách předcházet pevně zakódovaným rozměrům obrazovek a jednovýrobcovým závislostem a otestovat dotčené části na dostupných zařízení. **Nezahajovat plošný redesign ani hromadné přepisování stabilního kódu pouze kvůli této vizi**.

**Priorita:** spolehlivost, ochrana dat, přesnost měření/výpočtů a jednoduché používání mají přednost před honbou za maximálním počtem podporovaných modelů bez testů. Tento cíl sám **neznamená vydání na Google Play ani podporu již neověřených zařízení**.

#### Podrobná pravidla kompatibility a testování – upřesnění 4. 11. 2026

Tato část **zpřesňuje již existující požadavek**, nezakládá druhé nezávislé zadání ani nespouští rozsáhlý refactoring. **Platná zásada pro všechny nové či měněné funkce**, zatímco rozsah skutečně podporovaných verzí Androidu, výrobců a zařízení se bude potvrzovat pouze testováním.

1. **Různí výrobci:** cílově Samsung, Xiaomi, Google Pixel, Motorola, OnePlus, Honor **a další Android zařízení**. Nemít pevnou závislost na Samsung/One UI, jeho správci souborů, rozhraní pro pero či jeho způsobu vykreslování, není-li zároveň bezpečná alternativa přes běžné Android API. Zachovat doplňkové možnosti S Pen, ale každý základní postup musí jít provést prstem a případně běžným stylusem.
2. **Adaptivní rozložení a otočení zařízení:** malé i velké telefony, různé velikosti tabletů, **výška i šířka**, různé hustoty pixelů, poměry stran a systémové **zvětšení písma**. **Při otočení telefonu/tabletu za běhu** se má zobrazení plynule přizpůsobit, pokud systém otočení dovoluje; respektovat systémové uzamčení rotace. **Zachovat aktuální zakázku, otevřený editor a neuloženou rozpracovanou práci, zvolený objekt, skutečné hodnoty, souřadnice, orientaci dílců/hran a případné přiblížení tak, aby změna rozměru obrazovky nepoškodila data ani přesnost.** Přepočítávat jen zobrazení a dostupné ovládací plochy, nikoli výrobní rozměry. Tam, kde Android podporuje **rozdělenou obrazovku a změnu velikosti okna**, má aplikace reagovat bez ztráty rozpracované práce, překrytí tlačítek, vysunutých dialogů mimo plochu nebo nedosažitelných spodních lišt. **Před označením za funkční otestovat obě otočení v galerii, editoru, poznámkách a dostupných návrhových/nářezových obrazovkách**, na telefonu i tabletu, včetně návratu z pozadí; současná dokumentace není důkazem, že to nynější APK již zvládá. Nepředpokládat stále stejnou velikost okna ani rozlišení Samsungu.
3. **Gesta a úchopy:** **vizuální velikost** bílého úchopového kroužku je samostatná vlastnost oproti jeho **dotykové/hit-test oblasti**. Vzhled a umístění úchopů lze doladit jen podle odsouhlaseného zadání; **nezvětšovat, nezmenšovat ani nepřelaďovat citlivost funkčního dotyku** jako vedlejší efekt responsivního rozvržení. U konců má zůstat přednost konkrétního úchopu před tažením celého objektu, souřadnice kót se při zoomu, otočení nebo změně okna nesmějí svévolně přepočítat. Testovat prstem i perem, pokud je na zařízení k dispozici; budoucí Windows také myš/klávesnici.
4. **Verze Androidu:** při aktualizaci knihoven nebo **target SDK** regresně ověřit soubory, import/export ZIP, oprávnění, fotografie, Bluetooth, ukládání, obnovu a životní cyklus aplikace. **minSdk nezvyšovat bez prokazatelného technického důvodu, předchozího upozornění a posouzení dopadu na starší zařízení.** Úspěšný build ani start na emulátoru neznamená ověřenou funkčnost na všech Android verzích.
5. **Paměť, výkon a výdrž:** věnovat pozornost velkým snímkům, mnoha současně vykreslovaným kótám, složitému projektu, dlouhé práci v editoru, přepínání aplikací, uspání/obnovení a méně výkonnému hardware. Cílem je neblokovat UI, omezit zbytečné držení bitmap v paměti a **předcházet ztrátě neuložených úprav při ukončení procesu**. Konkrétní optimalizaci provádět až podle měření a dopadu; zachovat kvalitu fotografie a přesnost geometrie.
6. **Chybějící volitelný hardware:** bez Bluetooth/BLE, fotoaparátu nebo stylusu nemá spadnout celý program. Vypnout či vysvětlit pouze závislou funkci; nechat uživateli dostupné ostatní části (např. ruční zadání kóty, import již pořízeného snímku, ovládání prstem). Oprávnění mohou být odepřena nebo odvolána i za běhu. Používat systémem podporovaný Android přístup k dokumentům a sdílení, bez závislosti na jedné implementaci výběru souborů.
7. **Plán postupných testů:** kombinovat jednotkové a integrační testy, UI testy na Android emulátorech s různými API a displeji, změny orientace/velikosti okna a podle skutečné potřeby také **Firebase Test Lab** nebo obdobnou službu s fyzickými zařízeními. Kromě spuštění prověřit **vytvoření zakázky → fotografie a úpravy → uložení → úplné ukončení/opětovné otevření → zachování všech editovatelných dat**, dále ZIP export/import/obnovu a instalaci aktualizace přes starší verzi se zachováním dat. Funkce závislé na Bluetooth laseru/stylusu **ověřovat zvlášť na skutečném konkrétním hardware**.
8. **Poctivá evidence výsledků:** každý záznam má obsahovat model, výrobce, verzi Androidu, verzi APK, datum, konfiguraci displeje, přesný rozsah a výsledek testu a známá omezení. Odděleně evidovat **(a) skutečně otestováno s uvedením pokrytí**, **(b) očekávaně kompatibilní, ale neověřeno**, **(c) potvrzená nekompatibilita s reprodukcí**, **(d) zatím netestováno**. Částečný úspěch na jednom Samsungu **neznamená**, že je „kompletně podporován Samsung“ ani že je zaručena funkce jiného telefonu/laseru.
9. **Nejbližší aktualizace:** **primárně opravit domluvené závady a chránit data**. U přímo měněných funkcí odstranit zjevné zbytečné závislosti na jednom výrobci a doplnit cílené testy. Rozsáhlejší změny adaptivity, způsobu ukládání nebo kompatibility **nejprve technicky navrhnout a projednat**; žádná samostatná APK jen kvůli této dokumentaci.



### Možná budoucí podpora iPhone a iPad (iOS / iPadOS)

**Dohoda 4. 11. 2026 – NEZÁVAZNÝ DLOUHODOBÝ SMĚR, NIKOLI SCHVÁLENÍ VÝVOJE iOS APLIKACE, PŘECHODU NA JINÝ FRAMEWORK ANI VYDÁNÍ V APP STORE.** Vedle současných Android telefonů a tabletů a plánovaného plnohodnotného Windows PC editoru se **do budoucna nevylučuje** podpora zařízení **Apple iPhone (iOS)** a **Apple iPad (iPadOS)**. Jde o možnost, jejíž účelnost, způsob realizace, technologie, rozsah a termín budou rozhodnuty samostatně později. **Hlavní priorita nyní: kvalitní a funkční Android aplikace, bezpečnost zákaznických dat a dokončení schválených oprav.**

**Architektonická pravidla při současném vývoji – rozumně zohledňovat, neprovádět plošný refactoring:**

1. **Oddělovat čistou aplikační a datovou logiku od operačního systému.** Výpočty rozměrů a geometrie, význam objektů, interpretace editovatelných anotací, kontrola kusovníku/nářezu a čtení či validace dat by neměly být bez nutnosti svázané s konkrétním Android API nebo obrazovkou.
2. **Sdílení kódu je možnost, ne dogma.** V budoucnu posoudit znovupoužitelné knihovny či společné jádro pro Android, iOS/iPadOS a Windows, pokud to přinese skutečný užitek a nebude omezovat výkon, kvalitu nebo dostupné nativní funkce. **Dnes nepřevádět aplikaci na nový multiplatformní framework** jen kvůli hypotetickému iOS.
3. **Přenositelné, dokumentované a verzované zakázky.** Originální fotografie, oddělené editovatelné kóty a grafické objekty, poznámky, návrhy, kusovníky, dílce, materiály a další přílohy musejí mít bezpečně interpretovatelná data, jednotky, souřadnice, identifikátory a schéma. Zachovávat zpětnou kompatibilitu a nepřepisovat současný formát bez migrace.
4. **Budoucí stejné zakázky napříč zařízeními.** Android ↔ iOS/iPadOS ↔ Windows může jednou bezpečně přenášet změny, fungovat offline a řešit souběh úprav bez tiché ztráty dat. **Dnešní ZIP záloha, která při importu vytváří kopii, není hotová synchronizace.** Výběr synchronizační technologie zůstává otevřený.
5. **Ovládání podle hardware:** základní práce prstem; pokud zařízení umožňuje přesné pero, také běžný stylus, Samsung **S Pen** nebo **Apple Pencil**, podle skutečné podpory konkrétního zařízení. Gesta, citlivost úchopů, obrazovkové souřadnice a přesnost měření mají zůstat konzistentní; platformy mohou používat odlišné UI.
6. **Platformní adaptéry:** Bluetooth/BLE měřáky, fotoaparát, galerie, výběr souborů, systémová oprávnění, sdílení, notifikace, životní cyklus aplikace a případné přihlašování implementovat pro každou platformu podle jejích API. **Nepředpokládat stejný Bluetooth protokol ani totožné oprávnění na Androidu a iOS.** Případné omezení hardware nesmí poškodit ostatní funkce.
7. **Testování a budoucí distribuce:** pokud se iOS vývoj jednou schválí, vytvořit samostatnou matici testů pro skutečné iPhone/iPad, různé verze iOS/iPadOS, rozměry displejů, Apple Pencil, práci offline, data, import/export, měření a aktualizace; případné vydání přes **Apple App Store** řešit až tehdy s aktuálními pravidly a správným podpisem/ochranou soukromí. **Teď žádný účet, build, platba ani publikování.**

**Pravidlo rozhodování:** pokud nové řešení v Androidu vytváří zbytečnou nezvratnou závislost na jeho specifickém úložišti, způsobu serializace, nepřenosném modelu grafických prvků nebo konkrétním výrobci, upozornit na riziko a nabídnout rozumně přenositelnou variantu. **Nedělat drahý redesign stabilní funkce pouze kvůli možnosti budoucího iOS.**

**Stav plnění:** pouze zdokumentováno; **iOS/iPadOS aplikace nebyla vytvořena, jazyková a datová kompatibilita s Apple platformami nebyla otestována a sdílený multiplatformní kód nebyl schválen ani zaveden**. Současný Android vývoj pokračuje nezávisle.

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

### Vlastní identita Zaměřovače vůči ImageMeteru před případným zveřejněním

**Otevřená strategická otázka uživatele (4. 11. 2026):** Pokud by šel Zaměřovač veřejně do obchodu s aplikacemi, nakolik se má lišit od referenčního ImageMeteru? **Zatím nejde o schválení redesignu, přejmenování, změny současného funkčního vzoru ani veřejného vydání.**

- **Funkční principy nemusí být za každou cenu jiné:** přesné kóty do fotografie, prst/S Pen, lupa, přichytávání, přesuny konců, laser a běžná gesta patří k užitečnému pracovnímu postupu. Při dnešních opravách zachovat schválené ovládání a chování podle `AGENTS.md`, ale implementovat vše vlastním kódem a vlastními podklady; nepřebírat proprietární kód, ikonové soubory, grafiku či nelegálně získané zdroje.
- **Vlastní obchodní a grafická identita:** před případným veřejným vydáním připravit a uživatelsky schválit odlišný název/značku, ikonu, grafické prostředky a vlastní vizuální styl; posoudit i celkovou podobnost obrazovek, charakteristických sad ikon, menu a marketingových materiálů, aby nedocházelo k záměně aplikací ani dojmu oficiálního propojení s ImageMeterem.
- **Vlastní hodnota produktu:** pro truhláře a montážníky využít vlastní organizaci zakázek, přílohy, české ovládání, přesné rozměry/Bosch, případně pozdější půdorysy a bezpečné propojení s Konfigurátorem–Nářezákem, jen pokud budou samostatně schválené a ověřené. Google Play může vyžadovat skutečnou přidanou hodnotu, nikoli pouhou kopii jiné aplikace.
- **Právní / obchodní kontrola před zveřejněním:** zhodnotit autorská práva, ochranné známky, případné designy, licence použitých knihoven/ikon/fotografií, zásady Google Play pro [duševní vlastnictví](https://support.google.com/googleplay/android-developer/answer/9888072?hl=en) a [vydávání se za jinou aplikaci](https://support.google.com/googleplay/android-developer/answer/9888374?hl=en). Originalita grafického rozhraní může být chráněná autorským právem i v EU (např. [SDEU C-393/09](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A62009CJ0393)). Před komerčním vydáním podle situace konzultovat odborníka; žádný konkrétní právní výsledek dnes není zaručen.
- **Postup a priorita:** až se uživatel rozhodne pro veřejné vydání, navrhnout oddělený audit podobnosti a rozumný postupný redesign pouze tam, kde bude potřebný; zachovat chování, data, přesnost, přístupnost a existující zakázky. **Nyní nic nepřekreslovat naslepo, nepřepisovat funkční editor, nespouštět APK a nebrat to jako schválenou změnu aktuální aktualizace.**

**K případnému přechodu do plánu vydání** dojde teprve po výslovném rozhodnutí uživatele a samostatné kontrole stability, kompatibility, právních/obchodních požadavků, zásad obchodu a skutečných testů. Do té doby je toto **nezávazný dlouhodobý směr, nikoli úkol „vydat APK na Google Play“.**

### Širší okruh uživatelů a možná mezinárodní dostupnost (nezávazná vize)

**Stav k 4. 11. 2026: NEZÁVAZNÁ DLOUHODOBÁ VIZE, nikoli pokyn k implementaci nebo rozhodnutí o zveřejnění či prodeji.** Tento zápis pouze doplňuje existující dlouhodobé plány pro Android, možný iPhone/iPad, Windows, jazykovou podporu a samostatné/propojené moduly. Neznamená, že už jsou tyto varianty vytvořené nebo ověřené.

- **Cílové skupiny – předběžná představa:** systém by jednou mohl pomáhat nejen při vlastní zakázkové výrobě, ale i profesionálním řemeslníkům (truhlářům, nábytkářům, montážníkům a dalším profesím), **domácím kutilům, hobby uživatelům a lidem, kteří potřebují něco zaměřit, naplánovat či vyrobit pro vlastní potřebu**, případně uživatelům v zahraničí. Konečný okruh uživatelů, trhy ani poptávka nejsou rozhodnuté nebo ověřené.
- **Široká dostupnost a mezinárodní použitelnost:** usilovat dlouhodobě o možnost podpory různých telefonů/tabletů s Androidem, případně iOS/iPadOS a Windows, a více jazyků, jednotek a místních formátů. Interní rozměry, přesnost a význam údajů se nesmějí nechtěně měnit podle jazyka nebo regionu. Každá platforma, jazyk a zařízení potřebují vlastní ověření.
- **Rozsah funkcí podle potřeb:** budoucí uživatel může potřebovat pouze Zaměření, Návrh, Kusovník nebo Nářezák, případně celý propojený systém. Zda budou moduly součástí jedné instalace, nebo oddělených aplikací, zůstává otevřené. Současné dvě aplikace se neslučují.
- **Přehledné ovládání pro začátečníka i profesionála:** šíře budoucích funkcí nemá vynucovat složitý postup ani předpokládat odborné znalosti. Uživatel má mít snadno přístupné potřebné nástroje a možnost začít i bez předchozích kroků v jiném modulu. Rozdílnou složitost používání lze řešit později (například srozumitelnými popisky a volitelnými pokročilými nástroji), **bez současného závazku vytvářet zvláštní režimy nebo nové funkce**.
- **Veřejná distribuce:** Google Play a Apple App Store zůstávají pouze možnými distribučními cestami. Široká kompatibilita sama o sobě nezaručuje počet uživatelů ani úspěch vydání.
- **Finanční/obchodní model je výslovně NEROZHODNUTÝ:** není stanoveno, zda by aplikace byla zdarma, jednorázově placená, na měsíční/roční předplatné, zda by měla některé prémiové nebo placené funkce, nebo jiný model. Žádná z těchto možností se nyní neschvaluje ani nevylučuje. Nezavádět dnes platby, omezení funkcí, registraci, předplatné nebo obchodní infrastrukturu jen kvůli této vizi; případné řešení a dopad na uživatele se posoudí samostatně později.

**Současný postup:** pouze zaznamenat dlouhodobý směr. Pokračovat v domluvených opravách, testování a rozvoji současných aplikací se zásadní prioritou spolehlivost → bezpečnost dat → přesnost a funkčnost → jednoduché ovládání. Bez nových modulů, přepisování frameworku, vývoje iOS/PC, změn cenové politiky nebo samostatného APK buildu kvůli tomuto zápisu.

### Volba jazyka podle systému s ručním přepsáním (budoucí chování)

**Upřesnění uživatele 4. 11. 2026 – až bude skutečně k dispozici více překladů; nikoliv požadavek na další jazyk v aktuální APK.**

- **Výchozí nastavení „Podle systému“:** při prvním spuštění a dokud si uživatel ručně neurčí jazyk, volit podle jazykových preferencí telefonu/tabletu (preferenční pořadí, dostupné překlady a vhodný jazykový fallback). Změnu jazyka zařízení za běhu či po dalším spuštění respektovat, když zůstává nastaveno „Podle systému“.
- **Ruční výběr v „Nastavení → Jazyk aplikace“:** uživatel může kdykoliv zvolit některý ze skutečně podporovaných jazyků; ruční volba má přednost před jazykem telefonu a zůstane uložená i po restartu. Volbou „Podle systému“ se zase vrátí automatické sledování zařízení.
- **Nepodporovaný jazyk telefonu:** nejprve respektovat další preferované jazyky nastavené v telefonu, pokud pro ně existuje hotový překlad. Pokud žádný z preferovaných jazyků není podporovaný, **v budoucí mezinárodní vícejazyčné verzi použít angličtinu (`en`) jako hlavní záložní jazyk**. **Do doby skutečného dodání a otestování anglického překladu použít češtinu (`cs`)**, protože je zatím jediným dodaným jazykem. Nezobrazovat chybějící překlady, technické klíče ani falešně nabízené jazyky; nikdy nestahovat překlad kvůli běžnému offline ovládání.
- **Oddělit nastavení jazyka od projektových dat:** přepnutí nezmění hodnoty měření, anotace, uživatelské texty, název souborů, ZIP ani uložená čísla; nemá ztratit rozpracovanou práci.
- **Přechodné období:** v nejbližší aktualizaci Zaměřovače je stále jediný dostupný jazyk **🇨🇿 Čeština**, i na telefonu s jiným systémovým jazykem. Samotnou možnost „Podle systému“ v UI lze zobrazit až tehdy, kdy má skutečný význam a jsou schváleny alespoň dva funkční překlady. Neměnit dříve schválený jednoduchý výběr pouze češtiny.

**Stav:** zapsáno jako pravidlo pro budoucí skutečné vícejazyčné vydání. Nyní jen dokumentace, ne zadání k implementaci a ne nové APK.

### Možná budoucí monetizace reklamou (pouze otevřená možnost)

**4. 11. 2026 – NEROZHODNUTÁ DLOUHODOBÁ MOŽNOST.** K dříve zaznamenaným otevřeným otázkám (zdarma, jednorázová platba, předplatné, případně placené funkce či moduly) přibývá také **možnost financování aplikace reklamou**. Zatím není schváleno, že reklamy v aplikaci budou; není určený poskytovatel, formát, četnost, umístění, příjmový cíl ani kombinace s ostatními modely. Veřejné vydání také není rozhodnuté. **Reklama není požadavek na nynější ani příští aktualizaci.**

- **Konkrétní nezávazný příklad od uživatele:** aplikace může být zdarma s malým, nerušivým reklamním proužkem (bannerem) a **za jednorázový poplatek** by šlo reklamy trvale odstranit. Jde jen o možný model „zdarma s reklamou → zaplatit za odstranění reklam“, **nikoli o schválení reklamy, ceny, způsobu platby či termínu**. Pokud se tato varianta někdy zvolí, odstranění reklam by nemělo měnit nebo znehodnotit vlastní zakázky ani rozpracovanou práci; je nutné otestovat obnovu nákupu při přeinstalaci/změně zařízení a pravidla jednotlivých obchodů.
- **Další možné varianty:** dobrovolné odměňované reklamy, bezreklamová verze či úplně žádné reklamy; zůstávají otevřené také jednorázový nákup celé aplikace, předplatné nebo placené moduly. Žádná varianta není definitivně vybraná.
- **Nezasahovat do práce:** případná reklama nesmí překrývat pracovní fotografie, kóty, 2D/3D návrhy, ovládací úchopy, důležité dialogy a výrobní rozměry; nesmí blokovat měření, přenos z Bluetooth laseru, ukládání, export ani práci v dílně. Vyhnout se nečekaným celoplošným reklamám a náhodným kliknutím.
- **Offline a data:** veškerá základní práce má zůstat funkční bez internetu, bez načtené reklamy či nedostupného reklamního serveru. **Údaje o zákaznících, zakázkách, fotografie, poznámky, kóty ani kusovníky se nesmějí bez odpovídajícího právního základu a výslovného rozhodnutí sdílet s reklamními službami**; přístup reklamních knihoven k citlivým datům minimalizovat a posoudit soukromí.
- **Právní a technické předpoklady před případným zavedením:** aktualizovaná pravidla Google Play / Apple App Store, požadavky ochrany osobních údajů a souhlasů v EU (včetně vhodné CMP pro relevantní způsoby reklamního zpracování), údaje o sběru dat a zabezpečení, odpovědnost za reklamní SDK a jejich kompatibilitu.
- **Rozhodnout až podle reality:** před implementací vyhodnotit skutečnou cílovou skupinu, dopad reklam na profesionální a hobby používání, přínos oproti ostatním modelům, technické náklady a testy. Příjem z reklam **není garantovaný**.

**Nyní nedělat:** nezakládat reklamní účty, nepřidávat reklamní SDK, tracking, souhlasové dialogy, bannery ani omezení funkcí, nepřipravovat placené tarify, neměnit existující ukládání či ovládání a nespouštět sestavení APK pouze kvůli tomuto zápisu. Stávající priority oprav a bezpečnosti dat zůstávají.

### Kontrola sjednocení dlouhodobých požadavků – co platí nyní a co později

**Kontrola proti devíti bodům uživatele ze 4. 11. 2026.** Tato tabulka **jen rozcestníkem propojuje existující podrobné dohody**; nenahrazuje je a neotvírá nové implementační úkoly.

| Oblast | Stav dohody | Platný podrobný zápis |
|---|---|---|
| **1. Vícejazyčnost** | **SCHVÁLENO PRO NADCHÁZEJÍCÍ AKTUALIZACI:** bezpečný postupný český lokalizační základ, položka „Jazyk aplikace“ pouze s 🇨🇿 Čeština. Desítky jazyků jsou technický budoucí cíl, **žádné hotové překlady nyní**. | [LOKALIZACE_PLAN.md](LOKALIZACE_PLAN.md), [Issue #14](https://github.com/zaplikj30-ui/Zamerovac-android/issues/14) |
| **2. Google Play** | **NEZÁVAZNÁ DLOUHODOBÁ MOŽNOST**, bez termínu, vydání, registrace nebo změn kvůli publikování. | Sekce „Možný dlouhodobý cíl: veřejné vydání na Google Play“ níže |
| **3. PC aplikace** | **DLOUHODOBÝ SMĚR:** plnohodnotný Windows editor stejné zakázky a grafických objektů; **vývoj nezahájen**. | Sekce „plnohodnotný Zaměřovač pro Windows 11“ níže |
| **4. Společná aplikace** | **DLOUHODOBÁ MOŽNOST**, nikoli pokyn spojit dva dnešní projekty. | Sekce propojení Zaměřovače a Konfigurátoru–Nářezáku; [vize druhého projektu](https://github.com/zaplikj30-ui/Konfigurator-Narezak-Android/blob/main/VIZE_A_PLAN.md) |
| **5. Společné zakázky / přenos měření** | **DLOUHODOBÝ SMĚR**, zatím bez datového API; kontrolované převzetí fotografií, rozměrů, prostorových vazeb a překážek bez přepisování a bez zásahu do schválené výroby. | Sekce „jeden systém pro celý proces zakázkové výroby“ a [datová inventura](DATOVY_FORMAT_A_PC_KOMPATIBILITA.md) |
| **6. Datová kompatibilita** | **ZÁVAZNÁ ZÁSADA DNEŠNÍHO VÝVOJE** zachovávat originály, editovatelné objekty, stabilní identity, zpětnou kompatibilitu a bezpečnost; **nové společné schéma/synchronizace nejsou schválené k realizaci**. | [DATOVY_FORMAT_A_PC_KOMPATIBILITA.md](DATOVY_FORMAT_A_PC_KOMPATIBILITA.md) |
| **7. Průvodce zaměřením** | **NOVĚ SAMOSTATNĚ EVIDOVANÁ BUDOUCÍ MOŽNOST:** přehled potřebných měření, chybějící údaje a kontroly součtů kót. **Neimplementovat zatím.** | Sekce „Průvodce zaměřením“ výše |
| **8. Historie a bezpečnost** | **OCHRANA DAT A ZÁLOH JE PRIORITA SOUČASNÝCH OPRAV**; univerzální historie verzí a řešení konfliktů jsou **budoucí možnosti**. | [Audit 28 testů](AUDIT_KODU_PROTI_28_TESTUM.md), [datová inventura](DATOVY_FORMAT_A_PC_KOMPATIBILITA.md) |
| **9. Automatizované testování** | **SCHVÁLENÉ PRŮBĚŽNÉ VÝVOJOVÉ PRAVIDLO**; reálná kompatibilita Android zařízení a konkrétního laseru potvrdit jen fyzickým testem. | [Audit 28 testů](AUDIT_KODU_PROTI_28_TESTUM.md), sekce Google Play níže |

**Aktuální vývojový rozsah:** domluvené opravy a testy Zaměřovače podle [rekonstrukce 28 testů](START_ZDE.md), plus již schválená česká první fáze lokalizace. **Všechny ostatní uvedené cíle se nyní jen dokumentují a technicky zohledňují tam, kde to dává smysl.** Nezačínat PC aplikaci, sloučení projektů, cloudovou synchronizaci ani průvodce zaměřením bez dalšího schválení.

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
| 2026-11-04 | Sjednocena kontrola devíti dlouhodobých oblastí; již existující dohody zachovány a propojeny. **Nově jako samostatný nezávazný nápad** evidován průvodce zaměřením pro chybějící měření a kontroly součtů kót. Nejbližší aktualizace nadále řeší dohodnuté opravy a českou přípravu lokalizace. |
| 2026-11-04 | Schválen široký cílový rozsah Android telefonů a tabletů různých výrobců, velikostí a výkonnostních tříd; postupné testování skutečné kompatibility, bez tvrzení, že všechny modely již fungují, a bez plošného přepisu aplikace. |
| 2026-11-04 | Přidána nezávazná možnost budoucí podpory iPhone/iPad (iOS/iPadOS), přenositelné logiky a dat a případného Apple App Store; bez zahájení iOS vývoje, změny frameworku či oslabení Androidu. |

| 2026-11-04 | Upřesněn nezávazný dlouhodobý směr širší dostupnosti pro různá řemesla a zahraniční uživatele, volitelných samostatných modulů a přehledného ovládání. **Finanční model není rozhodnutý** (zdarma / jednorázová platba / předplatné / volitelné placené funkce či jinak); žádná varianta není schválena ani vyloučena. Pouze dokumentace, bez změn kódu. |

| 2026-11-04 | Nový budoucí samostatný typ položky „Půdorys“: volné kreslení rukou/perem s inteligentním **jemným narovnáním** jednotlivých stěn, které zachová jejich skutečně nakreslený směr; 90° jen při malé odchylce, bez násilného přetáčení šikmin. Rohy editovatelné, kóty ručně/Bosch, přenosná editovatelná data. Nejde o pokyn ihned implementovat či sestavit APK. |

## 8. Další dohledané drobné náměty a ověřované detaily z testování
- **Námět z testu 6 – rozměr a text u kót a ramen (4. 11. 2026):** Uživatel se ptá, zda je nutné mít všude samostatné pole „Popisek ramene/strany“, když lze do rozměru psát text. **Závazná bezpečnostní podmínka:** pokud text/poznámka obsahuje další čísla (např. skutečná kóta 500 mm, text „2 zásuvky, odstup 30 mm“), nesmějí se tyto číslice smíchat s měřenou hodnotou, změnit výpočet ani přepsat údaj z Bosche. **Doporučený směr:** v uložených datech vždy rozlišovat číselnou kótu, jednotku a volný text; případné společné vizuální zobrazení či zjednodušení vstupů je námět k projednání, nikoli schválení odstranění polí. Neodstraňovat teď žádné popisky a nepřepisovat historii. **Test 6 – Úhel: předběžně „Funguje správně“, stále otevřený, protože uživatel dosud nedal výslovné závěrečné potvrzení; tento námět sám o sobě není chyba testu ani důvod jej uzavřít.**

Tyto body jsou rozdělené podle původního kontextu; **nesmí se automaticky vydávat za hotové**.
- **Návrh na vylepšení:** barevná ikona výběru fotografie v poznámce; při více fotografiích ukázat první a části dalších náhledů pod ní (test 16).
- **Dohodnuté očekávané ovládání:** samostatně přesouvat text/rozměr při práci se šipkou, nezávisle přesouvat rám poznámky a hrot, mít jemné průhledné označení kóty.
- **K opravě/ověření:** pohyb volné kresby, úchopy kruhu a elipsy, lupa s vycentrovaným bodem, černá plocha při hlášení chyby, import ZIP.
- **Plánovaný test:** obousměrná synchronizace Google Disk, reálný offline provoz a navazující test 29.
- Podrobné výsledky podle čísel jsou v [rekonstrukci 1–28](START_ZDE.md) a statická kontrola současného kódu je v [auditu](AUDIT_KODU_PROTI_28_TESTUM.md); ani jedno nenahrazuje test nové APK.
