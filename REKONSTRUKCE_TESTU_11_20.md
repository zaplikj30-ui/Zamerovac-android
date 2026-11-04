# Zaměřovač v1.2.146 – rekonstrukce testů 11–20
**Hlavní zdroj:** 1000093687.mp4, přibližně 01:28–02:48. **Průběžná technická specifikace dle historického chatu**, ne potvrzení současného stavu APK. Pozdější dodatky a změny dohod mají přednost před prvním zjištěním.

## Test 11 – Poznámka
**Původní test (01:34–01:40):** vložit textovou poznámku do fotografie; přesunout její celý rámeček; **samostatně přemístit hrot spojovací šipky**, aniž se posune rámeček; znovu otevřít a upravit existující poznámku.
**Potvrzení:** uživatel nakonec řekl, že „zbytek všeho funguje“ a navrženou změnu více fotografií nechá na pozdější společnou aktualizaci. Test byl historicky označen **SPLNĚNO** – samotná základní interakce funguje, ale plánovaná vzhledová úprava není tímto vyřešena.
**Rozsáhlá předchozí dohoda zobrazená během testu 10 (01:28–01:36), zachovat jako závazný kontext:**
1. Jedna poznámka může obsahovat text, jednu či více fotografií a/nebo hlasovou nahrávku; je navázaná na konkrétní místo fotografie.
2. Prázdná poznámka zobrazí výzvu **„Klikněte pro zadání textu“**; po vyplnění skutečný text, po vložení fotografie náhled.
3. Text a přiložené fotografie tvoří **jeden celek**: rámeček se přesouvá společně s přílohami, ale **hrot spojovací šipky je nezávislý**. Přesun rámečku nesmí přesunout bod na fotografii, na který poznámka ukazuje; spojovací čára se přizpůsobí. Spojení se má objevit i u původně prázdné poznámky, jakmile se rámeček odtáhne.
4. V klidu **jen žlutý hrot**, nikoli trvalá bílá tečka; bílý úchop při editaci.
5. Klepnutím na text/náhled zachovat **stávající nabídku úprav**; nevymýšlet jinou navigaci.
6. Více fotografií reprezentovat **jako několik mírně přesazených papírových listů s lehce přehnutými rohy**: první fotografie vepředu, v pozadí naznačené další, malé číselné označení počtu (2, 5 atp.). Celá skupina je pořád jedna poznámka. Toto je **schválené vzhledové vylepšení pro společnou aktualizaci**, nikoli chyba základního fungování.
7. Hlasová poznámka má být na první pohled rozeznatelná **ikonou mikrofonu**.
**Oddělený budoucí nápad:** vlastní poznámkový blok se S Pen a možné propojení se Samsung Notes, vyhodnoceno jako větší úprava do budoucna; **neplést** s okamžitě schváleným vzhledem více fotek.
**Důkazy:** hlavní video přibližně 01:28–01:42. Související snímky na telefonu je možné odlišit podle obsahu; přesný název původní přílohy pro tento test není bezpečně čitelný.
**Status:** tehdy základ splněn + schválený vzhledový backlog; retest po realizaci.

## Test 12 – Symbol
**Původní postup:** vložit symbol na fotografii, označit jej, přesunout, případně upravit/změnit symbol a znovu jej označit.
**Uživatel:** vkládání a přesouvání funguje, přepisování/výměna symbolu také; tehdy nebyly řešeny velikost ani otočení.
**Výsledek:** **SPLNĚNO**.
**Nápad explicitně odložený, nikoli schválený:** někdy později umožnit symbol **zvětšovat a otáčet**; nejdřív posoudit smysl a potřebnost, neimplementovat jako součást této dávky.
**Důkaz:** hlavní video cca 01:40–01:44. Výslovně rozlišit „funguje“ a „možná později“.

