# Zaměřovač v1.2.146 – rekonstrukce testů 1–10
**Hlavní zdroj:** původní záznam konverzace 1000093687.mp4 (úseky přibližně 00:04–01:36; pozdější návraty v rámci úseku zohledněny). **Stav:** rekonstrukce zadání z obrazovkového záznamu, nikoli potvrzení funkčnosti nejnovějšího APK. Obrázky/videa níže jsou doklady tématu, nikoli nutně totožná příloha z původního chatu. Tam uvedené soubory 1000093xxx.mp4 nejsou všechny samostatně nahrané; přiřazení podle obsahu je označeno zvlášť.

## Zásadní společné dohody v této části
- Stejný princip práce napříč nástroji: konec/roh mění **jen svůj bod**, střed čáry/tvaru přesouvá **celý objekt**, popisek lze přesouvat **nezávisle** bez změny geometrie; pokud se dotykové plochy překrývají, **přednost má koncový úchop**. Nepřidávat zbytečná tlačítka.
- Každý vhodný rozměr lze zadat ručně, **laserem Bosch**, případně vybrat z historie. U vícestranných tvarů před měřením určit správnou stranu.
- Bílé úchopy: rozlišit **vzhled** a **dotykovou citlivost**. Měnit jen dohodnuté vizuální umístění/velikost, nezhoršovat funkční dotykovou oblast. U označeného tvaru jsou úchopy viditelné, po odznačení zmizí, ale samotný tvar zůstává.
- Stav každého testu je podle tehdejšího uživatelského zkoušení v TEST v1.2.146, nikoli podle dnešního zdrojového kódu. Na skutečnou implementaci/retest navazuje samostatná kontrola.

## Test 1 – Šipka
**Původní postup (00:04–00:08):** Otevřít fotografii; nakreslit nástrojem Šipka; otevřít úpravy; napsat např. „Voda“ a zadat 500 mm; uložit; ověřit zobrazení šipky, textu, rozměru; přemístit šipku a otevřít znovu.
**Uživatelské zjištění:** vykreslení šipky, zadání popisku a kóty, uložení i přesun celého objektu fungovaly.
**Dohodnutá úprava (00:08–00:12):** dotykem textu/číselného rozměru lze **samotný popisek posouvat podél šipky doleva/doprava**, aniž se přemístí šipka; posunutá poloha se uloží. Sjednotit s nástrojem Čára. **Bez nového tlačítka.** U čáry i šipky později schváleno také přímé přiřazení hodnoty z Bosch (viz test 2).
**Status:** historicky částečně splněno; rozšíření schváleno, ověření opravy v nové APK chybí.
**Zdroj:** hlavní video 00:04–00:14. Související ukázky čáry/šipky ve videích Screen_Recording_20261104_004433.mp4 a Screen_Recording_20261104_005059.mp4 (přiřazení podle funkce, nikoli shoda s historickým názvem původní přílohy).

## Test 2 – Čára
**Původní postup (00:10–00:14):** vytvořit čáru, přidat „Voda“, rozměr 500 mm, uložit, přemístit celý objekt, znovu otevřít a ověřit zachování obou údajů.
**Uživatelské zjištění:** kreslení, zadání textu/rozměru, uložení a přemístění celé čáry fungovalo; následně uživatel výslovně navrhl připojit laser Bosch i pro Čáru/Šipku, nejen ruční zápis.
**Finální dohoda:** (1) vybrat konkrétní Čáru nebo Šipku → změřit Bosch → **hodnota se zapíše přímo do její kóty**; (2) alternativně vybrat starší naměřenou hodnotu z historie; (3) text/číslo přemístit po čáře nezávisle na celé geometrii; žádné další tlačítko; úpravy sloučit do společného vydání.
**Status:** základ funkční, dohodnuté rozšíření zbývá ověřit po implementaci.
**Zdroj:** hlavní video 00:10–00:16; viz také výše uvedená videa.

