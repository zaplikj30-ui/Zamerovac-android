# AGENTS.md — Zaměřovač (Android)

## Účel a kontext
Tento repozitář je SAMOSTATNÝ projekt `Zamerovac-android`. Neměň repozitář `Prevadec-spojitosti`.
Uživatel vyrábí zakázkový nábytek. Vyvíjíme vlastní Android aplikaci na zaměřování zakázek, inspirovanou pracovním postupem ImageMeteru. Nejde o kopii původního kódu, designových prostředků ani o obcházení jeho licence. Komunikuj česky a používej jednoduché vysvětlení, nevyžaduj znovu už schválené volby.

## Úsporné rozdělení práce a ochrana limitů Codexu (rozhodnutí 7. 11. 2026)

**Závazné pravidlo:** Koordinující ChatGPT šetří omezený týdenní limit Codexu a placené kredity. Nemá však šetřit na úkor správnosti, bezpečného ukládání, přesnosti, regresních testů ani dlouhodobé udržovatelnosti. Výběr nástroje odvozuje z aktuálního úkolu, ne z automatického předpokladu, že „všechnu technickou práci musí udělat Codex“.

- **ChatGPT:** GitHub inventura a koordinace, vyhodnocení issues/PR/CI, analýza chyb a architektury, dokumentace, nápověda, historie, malé přesně ohraničené bezpečné úpravy v kódu, je-li možné je spolehlivě provést dostupnými nástroji a ověřit. Nezasahuje do souběžně rozpracované větve jiného chatu či Codexu.
- **Codex:** především náročné programování, selektivní přestavba editoru a geometrie, ukládání/přílohy/synchronizace/souběhy, nativní Android a iterativní testování složitých změn. Nepoužívat ho běžně na prosté dotazy, opakované obecné audity, shrnutí GitHubu nebo dokumentační práci, kterou lze udělat tady.
- **Work:** pouze pokud rozsáhlá vícekroková práce a soubory přinesou měřitelnou výhodu. Nelze předpokládat, že by Work nebo ChatGPT uměly spustit Codex bez skutečně dostupného nástroje.
- **Příprava jednoho efektivního českého zadání:** Koordinátor **nejprve sám** načte `START_ZDE.md`, `AGENTS.md`, relevantní plán, issues, otevřená PR, poslední změny a CI; vyjasní konkrétní potřebný výsledek a předá odkazy, existující testy, známou reprodukci a rozsah. Codex si před změnou i tak sám ověří nejnovější stav a povinná pravidla. Nezopakovat bez potřeby hotovou širokou analýzu; při složité opravě ponechat dostatečný prostor pro diagnostiku a testování.
- **Přednost malých, dokončitelných etap:** Jedno zadání má jedno hlavní téma a jedno ověřitelné kritérium dokončení, může obsahovat nutné související opravy a jejich regresní testy. Nedělit násilně bezpečnostně provázané změny. Navazovat na existující draft PR, nepřepisovat novější commity, bez zbytečných duplicitních issues/commitů. Po ukončení uložit přesné PASS/FAIL/SKIP/NOT RUN a odkazy.
- **Model a kredity:** Doporučit jen skutečně dostupný model a úroveň přemýšlení; náročnější použít, pokud přínos pro kvalitu ospravedlňuje spotřebu. Nepředstírat přesný převod kreditů na programovací úkol. Samostatně nespouštět nákup ani automatické dobíjení. Při vyčerpání týdenního limitu lze pokračovat v kontrole a malých bezpečných změnách mimo rozpracované větve; neblokovat celý projekt a nepředávat Codexu rozsáhlou práci, která zůstane nedokončená.
- **Testy nesmějí být obětí úspor:** Cílené testy průběžně, kombinované testy návazností, širší regrese před jedinou společnou testovací APK. Automatické/simulované/fyzické testy vždy odlišit; bez úspěšného ověření netvrdit, že je oprava hotová.

Tato změna je **jen rozdělení práce a limitů**; sama neautorizuje přepis, merge PR, novou technologii, změnu chování ani vydání APK.

## NEPŘEHLÉDNOUT – aplikace je dosud pouze testovací (uživatel opakovaně potvrdil 7. 11. 2026)

