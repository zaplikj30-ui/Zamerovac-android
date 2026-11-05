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
      "Opakované otevření stejné fotografie využívá omezenou paměťovou mezipaměť dekódovaných obrázků. Po úplném restartu se originál načítá znovu. Při načítání nebo chybě se samostatné kóty nezobrazují na prázdném podkladu; originály ani hodnoty se nemění.",
      "Příloha se připojí až po potvrzení celého zápisu. Při přerušení se nedokončený soubor odmítne a existující originál se nepřepíše."
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
      "V galerii se fotografie i všechny anotace posouvají jen k dostupným okrajům. Po oddálení na 1× se vycentrují; gesta zůstávají dostupná bez spodního pokynu."
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
      "Soukromé poznámky do zákaznického PDF patří jen při výslovné volbě."
    ],
    "keywords": [
      "checklist",
      "poznámkový blok",
      "audio",
      "mikrofon",
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
      "Otevři ☰ → Historické zálohy nebo Nastavení → Historické zálohy a obnova. Vyber složku záloh nezávisle na synchronizaci.",
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
      "Historie používá vlastní prostor Zamerovac-zalohy a funguje i při vypnuté synchronizaci či bez párování. Odpojení složky ani změna účtu uložené body nemaže. Starší historii najdeš opětovným výběrem původní složky.",
      "Google Disk je zatím závislý na tom, zda jeho systémový poskytovatel dovolí vybrat zapisovatelnou složku. Pokud ji nenabízí, použij místní úložiště nebo ZIP; oficiální Drive API se teprve dokončuje a nesmí se zaměnit za ověřené připojení.",
      "Poškozený blok, chybějící příloha, odebrané oprávnění, nedostatek místa a přerušený zápis nesmějí být potvrzeny jako úplná záloha. Při chybě původní historie zůstává beze změny; poškozený existující blok se automaticky nepřepisuje.",
      "Automatická frekvence ani automatické promazávání nejsou zapnuté. Ruční správa patří do správce souborů úložiště. Sdílené bloky nemaž bez kontroly všech historií, jinak můžeš poškodit více bodů; synchronizace je nikdy nemaže.",
      "Nevyvážej pouhé zákaznické PDF, pokud chceš později upravovat kóty.",
      "Nové ZIP zálohy obsahují kontrolní součty SHA-256 a velikosti souborů. Obnova je ověří před vytvořením kopií; starší ZIP zůstávají přijímány bez této dodatečné kontroly.",
      "Chybějící nebo prázdná příloha export zálohy zastaví. Neúspěšný zápis se neoznačí jako hotová záloha; původní zakázky zůstávají zachované.",
      "Při hlášení Neuloženo zůstaň v aplikaci a uložení zopakuj. Aplikace potvrdí zápis až po úspěšném uložení; souběžné konfliktní změny uchová jako označenou kopii.",
      "Poškozený nebo neplatný ZIP, neplatné kódování, neúplné znaky Unicode a příliš zanořená data aplikace odmítne. Pokud nelze soubor vybrat, zkontroluj filtr a umístění v systémovém správci."
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
      "kompatibilita"
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
    "intro": "Přímé propojení přenáší celé zakázky mezi spárovanými Androidy v místní síti nebo přes Wi-Fi Direct. Google Disk je oddělená cesta závislá na poskytovateli složky.",
    "steps": [
      "Otevři ☰ → Synchronizace zařízení nebo Nastavení → Místní a přímé propojení. Zapni párování na obou zařízeních.",
      "Ve stejné místní Wi-Fi vyber nalezený Zaměřovač. Bez internetu a routeru na obou spusť Hledat přes Wi-Fi Direct bez routeru a na jednom zvol druhé zařízení; systém Android může vyžádat potvrzení propojení.",
      "Porovnej celý kód na obou obrazovkách a potvrď shodu na obou zařízeních. Při odlišných kódech párování odmítni. Spárované zařízení získá všechny zakázky a přílohy.",
      "Při dostupném spojení se spárované instalace dorovnávají automaticky, když je Zaměřovač otevřený. Obrazovka ukazuje čekající potvrzení a chyby; po výpadku použij Zkusit přenos znovu.",
      "Pro odebrání důvěry zvol Odebrat párování. Tím se nemažou zakázky už uložené na druhém zařízení; zastaví se nové přenosy a odstraní místní fronta pro toto zařízení.",
      "Pro dosavadní cloudovou cestu v Nastavení nebo nabídce Google Disk vyber složku, do které má Zaměřovač přístup pro čtení i zápis.",
      "Ruční cloudovou synchronizaci spouštěj přes Synchronizovat nyní. Ikona cloudu rozlišuje potvrzeno, čeká a chybu; pouhé odeslání bez potvrzení příjemce není dokončený přenos.",
      "Před cloudem zařízení nejdříve spáruj místní cestou. Cloudové zprávy i potvrzení mají ověřovaný podpis veřejného certifikátu schválené instalace. Nová cesta nepřepisuje společný projects.json; starší vzdálené soubory zůstávají nedotčené.",
      "Velké cloudové přílohy na měřené nebo neznámé síti čekají. Malá změna může dorazit, pokud má příjemce potřebné originály už uložené. Výjimku pro aktuální pokus povolíš přes ikonu cloudu a Jednorázově povolit velké soubory na měřené síti. Volba Synchronizovat pouze na Wi-Fi omezuje i malé automatické cloudové změny.",
      "Offline můžeš pracovat s lokálně dostupnými projekty. Při opětovném připojení zkontroluj úspěšné provedení synchronizace.",
      "Při souběžných změnách na více zařízeních zkontroluj konfliktní kopie, než cokoli smažeš. Otevřený editor zůstane u své zachované změny, i když dostane nové ID kopie.",
      "Pouhé prohlížení fotografie nebo detailu nevytváří historii ani novou revizi. Výchozí stav historie se uloží až s první skutečnou úpravou; rozměry plátna se zapíší při editaci, naměřené hodnoty se z pixelů neodvozují."
    ],
    "notes": [
      "Přímé propojení nevyžaduje internet, Google účet ani služby Samsungu. Wi-Fi Direct závisí na podpoře konkrétního Androidu a oprávněních; na starším Androidu také na zapnutém určování polohy. Při nepodpoře použij stejnou místní Wi-Fi. Rádia různých značek je stále nutné fyzicky ověřit.",
      "Po přerušení zůstává fronta v zařízení. Potvrzené soubory se ověří a nepřenášejí zbytečně znovu; nedokončený soubor se odešle celý. Při chybě hashe nebo odlišném originálu se přenos zastaví a nic nepřepíše. Příjem projektu se potvrdí až po ověření všech potřebných souborů a uložení dat.",
      "Po uspání nebo odchodu z aplikace se místní spojení zavře; návrat pokračuje z fronty. Bez vytvořené skupiny Wi-Fi Direct může být potřeba znovu vybrat zařízení. Tato implementace zatím negarantuje nepřetržitý přenos na pozadí ani automatické přepnutí na Drive.",
      "Historické zálohy se přímou synchronizací nemažou. Obnova Android systému nekopíruje identitu ani párování/frontu do jiného zařízení; po ní párování znovu nastav.",
      "Ne každý správce Google Disku nebo souborový poskytovatel nabízí zapisovatelnou složku pro Android.",
      "Živá cloudová synchronizace má vlastní prostor Zamerovac-sync/sync/v2, historické zálohy vlastní Zamerovac-zalohy/backups/v2. Složku cloudové synchronizace nastav na obou zařízeních na stejné úložiště. Data ve vybrané složce chrání oprávnění poskytovatele/účtu; podpis sám nešifruje jejich obsah. Nezveřejňuj tuto složku ostatním.",
      "Cloudová synchronizace není totéž jako ověřená nezávislá záloha. Před důležitými změnami si ulož ZIP.",
      "Instalace používá náhodnou vlastní identitu a čítače revizí, ne model telefonu ani jeho hodiny. Při souběhu se novější pozorovaná verze odliší od nezávislé změny.",
      "Přenos poskytovatele nedrží zámek místní databáze. Novější změny čekají ve frontě; data příjemce se sloučí teprve po ověření všech potřebných souborů. Při přímém spojení má místní přenos přednost. Otevřená aplikace opakuje cloud přibližně po minutě, Android na pozadí určuje čas sám. SAF poskytovatel může být pomalý či blokovat; tato cesta stále není oficiální Drive API/OAuth a účet Disku dosud nebyl fyzicky ověřen."
    ],
    "keywords": [
      "cloud",
      "SAF",
      "párování",
      "Wi-Fi Direct",
      "wifi direct",
      "router",
      "čekající potvrzení",
      "synchronizovat",
      "konflikt",
      "bez internetu",
      "wi-fi"
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
      "V hlavním menu ☰ → Historie změn nebo v Nastavení → Novinky a historie změn si zobrazíš skutečné novinky, opravené chyby a vylepšení podle verzí.",
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
      "Údaje o zákaznících a fotografie interiérů považuj za citlivé."
    ],
    "keywords": [
      "bezpečnost",
      "výroba",
      "přesnost",
      "ochrana",
      "data",
      "soukromí"
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