## Test 13 – Laser Bosch a historie měření
**Původní postup:** připojit Bosch přes Bluetooth, nakreslit běžnou kótu Rozměr, změřit a ověřit přenos hodnoty i historii.
**Důkaz:** v hlavním chatu se přímo objevuje **1000093532.mp4** (historická příloha nyní není pod tímto názvem k dispozici). Doplňující **Screen_Recording_20261104_013507.mp4** ukazuje obrazovku „Měřič Bosch“ a velmi dlouhý systémový seznam Bluetooth zařízení.
**Výsledek:** přenos skutečně naměřených hodnot a historie v testu **fungovaly**. Problém bylo **připojování**: laser se v seznamu nenašel/opakovaně nezobrazoval; pomohlo až úplné ukončení a nové spuštění aplikace. Seznam ukazoval sluchátka, hodinky a další nesouvisející zařízení, i když uživatel potřeboval pouze svůj laser.
**Finální dohoda z cca 01:44–01:50:**
1. Hledání/připojení **nespouštět automaticky při startu aplikace**.
2. **Klepnutí na ikonu Bluetooth** spustí hledání laseru; přednostně vyhledá a **bez dalšího potvrzení připojí dříve zvolený Bosch**.
3. Po úspěchu se na ikoně jasně zobrazí stav připojeno. Je-li laser mimo dosah, ukázat srozumitelný stav a možnost znovu zkusit.
4. Opakované kliknutí musí **obnovit hledání bez restartování aplikace**, i když první pokus selhal.
5. Dlouhý obecný seznam zařízení **neukazovat při běžném připojování**, ale ponechat možnost zvolit **jiný laser** ručně.
6. Nepřijít o fungující přenos hodnot a historii; odlišit chybu připojení od samotného měření. Přímé použití naměřených hodnot **v dalších nástrojích** řešit ve vazbě na jejich vlastní testy.
**Status:** částečně funkční (měření/historie ano, vyhledávání/obnova spojení ne), oprava spojení schválena.

## Test 14 – Zpět a Znovu
**Původní postup:** nakreslit čáru a kruh, několikrát kliknout Zpět/Znovu; ověřit postupné odstranění a obnovu, při nedostupné akci vizuálně **ztlumenou neaktivní šipku**.
**Uživatel:** chování Zpět/Znovu bylo správné, ztmavnutí neaktivní šipky také.
**Výsledek:** **SPLNĚNO**, bez úpravy.
**Zdroj:** hlavní video cca 01:48–01:50.
**Pozor na chybu starého deníku:** test 14 **není Volná ruka**. Dřívější přiřazení bylo chybné; skutečná volná ruka je test 10.

## Test 15 – Úprava spodní lišty nástrojů
**Původní postup:** spodní lištu vytáhnout přejetím nahoru, podržet ikonu, přemístit ji na jiné místo, zavřít editor a znovu otevřít: **rozmístění má přetrvat**.
**Výsledek:** rozbalení, přizpůsobování pořadí a přetrvání rozložení bylo uživatelem oznámeno jako funkční; historicky **SPLNĚNO**.
**Malá, ale schválená vzhledová oprava:** ikona **tří teček** ve spodní nabídce byla fialově zvýrazněná, jako by představovala aktivní kreslicí nástroj. **Tři tečky musí být neutrální** i při rozbalení nabídky; fialové zvýraznění pouze pro skutečně aktivní nástroj. Bez změny rozbalování a řazení.
**Důkazy:** hlavní video cca 01:50–01:54, přiložený screenshot lišty v chatu. Video Screen_Recording_20261104_014404.mp4 ukazuje spodní rozbalenou lištu, ale primárně slouží testu 16; toto přiřazení jen podpůrné.

## Test 16 – Magnetické přichytávání a úchopy kót
**Původní postup:** vytvořit dvě čáry se spojenými konci, **odtáhnout jeden konec**, vypnout přichytávání a zopakovat.
**Výsledek podle původního videa 1000093535.mp4:** magnet jako takový **funguje**, ale při úchopu **bílého koncového kroužku** někdy aplikace přesouvá **celou kótu** namísto zvoleného konce. Uživatel zdůraznil, že podobně se to chová u **Kóty, Čáry i Šipky**; problému se mohou týkat i další tvary. Není podložené, že magnet musí být nahrazen.
**Dohodnutá společná oprava (01:54–02:08):**
1. Uchopení **koncového/rohového bílého úchopu** mění jen konkrétní konec/roh.
2. **Střed čáry nebo objektu mimo úchopy** přesouvá celý objekt, ne koncový bod.
3. Při překryvu dotykových oblastí má **jednoznačnou přednost konkrétní koncový úchop**.
4. **Nesnižovat ani nezvětšovat dotykovou citlivost či velikost kroužků**, protože chyba leží ve vyhodnocování dotyku.
5. Magnetické přichytávání **zachovat**, ale oba přichycené konce se musí dát přesně a bez nechtěného přesunu celé kóty odpojit. **Vypnutí magnetu** má opravdu zabránit dalšímu přichycení, předchozí stav však v tomto videu není u všech variant definitivně doložen.
6. Závadu opravit **centrálně** pro všechny skutečně postižené kreslicí nástroje, ne třemi izolovanými zásahy.
**Výsledek:** historicky **ČÁSTEČNĚ SPLNĚNO**, potřeba opravit rozpoznávání úchopu.
**Důkazy:** hlavní video cca 01:54–02:08; označená příloha 1000093535.mp4 (původní název, v této sadě chybí) a tematicky Screen_Recording_20261104_014404.mp4.

