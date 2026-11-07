/* Zaměřovač – úplná česká offline nápověda, zadání #29.
 * Texty vycházejí z existujícího chování; při změně funkcí aktualizovat návod i test.
 * Žádná projektová data se zde nečtou, nemění ani neodesílají.
 */
(function(root){
'use strict';
const chapters=[
  {
    "id": "start",
    "title": "1. Začínáme – první zaměření",
    "intro": "Zaměřovač slouží k ukládání zakázek, fotografií, náčrtů, kót a poznámek na jednom místě.",
    "steps": [
      "Na úvodní obrazovce klepni na ＋ a zvol Nová složka. Pojmenuj ji podle zákazníka nebo zakázky.",
      "Otevři složku, klepni na ＋ a pořiď fotografii nebo zvol Nový náčrt.",
      "Otevři fotografii či náčrt, tlačítkem ＋ vyber měřicí nebo kreslicí nástroj.",
      "Vlož kótu dotykem a přesnou naměřenou hodnotu zapiš v její úpravě, případně ji převezmi z kompatibilního laseru Bosch.",
      "Po dokončení se vrať šipkou. Uloženou kótu ověř opětovným otevřením fotografie."
    ],
    "notes": [
      "Rozměry se automaticky nepočítají podle velikosti objektů na fotografii. Fotografie je pracovní podklad, skutečnou hodnotu zadáváš ty nebo měřidlo.",
      "Před použitím při výrobě vždy zkontroluj kritické rozměry.",
      "Lupa nápovědy hledá jen zde. Tlačítka Předchozí a Další přecházejí mezi zvýrazněnými slovy; samostatná počítadla rozlišují témata a výskyty. Hledání funguje i bez diakritiky."
    ],
    "keywords": [
      "první použití",
      "začít",
      "návod",
      "postup"
    ]
  },
  {
    "id": "folders",
    "title": "2. Zakázky, složky a podsložky",
    "intro": "Složky oddělují zákazníky, místnosti a části zakázky. Ve složce můžeš vytvářet další složky.",
    "steps": [
      "Pomocí ＋ vytvoř Novou složku, otevři ji a ukládej do ní fotografie, soubory a poznámky.",
      "Klepnutím na název složky v cestě nahoře se vrátíš na danou úroveň.",
      "U položky otevři nabídku ⋮ pro přejmenování, přesunutí, odstranění nebo dostupné exporty.",
      "Složku nepřesouvej do sebe ani do vlastní podsložky. Aplikace takový přesun odmítá."
    ],
    "notes": [
      "Při přesunu a přejmenování se mají zachovat kóty a přiložená média. Po složitější operaci je pro jistotu znovu otevři.",
      "Uzamčenou složku nejdřív odemkni, teprve pak upravuj její obsah."
    ],
    "keywords": [
      "zakázka",
      "zákazník",
      "název",
      "přejmenovat",
      "přesun",
      "podsložka"
    ]
  },
  {
    "id": "photo",
    "title": "3. Fotografie a soubory",
    "intro": "Zaměřování můžeš provádět přímo do fotografie interiéru nebo na samostatný náčrt.",
    "steps": [
      "V zakázce klepni na ＋ a vyber Pořídit fotografii nebo Importovat obrázek / PDF / video.",
      "V systémovém výběru souborů najdi médium; doba otevření výběru závisí i na správci souborů telefonu.",
      "Fotografii otevři klepnutím v seznamu. Po načtení lze přidávat kóty a další anotace.",
      "Další dokumenty a soubory přidávej přes ＋ → Přidat další soubor."
    ],
    "notes": [
      "Původní fotografie se kvůli nakresleným kótám nemá přepisovat; anotace jsou uložené odděleně.",
      "Při chybě načtení fotografii zavři a otevři znovu. U důležitých dat neodinstalovávej aplikaci jako první způsob opravy.",
      "Náhledy v přehledu se vytvářejí se zmenšeným dekódováním mimo zámek místní databáze, aby načítání fotografie neblokovalo ukládání. U náhledu se respektuje otočení i zrcadlení EXIF; originál zůstává beze změny. Při chybě nebo odstranění fotografie se nepublikuje opožděný náhled.",
      "Opakované otevření stejné fotografie využívá omezenou paměťovou mezipaměť dekódovaných obrázků. Po úplném restartu se originál načítá znovu. Při načítání nebo chybě se samostatné kóty nezobrazují na prázdném podkladu; originály ani hodnoty se nemění.",
      "Příloha se připojí až po potvrzení celého zápisu. Při přerušení se nedokončený soubor odmítne a existující originál se nepřepíše.",
      "Přidávání ze systémového výběru běží mimo hlavní vlákno a zobrazuje průběh. Po dobu dávky nezačínej další výběr. Výsledek patří do původní složky nebo poznámky; po přechodu jinam se tam nepřesměruje. Je-li původní cíl smazaný, uzamčený nebo dialog zavřený, příloha se jinam nepřipojí. Jedna dávka má nejvýše 1024 souborů a jeden soubor nejvýše 2 GiB."
    ],
    "keywords": [
      "foto",
      "fotoaparát",
      "import",
      "obrázek",
      "galerie",
      "náhled"
    ]
  },
  {
    "id": "video",
    "title": "4. Galerie a přehrávání videí",
    "intro": "Fotografie ve složce lze prohlížet a přibližovat. Videa mají vlastní přehrávač a miniatury, pokud je zařízení umí vytvořit.",
    "steps": [
      "Otevři fotografii a v editoru použij přechod do galerie, je-li pro ni dostupný.",
      "V galerii listuj mezi fotografiemi; pomocí dvou prstů přibližuj a posouvej zvětšený obrázek.",
      "Video otevři klepnutím na jeho položku. Použij přehrát/pozastavit a posuvník přehrávání; v přehrávači lze vyzkoušet celou obrazovku.",
      "Z přehrávání se vrať systémovým tlačítkem Zpět nebo viditelným ovládáním."
    ],
    "notes": [
      "Podpora formátů videa závisí na kodecích konkrétního telefonu. Nepodporované video může zobrazit chybu nebo náhradní miniaturu.",
      "Přehrání videa a vytvoření miniatury nemá změnit jeho původní obsah.",
      "V galerii se fotografie i všechny anotace posouvají jen k dostupným okrajům. Po oddálení na 1× se vycentrují; gesta zůstávají dostupná bez spodního pokynu.",
      "Galerie je jen pro prohlížení: při přiblížení znovu vykresluje kóty a jejich hodnoty ostře v rozlišení obrazovky. Samotné prohlížení nesmí změnit měřené hodnoty, pozici kót ani původní fotografii.",
      "Šipka zpět zavře galerii a ponechá původní výběr i kroky Zpět/Znovu v editoru. Upravit u stejné fotografie pokračuje v otevřené práci; u jiné fotografie otevře její editor. Při načítání dalšího snímku počkej na jeho zobrazení."
    ],
    "keywords": [
      "mp4",
      "přehrávač",
      "video",
      "zoom",
      "fullscreen",
      "miniatura"
    ]
  },
  {
    "id": "canvas",
    "title": "5. Nový náčrt bez fotografie",
    "intro": "Když nechceš kreslit do fotografie, založ prázdné plátno.",
    "steps": [
      "Ve složce zvol ＋ → Nový náčrt a napiš jeho název.",
      "Otevři náčrt a nástroji vytvoř půdorys, schematický tvar, kóty a texty.",
      "Přibližuj nebo oddaluj náčrt stejně jako fotografii; pro posun vyber Posun obrazu.",
      "Po návratu do seznamu se náčrt zobrazí jako samostatná položka."
    ],
    "notes": [
      "Náčrt není automaticky přesný CAD půdorys. Hodnoty kót a délky nakreslených úseků nejsou automaticky totéž.",
      "Budoucí klikací nárysy stěn nejsou součástí této funkce."
    ],
    "keywords": [
      "plátno",
      "prázdný papír",
      "půdorys",
      "skica"
    ]
  },
  {
    "id": "dimension",
    "title": "6. Rozměr (kóta) a obyčejná čára",
    "intro": "Rozměr je vizuální kótovací čára s číselnou hodnotou. Čára je samostatný kreslicí objekt.",
    "steps": [
      "V editoru klepni na ＋, v měřicích nástrojích vyber Rozměr a vyznač jeho začátek a konec.",
      "Klepni na vytvořenou kótu a otevři Upravit vybranou kótu. Zadej skutečný rozměr, jednotku a volitelný popisek.",
      "Pomocí nástroje Čára vytvoř jednoduchou čáru; lze k ní přidat popis nebo volitelnou hodnotu.",
      "Vybraným koncovým bodem měň jen konec; za střední část přesouvej celý prvek."
    ],
    "notes": [
      "Zápis například 1250,5 mm znamená tvůj naměřený údaj, nikoli hodnotu vypočítanou z fotografie.",
      "Při změně polohy nakreslené čáry musí číselný údaj zůstat přesně takový, jaký jsi zadal."
    ],
    "keywords": [
      "kóta",
      "okótování",
      "milimetry",
      "popisek",
      "rozměry"
    ]
  },
  {
    "id": "chains",
    "title": "7. Dimenzní a kumulativní řetězec",
    "intro": "Řetězce jsou složené z navazujících bodů a úseků.",
    "steps": [
      "Vyber Dimenzní řetězec a označ počáteční bod, potom další navazující body.",
      "U jednotlivých úseků zadej jejich skutečnou délku a případné popisky.",
      "Kumulativní řetězec používá navazující body pro průběžné kótování od výchozího bodu.",
      "Řetězec ukonči dvojklepnutím na poslední bod nebo přepnutím na výběr. Výsledek po návratu znovu otevři a zkontroluj."
    ],
    "notes": [
      "Nezaměňuj měřenou délku jednotlivého úseku s celkovou nebo kumulativní kótou.",
      "Pokud se celý řetězec po ukončení nezobrazí, nepokračuj do výrobního podkladu a nahlas konkrétní postup."
    ],
    "keywords": [
      "kótovací řetězec",
      "kumulativní",
      "dimenzní",
      "body",
      "úseky"
    ]
  },
  {
    "id": "shapes",
    "title": "8. Úhel, lichoběžník, obdélník, kruh a elipsa",
    "intro": "Geometrické nástroje kreslí tvary. Jejich číselné údaje nastavuj podle skutečného měření.",
    "steps": [
      "Úhel zadáš pomocí tří bodů; v úpravě lze doplnit délky a popisky obou ramen.",
      "Lichoběžník má čtyři nastavitelné rohy a čtyři strany. Přesný výpočet obsahu ze stran vyžaduje také správně změřenou úhlopříčku.",
      "Obdélníku lze samostatně zadat šířku, výšku a jejich popisky.",
      "Kruhu nebo elipse lze doplnit rozměr a určit označení Ø (průměr) nebo R (poloměr)."
    ],
    "notes": [
      "Obsah plochy bez dostatečných skutečných měření nelze odhadovat z fotografie.",
      "Po vytvoření vždy zkontroluj, že je barevný obrys opravdu vidět, nikoli jen bílé úchopy."
    ],
    "keywords": [
      "plocha",
      "m2",
      "m²",
      "průměr",
      "poloměr",
      "čtyřúhelník"
    ]
  },
  {
    "id": "drawing",
    "title": "9. Šipka, lomená čára, volná ruka, symbol a Směřovat",
    "intro": "Kreslicí nástroje označují důležité body a situaci na fotografii.",
    "steps": [
      "Šipkou vyznač směr, na který chceš upozornit. Pomocí Čáry odděl části fotografie.",
      "Lomenou čáru vytvoř postupným klepáním na body; dvojklepnutím ji ukonči. Úseky mohou mít vlastní popisky.",
      "Volnou rukou nakresli krátkou skicu nebo zvýraznění.",
      "Symbol označuje vybrané místo textem nebo ikonou; Směřovat používá značku a směrový popisek.",
      "Bodovou poznámkou otevři podrobné informace nebo přílohy u konkrétního místa."
    ],
    "notes": [
      "Názvy, značky a texty jsou pomocné výrobní poznámky. Nezavádějí automaticky nový skutečný rozměr."
    ],
    "keywords": [
      "tužka",
      "značka",
      "nápis",
      "šipky",
      "lomená",
      "poznámka"
    ]
  },
  {
    "id": "handles",
    "title": "10. Výběr, bílé úchopy a přesouvání",
    "intro": "Vybraný prvek můžeš upravovat bez jeho smazání.",
    "steps": [
      "Přepni na Vybrat a upravit, potom klepni na kótu nebo čáru.",
      "Bílé úchopy u konců přesouvají jednotlivé koncové body; střední oblast slouží k posunu celého objektu.",
      "U obdélníku, lichoběžníku a vložených obrázků se mohou objevit vlastní rohové či další úchopy.",
      "Při jemné práci používej lupu a podle potřeby vypni magnetické přichytávání.",
      "Po úpravě objekt odznač a ověř polohu i přesnou hodnotu po opětovném otevření."
    ],
    "notes": [
      "Jemné poklepání nemá náhodně posunout bod. Pokud se to stane, zkus Vrátit úpravu a chybu zdokumentuj.",
      "Výběr objektu není totéž jako změna jeho skutečně naměřené číselné hodnoty.",
      "Po otevření editoru je aktivní výběr. Při tažení rohu hotového obdélníku, lichoběžníku, kruhu nebo elipsy lupa sleduje upravovaný úchop; při přesunu celého objektu se nezobrazuje."
    ],
    "keywords": [
      "úchop",
      "kolečko",
      "kulička",
      "přesunout konec",
      "dotyk",
      "S Pen"
    ]
  },
  {
    "id": "zoom",
    "title": "11. Přiblížení, oddálení, lupa a magnet",
    "intro": "Zobrazení fotografie nebo náčrtu můžeš měnit bez změny samotných uložených kót.",
    "steps": [
      "Tlačítky ＋ a − v editoru přibližuj a oddaluj; na displeji můžeš použít i gesto dvěma prsty.",
      "V nabídce ⋮ použij Přizpůsobit fotografii pro návrat k přehlednému zobrazení.",
      "Pro přesouvání celého obrazu vyber Posun obrazu. Pro jemnou práci lze zapnout bodovou lupu.",
      "Magnetické přichytávání pomáhá k existujícím bodům, rohům či směrům; v Nastavení lze jednotlivé druhy vypnout.",
      "Zobrazit mřížku ovládá viditelný rastr. Přichytávání k rastru je samostatné nastavení."
    ],
    "notes": [
      "Zapnutí magnetu samo o sobě neznamená, že musí být na fotografii viditelná mřížka.",
      "Pokud při přibližování vznikají nechtěné čtverečky nebo chybné obrazy, jde o problém zobrazení; zakázku a data nemaž."
    ],
    "keywords": [
      "zoom",
      "pinch",
      "dva prsty",
      "mřížka",
      "rastr",
      "snap",
      "přichytávání",
      "čtverečky"
    ]
  },
  {
    "id": "undo",
    "title": "12. Vrátit úpravu, znovu, vrstvy a styl",
    "intro": "Editor má historii úprav, nástroje pro vzhled a možnost zobrazování různých druhů anotací.",
    "steps": [
      "Tlačítko se šipkou Vrátit vrací předchozí krok. Opakování vrácené úpravy najdeš v dalších nástrojích.",
      "Barvu a vzhled čar uprav pomocí barevného políčka a nabídky Vzhled a styl.",
      "Přes nabídku dalších nástrojů můžeš vybrané prvky kopírovat či přesouvat v pořadí, pokud je daná akce dostupná.",
      "Upravené prvky a změny zkontroluj před exportem; skrytá vrstva neznamená smazanou kótu."
    ],
    "notes": [
      "Vrácení úpravy není plnohodnotná záloha celé zakázky; pro přenos dat slouží ZIP.",
      "Zobrazovací nastavení vrstev nepřepisuje původní fotografie."
    ],
    "keywords": [
      "undo",
      "redo",
      "barva",
      "tloušťka",
      "historie",
      "vrstvy"
    ]
  },
  {
    "id": "notes",
    "title": "13. Textové poznámky, úkoly, skici a hlas",
    "intro": "Každá zakázka může mít samostatné textové poznámky a fotografie také bodové poznámky.",
    "steps": [
      "Pomocí ＋ → Nová textová poznámka založ zápis s názvem a vlastním textem.",
      "V poznámce můžeš vytvořit seznam úkolů, zaškrtávat položky a přidat přílohy.",
      "Pro přidání fotografie nebo souboru použij Přiložit; pro hlasovou poznámku mikrofon, pokud je zařízení a oprávnění podporují.",
      "V editoru fotografie nástrojem Poznámka vyznač bod; podle dostupných funkcí otevři detail poznámky a doplň text nebo obrázky.",
      "Po uložení poznámku znovu otevři, zvlášť pokud obsahuje kresby či více příloh."
    ],
    "notes": [
      "Hlasové nahrávání vyžaduje přístup k mikrofonu. Při odmítnutém oprávnění lze zkusit nastavení Androidu.",
      "Hlas se připojí k původní poznámce až po úspěšném ukončení záznamu a potvrzení souboru. Uložit nebo šipka zpět v textové poznámce nahrávání ukončí. Při chybě mikrofonu nebo zápisu zůstane formulář otevřený; u bodové poznámky zůstane otevřený i po neúspěšném Zpět. Zrušit bodovou poznámku rozpracovaný hlas zahodí.",
      "Nahrávej v otevřené aplikaci; systém může mikrofon na pozadí omezit. Nedokončený hlas se při zničení obrazovky nepřipojí. Existující originál ani při kolizi identifikátoru nepřepisuj. Přílohy s neplatnými metadaty nebo nad 2 GiB se odmítnou.",
      "Checklisty a přílohy dostávají revizi a průběžně se ukládají. Příchozí synchronizace během otevřené poznámky počká na dokončení její úpravy. Při chybě zápisu tlačítko Uložit formulář nezavře; zopakuj uložení.",
      "Pouhé otevření a zavření textové poznámky nebo zobrazení prázdné skici nemění její obsah ani revizi. Uzamčená poznámka nedovolí měnit checklist ani odebírat přílohy.",
      "Soukromé poznámky do zákaznického PDF patří jen při výslovné volbě."
    ],
    "keywords": [
      "checklist",
      "poznámkový blok",
      "audio",
      "mikrofon",
      "chyba mikrofonu",
      "přílohy",
      "S Pen"
    ]
  },
  {
    "id": "insets",
    "title": "14. Vložené fotografie a detaily poznámek",
    "intro": "Poznámky ve fotografii mohou obsahovat další obrázky nebo vlastní detailní kótování.",
    "steps": [
      "U bodové poznámky otevři její podrobnosti a vlož potřebné fotografie.",
      "Vložený obrázek umísti do pracovní fotografie a podle dostupných úchopů nastav jeho polohu, velikost a natočení.",
      "Do detailu obrázku lze přidávat vlastní kóty. Po návratu do hlavní fotografie ověř, že poznámka i její detail zůstaly uloženy.",
      "Při více přílohách se orientuj podle jejich seznamu nebo galerie."
    ],
    "notes": [
      "Příloha a její detail jsou součástí projektu; zálohovací ZIP má zachovat jejich vazby.",
      "Zákaznické PDF může tyto přílohy obsahovat pouze po povolení soukromých poznámek."
    ],
    "keywords": [
      "detail",
      "vložená fotografie",
      "fotka do fotky",
      "stoh",
      "náhled"
    ]
  },
  {
    "id": "bosch",
    "title": "15. Bluetooth laser Bosch a historie měření",
    "intro": "Kompatibilní měřidlo Bosch může poslat naměřenou hodnotu do Zaměřovače. Ne všechny modely a režimy mají totožnou podporu.",
    "steps": [
      "Zapni Bluetooth na telefonu a laseru, potom ve spodní liště Zaměřovače klepni na symbol laseru Bluetooth.",
      "Při prvním připojení povol vyžadovaná systémová oprávnění a vyber správný laser.",
      "Přijmi měření. V historii Bosch můžeš zvolit konkrétní hodnotu a přiřadit ji do upravované kóty nebo odpovídajícího úseku.",
      "Před uložením ověř jednotku a číselnou hodnotu. Po připojení a odpojení zkontroluj, zda lze měřit znovu.",
      "Pokud se zařízení nenajde, ukonči hledání, zkontroluj Bluetooth a oprávnění, případně použij volbu pro jiný měřič."
    ],
    "notes": [
      "Bluetooth přenos nemusí fungovat se všemi modely Bosch; podporu ověř na vlastním přístroji.",
      "Do výrobní dokumentace používej až rozměr, který se skutečně přenesl a který jsi zkontroloval.",
      "Obecný dialog se jmenuje Bluetooth měřič. Připojit můj laser Bosch používá dosavadní podporu Bosch; neutrální název neznamená podporu všech protokolů."
    ],
    "keywords": [
      "GLM",
      "BLE",
      "Bluetooth Classic",
      "spárování",
      "měřák",
      "laser",
      "historie"
    ]
  },
  {
    "id": "export",
    "title": "16. Export obrázku a běžné PDF",
    "intro": "Obrázek s anotacemi lze předat jako soubor pro prohlížení.",
    "steps": [
      "Otevři fotografii nebo náčrt, v nabídce editoru vyber Exportovat obrázek nebo PDF.",
      "Zvol PNG, pokud chceš snímek s vykreslenými čárami a kótami.",
      "Pro běžné PDF použij export/tisk PDF podle nabídky a možností Androidu.",
      "Ulož výsledek do vybraného umístění a otevři jej ke kontrole čitelnosti."
    ],
    "notes": [
      "PNG a PDF nejsou náhradou plné editovatelné zálohy projektu.",
      "Při exportu do souboru se hodnoty kót nemají automaticky měnit."
    ],
    "keywords": [
      "tisk",
      "PNG",
      "PDF",
      "sdílení"
    ]
  },
  {
    "id": "customer",
    "title": "17. Export pro zákazníka – ZIP s PDF",
    "intro": "Zákaznický export vytváří soubory PDF určené k prohlížení, nikoliv k editaci zakázky.",
    "steps": [
      "V nabídce fotografie či složky zvol Export pro zákazníka: ZIP s PDF.",
      "Vyber, které druhy anotací mají v dokumentu být.",
      "Volba Zahrnout i soukromé poznámky a vložené fotografie je standardně vypnutá. Zapni ji pouze pokud takové údaje opravdu chceš zákazníkovi předat.",
      "Export vytvoří ZIP s PDF pro příslušné fotografie; delší texty a více fotografických příloh mohou pokračovat na dalších stranách.",
      "Otevři výsledný ZIP a PDF a zkontroluj stránky, čitelnost kót a absenci soukromých údajů, které jsi nechtěl zveřejnit."
    ],
    "notes": [
      "Zákaznický export neobsahuje editovatelný projektový JSON, historii měření a soukromé poznámky bez výslovného povolení.",
      "Nezaměňuj export pro zákazníka s úplnou zálohou Zaměřovače."
    ],
    "keywords": [
      "soukromí",
      "zakázka zákazníkovi",
      "poznámky",
      "přílohy",
      "zákaznický PDF"
    ]
  },
  {
    "id": "backup",
    "title": "18. Historické zálohy, ZIP a bezpečná obnova",
    "intro": "Historické zálohy uchovávají samostatné body telefonu a tabletu ve vybraném úložišti. ZIP zůstává přenosnou úplnou zálohou zakázek s anotacemi a soubory.",
    "steps": [
      "Otevři ☰ → Historické zálohy nebo Nastavení → Historické zálohy a obnova. Zvol systémovou složku záloh nebo Připojit Google účet; tento výběr je nezávislý na synchronizaci.",
      "Zvol Vytvořit historickou zálohu. Všechny soubory se uloží do ověřovaných datových bloků a nový historický bod se potvrdí až po kontrole úplnosti.",
      "V přehledu najdeš oddělené historie instalací telefonu a tabletu. Stejné originály mohou sdílet neměnný blok; nový historický bod starý nepřepisuje. Přehled uvádí velikost datových bloků bez režie poskytovatele.",
      "Před obnovou můžeš zvolit Ověřit všechny soubory. Obnovit jako nové kopie znovu ověří data a přílohy a vytvoří nové identifikátory. Aktuální zakázky včetně změn provedených během stahování zůstanou zachované.",
      "Velké operace u cloudového nebo neznámého poskytovatele vyžadují neměřenou Wi-Fi. Výjimku pro jedinou operaci můžeš výslovně potvrdit; může spotřebovat mobilní data i data hotspotu. Místní složka funguje offline.",
      "V nabídce konkrétní fotografie nebo složky najdi Exportovat do ZIP a vyber místo pro uložení.",
      "Zkontroluj, že soubor ZIP skutečně vznikl; u důležité zakázky si jej ponech na bezpečném místě.",
      "Pro obnovení zvol ＋ → Importovat zakázky ze ZIP a vyber správný zálohovací soubor.",
      "Obnova vytváří novou kopii zakázky nebo složky; existující původní záznam by neměla přepisovat.",
      "Po importu otevři fotografie a ověř kóty, vložené obrázky, poznámky a přílohy."
    ],
    "notes": [
      "Když poskytovatel zálohy nevrací žádná data nebo překročí povolenou délku, kontrola skončí chybou. Neúplný obsah se nepotvrdí jako historická záloha ani se nepoužije k obnově; ověř dostupnost a zkus operaci znovu.",
      "Historie používá vlastní prostor Zamerovac-zalohy a funguje i při vypnuté synchronizaci či bez párování. Odpojení složky ani změna účtu uložené body nemaže. Starší historii najdeš opětovným výběrem původní složky.",
      "Google připojení používá soukromý prostor této aplikace na vybraném účtu. Body nejsou běžnými soubory v seznamu Disku; prohlížej, ověřuj a obnovuj je zde. Registrace a konfigurace této testovací verze jsou propojené. Použij povolený testovací účet; skutečný přenos a obnova na účtu dosud fyzicky ověřeny nebyly. Systémová složka nebo ZIP zůstávají samostatnou možností.",
      "Poškozený blok, chybějící příloha, odebrané oprávnění, nedostatek místa a přerušený zápis nesmějí být potvrzeny jako úplná záloha. Při chybě původní historie zůstává beze změny; poškozený existující blok se automaticky nepřepisuje.",
      "Pokud přerušená nebo poškozená záloha zanechá neúplný datový blok, nový pokus může z dostupného originálu vytvořit další ověřenou kopii. Původní soubor a historické manifesty nepřepisuje. Kontrola i obnova vybírají jen úplný obsah se správným součtem. Chyba oprávnění nebo čtení se nesmí vydávat za opravenou zálohu; pokud chybí všechny kopie i originál, obnova není možná. Ověření může vyžadovat další čtení velkých souborů.",
      "Automatická frekvence ani automatické promazávání nejsou zapnuté. Systémovou složku lze spravovat v jejím správci souborů; hromadné odstranění dat této aplikace v nastavení Disku smaže i její body. Sdílené bloky nemaž bez kontroly všech historií, jinak můžeš poškodit více bodů; synchronizace je nikdy nemaže.",
      "Nevyvážej pouhé zákaznické PDF, pokud chceš později upravovat kóty.",
      "ZIP podporuje nejvýše 20 000 položek včetně tří metadatových souborů, celkem 2 GiB rozbalených dat a 20 MiB UTF-8 pro každý JSON. Nadlimitní export skončí chybou; nepovažuj jej za hotovou zálohu.",
      "Při čtení ZIP ze systémového úložiště můžeš dál ukládat místní práci. Obnova přidá nové kopie k aktuálním zakázkám; pomalý poskytovatel má časový limit a přerušení nepotvrdí obnovu.",
      "Nové ZIP zálohy obsahují kontrolní součty SHA-256 a velikosti souborů. Obnova je ověří před vytvořením kopií; starší ZIP zůstávají přijímány bez této dodatečné kontroly.",
      "Chybějící nebo prázdná příloha export zálohy zastaví. Neúspěšný zápis se neoznačí jako hotová záloha; původní zakázky zůstávají zachované.",
      "Místní databáze má limit 20 MiB skutečných UTF-8 bajtů; české znaky a emoji zabírají více bajtů než prostý text. Odmítnutý nadlimitní zápis zachová obě potvrzené kopie. Rozpracované změny ponech otevřené a omez nepotřebný obsah před dalším uložením.",
      "Při hlášení Neuloženo zůstaň v aplikaci a uložení zopakuj. Aplikace potvrdí zápis až po úspěšném uložení; souběžné konfliktní změny uchová jako označenou kopii.",
      "Poškozený nebo neplatný ZIP, neplatné kódování, neúplné znaky Unicode a příliš zanořená data aplikace odmítne. Pokud nelze soubor vybrat, zkontroluj filtr a umístění v systémovém správci.",
      "Změna účtu nebo úložiště vyčistí pouze zobrazený seznam a dočasná označení ověření; původní historie zůstává na původním místě. Znovu ji zpřístupníš jeho výběrem. Odpojení záloh nezmění účet synchronizace ani místní zakázky."
    ],
    "keywords": [
      "archiv",
      "historické zálohy",
      "historie telefonu a tabletu",
      "sdílené bloky",
      "měřená síť",
      "SHA-256",
      "kontrolní součet",
      "neuloženo",
      "obnova",
      "importovat",
      "záloha",
      "kompatibilita",
      "Google účet",
      "soukromý prostor"
    ]
  },
  {
    "id": "trash",
    "title": "19. Koš, obnovení a zámky",
    "intro": "Odstraněné zakázky a soubory lze před trvalým smazáním dohledat v koši.",
    "steps": [
      "U položky otevři ⋮ → Smazat / Odstranit. Záznam se přesune do koše.",
      "Koš otevři z hlavního menu ☰ → Koš. Pokud chceš něco vrátit, použij Obnovit.",
      "Možnost Vysypat koš trvale odstraňuje položky; používej ji až po kontrole, že nejsou potřeba.",
      "Zámky složek slouží k ochraně před nechtěnou změnou. Před editací nebo mazáním složku podle potřeby odemkni."
    ],
    "notes": [
      "Vysypání koše uchovává pouze identifikátory a revizi smazání. Nezávislá novější změna z jiného zařízení se může zachovat jako označená konfliktní kopie; původní vysypané ID se neobnovuje.",
      "Trvalý úklid zahrnuje také výhradní hlasové poznámky a přílohy historie anotací. Soubor používaný jiným záznamem nebo jeho historií zůstane zachovaný; oddělené neměnné zálohy se tím nemažou.",
      "Obnovení z koše nenahrazuje samostatnou zálohu ZIP.",
      "Trvalé odstranění a synchronizace s dalšími zařízeními mohou mít nevratné následky."
    ],
    "keywords": [
      "vysypat koš",
      "odpad",
      "obnovit",
      "zamknout",
      "zámek"
    ]
  },
  {
    "id": "cloud",
    "title": "20. Synchronizace zařízení, Google Disk a práce offline",
    "intro": "Přímé propojení přenáší celé zakázky mezi spárovanými Androidy v místní síti nebo přes Wi-Fi Direct. Vzdálený přenos může použít samostatně připojený Google účet nebo systémovou složku.",
    "steps": [
      "Otevři ☰ → Synchronizace zařízení nebo Nastavení → Synchronizace zařízení – místní a Google Disk. Zapni párování na obou zařízeních.",
      "Ve stejné místní Wi-Fi vyber nalezený Zaměřovač. Bez internetu a routeru na obou spusť Hledat přes Wi-Fi Direct bez routeru a na jednom zvol druhé zařízení; systém Android může vyžádat potvrzení propojení.",
      "Pokud Android oznámí, že bezpečnostní klíč zařízení není dostupný, párování ani přenos nejsou potvrzené. Vrať se do aplikace a zkus přenos znovu; trvající chybu nepovažuj za úspěšné doručení dat.",
      "Porovnej celý kód na obou obrazovkách a potvrď shodu na obou zařízeních. Při odlišných kódech párování odmítni. Spárované zařízení získá všechny zakázky a přílohy.",
      "Automatické pokusy z tohoto zařízení se řídí zvolenou frekvencí. Zapnutý místní přenos běží i po zavření obrazovky ve službě Androidu s oznámením; vypneš ho v Synchronizaci zařízení nebo tlačítkem v oznámení. Na Androidu 13 a novějším povol oznámení, pokud je chceš vidět v běžném seznamu. Obrazovka ukazuje čekající potvrzení a chyby; po výpadku použij Zkusit přenos znovu.",
      "Ve stejné obrazovce nastav Frekvence automatických pokusů z tohoto zařízení: Automaticky (doporučeno), každých 15, 30 či 60 minut nebo Ručně. Automaticky průběžně zkouší místní přenos a otevřený cloud přibližně po minutě; Android na pozadí plánuje cloud nejdříve po 15 minutách. Časy jsou orientační, systém je může odložit. Ručně zastaví vlastní automatické pokusy, neukončí rozběhnutý přenos a nevypne příchozí místní spojení důvěryhodného zařízení. Vlastní pokus spustíš přes Zkusit přenos znovu nebo Synchronizovat nyní; příchozí místní přenos zastavíš vypnutím místního přenosu. Neúspěšně uložené nastavení se nepotvrdí.",
      "Odebrání párování zneplatní také právě dokončované spojení. Zařízení lze znovu schválit jen novým výslovným párováním. Pro odebrání důvěry zvol Odebrat párování. Tím se nemažou zakázky už uložené na druhém zařízení; zastaví se nové přenosy a odstraní místní fronta pro toto zařízení.",
      "Pro Google Disk v Synchronizaci zařízení zvol Připojit Google účet. Vyber stejný povolený testovací účet v telefonu i tabletu a potvrď přístup k soukromým datům této aplikace. Zrušený souhlas ponechá původní účet; změna účtu záloh je samostatná. Pokud připojení této verze čeká na dokončení nastavení, zůstává tlačítko nedostupné a místní přenos lze dál používat.",
      "Systémovou složku lze dál vybrat v Nastavení → Systémová složka synchronizace nebo přes ikonu cloudu. Vyber na obou zařízeních stejné místo s právem číst i zapisovat. Přepnutí na složku nahradí pro synchronizaci vybraný Google účet, účet záloh tím nemění.",
      "Ruční cloudovou synchronizaci spouštěj přes Synchronizovat nyní. Ikona cloudu rozlišuje potvrzeno, čeká a chybu; pouhé odeslání bez potvrzení příjemce není dokončený přenos.",
      "Potvrzené přijaté cloudové zprávy se evidují přímo v instalaci pro konkrétní úložiště. Po návratu se jejich obsah nečte zbytečně znovu; přerušené odeslání potvrzení se dokončí z uloženého stavu bez opakování importu.",
      "Před cloudem zařízení nejdříve spáruj místní cestou. Cloudové zprávy i potvrzení mají ověřovaný podpis veřejného certifikátu schválené instalace. Nová cesta nepřepisuje společný projects.json; starší vzdálené soubory zůstávají nedotčené.",
      "Velké cloudové přílohy na měřené nebo neznámé síti čekají. Malá změna může dorazit, pokud má příjemce potřebné originály už uložené. Výjimku pro aktuální pokus povolíš přes ikonu cloudu a Jednorázově povolit velké soubory na měřené síti. Volba Synchronizovat pouze na Wi-Fi omezuje i malé automatické cloudové změny.",
      "Hláška čekání na místní přenos, povolenou síť nebo další dávku zpráv znamená pokračování v následujícím pokusu. Poškozené zprávy ani uložená pozice procházení nejsou potvrzením přijetí zakázky. Rozpočet aplikace zahrnuje také řídicí zprávy; neudává přesnou síťovou spotřebu systémového poskytovatele.",
      "Při souběhu ověřených místních relací má Wi-Fi Direct přednost před místní Wi-Fi; mezi stejně dostupnými cestami obě zařízení používají shodné pořadí. Při výpadku se fronta pokusí pokračovat dostupnou cestou. Obrazovka ukazuje použitý místní přenos. Určení Wi-Fi Direct vychází ze skutečného síťového rozhraní skupiny Androidu, nikoli z názvu výrobce nebo odhadnuté IP adresy. Ověření rádia na skutečných zařízeních teprve čeká.",
      "Nedostupná stará cloudová zpráva zůstane nepotvrzená a může dál hlásit chybu; ostatní příchozí zprávy i vlastní nové odesílání přesto pokračují po omezených dávkách. Chybějící starý obsah se nesmí vydávat za doručený jen proto, že dorazila jiná zpráva.",
      "Dva nezávislé přesuny mohou při sloučení vytvořit cyklus složek. Aplikace deterministicky přesune jednu ze složek do kořene a označí ji OPRAVENÝ CYKLUS SLOŽEK. Všechny záznamy, přílohy a přesné kóty zachová; zkontroluj umístění a případně složku přesuň znovu.",
      "Když se objeví ověřené místní spojení nebo se změní povolené připojení, cloud to zkontroluje před dalším blokem, také během místní kontroly velkých originálů. Již probíhající operace poskytovatele může čekat do svého časového limitu. Nedokončená příloha ani zrušená plánovaná úloha neoznačí zakázku jako doručenou; potvrzené změny a fronta zůstávají uložené.",
      "Po změně cloudového úložiště se do něj musí ověřit úplná kopie aktuálních dat, i když je druhé zařízení dříve potvrdilo jinou cestou. Staré potvrzení nenahrazuje chybějící přílohy v novém místě. Velká kopie dál čeká na povolené připojení.",
      "Ověřené cloudové soubory se při čekání na druhé zařízení znovu celé nečtou. Aplikace kontroluje jejich dostupnost; chybějící nebo poškozený soubor si příjemce vyžádá podepsanou žádostí o novou kopii. Velká oprava dál čeká na povolenou síť. Při dlouhém čekání se kontrola souboru zopakuje nejpozději při dalším přenosu po uplynutí dne. Žádost o opravu ani evidence odeslání nenahrazují potvrzení celé zakázky.",
      "Offline můžeš pracovat s lokálně dostupnými projekty. Při opětovném připojení zkontroluj úspěšné provedení synchronizace.",
      "Při souběžných změnách na více zařízeních zkontroluj konfliktní kopie, než cokoli smažeš. Otevřený editor zůstane u své zachované změny, i když dostane nové ID kopie.",
      "Příchozí změny během kreslení, vyplňování rozměru nebo úprav detailní fotografie počkají na dokončení této úpravy. Tvoje rozpracovaná hodnota zůstane zachovaná i při konfliktní kopii; potom se načte aktuální stav.",
      "Pouhé prohlížení fotografie nebo detailu nevytváří historii ani novou revizi. Výchozí stav historie se uloží až s první skutečnou úpravou; rozměry plátna se zapíší při editaci, naměřené hodnoty se z pixelů neodvozují."
    ],
    "notes": [
      "Přímé propojení nevyžaduje internet, Google účet ani služby Samsungu. Wi-Fi Direct závisí na podpoře konkrétního Androidu a oprávněních; na starším Androidu také na zapnutém určování polohy. Při nepodpoře použij stejnou místní Wi-Fi. Rádia různých značek je stále nutné fyzicky ověřit.",
      "Pokud se místní databáze musí načíst ze starší záložní kopie, aplikace zneplatní stará místní potvrzení cloudových zpráv a znovu je ověří a sloučí. Spárovanému zařízení oznámí obnovu a vyžádá nové nabídnutí jeho dat; podle pořadí spojení může být potřeba další automatický pokus. Musí zůstat dostupná ověřená kopie zprávy nebo druhé zařízení. Ztrátu všech kopií tím opravit nelze.",
      "Když novější potvrzený stav nebo vysypaný koš prokazatelně nahradí starší nedokončenou zprávu a její chybějící přílohy už nejsou potřebné, aplikace ji místně vyřadí z čekání. Chybějící soubory tím neoznačí jako přijaté. Nezávislá konfliktní změna ani stále potřebná příloha se nesmějí zahodit.",
      "Po přerušení zůstává fronta v zařízení. Potvrzené soubory se ověří a nepřenášejí zbytečně znovu; nedokončený soubor se odešle celý. Při chybě hashe nebo odlišném originálu se přenos zastaví a nic nepřepíše. Příjem projektu se potvrdí až po ověření všech potřebných souborů a uložení dat.",
      "Párování vyžaduje otevřenou aplikaci a po odchodu z obrazovky se ukončí. Již spárovaný přenos může pokračovat na pozadí; Android či úspora baterie jej mohou omezit nebo ukončit. Po návratu se použijí potvrzená data a trvalá fronta. U dříve přímo ověřeného zařízení aplikace zkouší obnovit i zaniklou skupinu Wi-Fi Direct, pokud má oprávnění a protistrana nezměnila rádiovou adresu. Při změně adresy nebo systémovém odmítnutí znovu vyber zařízení. Nepřetržitý provoz na všech značkách ani skutečný Drive dosud nejsou fyzicky ověřeny.",
      "Historické zálohy se přímou synchronizací nemažou. Obnova Android systému nekopíruje identitu ani párování/frontu do jiného zařízení; po ní párování znovu nastav.",
      "Ne každý správce Google Disku nebo souborový poskytovatel nabízí zapisovatelnou složku pro Android.",
      "Systémová složka synchronizace má prostor Zamerovac-sync/sync/v2, zálohy Zamerovac-zalohy/backups/v2. Google připojení používá oddělené sync/v2 a backups/v2 v soukromém prostoru aplikace téhož účtu. Složku cloudové synchronizace nastav na obou zařízeních na stejné úložiště. Data ve vybrané složce chrání oprávnění poskytovatele/účtu; podpis sám nešifruje jejich obsah. Nezveřejňuj tuto složku ostatním.",
      "Cloudová synchronizace není totéž jako ověřená nezávislá záloha. Před důležitými změnami si ulož ZIP.",
      "Instalace používá náhodnou vlastní identitu a čítače revizí, ne model telefonu ani jeho hodiny. Při souběhu se novější pozorovaná verze odliší od nezávislé změny.",
      "Přenos poskytovatele nedrží zámek místní databáze. Novější změny čekají ve frontě; data příjemce se sloučí teprve po ověření všech potřebných souborů. Při přímém spojení má místní přenos přednost. Frekvenci automatických pokusů z tohoto zařízení volíš v synchronizačním panelu; Android na pozadí může nastavený interval prodloužit. Při neodpovídajícím poskytovateli se operace po časovém limitu nepotvrdí a čekající data zůstanou zachovaná; opožděná odpověď se zahodí. Google cesta používá vlastní API a potvrzenou registraci testovacího přihlášení. Vyžaduje služby Google Play a povolený testovací účet; živý přenos a obnova na účtu dosud fyzicky ověřeny nebyly.",
      "Odpojit Disk pro tuto funkci zastaví její cloudové přenosy a nepřejde samo na dřívější složku. Zakázky, párování, druhá funkce a historie se nemažou. Na pozadí se neotvírá souhlas k účtu; pokud je znovu potřeba, potvrď jej zde. Přihlašovací token se neukládá do projektu ani zálohy."
    ],
    "keywords": [
      "cloud",
      "frekvence",
      "15 minut",
      "30 minut",
      "60 minut",
      "ručně",
      "SAF",
      "párování",
      "Wi-Fi Direct",
      "wifi direct",
      "router",
      "čekající potvrzení",
      "synchronizovat",
      "konflikt",
      "bez internetu",
      "wi-fi",
      "Google účet",
      "souhlas účtu",
      "odpojit Disk"
    ]
  },
  {
    "id": "settings",
    "title": "21. Nastavení, jazyk a vzhled",
    "intro": "V Nastavení najdeš chování editoru, zobrazení, jednotky a další volby.",
    "steps": [
      "Z hlavního menu otevři Nastavení.",
      "V Editoru nastav lupu, přichytávání bodů/rastru, mřížku, odstup rastru a citlivost přesouvání.",
      "V Rozměrech nastav výchozí jednotky a počet zobrazovaných desetinných míst.",
      "Ve Vzhledu nastav barvu, tloušťku čar, velikost textu, zobrazení a další běžné chování.",
      "V hlavním menu ☰ → Historie změn nebo v Nastavení → Novinky a historie změn si zobrazíš skutečné novinky, opravené chyby a vylepšení podle verzí. Od verze 1.3.0 se významnější změny projevují druhým číslem verze, menší opravy posledním číslem; číslo sestavení Androidu je samostatné.",
      "Jazyk aplikace zatím nabízí pouze 🇨🇿 Čeština; další překlady nejsou hotové."
    ],
    "notes": [
      "Změna zobrazení jednotek nebo přiblížení nesmí přepočítat již uloženou naměřenou hodnotu bez tvé výslovné úpravy.",
      "Experimentální funkce jsou v hlavní nabídce samostatné a nemusí být ověřené pro běžné zakázky.",
      "Na výšku se lišta nemění. Na šířku se přidají vybrané nástroje podle volného místa. Nabídka nástrojů → Nastavit lištu na šířku umožní výběr a pořadí; vytahovací nabídka zůstává dostupná."
    ],
    "keywords": [
      "čeština",
      "jednotky",
      "mm",
      "cm",
      "barvy",
      "jazyk",
      "font",
      "historie změn",
      "changelog",
      "opravené chyby",
      "novinky",
      "verze",
      "nastavení"
    ]
  },
  {
    "id": "search",
    "title": "22. Vyhledávání a řazení zakázek",
    "intro": "Zakázky a soubory se dají vyhledat a seřadit v přehledu.",
    "steps": [
      "Ikonou hledání nahoře vyhledej položku podle názvu.",
      "Tlačítkem A–Z / Z–A změň pořadí v seznamu.",
      "Další možnosti hledání a filtrování mohou být dostupné v rozšířené nabídce; výsledky zkontroluj před úpravami.",
      "Ve vyhledávání zvol Vyhledat adresu v RÚIAN, zadej obec a číslo domu a vyber nalezenou adresu. Mapu otevři tlačítkem v prohlížeči."
    ],
    "notes": [
      "Vyhledání neznamená přesunutí ani smazání záznamu.",
      "Vyhledávání RÚIAN a mapa potřebují internet. Při otevření mapy se vybrané souřadnice odešlou službě OpenStreetMap."
    ],
    "keywords": [
      "najít",
      "hledat",
      "řazení",
      "seřadit",
      "filtr",
      "RÚIAN",
      "adresa",
      "mapa"
    ]
  },
  {
    "id": "experiments",
    "title": "23. Experimentální funkce a budoucí nápady",
    "intro": "Některé funkce v hlavní nabídce jsou výslovně označené jako experimentální.",
    "steps": [
      "Otevři ☰ → Experimentální funkce a přečti popis každé položky.",
      "Funkci zapínej pouze pro zkoušení, pokud víš, co od ní očekávat.",
      "Před výrobním použitím vždy ověř, že měření nebo pokyn ze zařízení skutečně fungují."
    ],
    "notes": [
      "Například dálková spoušť, digitální sklon nebo budoucí chytré plátno nemusejí být na tvém laseru nebo v této verzi plně dostupné.",
      "Nezaměňuj návrhy do budoucna za funkce již připravené k práci."
    ],
    "keywords": [
      "zkušební",
      "experiment",
      "novinky",
      "vývoj"
    ]
  },
  {
    "id": "trouble",
    "title": "24. Když něco nefunguje",
    "intro": "Při potížích je důležité nejdřív chránit data a pak zjistit konkrétní krok, na kterém vznikla chyba.",
    "steps": [
      "Nelze otevřít fotografii: zavři ji a zkus znovu; ověř, že originální soubor existuje.",
      "Vypadl laser: zkontroluj Bluetooth, zapnutý laser a oprávnění Androidu, potom zkus nové připojení.",
      "Nevypisuje se kóta: ověř výběr nástroje, vrstvy, barvu a přiblížení; zkus zavřít a otevřít fotografii.",
      "Nejde vybrat ZIP: najdi soubor v systémovém správci a ověř, že jde o zálohu Zaměřovače, nikoli zákaznický PDF ZIP.",
      "Ztratil se obrázek po přiblížení nebo se zobrazila mřížka: ukonči gesto, obnov zobrazení; nemaž zakázku ani data aplikace.",
      "Pokud chyba přetrvává, poznamenej verzi aplikace a pošli popis kroků a případně snímek či video."
    ],
    "notes": [
      "Neodinstalovávej aplikaci a nemaž její data jen kvůli dočasné chybě.",
      "Úspěšné automatické testy nejsou zárukou kompatibility všech telefonů a připojených zařízení."
    ],
    "keywords": [
      "chyba",
      "nefunguje",
      "ztráta dat",
      "pomoc",
      "oprava",
      "pád"
    ]
  },
  {
    "id": "safety",
    "title": "25. Přesnost rozměrů a ochrana dat",
    "intro": "Zaměřovač je pomocník pro dokumentaci, nikoli náhrada kontroly skutečného měření.",
    "steps": [
      "Každou důležitou výrobní kótu porovnej s reálným měřením na místě.",
      "Při změně polohy čáry znovu zvaž, zda číselná hodnota pořád odpovídá správnému prvku.",
      "Před vývozem nebo předáním zákazníkovi zkontroluj jednotky, názvy a případné soukromé poznámky.",
      "Při přenosu mezi zařízeními vytvoř a ověř zálohovací ZIP. V původní zakázce nemaž data, dokud není obnova ověřená."
    ],
    "notes": [
      "Kritické rozměry, například pro výrobu a montáž nábytku, nikdy nepotvrzuj jen podle obrazového měřítka fotografie.",
      "Údaje o zákaznících a fotografie interiérů považuj za citlivé.",
      "Editor otevírá jen vlastní zabalenou aplikaci. Cizí stránky, vložené rámce a spustitelné přílohy se v něm blokují; klepnutý webový odkaz se otevírá v systémovém prohlížeči. Tato ochrana nenahrazuje kontrolu celého zabezpečení aplikace."
    ],
    "keywords": [
      "bezpečnost",
      "výroba",
      "přesnost",
      "ochrana",
      "data",
      "soukromí",
      "webové odkazy",
      "spustitelné přílohy"
    ]
  }
];
const fold=text=>String(text||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('cs-CZ').trim();
function searchChapters(query=''){
 const needle=fold(query);
 if(!needle)return chapters;
 return chapters.filter(c=>fold([c.title,c.intro,...c.steps,...c.notes,...c.keywords].join(' ')).includes(needle));
}
function matchingRanges(text,query){
 const needle=fold(query);if(!needle)return [];
 let normalized='',offsets=[];
 for(let i=0;i<text.length;){const point=String.fromCodePoint(text.codePointAt(i)),part=point.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('cs-CZ');for(const char of part){normalized+=char;offsets.push([i,i+point.length])}i+=point.length;}
 const ranges=[];for(let at=0;(at=normalized.indexOf(needle,at))>=0;at+=needle.length){ranges.push([offsets[at][0],offsets[at+needle.length-1][1]])}return ranges;
}
const api=Object.freeze({chapters,searchChapters,matchingRanges});
root.ZamerovacHelp=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
if(typeof document==='undefined')return;
let panel,search,results,count,returnFocus,occurrenceCount,previousMatch,nextMatch,matches=[],matchIndex=-1;
function el(tag,className,text){
 const node=document.createElement(tag);
 if(className)node.className=className;
 if(text!==undefined)node.textContent=text;
 return node;
}
function moveMatch(step){
 if(!matches.length)return;
 matches[matchIndex]?.classList.remove('z-help-active-match');matchIndex=(matchIndex+step+matches.length)%matches.length;
 const target=matches[matchIndex];target.closest('details').open=true;target.classList.add('z-help-active-match');
 target.scrollIntoView({block:'center',behavior:'auto'});occurrenceCount.textContent=(matchIndex+1)+' z '+matches.length+' výskytů';
}
function render(){
 for(const mark of results.querySelectorAll('mark[data-help-match]'))mark.replaceWith(document.createTextNode(mark.textContent));
 results.normalize();matches=[];matchIndex=-1;
 const query=search.value,filtered=new Set(searchChapters(query).map(c=>c.id));let shown=0;
 for(const card of results.querySelectorAll('details[data-help-topic]')){
  const visible=filtered.has(card.dataset.helpTopic);card.hidden=!visible;
  if(visible)shown++;
  if(query.trim())card.open=visible;else if(card.dataset.helpTopic!=='start')card.open=false;
  if(!visible||!fold(query))continue;
  const walker=document.createTreeWalker(card,NodeFilter.SHOW_TEXT),nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
  for(const node of nodes){
   const ranges=matchingRanges(node.textContent,query);if(!ranges.length)continue;
   const fragment=document.createDocumentFragment();let from=0;
   for(const [start,end] of ranges){fragment.append(document.createTextNode(node.textContent.slice(from,start)));const mark=el('mark','',node.textContent.slice(start,end));mark.dataset.helpMatch='';matches.push(mark);fragment.append(mark);from=end;}
   fragment.append(document.createTextNode(node.textContent.slice(from)));node.replaceWith(fragment);
  }
 }
 count.textContent=shown===0?'Nic jsme nenašli. Zkus jiné slovo.':'Zobrazeno témat: '+shown+' z '+chapters.length;
 previousMatch.disabled=nextMatch.disabled=!matches.length;occurrenceCount.textContent='0 z '+matches.length+' výskytů';
 if(matches.length)moveMatch(1);
}
function close(){
 if(!panel||panel.hidden)return;
 panel.hidden=true;document.body.classList.remove('help-open');
 search.value='';
 render();
 const target=returnFocus&&returnFocus.isConnected?returnFocus:document.getElementById('back');
 target?.focus?.();
}
function open(){
 if(!panel)build();
 if(typeof closeMenus==='function')closeMenus();
 returnFocus=document.activeElement;
 panel.hidden=false;document.body.classList.add('help-open');
 search.value='';
 render();
 panel.querySelector('details[data-help-topic="start"]').open=true;
 // Browsing the guide must not summon Android keyboard on every open.
 // The magnifier in the header explicitly focuses the search input.
 panel.querySelector('#helpBack').focus();
}
function build(){
 panel=el('section','z-help-panel');
 panel.id='helpPanel';panel.hidden=true;
 panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');
 panel.setAttribute('aria-label','Nápověda Zaměřovače');
 const header=el('header','z-help-header');
 const back=el('button','z-help-close','←');back.id='helpBack';back.type='button';
 back.setAttribute('aria-label','Zavřít nápovědu');
 back.addEventListener('click',close);
 header.append(back,el('h1','','Nápověda'));
 const searchButton=el('button','z-help-search-button','🔍');
 searchButton.id='helpSearchToggle';searchButton.type='button';
 searchButton.setAttribute('aria-label','Hledat v nápovědě');
 searchButton.setAttribute('title','Vyhledat téma');
 searchButton.addEventListener('click',()=>{search.focus();search.select();});
 header.append(searchButton);
 const top=el('div','z-help-search');
 const label=el('label','','Hledat v nápovědě');label.htmlFor='helpSearch';
 search=el('input');search.id='helpSearch';search.type='search';
 search.placeholder='Např. kóta, Bosch, ZIP, fotografie';
 search.autocomplete='off';search.setAttribute('enterkeyhint','search');
 search.addEventListener('input',render);
 count=el('p','z-help-count');
 const navigation=el('div','z-help-match-nav');
 previousMatch=el('button','','↑ Předchozí');previousMatch.id='helpPreviousMatch';previousMatch.type='button';previousMatch.onclick=()=>moveMatch(-1);
 nextMatch=el('button','','Další ↓');nextMatch.id='helpNextMatch';nextMatch.type='button';nextMatch.onclick=()=>moveMatch(1);
 occurrenceCount=el('span');occurrenceCount.id='helpOccurrenceCount';occurrenceCount.setAttribute('aria-live','polite');
 navigation.append(previousMatch,occurrenceCount,nextMatch);top.append(label,search,count,navigation);
 const scroller=el('div','z-help-scroll');
 const intro=el('p','z-help-intro','Praktický návod ke všem současným funkcím. Funguje i bez internetu. Klepni na kapitolu pro otevření a čti postupy po jednotlivých krocích.');
 results=el('div','z-help-results');
 const list=el('div','z-help-list');
 for(const c of chapters){
  const detail=el('details','z-help-section');
  detail.dataset.helpTopic=c.id;
  const title=el('summary','',c.title);
  detail.append(title,el('p','z-help-lead',c.intro));
  if(c.steps.length){
   const steps=el('ol','z-help-steps');
   for(const step of c.steps)steps.append(el('li','',step));
   detail.append(steps);
  }
  if(c.notes.length){
   const tips=el('div','z-help-tips');
   for(const note of c.notes)tips.append(el('p','',note));
   detail.append(tips);
  }
  list.append(detail);
 }
 results.append(list);
 scroller.append(intro,results);
 panel.append(header,top,scroller);
 panel.addEventListener('keydown',event=>{
  if(event.key!=='Tab')return;
  const nodes=[...panel.querySelectorAll('button,input,summary')].filter(node=>!node.closest('[hidden]'));
  if(!nodes.length)return;
  const first=nodes[0],last=nodes[nodes.length-1];
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
 });
 document.body.append(panel);
 render();
}
root.openZamerovacHelp=open;
root.closeZamerovacHelp=close;
const previousBack=root.handleAndroidBack;
root.handleAndroidBack=function(){
 if(panel&&!panel.hidden){close();return 'handled';}
 return typeof previousBack==='function'?previousBack():'root';
};
})(typeof window!=='undefined'?window:globalThis);
