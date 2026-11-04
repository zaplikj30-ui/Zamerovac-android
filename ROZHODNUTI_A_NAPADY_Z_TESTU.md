# Zaměřovač – schválené změny, samostatné nápady a společná pravidla

**Zdrojem je celé video konverzace `1000093687.mp4`** (cca 3:55 min), spolu s ostatními zaslanými videi/screenshoty. Vzniklo při rekonstrukci **historického testování TEST v1.2.146**. Tento soubor **nenahrazuje detailní specifikaci** jednotlivých 28 kontrol: [1–10](REKONSTRUKCE_TESTU_01_10.md) · [11–20](REKONSTRUKCE_TESTU_11_20.md) · [21–28](REKONSTRUKCE_TESTU_21_28.md).

## Rozlišování stavu – nepřeskočit
- **Schváleno pro budoucí společnou aktualizaci:** v původním chatu byla odsouhlasena podoba; **nemusí to znamenat**, že už je aktuální kód upraven.
- **Historicky fungovalo:** pozitivní reálný test ve verzi 1.2.146, který je důležité *nepokazit*; po změnách ověřit regresně.
- **Možná později:** nápad nebo dlouhodobá vize bez rozhodnutí implementovat nyní.
- **Otevřená technická otázka:** chybějící detail, který nelze bez důkazu „dořešit za uživatele“.
- **Tvrzení o kódu ve starém chatu:** není rovnocenné současné kontrole commitu, vydání APK ani retestu na Samsungu.

## 1. Samostatně schválené nové funkce / zlepšení mimo původní testovací kroky