## Test 17 – Barva a tloušťka čar
**Původní postup:** změnit barvu a tloušťku již nakreslené kóty, zrušit označení a znovu vybrat; ověřit zachování. V průběhu došlo ke krátkému nedorozumění: uživatel nejdříve odkazoval zpátky na **problém úchopů z testu 16**, nikoli na barvu. Tato část **není důkazem** chyby nastavení barvy.
**Samostatný pozdější test:** historická příloha 1000093536.mp4 (označená kolem 02:10), tematicky dostupné Screen_Recording_20261104_015015.mp4. U již nakresleného objektu **změna barvy ze spodního výběru nebyla správně použitá**. Uživatel navrhl umístit barvu **do kontextových úprav konkrétního objektu**, nikoli spoléhat jen na spodní paletu.
**Finální rozhodnutí (02:08–02:16):**
- Při označení existující kóty/čáry/šipky otevřít její **Úpravy** a nabídnout položku **Barva**; výběr se projeví ihned přímo na konkrétním objektu, trvale se uloží a jde změnit kdykoliv znovu.
- **Spodní paletu barev ponechat** pro kreslení nových prvků; neodstraňovat fungující rychlou volbu.
- **Tloušťka čáry** šla změnit a **velikost písma** šla změnit; tyto funkce **zachovat**, nejsou součástí opravy barvy.
- Obdobnou změnu barvy v úpravách nabídnout ostatním relevantním typům kreslených objektů; přesný rozsah má být kontrolován podle kódu.
**Výsledek:** historicky **ČÁSTEČNĚ SPLNĚNO**, chyba barvy již existujícího objektu; tloušťka a font fungují.
**Důležité:** v části starého chatu se na okamžik objevilo duplicitní označení „test 17 – Směrovat“ před konečným správným **testem 18**. Správná čísla: **17 = Barva a tloušťka; 18 = Směřovat**.
**Důkazy:** hlavní video cca 02:06–02:16; 1000093536.mp4 v konverzaci, doplňkové Screen_Recording_20261104_015015.mp4.

## Test 18 – Směřovat (správný název!)
**Původní postup:** vložit značku na fotografii, přesunout ji, upravit a znovu vybrat.
**Přesně zdokumentovaná změna názvu (cca 02:20–02:22):** uživatel opravil předchozí automaticky použitý název „Směrovat“. **Nástroj se správně jmenuje Směřovat**. Používat toto označení v testech, plánu i aplikaci, pokud se má text v UI opravovat.
**Srovnávací zdroj:** v původním chatu fotografie a video **1000093539.mp4** předváděly označení konkrétního bodu ve **ImageMeteru**: malý žlutý křížek / kolečko s křížkem a vedle něj rozměr 54 mm. Nástroj má značit **jeden konkrétní bod**, není to další běžná lineární kóta.
**Finální schválené chování (02:20–02:30):**
1. **Značka kolečka s křížkem má pevnou velikost**; žádné úchopy na zvětšování (zachovat jednoduché ovládání).
2. **Chycení za střed kolečka** přemístí celé označení na libovolné místo fotografie; ve finální verzi se s ním přesune i popisek a zachová se jejich vzájemné uspořádání.
3. U bodu lze zobrazit **libovolný vlastní text** („Voda“, „Odpad“) a/nebo číselný rozměr; lze jej kdykoli upravit, připsat ručně, převzít z **Bosch** nebo z historie měření.
4. **Chycením samotného popisku** se posune **jen popisek** kolem pevné značky v **celém rozsahu 360°**, jako ručička hodin: vlevo/vpravo/nahoře/dole i mezi polohami; značka zůstává na místě.
5. Při tomto pohybu **text zůstává vodorovný, čitelný a neotáčí se o 360°**; mění se pouze poloha textu kolem značky.
6. Barva značky/popisů má být později měnitelná v úpravách značky, v souladu s testem 17.
7. **Žádné nové tlačítko**, gesta prstem nebo S Pen.
**Status:** původní chování vyžadovalo úpravu; specifikace byla výslovně přijata. Implementaci a retest zatím nezaměňovat.
**Důkazy:** hlavní video cca 02:16–02:30, původní 1000093539.mp4; Screenshot ImageMeteru v chatu. Screen_Recording_20261104_015435.mp4 ukazuje práci se značkou připomínající terčík, přiřazení podle tématu.