## Test 3 – Lomená čára
**Původní postup (00:16–00:18):** nejméně tři úseky; každému vlastní rozměr a text; přesouvání jednotlivých bodů; následná úprava rozměrů; přidání/odebrání bodu. U asistenta bylo výslovně řečeno, že se má posoudit i logika ovládání.
**Důkaz z testu:** původní příloha 1000093514.mp4 je **viditelně označená v hlavním videu**, samostatný soubor stejného jména zde zatím není. Uživatel píše, že „lomená čára zmizí pod označením“, kreslí pořád nové čáry a nejde ji prakticky ukončit. Nedostane se tak k zadávání rozměrů a popisků (00:18–00:22).
**Dohodnutá oprava:** **dvojité klepnutí na poslední bod** ukončí kreslení; výsledná lomená čára zůstane na fotografii a automaticky se označí; každý úsek má zvlášť text a rozměr, který jde zadat ručně nebo Bosch; body i celou čáru lze následně přemísťovat. **Nepřidávat další tlačítko.** Kvůli blokujícímu dokončování nebyly ostatní podkroky reálně ověřené.
**Status:** nefunkční/blokováno; oprava dohodnuta, po implementaci retest všech podkroků.
**Zdroj:** hlavní video 00:16–00:24; tematicky Screen_Recording_20261104_004433.mp4 (kreslení), ale nejde prokázat, že odpovídá přímo příloze 1000093514.mp4.

## Test 4 – Dimenzní řetězec
**Původní postup (00:24–00:26):** nakreslit tříúsekový řetězec; ukončit posledním bodem; zkontrolovat, že objekt zůstane; pak zadat vlastní rozměr a text jednotlivým úsekům.
**Zjištění:** uživatel hlásí **stejný problém jako u lomené čáry** – řetězec nelze správně dokončit, a tím se nedá ověřit následná editace. Vysvětlení rozdílu: dimenzní řetězec měří rozměry **mezi sousedními body**, např. 300, 400 a 500 mm (00:32–00:34).
**Finální dohoda:** společná oprava ukončení a zachování objektu (včetně přechodu do úprav), následně individuální změna bodů, textů a hodnot včetně Bosch; dimenzní princip zachovat, nezaměňovat s kumulativním.
**Status:** historicky nefunkční – zablokované další ověření.
**Zdroj:** hlavní video 00:24–00:34, bez jednoznačně identifikovaného samostatného videa.

## Test 5 – Kumulativní řetězec
**Původní postup (00:26–00:30):** nakreslit, dokončit a přiřazovat vzdálenosti od **jednoho společného počátku/nuly**. Příklad: 300, 700, 1200 mm (ne mezery 300+400+500 – to patří dimenznímu řetězci). Uživatel si nechal smysl nástroje vysvětlit, např. zásuvky, voda a odpad od jednoho rohu místnosti.
**Důkaz:** hlavní video ukazuje vloženou přílohu **1000093518.mp4** (samostatný soubor pod tímto názvem nyní nepřiložen). Vznikal **nepřehledný vějíř žlutých čar**, číselné štítky se překrývaly a po dokončení kresba zmizela. Uživatel navrhl **funkci i zlepšit**, ne jen obnovit dokončení (00:36–00:40). Doplňkové video Screen_Recording_20261104_005059.mp4 vizuálně ukazuje shluk mnoha žlutých kót u jednoho místa; tématická shoda vysoká, identita původní přílohy neověřená.
**Dohodnuté cílové chování:** vybere se výchozí bod (nula) a směr měření, poté další body; všechny kóty se přehledně řadí v daném směru od společné nuly, **ne jako vějíř v různých směrech**. Číselné štítky samostatně pohyblivé tak, aby se nepřekrývaly; ruční zápis či Bosch pro každou hodnotu; dokončení **dvojklepnutím na poslední bod**. Zachovat objekt po dokončení i možnost následné editace.
**Status:** historicky nefunkční a návrh jeho přepracování schválen; nelze považovat za opravené jen podle změn kreslení.
**Zdroj:** hlavní video 00:26–00:40, zmínka 1000093518.mp4, doplňkově 005059.mp4.

## Test 6 – Úhel
**Původní postup (00:28–00:40):** označit tři body: konec prvního ramene, vrchol, konec druhého ramene; sledovat stupeň úhlu; přemístit vrchol či konce; ověřit přepočet. Uživatel řekl, že kreslení a ovládání **asi funguje**, ale správnost úhlu **neuměl potvrdit** (má se zkusit jednoduchých 90°).
**Podrobná dohoda (00:40–00:44):** kromě stupňů úhlu musí být u každého ramene vlastní délka (ilustrační 850 a 1200 mm). **Tři současné čitelné hodnoty**: úhel a obě délky. Každé rameno samostatně zvolit pro ruční nebo Bosch měření, zapsat na správnou stranu. Přidat vlastní text a **posouvat jej po příslušném rameni**, aniž se mění úhel/geometrie. Hodnota úhlu má zůstat u vrcholu, texty lze posouvat.
**Status:** ovládání předběžně funkční; přesnost úhlu nepotvrzena; doplnění funkcí schváleno.
**Zdroj:** hlavní video 00:28–00:44; pro podobu je přímo v záznamu grafický návrh.