### A – Hromadné označování a společné operace
**Schváleno** během testu 25 (video t≈194–198 s), ačkoliv nebylo součástí původního testu.
- Dlouhé podržení souboru/složky/poznámky → režim výběru, první položka vybraná.
- Další položky tapnutím přidat, opětovným tapnutím odebrat.
- Počet nahoře **„Vybráno: N“**.
- Akce **Přesunout, Kopírovat, Smazat, Exportovat do ZIP, Vybrat vše**.
- Respektovat zámky jak u vybraných položek, tak cílových složek; vysvětlit blokované operace.
- Režim výběru po úspěšné akci ukončit. Bez svévolného přesunu složek či přepsání dat.
**Podrobný kontext:** [test 25](REKONSTRUKCE_TESTU_21_28.md#25--přejmenování-a-přesouvání-souborů--další-schválené-funkce).

### B – Odznak upravené fotografie
**Schváleno přímo uživatelem** v části testu 25, pozdější doplnění v testu 26 (video t≈200–218 s).
- Jedna diskrétní značka na miniaturním náhledu, když fotografie obsahuje **jakýkoliv uživatelský prvek** (kótu, čáru, šipku, poznámku, symbol aj.).
- Po odstranění **všech** prvků značka zmizí; neupravené snímky zůstávají bez odznaku.
- **Bílá/černobílá tužka s pravítkem** v malém tmavém **poloprůhledném** zaobleném čtverci v **pravém horním rohu** miniatury, přibližně **24×24 px** pozadí a **16×16 px** ikona, jemný světlý lem a odsazení; čitelné na světlé i tmavé fotce.
- **Stejný odznak** v galerii, seznamech složek a výsledcích vyhledávání.
- Historický asistent uvedl, že značku již dal do zdrojového kódu GitHubu a že **APK ještě nesestavil**. **Ověřit podle skutečného kódu/commitu a dnešní APK** – neoznačovat za potvrzené hotovo.
**Důležitý důkaz:** uživatelské „Jo, super nápad. Tak nějak to udělej.“ v hlavním videu t≈208–210 s.

### C – Export ZIP jednotlivé fotografie
**Schváleno** při testu 26, navíc ke stávající záloze celého projektu i vybrané složky (t≈210–216 s).
- V nabídce jedné fotografie **„Exportovat do ZIP“**, výstup: originál + editovatelné kóty + poznámky + přílohy.
- ZIP musí jít znovu importovat tak, aby vše zůstalo upravitelné.
- Před exportem jasně popsat, co je v archivu; pojmenování automaticky od aktuálního názvu aplikace a složky/fotografie (nesmí být napevno „Zaměřovač“).
- **Skutečná obnova pomocí importu zatím neprošla testem 27**.

### D – Více fotografií v jedné poznámce jako stoh
**Schválený vzhledový návrh**, samostatně od ověření funkce Poznámka (video t≈90–100 s).
- Jedna poznámka může mít více fotografií a stále se považuje za jeden celek s rámečkem a nezávislým hrotem.
- Miniatura první fotografie vpředu, další naznačené **posunutými listy papíru** s mírně přehnutým rohem, číslo počtu připojených fotografií.
- Hlasová poznámka má na první pohled ikonu mikrofonu; prázdná poznámka výzvu k zadání textu.
- Zachovat existující způsob otevření editace klepnutím, nezavádět jiné tlačítko.

### E – Společné řízení kót a výběru nástrojů
**Schválené průřezové pravidlo**, opakuje se v testech 1–9, 16–18:
- Za **koncový/rohový úchop** upravovat jen příslušný konec/roh; za **střed objektu** přemísťovat celý objekt; za **popisek** přesouvat popisek nezávisle.
- **Přednost koncového úchopu** při překrývajících se dotykových zónách.
- U kruhu **i elipsy** střed bílého úchopového kroužku leží přesně na žluté geometrii; dotykovou citlivost bez dohody neměnit.
- Bosch naměřená hodnota patří konkrétně označenému nástroji/straně/rameni; ponechat ruční zápis i volbu z historie, ale nenechat měření pouze v historii bez přímého zápisu.
- **Bez zbytečných nových tlačítek**, tam kde stačí přirozené gesto nebo existující Úpravy.
- Názvy: historická **„Plocha“ → nově „Lichoběžník“**, vedle ní zůstává **„Obdélník“** (90°); nástroj **„Směřovat“**, NE „Směrovat“.
- Přesné výjimky a nevýjimky podle jednotlivých testů (např. u Směřovat se text pohybuje 360° kolem bodu, ale neotáčí písmo).

## 2. Schválené vizuální / ovládací úpravy, které nepovažovat za kosmetiku bez zadání

- **Spodní tři tečky nemají být fialově zvýrazněné** jako aktivní kreslicí nástroj, přestože přeskupování ikon dlouhým stiskem už fungovalo ([test 15](REKONSTRUKCE_TESTU_11_20.md)).
- **Barva již existujícího objektu přímo v jeho úpravách**, nikoli pouze předběžná barva ze spodní palety. Spodní paletu, fungující tloušťku čáry a velikost písma zachovat ([test 17](REKONSTRUKCE_TESTU_11_20.md)).
- **Odstranit jen redundantní horní šipky ‹ ›** pro fotografie; horní náhled ponechat jako vstup do galerie; **spodní Zpět/Znovu nesmazat** ([test 20](REKONSTRUKCE_TESTU_11_20.md)).
- **Výchozí fotografie více vyplní pracovní plochu** a může se posouvat; kóty zůstávají na původních souřadnicích; mřížka přichytávání nemá při velkém zoomu vizuálně rušit. **Přizpůsobit fotografii** už bylo pod horními třemi tečkami, nevytvářet duplicitní ikonu ([test 19](REKONSTRUKCE_TESTU_11_20.md)).
- **Výsledky hledání** s miniaturou a výpisem odpovídající poznámky, nad klávesnicí, **návrat zpět do stejného vyhledávání** ([test 23](REKONSTRUKCE_TESTU_21_28.md)).
- **Koš s miniaturami a skutečnou obnovou**, ne jen toastem „Obnoveno“ ([test 22](REKONSTRUKCE_TESTU_21_28.md)).
- **Ochrana obsahu zamčené složky** i při přesunu, včetně jasné hlášky ([test 25](REKONSTRUKCE_TESTU_21_28.md)).
- **ZIP názvy dynamicky** podle názvu aplikace, který se může změnit (např. Zaměřovač → Měřák), a názvu zakázky ([test 26](REKONSTRUKCE_TESTU_21_28.md)).

## 3. Nápady výslovně odložené / nezávazné

| Nápad | Původní postavení, co **není** schváleno okamžitě | Zdroj |
|---|---|---|
| Samostatný poznámkový blok s ručním psaním **S Pen** a možné obousměrné propojení se **Samsung Notes** | **Větší budoucí projekt**, ne prosté přepnutí ikonky Poznámka; technickou proveditelnost nutno zvlášť posoudit. | ~01:30–01:34 (test 10/11) |
| Zvětšování a otáčení vloženého **Symbolu** | Při testu 12 bylo funkční vkládání/přesun; možnost měnit velikost/rotaci byla zmíněna jen jako **„možná někdy“**. | ~01:40–01:44 |
| Změna/odstranění stávajícího tlačítka **Přizpůsobit fotografii** z nabídky | V pozdějším vysvětlení se našlo v menu a bylo rozhodnuto **nepřidávat duplicitní horní tlačítko**; další redesign zatím nezávazný. | ~02:36–02:42 |
| Plná obousměrná synchronizace přes **Google Disk** mezi telefonem a tabletem | **Nesplněno/nezahrnuto do testů 1–28**; samostatná budoucí fáze, nelze tvrdit fungování na základě editoru. | úvod videa ~00:00 |
| **Test 29 – práce bez internetu** | Další navržená kontrola po dokončení 28, nikoli splněný test. | závěr videa ~03:53–03:55 |

## 4. Přehled důkazů a dosud nepotvrzených identit videí

### Obrázky přiložené uživatelem
| Název | Čemu odpovídá |
|---|---|
| `1000093519.jpg` | Test 7, původní Plocha se čtyřúhelníkem / 1 m² |
| `1000093546.jpg` | Test 19, srovnání vzhledu fotky |
| `1000093548.jpg` | Test 20, zakroužkované horní šipky |
| `1000093549.jpg` | Test 22, koš |
| `1000093552.jpg` | Test 23, hledání „Bla“ |
| `1000093557.jpg` | Test 26, ZIP rozbalení |
| `1000093570.jpg` | Test 26, ZIP `media` a dva JSON soubory |
| `1000093572.jpg` | Test 26, obsah složky `media` |
| `1000093574.jpg` | Testy 21/25, fotografie a zamčené položky |
| `1000093683.jpg` | Snímek místnosti – **kontext a původní fotografie**, nikoli samostatný důkaz o funkci aplikace |

### Nahrávky aplikace doplněné k hlavnímu videu
| Soubor | Podle zobrazeného obsahu souvisí s | Poznámka |
|---|---|---|
| `Screen_Recording_20261104_004433.mp4`, `005059.mp4` | Testy 1–5 | Kreslení a řetězce; přesné staré ID nutno spárovat |
| `Screen_Recording_20261104_010328.mp4`, `010354.mp4`, `010521.mp4`, `011043.mp4` | Testy 7–9 | Plocha, kruh, elipsa, úchopy, Bosch; **kruh i elipsa** |
| `Screen_Recording_20261104_013507.mp4` | Test 13 | Bosch a Bluetooth seznam |
| `Screen_Recording_20261104_014404.mp4` | Test 16 | Magnetické přichytávání, koncové úchopy |
| `Screen_Recording_20261104_015015.mp4` | Test 17 | Barva, tloušťka a úpravy |
| `Screen_Recording_20261104_015435.mp4` | Test 18 | Směřovat |
| `Screen_Recording_20261104_020258.mp4` | Testy 19–20 | Fotografie, editace, náhled |
| `Screen_Recording_20261104_021857.mp4` | Test 22 | Koš, volba Obnovit, hláška |
| `Screen_Recording_20261104_022456.mp4` | Test 23 | Dialog vyhledávání |
| `Screen_Recording_20261104_023025.mp4` | Test 25 | Seznam a přesun souborů |
| `Screen_Recording_20261104_024728_My Files.mp4` | Test 26 | Správce souborů, ZIP a export |
| `Screen_Recording_20261104_030119_My Files.mp4` | Test 27 | Správce souborů a ZIP import |

V samotném hlavním záznamu se objevují **původní jména příloh**, jejichž identita s nynějšími časově pojmenovanými soubory ještě není stoprocentně doložená: `1000093514.mp4`, `1000093518.mp4`, `1000093525.mp4`, `1000093528.mp4`, `1000093532.mp4`, `1000093535.mp4`, `1000093536.mp4`, `1000093539.mp4`, `1000093545.mp4`, `1000093551.mp4`, `1000093554.mp4`, `1000093555.mp4`, `1000093598.mp4`, `1000093686.mp4`. **Nepředstírat totožnost; zatím přiřazení podle obsahu a času.** Originály lze podle potřeby porovnat, pokud budou dodány.

### Přesnost přepisu
Protože hlavní video **rychle posouvá dlouhý chat** a místy zakrývá text vrchním ovládáním či koncem obrazovky, tyto podrobné dokumenty představují **věcnou rekonstrukci z čitelných obrazových úseků**, nikoliv ověřený **doslovný přepis úplně každého znaku a každé zprávy**. Podstatné rozhodující uživatelské formulace a následná výslovná vyvrácení dřívějších nedorozumění jsou zachované. **Nečitelný detail je třeba vyžádat konkrétním snímkem místo domněnky.**

## 5. Na co navázat před vývojem a sestavením další APK
1. Z těchto protokolů vytvořit **kontrolní mapu požadavek → aktuální třída/funkce v GitHubu → existující commit → chybějící část → test na zařízení**, protože původní video obsahuje **historická** tvrzení o implementaci a nepokrývá současnou verzi.
2. Zkontrolovat především **regrese** v již funkčních testech 10, 12, 14, 15 (přeskupování, vyjma úpravy zvýraznění), 21 (základ), 23 (vyhledávací logika), 24, 25 (základ) a 28.
3. **V tomto kroku ještě nesestavovat APK**. Až po domluvě/uživatelově pokynu; režim nových testů v dávkách přibližně pěti úkolů použít až pro následnou fázi, **ne místo nynější úplné rekonstrukce 28**.