## Test 19 – Fotografie: přiblížení, posun, přizpůsobení
**Původní postup:** otevřít fotografii, přiblížit/oddálit dvěma prsty, posunout zvětšený obraz, ověřit tlačítko Přizpůsobit fotografii a zachování polohy anotací.
**Důkaz:** původní 1000093545.mp4 je označené v hlavním chatu; tematicky přiložený screenshot **1000093546.jpg** zachycuje otevřenou fotografii s větším zobrazením v ImageMeteru.
**Zjištění:** v Zaměřovači byla fotka po otevření automaticky zmenšená tak, aby se vešla **celá**; uživatel vnímal velké nevyužité šedé okraje a musel obraz ručně přibližovat. ImageMeter po otevření vyplní **větší část pracovní plochy**, případně část snímku přetéká mimo obrazovku a dá se posunout. Při velkém zoomu se objevuje **mřížka drobných kostek**, která je spojena se zapnutým přichytáváním, ne s kvalitou fotografie.
**Dohodnutá úprava:** (1) výchozí zobrazení fotografie při otevření **větší, využívá dostupný pracovní prostor** podobně jako ImageMeter; lze obraz přibližovat, posouvat a dostat se i k oříznutým částem; (2) **mřížku vizuálního přichytávání oddělit od přichytávání bodů**, aby při přiblížení nerušila pohled na fotku; (3) **všechny kóty a poznámky musí při transformacích zůstat na přesně stejných místech původní fotografie**, neodpojit se od obsahu.
**Pozdější důležitá změna rozhodnutí (02:36–02:42):** funkce **Přizpůsobit fotografii** ve skutečnosti existovala, ale v aktuální verzi byla **schovaná pod horními třemi tečkami**, ne jako trvalá horní ikona. **Nezavádět duplicitu**, ponechat v nabídce; při kliknutí zobrazí celý snímek. Uživatel jen navrhl, zda by nebylo někdy vhodné tlačítko odstranit či změnit — **tuto konkrétní změnu tlačítka odložit jako nezávazný nápad**, schválená je úprava výchozího zoomu.
**Status:** historicky částečně funkční; schválené výchozí přiblížení a nerušivá mřížka; tlačítko neměnit bez další dohody.

## Test 20 – Procházení fotografií
**Původní test:** otevřít fotografii, přejít na další a zpět, ověřit zachování kót/poznámek.
**Screenshot/poznámka:** uživatel zakroužkoval **dvě horní šipky ‹ a ›** vedle náhledu aktuální fotografie, které považoval za zbytečné, protože se lze přesouvat přes galerii.
**Finální dohoda (cca 02:42–02:46):**
- **Odstranit jen horní šipky ‹ ›** pro přepínání mezi fotografiemi.
- **Malý horní náhled fotografie ponechat**: klepnutí na něj otevře galerii, tam se vybere jiná fotografie.
- **Spodní šipky Zpět a Znovu ponechat** – slouží historii úprav, nikoli navigaci mezi fotkami.
- Po výběru jiné fotografie a návratu **zůstávají její kóty i poznámky zachovány**; uživatel to výslovně potvrdil.
**Status:** vlastní přepínání/prohlížení **SPLNĚNO**, schválená drobná změna horního panelu.
**Důkaz:** hlavní video cca 02:40–02:48, nahraný screenshot **1000093548.jpg** se zakroužkovaným horním ovládáním.

---
**Navazující nutnost:** před implementací porovnat všechny body se skutečným aktuálním kódem a ponechat testy, u kterých není ověřená oprava na fyzickém zařízení. **Přílohy na GitHub nekopírovat bez potřeby**, jde o soukromé fotografie. [Testy 1–10](REKONSTRUKCE_TESTU_01_10.md) | [Deník #13](https://github.com/zaplikj30-ui/Zamerovac-android/issues/13)