## Test 7 – Plocha → pozdější finální název Lichoběžník
**Původní postup (00:44–00:46):** nakreslit obdélníkovou plochu, zadat šířku/výšku, sledovat m² a po uložení znovu editovat. Snímek ukazoval rozměry 1000 mm a 1000 mm a výpočet 1 m², ale **úchopy nebyly ve všech čtyřech rozích**. Odpovídající dodaný screenshot **1000093519.jpg**; obdobná ukázka je v Screen_Recording_20261104_010328.mp4.
**Původní domluva (00:46–00:52):** čtyři úchopy (všechny čtyři rohy), **každý roh táhnout zvlášť**, středovým úchopem přesouvat celý tvar, zachovat kóty a plochu. Uživatel připomněl dříve řešený lichoběžník. Důležité: **tato dohoda byla dál zpřesněna**, proto je nutné použít finální podobu níže.
**Finální rozdělení nástrojů (00:54–01:08):** původní nástroj **Plocha přejmenovat na Lichoběžník**; může z něj vzniknout i jiný nepravidelný čtyřúhelník. Každý ze čtyř rohů se pohybuje **nezávisle**, každá ze čtyř stran má **vlastní rozměr** zadaný ručně či Bosch a vlastní přemístitelný text. Celý tvar se přesouvá uchopením středu **společně se všemi rohy a popisky**, bez deformace. Údaj **plochy v m² zůstává vždy automaticky uprostřed tvaru**, nelze jej samostatně přesunout; při přemístění/změně tvaru se jeho poloha aktualizuje. **Přesnou plochu nepravidelného čtyřúhelníku nelze získat pouze ze čtyř délek stran** – výpočet vyžaduje další geometrický údaj (výšku, úhlopříčku, příp. vhodně určený úhel), detail způsobu zadávání je nutné při implementaci upřesnit a nesmíme si domyslet vzorec. Žádné nové tlačítko; samostatný nástroj Obdélník zůstává.
**Status:** historicky částečně funkční, finální redesign schválen; přesný algoritmus výpočtu nepravidelného tvaru je otevřená technická otázka.
**Zdroj:** hlavní video 00:44–01:08, 1000093519.jpg, Screen_Recording_20261104_010328.mp4. Tato finální podoba **přepisuje dřívější stručné „doplnit čtyři rohy“**.

## Test 8 – Obdélník
**Původní postup (00:48–00:56):** zjistit dostupnost čtyř rohů, přesunu celku, změny šířky/výšky a textu. **Pozdější finální dohoda** vznikla při porovnání s Plochou/Lichoběžníkem.
**Finální chování:** zůstává **samostatným jednoduchým nástrojem Obdélník**; při tahu rohu se stále drží **pravé úhly 90°** (na rozdíl od Lichoběžníku). Pouze dvě nezávislé hodnoty **šířka a výška**, ručně či přímo laserem Bosch; měření horní/dolní stranou má mířit do šířky, levá/pravá do výšky. Čtyři viditelné rohové úchopy upravují rozměr, střed přesouvá celý objekt beze změny rozměrů. Vlastní texty u stran jsou posuvné nezávisle. Obsah v m² se přepočítává z rozměrů a zůstává **automaticky ve středu** včetně po přemístění/změně velikosti.
**Společné UX:** není nutné přidávat tlačítko; výběr konkrétní strany při Bosch měření, jednoznačná priorita koncového úchopu; dotykovou citlivost nepředělávat bez domluvy.
**Status:** původní stav v APK v tomto úseku není kompletně potvrzen všemi podkroky; finální specifikace funkcí schválena.
**Zdroj:** hlavní video 00:48–01:08, srovnávací ilustrace v původním chatu.