**FAKT:** Uživatel dosud **nemá v Zaměřovači žádné skutečné zákaznické/pracovní zakázky**; aplikaci jen testuje. Neodůvodňuj odmítání nové architektury/případného čistšího přepisu tvrzením, že bychom ohrozili jeho existující ostré zakázky. Uvažuj realisticky i o znovupoužití funkčního kódu a existujících testů. Zachování bezpečného ukládání, přesnosti a editovatelnosti je stále požadavek na **budoucí profesionální kvalitu** a na regresní testy, nikoli tvrzení o dnešních reálných datech. Při rozhodování o pokračování varianty B vs. čistším jádru odděluj skutečné dnešní náklady/limity od hypotetické migrace reálných zákaznických dat. Podrobné dřívější upřesnění a výjimka ze zálohování testovacích dat jsou níže v části [Současný testovací režim](#současný-testovací-režim--zálohy-nejsou-podmínkou-výslovné-upřesnění-uživatele-4-11-2026) a v [issue #42](https://github.com/zaplikj30-ui/Zamerovac-android/issues/42#issuecomment-6700933092). **Toto není automatický souhlas se změnou rozpracovaného PR, přepisem ani novou APK.**

## Povinná rozhodovací brána před významnou přestavbou (7. 11. 2026)

**Poučení z opomenuté otázky Java/WebView vs. Kotlin:** Samotné uložení požadavků na GitHub nestačí. **PŘED** doporučením rozsáhlé přestavby, čistého jádra, přepisu editoru nebo změny technologie musí koordinující ChatGPT/Codex výslovně projít krátký kontrolní bod a výsledek zaznamenat do existujícího [#42](https://github.com/zaplikj30-ui/Zamerovac-android/issues/42):

1. Načíst aktuální stav, rozpracované PR/CI, skutečné technologické vrstvy a schválené požadavky včetně Windows/iOS, přesnosti, výkonu na slabších zařízeních, testů a **testovacího režimu bez ostrých zakázek**. Nesmí předpokládat, že dříve navržená varianta B nebo zachování Javy/WebView je automaticky nejlepší.
2. **Aktivně porovnat** minimálně: (A) ponechat Java + JavaScript/WebView s čistší architekturou, (B) Kotlin + zachování WebView, (C) Kotlin + nativní editor/vykreslování a (D) vhodnou přenositelnou variantu jen tehdy, pokud má konkrétní přínos. U každé posoudit dopad na funkční komponenty, testy, kóty/geometrii, bezpečné ukládání, Bluetooth, Android, budoucí platformy, cenu dokončení a riziko regresí. Nezaměňovat modernější jazyk za automatickou vyšší kvalitu.
3. **Ověřit a doložit závěr** z aktuálního kódu a testů; pokud důkazy chybí, uvést „nevyhodnoceno“ a **nepředkládat předběžný směr jako definitivní technické rozhodnutí**. Oddělit schválené požadavky, odborné doporučení a neodsouhlasenou změnu technologie; určit, co se zachová, co se změní a jak ověřit přínos.
4. **Brána je před zadáním Codexu, nikoli až při kontrole hotového PR.** Už běžící etapu #51 dokončit a vyhodnotit bez souběžného přepisování; její práce není automatickým schválením další architektury. Před další zásadní etapou uživateli stručně předložit srovnání a vyžádat souhlas s velkou změnou.

Tento bod není pokyn spustit nový přepis ani sestavit APK. Kontrolní mechanismus má předcházet opomenutí, ne jen prodlužovat pokyny; při běžné drobné opravě se celý audit neopakuje.

## Povinná kontrola kolizí funkcí a proaktivní péče o architekturu (5. 11. 2026)

**Závazný požadavek uživatele:** ChatGPT má samostatně řídit technickou kvalitu a dlouhodobou stavbu Zaměřovače, nikoli pouze reagovat na seznam viditelných funkcí. Uživatel není programátor. U nových funkcí, oprav i modernizace aktivně hledat, zda se části aplikace navzájem neovlivňují nebo „nebijí“; upozornit na skutečné důvody technických problémů ještě před jejich nahromaděním. Vysvětlovat jednoduše česky; odborné volby a priority navrhovat samostatně.

**Před každou významnou změnou:**
1. Prověřit návaznosti nové funkce na stávající editor, kóty/jednotky, dotyky/S Pen, zakázky a soubory, ukládání, Undo/Redo, import/export, zálohy, synchronizaci, Bluetooth, oprávnění, nastavení, galerii a další relevantní části. Nedovolit tiché přepsání stavu ani rozměrů při přechodu mezi funkcemi.
2. Nové funkce navrhovat s jasnou odpovědností a bezpečným rozhraním; nevrstvit další neprověřenou logiku do jednoho velkého souboru. Zohlednit společné editovatelné datové struktury pro Android, Windows a iPhone/iPad, oddělené od funkcí konkrétního zařízení. Volba Kotlinu/Javy/JS/KMP nebo jiné technologie je nástroj, nikoli cíl.
3. **Povinná kontrola kolizí funkcí:** ke každé relevantní změně kromě samostatného testu připravit aspoň cílené **kombinované scénáře**: nová funkce + sousední starší funkce; vytvořit → změnit → uložit → zavřít → obnovit → exportovat/importovat; Zpět/Znovu, souběh, offline/výpadek, přesné kóty a jednotky. Testy mají ověřit původní hodnoty i data, nejen že obrazovka nespadla. Konkrétní scénáře volit podle rizika, výsledky evidovat v [#28](https://github.com/zaplikj30-ui/Zamerovac-android/issues/28).
4. Po každé významné aktualizaci nezávisle vyhodnotit nejen chyby, ale i místa, kde se funkce vzájemně ovlivňují, a rizika dalšího rozšiřování. Předložit prioritizované konkrétní návrhy s přínosy, nevýhodami, náklady a plánem testů; nečekat, až je odhalí uživatel nebo jiná AI.
5. **I výraznější přepracování aplikace je přípustná možnost**, pokud menší opravy nedokážou rozumně zajistit dlouhodobou bezpečnost, přesnost a udržovatelnost. Nejde o automatický souhlas s okamžitým přepisem od nuly: nejprve doložit konkrétní závady a varianty řešení, srozumitelně doporučit nejlepší cestu a vyžádat schválení konkrétního zásahu. Při rozsáhlé změně mít záložní návratovou cestu, testy před/po, bezpečnou migraci a ochranu stávajících zakázek; neoznačit výsledek za spolehlivý bez fyzického ověření tam, kde je nutné.
6. Uživatel může navrhovat další funkce kdykoli. Pokud má přednost důležitá oprava, stabilizace či příprava architektury, **aktivně to sdělit a zařadit nové nápady na později**. Naopak neodkládat všechny chyby až po dokončení celé modernizace; rozumně kombinovat malé opravy a cílené zlepšování stavby aplikace.

**Aktuální pořadí:** bezpečně dokončit rozpracovanou aktualizaci [#39 / PR #41](https://github.com/zaplikj30-ui/Zamerovac-android/pull/41), provést nezávislou kontrolu kvality a kolizí funkcí; pak podle zjištění navrhnout a provést cílenou modernizaci (případně větší přepracování po samostatném schválení). Nepřepisovat souběžně práci Codexu, nevytvářet APK kvůli dokumentaci. Technické rozhodování a výsledky průběžně evidovat v [#42](https://github.com/zaplikj30-ui/Zamerovac-android/issues/42).

### Povinné porovnání architektury se seznamem funkcí a nápadů (5. 11. 2026)

**Přímý pokyn uživatele:** Koordinující ChatGPT je odpovědný za to, že **sám porovnává technický návrh a skutečnou stavbu Zaměřovače se všemi známými požadavky a možnými budoucími funkcemi na GitHubu**. Uživatel má říkat, co potřebuje, ne sám hlídat architektonické dopady či objevovat rizika.

- Před významnými změnami a povinně po dokončení velké aktualizace [#39 / PR #41](https://github.com/zaplikj30-ui/Zamerovac-android/pull/41) načíst nejnovější [VIZE_A_PLAN.md](VIZE_A_PLAN.md), relevantní issues (zejména #12, #17, #28, #39, #42), současný kód, testy a pravidla. Rozlišit **fungující funkce / schválené zadání / nezávazný budoucí nápad**.
- Zjistit, zda současná architektura bezpečně zvládne zamýšlený rozvoj: samostatné moduly, jednotky a geometrie, stabilní editovatelná data, ochrana a migrace zakázek, různé způsoby ovládání, doplnění měřidel, promítání, vzdálený tisk, sdílení, možné licence a budoucí změny technologií (Java, Kotlin, WebView i alternativy). **Neznámé budoucí funkce** zohledňovat obecně udržitelným návrhem, ne spekulativní implementací každé technologie.
- Proaktivně najít konkrétní místa, která zbytečně ztíží rozšíření nebo způsobí konflikty nových a starých funkcí, a doporučit pořadí oprav. **Říct uživateli srozumitelně, co musíme zlepšit před další funkcí a proč**; pokud je prokázaná zásadní slabina, porovnat menší úpravy s cíleným větším přepracováním.
- Výsledky kontroly a zbývající rizika ukládat do existujícího [#42](https://github.com/zaplikj30-ui/Zamerovac-android/issues/42), relevantní funkční testy do #28. Nevytvářet duplicitní záznamy. **Neimplementovat automaticky nezávazné nápady**, nespouštět nyní konkurenční zásahy do PR #41 ani novou APK kvůli dokumentaci.

### Připravenost na změny a doplnění technologií (5. 11. 2026)

**Upřesnění uživatele:** Zaměřovač musí být stavěn tak, aby bylo možné v budoucnu **přecházet na vhodnější technologie, přidávat nové technologie a funkce** bez zbytečného rozsáhlého přepisování a bez vzájemného rozbíjení existujících funkcí. Nelze zaručit nulové potíže, ale architektura má rizika předem omezovat.

Před zavedením nové technologie či významnější funkce vždy posoudit její kompatibilitu se stávajícím kódem a daty, závislosti na ostatních modulech, bezpečný postup výměny/rozšíření, návrat při neúspěchu a kombinované testy starého i nového chování. Preferovat jasně vymezené a vyměnitelné části, dokumentované a verzované datové formáty a oddělení společných pravidel od Android/Windows/iOS. Nesmí se měnit rozměry, ztrácet originály, zakázky ani editovatelnost. **Nenabírat technologie jen proto, že jsou nové**; vybrat je podle skutečného dlouhodobého přínosu. Pokud zjištěná architektura bezpečné rozšiřování neumožňuje, navrhnout cílené nebo případně větší přepracování s testy, porovnáním variant a schválením rozsahu.

**Praktický postup, kterým snižujeme náklady a riziko budoucí výměny technologie (7. 11. 2026):**
1. **Při dnešním vývoji** držet přesné hodnoty, jednotky, geometrii, ID objektů, editovatelné anotace a pravidla ukládání mimo konkrétní obrazovku, renderer a API telefonu. Nové části mají jasně vymezené vstupy/výstupy; nedělat závislosti na globálním stavu, pokud se jim lze rozumně vyhnout.
2. **Udržovat ověřitelné kontrakty a testy:** výchozí syntetická data, původní fotografie, přesné laserové hodnoty, souřadnice, Undo/Redo, import/export, historie, synchronizace a obnovení po chybě. Při změně technologie musí stejný scénář ověřit starou i novou implementaci včetně skutečných pixelů a dotyků, ne jen úspěšné kompilace.
3. **Před každým zásadním technologickým rozhodnutím** podle rozhodovací brány výše zkontrolovat podporu Android/Windows/iOS/iPadOS, výkonnost i slabších zařízení, bezpečnost, převzetí funkčního kódu/testů, skutečné náklady a rizika. Změnu navrhnout jen při podloženém přínosu; výběr a rozsah zásadní migrace schvaluje uživatel.
4. **Pokud ke změně dojde:** nejprve malý reprezentativní prototyp nebo oddělený modul, potom postupná náhrada s regresními a chybovými testy, měřením odezvy, možností bezpečného návratu a kontrolou kompatibility dat. Nikdy nepřepisovat celý systém souběžně s rozpracovaným PR naslepo; skutečná fyzická kontrola zůstává samostatnou bránou.
5. **Realistické očekávání:** cílem je omezit zbytečně rozsáhlý přepis a počet chyb, **nikoli slíbit bezchybný nebo levný přechod za všech okolností**. Pokud je starý a nový renderer zásadně odlišný, část UI a testů může vyžadovat novou implementaci; uvést to před schválením.

**Stav:** pracovní pravidlo; žádný okamžitý přechod frameworku, změna kódu ani vydání APK.

### Výhledová nezávislost na technologiích, promítání a vzdálený tisk (5. 11. 2026)

**Upřesnění uživatele:** Nejde pouze o nové operační systémy. Zaměřovač má být technicky připravený na případnou **změnu či doplnění programovacích jazyků, frameworků, vykreslování a komunikačních technologií** (např. Java, Kotlin, JavaScript, WebView či něco, co dnes neznáme). Stabilní data, geometrie, hodnoty kót, jednotky a editovatelné objekty nemají zbytečně záviset na jedné technologii. Připravovat rozumné hranice mezi částmi, nepreventivně nezavádět každou myslitelnou knihovnu. Před konkrétní změnou posoudit reálný přínos, migrační rizika, kompatibilitu a testy.

**Budoucí nápad, zatím nepovinná funkce: „Promítat“ s ikonou Cast.** Možnost vyslat pracovní obrazovku nebo vybranou fotografii s kótami / náčrt na TV, monitor, projektor či jiný displej **bez vazby na Samsung nebo jediného výrobce**. Před návrhem zmapovat systémové zrcadlení, bezdrátové technologie (Google Cast/Chromecast, Miracast, AirPlay a další dostupné způsoby dle platformy), kabelový výstup a možnost vlastní cílené prezentace. Tyto způsoby **nejsou navzájem zaměnitelné a nemusí být dostupné v každé kombinaci zařízení**; neslibovat univerzální výčet všech přijímačů z jednoho tlačítka. Při realizaci chránit soukromí zákaznických dat, spouštět přenos vědomě, ukázat stav a nabídnout ukončení.

**Budoucí požadavek: vzdálený tisk.** Počítat s bezpečným tiskem vybraných fotografií s kótami, výkresů a dokumentů na tiskárnu mimo telefon/tablet: přednostně tisk dostupný přes systémové tiskové služby a lokální Wi-Fi/síť; možnost odeslání přes internet řešit zvlášť s ověřením konkrétní služby, přihlášení a zabezpečení. Přenos obrazu a tisk jsou odlišné funkce. Zachovat přesné rozměry, viditelnost anotací, náhled před tiskem, volbu tiskárny a rozsahu a možnost zrušit. Nesmí dojít k nechtěnému odeslání zákaznických podkladů ani ke změně uložených dat. Kompatibilita tiskáren se bude ověřovat, nikoliv předpokládat.

**Stav a priorita:** jde o technickou připravenost a budoucí požadavky, **nikoli o zadání nyní přidat nové funkce, oprávnění, knihovny či sestavit APK**. Po dokončení #39/PR #41 nezávisle prověřit skutečnou architekturu v #42 a navrhnout vhodné pořadí. Přesná podoba a podporovaná zařízení se rozhodnou až před implementací; některé hypotetické technologie možná vůbec nepoužijeme.

### Nezávislé ovládání prstem, perem a myší (upřesnění 5. 11. 2026)

**Závazný směr:** Zaměřovač nesmí být závislý na S Pen ani jedné značce zařízení. Základní kreslení, úprava kót, výběr, přesun, úchopy a zoom musí fungovat **prstem** na podporovaných telefonech a tabletech. Na zařízeních s podporou pera počítat se stylusy různých výrobců (včetně S Pen a do budoucna Apple Pencil na kompatibilním iPadu), později také s myší/klávesnicí. **Apple Pencil automaticky nepovažovat za příslušenství k iPhonu.** Specifické schopnosti pera jako tlak, boční tlačítko či ignorování dlaně jsou volitelné a závislé na zařízení; nesmějí být podmínkou základní použitelnosti.

**Technický princip:** obecná gesta a geometrie oddělit od API konkrétního pera/výrobce; sjednotit význam akcí bez ztráty přesnosti kót. Testovat dotyk/tah, víceprstá gesta, zoom, přerušení, výběr a editaci, rotaci a změnu velikosti okna. Dodržet schválené rozlišení vizuálních úchopů a dotykových oblastí. Při chybě nebo absenci pera musí fungovat prst. Potvrzovat kompatibilitu konkrétních značek až skutečným testem.

**Stav:** pravidlo pro další práci a testování, ne potvrzení současné kompatibility se všemi pery. Nespouští změnu #39/PR #41 ani APK.

### Budoucí rozšiřitelnost – ovládání, integrace, obnova a diagnostika (doplněno 5. 11. 2026)

**Zásada:** Nové možnosti se mají do architektury přidávat bezpečně, bez přepisování stávajících dat či vzájemných konfliktů. Níže jde o **dlouhodobé nápady**, ne příkaz zahájit implementaci; konkrétní rozsah se posoudí před vývojem.

- **Vstup a displeje:** počítat s prstem, perem různých značek, myší, klávesnicí a touchpadem; podporovat změnu velikosti okna, otočení, skládací telefony a režim více oken bez ztráty rozpracované práce, kót nebo zoomu. Vstupní gesta oddělit od datového modelu a geometrie.
- **Režimy ovládání:** budoucí nastavení **Začátečník / Střední / Expert** řídí jen přehlednost a zobrazení pokročilých nástrojů, ne práva, výpočty, kvalitu exportu či přístup k zakázkám. Všechny režimy musí zachovat editovatelnost, přesnost i bezpečnost; volba výkonu vykreslování je nezávislá. Nezavádět tři samostatné implementace editoru.
- **Sdílení:** volitelné systémové sdílení výslovně vybraných výstupů do jiných aplikací, nezaměňovat PDF pro zákazníka za editovatelnou zálohu; neodesílat interní nebo zákaznické informace bez vědomého souhlasu.
- **Přístroje:** umožnit rozšíření o další značky měřicích přístrojů či vhodná rozhraní (např. Bluetooth a USB) až po ověření reálných protokolů. Oddělit ovladač od přesných hodnot, jednotek a ukládání.
- **Biometrie:** případný volitelný zámek aplikace/zakázky přes standardní rozhraní systému, bezpečné řešení dostupnosti bez senzoru; biometrie nenahrazuje ochranu dat v úložišti ani zálohy.
- **QR kódy:** případné otevírání zakázky nebo dokumentu z QR kódu. Kód nesmí sám zveřejňovat soukromé údaje ani přístupová tajemství; validovat načítaný obsah.
- **Nová připojení a technologie:** tisk, promítání, přenosy, externí zařízení i nové budoucí knihovny řešit přes přiměřeně oddělené části; nestavět složitou univerzální infrastrukturu dřív, než bude skutečně potřeba.
- **Aktualizace/obnova:** verzované kompatibilní formáty, testované migrace, obnovitelné zálohy a případná návratová cesta. Starší APK nemusí umět otevřít data z novější verze – neslibovat jednoduchý downgrade bez ověření.
- **Diagnostika:** možnost lokálních nebo výslovně povolených technických hlášení o pádech a chybách, bez zákaznických fotografií, zakázek, adres a tajných údajů; nic neposílat na server bez transparentního rozhodnutí.
- **Nízká paměť/životní cyklus:** testovat velké zakázky, dlouhý běh, návraty z pozadí, přerušení, systémové ukončení a výpadek sítě; zachovat původní data, rozpracované změny a přesné kóty.

**Priorita:** nejprve bezpečně dokončit #39/PR #41, poté přezkoumat technický základ a testy v [#42](https://github.com/zaplikj30-ui/Zamerovac-android/issues/42). Žádné nové APK kvůli této dokumentaci.

### Budoucí funkce jsou zamýšlené, nikoli odepsané (upřesnění 5. 11. 2026)

**Oprava dřívější interpretace:** Když uživatel mluví o „nezávazných nápadech“, často tím myslí **funkce, které v aplikaci do budoucna chce, ale ještě nemají domyšlené chování, technické řešení nebo pořadí**. Nesmíme je automaticky označit za nepodstatné hypotézy, které se mohou ignorovat. U těchto záměrů s jejich **budoucím přidáním počítat při návrhu architektury**. Současně **to není schválení okamžité implementace**: konkrétní zadání, prioritu, čas a bezpečné testy je nutné dohodnout zvlášť.

**Povinné rozlišení stavu:** (a) plánovaná budoucí schopnost, detaily otevřené; (b) pouze možnost k obchodnímu/technickému posouzení; (c) schválená konkrétní implementace; (d) skutečně implementováno a ověřeno. Pokud z kontextu není jisté, která kategorie platí, nedomýšlet závazek ani zamítnutí. **Monetizace a konkrétní reklamní model zůstávají jen otevřenými obchodními možnostmi**, protože uživatel je takto výslovně označil.

**Technické řízení:** ChatGPT sám porovnává všechny plánované budoucí schopnosti a možnosti se současnou stavbou aplikace, předchází zbytečným závislostem a kolizím, ale nemá předem programovat neodsouhlasené funkce či vytvářet složitou infrastrukturu „pro jistotu“. Plánované oblasti zahrnují mj. promítání na další displeje, vzdálený tisk, další pera a vstupy, další měřidla, různé režimy ovládání a bezpečné integrace. Postupovat až po bezpečném dokončení rozpracované #39/PR #41 a povinné kontrole #42.

## Povinné testování selhání a ochrany dat u každé změny (5. 11. 2026)

**Výslovně schválené trvalé pravidlo uživatele:** Nesmíme ověřovat pouze to, že nová či upravená funkce v běžném scénáři funguje. **Před dokončením každé významné změny podle rizika zkontroluj také, jak funkce selže, co přitom zobrazí uživateli a zda zachová původní data a správnost rozměrů.** Testování chybových cest je součástí zadání, implementace i kontroly výsledku — není až volitelnou dodatečnou revizí.

- **Uložení, import, export, záloha a obnova:** selhání zápisu/čtení, nedostatek místa, neúplný či poškozený soubor, chybějící médium, nepovolený přístup a přerušení operace. Při neúspěchu nesmí funkce klamně hlásit úspěch, přepsat novější data ani zničit poslední bezpečně uloženou kopii.
- **Synchronizace a souběh:** offline stav, timeout, odpojení, pomalý přenos velkého souboru, současná změna lokálně i na jiném zařízení, odložený callback, návrat do aplikace a čištění koše. Nekontrolovat jen výsledná data, ale také zamykání, odezvu uživatelského rozhraní a zachování obou konfliktních změn.
- **Editor a Bosch:** neplatný či hraniční údaj, různá jednotka, desetinná čárka, příliš krátká kóta, zoom, otočení, přerušení tahu a výpadek Bluetooth. Hodnoty měření se nikdy nesmějí měnit či odvozovat z pixelů bez výslovného požadavku; chránit již uložené údaje.
- **Bezpečnost:** v každé relevantní změně posoudit nedůvěryhodné vstupy, cizí webový obsah, oprávnění, práci s citlivými údaji a zpřístupněné nativní rozhraní. Nezaměňovat úspěšný build nebo funkční test s bezpečnostním auditem.
- **Evidence a priorita:** ke konkrétní funkci doplň příslušný pozitivní i negativní regresní test do existujícího registru [#28](https://github.com/zaplikj30-ui/Zamerovac-android/issues/28), výsledek, zbývající riziko a jasně označené neprovedené fyzické testy. **Nepředstírat 100% ověření** ani zbytečně neblokovat opravou nekritické QA infrastruktury bezpečně dokončenou testovací aktualizaci. Kritické nevyřešené riziko ztráty dat, chybného měření nebo přístupu k zákaznickým datům před skutečným ostrým použitím vyřešit.

**Poučení z nezávislého auditu:** běžné úspěšné E2E testy přehlédly důležité chybové scénáře. Konkrétní zjištění a testovací podmínky viz [#33](https://github.com/zaplikj30-ui/Zamerovac-android/issues/33). Tento odstavec mění *pravidla další práce*, **není to hotová oprava #33**. Samotná změna dokumentace nespouští sestavení APK.

## Povinná historie změn podle skutečného vydání (5. 11. 2026)

**Schválené trvalé pravidlo:** Zaměřovač má pro uživatele přehledný offline **changelog** (nové funkce, opravené chyby, vylepšení) v hlavním menu a v Nastavení. Každá funkční aktualizace musí společně s kódem a nápovědou aktualizovat `app/src/main/assets/release-history.js`: nová položka pro **skutečné vydání** a přesný popis změn, rozdělený do správných kategorií. Text odvozovat z ověřených commitů/issues/PR a výsledků testování; nesmí se zaměňovat implementace, automatické ověření a fyzické ověření na zařízení. Nesmí se automaticky přejmenovat starší novinky na `appVersionShort`.

**Při vydání:** před jediným vyžádáním APK ověř, že číslo vydání v changelogu odpovídá verzi, kterou workflow skutečně vyrobí (pokud se očekávané číslo změní, oprav changelog před sestavením), a že historie neukazuje budoucí verze. V případě chybějících starších podrobných poznámek přiznej omezení, nedoplňuj je smyšlenými položkami. Rozšíř `tests/release_history.js` a `tools/e2e/release-history.cjs` pro aktuální změnu, ověř menu, kategoriemi roztříděné texty, bezpečné otevírání a nulové změny dat. Nové položky nejsou samostatným důvodem k více APK během téže aktualizace. Vlastní zadání původní opravy a rozšíření je v [#31](https://github.com/zaplikj30-ui/Zamerovac-android/issues/31).

## Povinná průběžná aktualizace nápovědy při KAŽDÉ změně aplikace (4. 11. 2026)

**Schválené trvalé pravidlo uživatele:** Pokaždé, když se v Zaměřovači **přidá nová funkce, změní ovládání/chování, text, název, ikona, nabídka, nastavení, import/export, podpora zařízení nebo relevantní omezení**, je součástí téže vývojové změny také odpovídající **aktualizace české offline nápovědy** v `app/src/main/assets/help.js` (a je-li třeba i jejích stylů, odkazů a vyhledávacích slov). Není potřeba další pokyn uživatele. Pokud nová funkce potřebuje samostatnou kapitolu, vytvoř ji; pokud jde o změnu dosavadní funkce, oprav text příslušného postupu a zruš zastaralé informace. Přidávej i chybové stavy, bezpečnostní upozornění a omezení kompatibility, pokud souvisí se změnou. Vysvětluj **reálně naprogramované** chování, ne přání nebo experiment jako hotovou funkci.

**Nápověda patří ke stejnému PR a stejnému následnému APK** jako související změna (nevyrábět APK zvlášť kvůli dokumentaci). Před dokončením PR zkontroluj **kód ↔ UI texty ↔ kapitoly nápovědy ↔ vyhledávací klíčová slova ↔ testy**. Rozšiř `tests/help_guide.js` a podle potřeby `tools/e2e/help.cjs` o odpovídající scénář. Bez této kontroly nepovažovat úpravu za zcela dokončenou, ledaže je výslovně zdokumentováno, proč se nápovědy netýká (např. čistá oprava CI bez změny chování aplikace).

**Dvě vyhledávání zůstávají oddělená:** globální lupa hledá zakázky/soubory/poznámky, **nikoliv obsah nápovědy**; lupa v nápovědě hledá jen mezi jejími kapitolami. Pomocná nápověda je offline a nesmí číst, měnit ani odesílat projektová data. Zadání a historie v [issue #29](https://github.com/zaplikj30-ui/Zamerovac-android/issues/29), implementace v [PR #30](https://github.com/zaplikj30-ui/Zamerovac-android/pull/30) (stav ověřovat podle GitHubu).

## Trvalá předávka a automatické testy napříč nástroji (4. 11. 2026)
**Nezávislost na Codexu a konkrétním chatu:** Schválené požadavky, opravy, rozhodnutí, testovací výsledky a rozpracovaná práce se předávají **přes GitHub**, ne přes paměť chatu ani neveřejnou historii Codexu. Do nového chatu a k jinému nástroji se nemají ručně znovu diktovat. Záznam na GitHubu není sám o sobě automaticky spuštěné zadání Codexu; kód existuje pro dalšího pracovníka až po skutečném pushi, nesloučený PR není vydaná aplikace.

**Povinný vstup pro každého pokračujícího pracovníka:** načíst [START_ZDE.md](START_ZDE.md), tento AGENTS.md, poslední commity, otevřené PR a Actions, poté navázat podle konkrétních issues a jejich *nejnovějších komentářů*. Hlavní živý úkol pro **profesionální automatické testování celé aplikace** je [issue #28](https://github.com/zaplikj30-ui/Zamerovac-android/issues/28). Detailní [pravidlo mapování všech funkcí na testy](https://github.com/zaplikj30-ui/Zamerovac-android/issues/28#issuecomment-6642585299), [povinné průběžné kontroly všech budoucích jazyků](https://github.com/zaplikj30-ui/Zamerovac-android/issues/28#issuecomment-6642531865) a [matice praktických testů](https://github.com/zaplikj30-ui/Zamerovac-android/issues/28#issuecomment-6642109661) mají platit i při výměně nástroje. Aktuálně rozpracovaný kód je v [PR #27](https://github.com/zaplikj30-ui/Zamerovac-android/pull/27); při každém navázání ověřit aktuální stav, nikoli spoléhat na datum tohoto zápisu.

**Zdroj požadovaného chování:** rekonstrukce 28 původních kontrol (`REKONSTRUKCE_TESTU_01_10.md`, `REKONSTRUKCE_TESTU_11_20.md`, `REKONSTRUKCE_TESTU_21_28.md`), novější schválené změny a výsledky [issue #13](https://github.com/zaplikj30-ui/Zamerovac-android/issues/13) a souvisejících issues. Rozlišovat historické výsledky, pozdější upřesnění, reálnou implementaci a nezávazné nápady z `VIZE_A_PLAN.md`. Při každé nové nebo změněné funkci **současně doplnit nebo upravit regresní test a trvalý registr pokrytí**: specifikace → kód → test → výsledné důkazy/limity → potřebné ověření na telefonu. Nálezy i neprovedené kontroly zaznamenávat bez zkreslování; kritické chyby měření a ztráty dat před vydáním neignorovat.

**Předání dál:** před ukončením práce či změnou nástroje uložit dokončený kód, testy a přehled hotovo/zbývá/nejisté na GitHub. Pracovat proti aktuálnímu stavu, nikdy nepřepsat novější PR. Aktuálně nerozjíždět zbytečné průběžné vydání APK ani náročný emulátor; jedna společná APK teprve po dokončení schválených úprav. Fyzické Samsung/S Pen/Bosch testy oddělit od softwarových a nativních CI. Nevytvářet nové budoucí funkce jen kvůli tomu, že jsou v nápadech.

## Doporučení modelu, úrovně a postup při nízkém limitu (4. 11. 2026)

**Odpovědnost asistenta, nikoli uživatele:** Když ChatGPT připravuje zadání pro Codex nebo jinou AI, musí sám zhodnotit riziko, rozsah a zbývající dostupný limit. **Současně s připraveným zadáním výslovně doporučí konkrétní dostupný model a vhodnou úroveň přemýšlení (např. Low/Medium/High), stručně vysvětlí volbu a nabídne úspornější alternativu.** Nenutit uživatele vybírat bez pomoci. Názvy a dostupnost modelů se mění; neuvádět neověřené vlastnosti nebo údajné úspory jako jistotu. Přepnutí ve skutečném rozhraní provede uživatel, pokud k tomu není výslovně dostupný a autorizovaný nástroj.

**Nenechat vývoj bezdůvodně stát kvůli limitu Codexu:** Při nízkém nebo vyčerpaném limitu nejdřív ověřit uložený stav na GitHubu, zvolit menší/levnější vhodný model či jiný dostupný pracovní postup a **bezpečné drobnosti vyřešit přímo v ChatGPT**. Složitější práci rozdělit do dokončitelných celků s průběžnými commity a testy. Nečekat pasivně jen na obnovení limitu; přitom však **neobcházet nezbytné testy** a nevydat neověřený či rizikový kód kvůli rychlosti. Když něco nelze bezpečně dokončit, srozumitelně uvést konkrétní překážku a další dostupnou možnost.

**Nová APK:** Uživatel chce aktuální testovatelnou aplikaci bez zbytečného čekání. Upřednostnit dokončení dohodnutých oprav, přiměřeně důkladné kritické a regresní kontroly a **jedno společné APK po dokončení schválené aktualizace**; nečekat na nekonečné rozšiřování budoucí testovací infrastruktury, pokud pro dané vydání není kritickým blokátorem. Před sloučením/novým vydáním ověřit finální SHA, bezpečnost dat a přesnost kót, respektovat výslovně schválené požadavky a aktuální pravidla v START_ZDE.md; nesestavovat APK automaticky pouhou změnou dokumentace. Rozlišovat úspěšné CI a fyzické ověření uživatelem.

## ZÁVAZNÝ VÝCHOZÍ PRINCIP: ImageMeter je funkční referenční aplikace
**Priorita zadání uživatele:** Zaměřovač se má v běžném používání co nejvíc chovat jako ImageMeter. Nejde o volnou inspiraci ani o nový alternativní návrh editoru. Zachovej známé rozložení a pořadí běžných ovládacích prvků, dotykové interakce, práci s kótami, přetahování konců, lupu, výběr, nabídky i workflow fotografií. Nejdřív reprodukuj ověřené chování, teprve potom zjednodušuj a rozšiřuj. Výjimky jsou pouze explicitně vyřazené funkce uvedené níže a další změny, které uživatel skutečně schválil. Funkce mají vlastní originální implementaci bez přebírání proprietárního kódu a grafiky.

**Toto je důležitější než předchozí experimentální odchylky našeho editoru.** Pokud Zaměřovač funguje jinak než ImageMeter a uživatel danou změnu neschválil, je to nevyřešený rozdíl, nikoliv automaticky správné řešení.

### Povinný postup při přizpůsobování funkce
1. Nejprve prozkoumej dostupné uživatelské referenční snímky/videa a případné APK/XAPK a odděl *pozorované chování* od odhadů. Pokud máš možnost legitimně analyzovat zdroje v APK, použij to jako pomocný podklad; nepředstírej přístup ke zdrojovému kódu ani přímý běh aplikace, pokud není k dispozici.
2. Sepiš konkrétní rozdíl výchozího ImageMeteru vs. aktuálního Zaměřovače (například velikost lupy, strana obrazovky, poloha kóty uvnitř lupy, přichytávání a drag).
3. Oprav příčinu v modelu souřadnic a dotyku, nikoliv kosmeticky při každé iteraci přesouvej či zvětšuj lupu. Ověř chování na levé i pravé straně, při různém přiblížení a orientaci fotografie; pokud není možné simulovat skutečné dotyky, označ ověření na telefonu jako stále otevřené.
4. Přidej cílený regresní test a zkontroluj build, ale **úspěšné sestavení nedokazuje shodu chování**. Nevydávej to za vyřešený problém bez ověření na zařízení.
5. Nepřidávej do běžného UI další komplikovaná nastavení bez důvodu. Když bude potřeba rozhodnutí, drž se ověřeného výchozího chování; uživateli nepokládej opakovaně otázky o schválených vlastnostech.

**Výslovná preference pro lupu a kóty:** žádné velké tečky/úchyty na koncích, dotykové cíle však zůstávají použitelné. Žádná zelená záře vybrané kóty. Ve zvětšovacím výřezu musí být správně vidět konec skutečně vykreslené kótovací čáry; velikost a tvar porovnávej s uživatelskou referencí a neodhaduj je pouze z paměti. Nepřenášej chybná rozhodnutí ze starých iterací jako nový standard.

## Priorita verzí referenčního ImageMeteru
- **Hlavní vzor:** ImageMeter **26.6.1** (uživatelem dodaná XAPK; aktuálně nejnovější dostupná reference).
- **Doplňkový vzor:** ImageMeter **Pro 26.5.0** (uživatelem dodaná APK).
- **ImageMeter 3.9.15:** doplňková reference; lze z ní čerpat užitečné postupy, principy či technické poznatky, ale současné ovládání a vzhled určují přednostně verze 26.6.1 a 26.5.0. Starší postup nepřebírat, pokud jej novější verze řeší lépe.
- Pokud se verze 26.6.1 a 26.5.0 liší, přednost má **26.6.1**. Nezaměňovat starší fungování za aktuální.
- Referenční soubory jsou uloženy v ChatGPT Library pod `/Zamerovac/reference/ImageMeter/`; nejsou automaticky přístupné GitHub Actions. Nedávat cizí instalační soubory do zdrojového repozitáře. Zaznamenávat pouze vlastní pozorování, struktury a testovací požadavky.
- Vlastní implementace Zaměřovače zachovává známé ovládání a význam ikon, ale nepřebírá proprietární zdrojový kód, originální ikonové soubory ani obchodní identitu ImageMeteru.

## Schválené požadavky
- Organizace zákazníků do složek a místností, podsložky a přílohy.
- Pořizování a import fotografií, PDF a jiných souborů; přidání videí.
- Kreslení a editace kót přímo do fotky; skutečnou hodnotu zadává uživatel ručně nebo ji předá laser Bosch přes Bluetooth. Žádné automatické odvozování rozměru z pixelů.
- Přesná dotyková lupa při umisťování bodů, posun/zoom, čáry, šipky, obdélníky, kruhy, úhly, kótovací řetězce, styly a barvy, přichytávání bodů i pomocný rastr. Přepínatelné volby zachovat.
- Textové poznámky, seznamy úkolů, hlasové poznámky, detailní fotografie, další přílohy.
- Offline-first lokální ukládání, vlastní synchronizace přes Google Disk mezi telefonem, tabletem a časem PC bez předplatného ImageMeteru. Bezpečná synchronizace konfliktních změn a fotografií je důležitá.
- Export obrázků/PDF; otevřený vlastní formát pro budoucí propojení s PC programem Převaděč spojitosti.
- Zachovat chování a ovládání užitečných funkcí obdobné ImageMeteru, ale implementovat vlastním kódem. Pokud něco uživatel explicitně nevyřadil, neodstraňuj to svévolně; zbytečné funkce mohou být volitelně vypnuté.

## Výslovně vyřazené funkce
1. Referenční měřítko.
2. Perspektivní reference.
3. Perspektivní délka.
4. Počítadlo objektů.
5. Výsledková listina.

## Současný testovací režim – zálohy nejsou podmínkou (výslovné upřesnění uživatele 4. 11. 2026)

**Zaměřovač je zatím výhradně zkušební aplikace a uživatel ji NEPOUŽÍVÁ při skutečné práci ani pro ostré zákaznické zakázky.** Všechna současná data v aplikaci jsou pro něj postradatelná; výslovně akceptuje jejich případnou ztrátu. **Nemá zálohu a nechce být před dalšími běžnými testy ani instalacemi opakovaně dotazován na její vytvoření.** Nenuť jej zálohovat ani neblokuj postup testů požadavkem na záložní ZIP. Zálohu lze zmínit jen jako nepovinnou možnost, nikoli nutnou podmínku.

**Rozlišení:** Tento souhlas se ztrátou vlastních *testovacích* dat neznamená souhlas se zhoršením ochrany dat v aplikaci: nadále vyvíjet a ověřovat bezpečné zachování dat při aktualizaci, importu a mazání. Pro destruktivní scénáře dál používat testovací položky, bez zásahu do jiných aplikací. Jakmile uživatel oznámí přechod na skutečné zakázky, společně znovu zavést přiměřená pravidla záloh a ochrany reálných dat. Nespouštět žádné další APK jen kvůli této dokumentační změně.

## Stav projektu a omezení
- Projekt obsahuje Android Java shell/WebView a HTML/JS editor v `app/src/main/assets/`, Android nativní most v `app/src/main/java/cz/zamerovac/app/`.
- GitHub Actions workflow `.github/workflows/build-apk.yml` sestavuje a vydává testovací APK **pouze na vyžádání**: tlačítkem Actions → Run workflow nebo zvláštním commitem, který změní `.github/apk-build-request.txt`. Workflow je nastavené na `push` jen pro tuto cestu; **běžné commity na main sestavení NESPOUŠTĚJÍ**. Emulátor `.github/workflows/emulator-smoke.yml` se spouští výhradně ručně. Při vydání zachovej kontrolu podpisu a jednoznačné verze. Zachování uživatelských dat při aktualizaci musí být navíc ověřeno na skutečném zařízení, nelze jej odvozovat pouze z úspěšného sestavení. Úspěšný build NENÍ ověření správného fungování.
- Pozor: synchronizace přes Android Storage Access Framework je podmíněna podporou zapisovatelné složky poskytovatelem Google Disku. Pokud nefunguje, zvaž bezpečnou oficiální integraci Drive API/OAuth, nikoli předstírání funkčního cloudu.
- Bluetooth implementace v `BoschClassicReader.java` je experimentální; funkčnost je nutné ověřit na konkrétním laseru Bosch, konkrétním firmware a Android zařízení.
- Žádné reálné zákaznické soubory nepoužívat jako testovací data bez výslovného souhlasu. Preferuj testovací zakázky.
- Neoznačuj aplikaci za plně hotovou, dokud nejsou testované všechny deklarované funkce. Zachovej kompatibilitu uložených záznamů a proveď migrace, pokud se mění schéma.

## Společný pracovní protokol ChatGPT ↔ Codex ↔ GitHub (závazné)

**Schváleno 4. 11. 2026 pro oba samostatné projekty.** Na projektu střídavě pracuje **klasický ChatGPT (i více různých chatů) a Codex**. Nemusejí vidět stejnou konverzaci, lokální soubory ani neuložené rozpracované změny. **GitHub – commity, větve, issues, dokumentace, PR, Actions a Releases – je jejich společný trvalý zdroj aktuálního stavu**, nikoliv paměť jednotlivého chatu. Pravidla níže doplňují stávající bezpečnostní a sestavovací postupy; **nesmějí spouštět automatický build ani měnit jiný repozitář**.

1. **Před KAŽDÝM novým úkolem / navázáním v dalším chatu** načíst aktuální `AGENTS.md`, [START_ZDE.md](START_ZDE.md), poslední relevantní commity a změněné soubory, aktivní větve/PR, otevřená související issues **včetně nejnovějších komentářů**, stav testů, Actions a nejnovější skutečná Releases. Při návratu po přestávce a těsně před zápisem či mergem aktualizovat porovnání s GitHubem. **Nepředpokládat, že stav známý z předchozího chatu je stále platný.**
2. **Zjistit, zda mezitím pracoval druhý chat nebo Codex.** Porovnat aktuální SHA/commit, otevřený PR a dotčené soubory s výchozím stavem. Při kolizi nebo souběžných změnách nejdřív přečíst rozdíl, zachovat platné úpravy, případně bezpečně rebase/sloučit. **Nikdy bez kontroly nepřepsat novější práci ani stará uživatelská data.**
3. **Zaznamenávat průběžně HNED po ujasnění, ne až při konci chatu:** přesné zadání a odsouhlasené chování, nová rozhodnutí a jejich změny, chyby, výsledky testů (včetně neúspěchů), důležité pozorování, rozpracovaný kód/PR/commit, zbývající práci, blokátory, rizika a nápady „možná později“. Není potřeba, aby uživatel pokaždé zvlášť žádal „ulož na GitHub“. Zapisovat cíleně k existujícímu issue / dokumentu, **bez duplicit a bez zveřejňování soukromých zákaznických dat**.
4. **Stavy důsledně oddělovat:** **nápad / nezávazná vize → schválený požadavek → naplánováno → rozpracováno → změna v kódu (commit/PR) → sestaveno/vydáno v konkrétní APK → reálně ověřeno na uvedeném zařízení**. Stavy „odloženo“, „zamítnuto“, „selhalo“, „neověřeno“ rovněž zachovat. Build nebo zelené CI **nejsou** potvrzení dotyků, Bluetooth ani výrobních výpočtů.
5. **Jedno konkrétní předání práce pro další chat/Codex:** průběžně udržovat [START_ZDE.md](START_ZDE.md) jako rychlý stavový rozcestník a [testovací deník #13](https://github.com/zaplikj30-ui/Zamerovac-android/issues/13) pro detaily testů. Musí být dohledatelné: **co je hotové**, **co zbývá**, **co není rozhodnuté**, **aktuální větev/PR/commit**, **poslední skutečně vydaná verze APK a její úroveň ověření**, a **jediný další konkrétní krok** s odkazy. Podrobnosti patří do odpovídajících issues a technických dokumentů; rozcestník je **nepřepisuje ani neduplikuje**.
6. **Po každém důležitém zápisu potvrdit výsledek:** získat commit SHA / odkaz na issue a podle možností soubor znovu načíst. Uživatel obdrží přímý odkaz. Pokud zápis nebo kontrola selže, **výslovně říct, že změna není ověřeně uložená**; nikdy nevymýšlet úspěšný commit či release.
7. **Respektovat hranici schválení:** budoucí vize (např. PC, iOS, propojení aplikací) se samy nemění na úkoly k implementaci. Vyžadovat skutečné schválení rozsahu; neposouvat bez něj hranice funkčnosti. **Dokumentační aktualizace nespouští sestavení APK.**

**Zdroje a rozdíly mezi projekty:** Záznamy podrobné rekonstrukce 28 testů, [IMPLEMENTACE_A_TESTOVANI_28.md](IMPLEMENTACE_A_TESTOVANI_28.md), [VIZE_A_PLAN.md](VIZE_A_PLAN.md), otevřené issues #12, #13, #14 a aktuální Releases jsou podklady; stav „testováno na zařízení“ má přednost pouze při konkrétním důkazu.

## Proaktivní technické vedení uživatele – začátečníka

**Výslovná dohoda 4. 11. 2026:** uživatel **není programátor** a nechce sám objevovat, jaké nastavení ChatGPT, propojení s Codexem, testovací postupy a vývojové nástroje by mu mohly pomoci. **ChatGPT/Codex má aktivně rozpoznat a včas doporučit užitečné kroky**; nečekat, až se uživatel na přesnou technickou možnost náhodou zeptá. Cílem je **rychlý, udržitelný a bezpečný vývoj**, nikoli jen reaktivní plnění drobných příkazů.

- **Převzít technickou iniciativu:** uživatel vysvětluje, *co potřebuje v praxi*; asistent sám volí a jednoduše vysvětluje vhodné technické postupy (repozitáře, Codex, testy, CI, zálohy, sestavení, správa verzí, dokumentace). Pokud je potřebná akce proveditelná dostupnými nástroji, provést ji bez zbytečného předávání technických kroků uživateli; větší nevratné nebo produktové změny nejprve vysvětlit a nechat schválit.
- **Průběžně upozorňovat na skutečně přínosné možnosti:** nastavení a funkce ChatGPT/Codex, automatizované regresní testy, ochrana uživatelských dat, kompatibilita zařízení, snížení počtu zbytečných APK sestavení, dostupnější diagnostika bez počítače, předávání práce přes GitHub. Nepředstírat funkce nebo oprávnění, která nejsou k dispozici, a neslibovat práci na pozadí bez skutečně nastavené automatizace.
- **Prioritizovat a filtrovat:** stručně odlišit **„doporučuji udělat teď“ / „může počkat“ / „není potřeba“**, u důležitého doporučení vysvětlit přínos, cenu v čase a riziko. Nezahltit uživatele seznamem technických možností ani neotevírat nové vedlejší úkoly uprostřed kritické opravy. Zvláštní přednost má bezpečnost dat a ověřené fungování.
- **Mluvit srozumitelně:** bez předpokladu zkušeností s programováním nebo GitHubem; krátce vysvětlit nový pojem, pokud rozhodnutí ovlivňuje, a **zbytečně nevyžadovat potvrzení již odsouhlasených věcí**. Uvádět, co bylo skutečně provedeno a otestováno; nevydávat nápad za schválený úkol, commit za vydanou APK ani sestavení za ověření v telefonu.
- **Nenutit uživatele hlídat proces:** při zjištěné chybě v našem postupu sám navrhnout zlepšení pravidel či testů, případné podstatné rozhodnutí po dohodě průběžně uložit na GitHub, aby stejnou zásadu znal i další chat a Codex. Neměnit aplikaci nebo build jen kvůli dokumentaci tohoto požadavku.

### Kdy sám navrhnout úpravu pokynů projektu ChatGPT a užitečné nastavení

**Konkrétní zpřesnění uživatele 4. 11. 2026:** Nestačí pouze reagovat na jeho otázky o nastavení. Jakmile se v rozhovoru domluví nový dlouhodobý způsob spolupráce nebo objeví chybějící užitečné pravidlo, **asistent musí sám a včas upozornit**, že stojí za doplnění **Pokynů projektu v ChatGPT** (popřípadě jiného relevantního nastavení ChatGPT/Codexu), i když se uživatel na tuto možnost vůbec nezeptal. Příkladem je právě rozdělování práce mezi ChatGPT a Codex nebo pravidlo automatického ukládání na GitHub: obojí měl asistent navrhnout vložit do projektových pokynů **hned při dohodě**, nikoli až po dotazu uživatele.

- U každého **skutečně přínosného** návrhu stručně vysvětli **proč**, zda jde o **Pokyny projektu ChatGPT**, GitHub `AGENTS.md`, jiné nastavení nebo kombinaci, a nabídni **hotový krátký text k vložení** i jednoduché místo/postup. Nevytvářej zbytečně duplicitní pravidla, nezahltit opakovanými tipy a neodbočovat od kritické práce.
- **Rozlišuj dvě oddělené věci:** projektové pokyny v uživatelském ChatGPT ovlivňují spolupráci v chatech, zatímco GitHub `AGENTS.md`, issues a dokumentace dávají společná pravidla i Codexu a dalším chatům. Doporuč odpovídající aktualizaci **obou**, pokud to přinese užitek; samotný zápis do GitHubu **nezmění uživatelské pokyny projektu v ChatGPT**.
- **Zapisuj zásadní schválené dohody na GitHub bez čekání na další příkaz** a po úspěchu dej ověřený odkaz. Pokud nemáš oprávnění přímo upravit nastavení projektu ChatGPT, řekni to a dej uživateli připravený text; **nepředstírej, že jsi nastavení změnil**.
- Mysli proaktivně i na další dostupné možnosti pro začátečníka (lepší kontrola vývoje, nástroje, bezpečnost záloh, vhodné režimy a testování), ale doporučuj jen reálné, v daný okamžik užitečné kroky. Uživatel nemá sám hádat, jaké otázky se musí zeptat.

## Rozdělení práce mezi ChatGPT a Codex – rozhoduje asistent

**Výslovné doplnění uživatele 4. 11. 2026 – text pro Codex musí připravit ChatGPT:** Uživatel řekl: „Ulož si, že mi dáš pokyn a text a já to vložím do Codexu. Bavili jsme se, že takhle budeme fungovat, že rozhodneš, jestli to máš udělat ty nebo Codex. Akorát mi to musíš poslat text, co mám vložit do Codexu.“ Tato dohoda je závazná pro další chaty.

- **Vždy rozhoduje ChatGPT** na základě rizika, rozsahu a aktuálních možností, ne uživatel. Rozhodnutí stručně oznámí.
- **Když ChatGPT zvolí Codex a v tomto chatu nemá přímo dostupnou akci ke spuštění Codexu, sám sepíše kompletní, konkrétní a ihned použitelný český prompt ve zkopírovatelném bloku.** Zahrne repozitář, přesné zadání a schválený rozsah, odkazy na související issues / commity, ochranu dat a přesnosti, testy, pravidla společné APK a požadovaný výsledek (commity / PR / kontrola). Uživatel jen tento text vloží do Codexu, bez dalšího vymýšlení nebo vyhledávání podkladů.
- **Nelze tvrdit, že Codex běží, že dostal zadání nebo že je práce předaná, dokud uživatel tento prompt skutečně neodešle nebo dostupný nástroj spuštění nepotvrdí.** GitHub issue je podklad pro předání, nikoliv samo o sobě spuštění Codexu.
- ChatGPT může předem zapsat schválený požadavek a odkazy na GitHub. Po skutečném dokončení Codexem kontroluje nové commity, změny, testy a případné kolize a až potom řídí jediné společné vydání APK. Není povinností uživatele posuzovat technický výsledek.
- **Nezapomeň připravit také návrh jednořádkového doplnění Pokynů projektu ChatGPT**, které si může vložit uživatel; GitHub sám tyto Pokyny neupravuje.

**Dohoda s uživatelem 4. 11. 2026:** Uživatel není programátor a **nemá sám posuzovat**, zda úprava patří klasickému ChatGPT, nebo Codexu. **Koordinující ChatGPT sám zhodnotí složitost, riziko, dostupné nástroje, aktuální souběžnou práci a omezený limit Codexu** a zvolí nejlepší cestu. Zbytečně se na toto rozdělení uživatele neptá.

- **Klasický ChatGPT přednostně provádí** bezpečně zvládnutelné menší opravy, jednoduché úpravy textů či UI, kontrolu GitHubu, dokumentaci, cílené testy a kontrolu výsledků, pokud má potřebné nástroje a přístup. Nezůstává pouze u plánování, když může změnu skutečně dokončit.
- **Codex přednostně dostává** náročnější, rozsáhlejší nebo více soubory zasahující implementace, složité ladění a změny, kde jeho vývojové prostředí přinese skutečný přínos. **Riziko má přednost před velikostí:** i malý zásah do mazání zakázek, ukládání dat, přesnosti kót nebo exportů může vyžadovat silnější kontrolu.
- **Kombinovaný postup** je vítaný: ChatGPT s uživatelem vyjasní zadání a uloží je na GitHub, podle potřeby předá práci Codexu, ověří jeho commity/PR a připraví společné fyzické testování. Nepředávat Codexu každou drobnost jen ze zvyku; šetřit jeho limit, ale nikoli na úkor kvality.
- **Souběh:** před vlastní implementací zkontrolovat rozpracovanou práci/PR Codexu a do stejného místa bez koordinace nezasahovat. Pokud potřebné nástroje chybějí, oznámit omezení a nabídnout věcně připravené předání. Respektovat výslovnou volbu uživatele.
- V obou variantách platí **GitHub jako zdroj pravdy**, skutečné změny a testy, průběžné ukládání, jediná APK až po dokončení schválené aktualizace a oddělení úspěšného buildu od ověření na zařízení.

## Doporučený způsob práce
1. Přečti README.md a existující kód, než cokoliv změníš.
2. Opravuj konkrétní chyby, nevytvářej nový projekt od nuly bez důvodu.
3. Při úpravách spouštěj cílené rychlé lokální kontroly a testy, pokud to prostředí umožňuje. Plný Gradle build a kontrolu testovací APK prováděj souhrnně před testováním či vydáním, nikoli po každém drobném commitu přes GitHub Actions. Emulátor spouštěj ručně jen při potřebě ověřit chování a výsledky potvrď na skutečném zařízení.
4. Průběžně commituj změny do tohoto repozitáře; popisuj přesně co je implementované, co je jen prototyp a co není ověřené.
5. Pokud uživatel pošle screenshot nebo chybu z Androidu, nejprve reprodukuj/diagnostikuj problém a navrhni opravu přímo v repozitáři.
6. Vzájemná spolupráce mezi ChatGPT a Codexem probíhá pomocí commitů v GitHubu. Neznamená to sdílení celé konverzace ani automatické synchronizování kontextu mimo tento repozitář.

## Jednoduchý provoz pro uživatele — koordinuje ChatGPT/Codex
- Uživatel zadává **co má aplikace dělat nebo co nefunguje**; nemusí zadávat commity, kroky GitHubu, testování ani sestavení.
- V jedné pracovní dávce: pochopit zadání → upravit zdrojové soubory → spustit rychlé relevantní testy → uložit změny → **jednou na závěr**, pokud uživatel chce aktualizaci či instalaci, vyvolat sestavení `.github/apk-build-request.txt` → ověřit dostupný výsledek. Neprodlužovat práci zbytečnými průběžnými vydáními ani opakovaným úplným čtením beze změny.
- Na malé opravy spouštěj cílené testy a kontrolu syntaxe; úplný workflow build až při vydání. Důležitá ověření nesmí být vynechána (kontrola podpisu, verze, příslušné regresní testy, ochrana dat). Emulátor jen když pomůže ověřit problém, nikoli automaticky při každé opravě.
- Uživatel má testovat jen dotykové chování, Bluetooth a jiné věci vyžadující skutečný telefon či tablet. Dej mu přímý odkaz na ověřené vydání, krátce popiš co otestovat a co je neověřené. Nepředkládej manuální kroky v GitHubu, pokud je lze obsloužit dostupnými nástroji; když přístup neumožní dokončit krok, jasně to řekni.
- Uživatelovo „pusť se do aktualizace“ znamená dodělat aktuálně požadovaný obsah a potom jednou vydat APK; **nespouštět build nedokončené práce na začátku**. Běžná diskuse či návrh bez požadavku na instalaci build nespouští.

## Přirozené pokyny k aktualizaci a sestavení APK
- Uživatel nemusí vyslovit přesné „sestav APK“. Výrazy **„uděláme aktualizaci“**, **„pusť se do aktualizace“**, **„aktualizuj aplikaci“** a podobné znamenají provést požadované úpravy, ověřit dostupné testy a **po dokončení této várky změn sestavit jednu testovací APK**. Samotné zahájení úprav ještě není pokyn sestavit nedokončený kód.
- Přímé **„sestav APK“**, **„vytvoř testovací verzi“**, **„dej mi instalaci“** znamená spustit sestavení aktuálního stavu bez čekání na další změny.
- Aby sestavení mohl vyvolat připojený GitHub nástroj i bez přímého API `workflow_dispatch`, načti aktuální obsah a SHA `.github/apk-build-request.txt`, **zvyš číslo `request` o 1**, zapiš stručný důvod a aktualizuj soubor na `main` samostatným commitem. Tento jediný commit vyvolá `build-apk.yml` přes filtr `paths`. Neprováděj tentýž požadavek opakovaně a nesestavuj po každém mezikroku.
- Před změnou spouštěcího souboru musí být zamýšlené úpravy uloženy na `main`; při souběžné práci ověř poslední stav a případné konflikty. Pokud GitHub build selže, oznam to a zkus cílenou opravu. Pokud nemáš možnost číst výsledek běhu, **netvrď, že APK je hotová**; odkaž na Actions/Releases a výslovně označ stav za neověřený.

## Výběr režimu ChatGPT: Chat / Work / Codex (dohoda 6. 11. 2026)

**ChatGPT sám doporučuje vhodný pracovní režim podle cíle, rizika, dostupných nástrojů a limitů; uživatel nemusí volbu technicky řešit.** Tato zásada doplňuje výše uvedené rozdělení práce a nenahrazuje ho.

- **Běžný Chat:** každodenní rozhodování, vysvětlování, průběžná kontrola GitHubu, menší bezpečné úpravy, evidence požadavků a výsledků. Pokud má přímý přístup k odpovídajícím nástrojům, má úkol provést, ne automaticky přesouvat jinam.
- **Work (Práce):** doporučit především pro rozsáhlejší samostatnou práci s dokumenty, soubory, podporovanými weby či připojenými aplikacemi: například úplný návrh a inventuru Zaměřovače, porovnání UI, přípravu podrobného plánu a dokumentace. Režim Work nenahrazuje automaticky Codex ani neznamená záruku přístupu k webu, GitHubu, místním souborům či testovacím zařízením; schopnosti ověřit pro konkrétní úkol.
- **Codex:** přednostně složitější zásahy do zdrojového kódu, opravy datových/bezpečnostních chyb, komplexní testování, kontrolu buildů a rozsáhlejší implementaci. Když není přímé spuštění k dispozici, ChatGPT dá úplný text zadání, doporučí dostupný model a úroveň a řídí následnou kontrolu výsledků.
- **GitHub zůstává zdrojem pravdy bez ohledu na režim.** Před změnou číst aktuální pravidla, issues, commity, PR a CI; zabránit souběžnému přepisu. Přepnutí režimu automaticky nepřenáší nedokončené lokální změny ani nespouští Codex. Důležité závěry zapisovat na GitHub bez duplicit. Uživatel přepnutí do Work/Codex provede, pokud ho ChatGPT nemůže provést dostupnou oprávněnou akcí.
- **Nesnažit se použít Work pro každou drobnost.** Výběr musí usnadnit dosažení výsledku, ne zvýšit režii či spotřebu limitů. Neodkládat kritické opravy #39/PR #41 kvůli přípravě dokumentace nebo experimentům s režimy.

**Pokyny projektu ChatGPT jsou odlišné od tohoto souboru.** Požadavek uživateli doporučit i krátké doplnění v Pokynech projektu; GitHub zápis tyto pokyny sám nemění. Bez změny programu, testů či APK.