## Test 9 – Kruh **i elipsa**
**Původní postup (01:08–01:20):** nakreslit kruh; středem přemístit celý, úchopy měnit velikost, v úpravách zadat průměr Ø / poloměr R ručně/Bosch a vlastní text; vyzkoušet elipsu a nezávislou úpravu šířky/výšky.
**Přílohy v původním chatu:** viditelně 1000093525.mp4 (kruh) a 1000093528.mp4 (elipsa), zde samostatně nenahrané pod tímto názvem. Doplňující videa Screen_Recording_20261104_010328.mp4, 010354.mp4, 010521.mp4, 011043.mp4 ukazují kruh, elipsu, úchopy, editor hodnot a chování laseru (tematické spárování).
**Historické závady:** (a) u **kruhu** se bílé úchopy chovaly neintuitivně a někdy měnily tvar/polohu nepředvídatelně; (b) u **elipsy** její **natahování a zmenšování ve směrech fungovalo**, ale **bílé úchopové kroužky zůstávaly mimo žlutý obrys**, nedržely na něm; (c) u kruhu naměřená hodnota Bosch skončila v historii, ale **nezapsala se do právě upravovaného kruhu**, historie nebyla dostupná v úpravách; (d) nebylo spolehlivé, kde klepnout, aby se kruh vybral a otevřely úpravy.
**Finální cílové chování (01:12–01:30):**
1. **Klepnutí na žlutý obvod** kruhu nebo elipsy označí objekt a ukáže **všechny** úchopy. Samotné klepnutí **nesmí měnit rozměry ani nečekaně otevřít nabídku**. Dvojklepnutí na vybraný objekt otevře editor.
2. Po dokončení kreslení a při označeném objektu úchopy zůstávají viditelné; klepnutí mimo tvar je skryje, ale tvar zůstane uložen.
3. **Tažení za bílý úchop** mění velikost/tvar, nikoli přemístění celého objektu. **Tažení za vnitřek/střed** přesouvá celý objekt s rozměrem a popiskem. **Tažení za popisek** mění jen pozici popisku.
4. **Každý střed bílého kroužku musí ležet přesně na žlutém obrysu** kruhu/elipsy, kroužek má žlutou čáru **obklopovat, ne překrývat**, a při transformaci tvaru se musí pohybovat společně s obrysem, nikoliv zůstat na staré poloze.
5. **Dotykovou citlivost úchopů neměnit.** Rozlišit vizuální umístění od zásahu do dotykové oblasti. Stejné zásady u obou tvarů (a kde smysluplné i jinde).
6. Při zadávání Ø/R lze převzít **aktuální Bosch hodnotu přímo** a vybrat z historie; ruční vstup zachovat. Výběr kruhu/editace musí fungovat i prstem.
**Status:** kruh i elipsa částečně funkční, několik konkrétních závad; přesnost a sjednocení úchopů zásadní. **Nezjednodušovat na problém pouze elipsy.**
**Zdroj:** hlavní video 01:08–01:30; původní přílohy dle označení v chatu, doplňující videa výše.

## Test 10 – Volná ruka
**Původní postup (01:28–01:36):** nástrojem Volná ruka něco nakreslit, označit, přesunout **celou kresbu**; ověřit pozici úchopů.
**Uživatelský výsledek:** „Volná ruka funguje normálně. Přesouvá se, úchopové body jsou, kde mají být.“ V chatu byl test označen **SPLNĚNO, bez připomínek**.
**Důležité omezení:** v jiných předběžných souhrnech byla omylem uvedena chyba „volné kresby“ pod jiným číslem. Tento **historický test 10** má výslovně pozitivní výsledek; případné pozdější vady se musí doložit samostatně a nesmí jej přepsat bez zdroje.
**Status:** historicky splněno, při budoucí aktualizaci pouze regresní kontrola.
**Zdroj:** hlavní video 01:28–01:36.

---
**Zůstává ověřit:** shodu konkrétních původních příloh s nově pojmenovanými Screen_Recording videi, úplný verbatim text v rychle posouvaných či částečně překrytých úsecích a přesný stav posledního zdrojového kódu. Všechny podstatné pozdější změny známé v úseku jsou zapracované; pokud se objeví další dodatek v testech 11–28, musí se sem vrátit. [Hlavní rozcestník](START_ZDE.md) | [Deník](https://github.com/zaplikj30-ui/Zamerovac-android/issues/13)
