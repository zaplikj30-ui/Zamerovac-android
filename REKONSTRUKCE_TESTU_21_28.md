# Zaměřovač – rekonstrukce testů 21–28 z původního chatu

**Zdroj:** video původního chatu `1000093687.mp4`, cca 02:46–03:55 (t=166–235 s). Všechny níže uvedené výsledky jsou **historická uživatelská zjištění** při testování v původní konverzaci, ne automatické potvrzení chování aktuálně sestavené APK. Rozhodující jsou **pozdější upřesnění a konečné dohody**, ne první stručné nebo chybné vyhodnocení v chatu.

Přílohy v původním záznamu označené číselným názvem (např. `1000093551.mp4`) nejsou vždy přiložené zde pod totožným jménem. Když je časově pojmenované video z nových nahrávek obsahově odpovídající, uvádím je jako **tematicky přiřazené**, nikoliv jako prokázanou identitu původního souboru. Originální soukromé fotografie nevkládat do veřejného repozitáře.

## 21 – Zamykání souborů a složek

**Původní postup (t≈166–172 s):** zamknout fotografii nebo složku; ověřit viditelný symbol zámku, zákaz přejmenování a smazání, možnost odemknutí, přístup k exportu ZIP jako záloze.

**Skutečný průběh:** po prvním ověření uživatel sdělil: „Zámek se objeví přejmenovat nejde, jde akorát exportovat zip.“ Při exportu se otevřelo běžné okno Androidu pro uložení ZIP; není to chyba ochrany. V další odpovědi uživatel upřesnil, že **smazat nejde a odemknout lze**. Následně byl test **výslovně označen SPLNĚNO**.

**Co zachovat:**
- Symbol zámku je zřetelný na zamčené položce (snímek `1000093574.jpg`).
- Zamčenou položku nelze přejmenovat ani smazat; lze ji odemknout.
- Export ZIP je možný i u zamčené položky, aby šla bezpečně zálohovat.
- Žádná změna exportu do systémového okna Androidu jen kvůli zamknutí.

**Pozdější důležitý dodatek z testu 25:** základní test 21 prošel, **ale ochrana obsahu složky byla následně obejita** tím, že šel zvenku přesunout soubor do zamčené složky. To je **nová potvrzená chyba**, kterou je nutné opravit v navazujícím testu 25 a u centrální ochrany zámku. Nelze proto z celkového SPLNĚNO u 21 vyvozovat, že jsou všechna pravidla zamykání bezvadná.

**Historický stav:** SPLNĚNO v rozsahu provedených úkonů, s nově odhaleným problémem v testu 25. **Zdroj:** 02:46–02:52 (t≈166–172), screenshot `1000093574.jpg`.

## 22 – Koš a obnovení souborů

**Původní test (t≈170–176):** vytvořit *jen zkušební* fotografii nebo poznámku; smazat ji do koše, otevřít Koš, vybrat Obnovit a ověřit návrat do původní složky se všemi kótami, poznámkami a přílohami. **Trvalé odstranění se v tomto testu zatím nemělo zkoušet.**

**Původní příloha:** `1000093551.mp4` viditelná v chatu; nově nahrané `Screen_Recording_20261104_021857.mp4` **přímo zachycuje Koš, tlačítka Obnovit/Odstranit a hlášku „Položka obnovena“**. Snímek `1000093549.jpg` zachycuje Koš se souborem i poznámkou.

**Dvě potvrzené připomínky:**
1. Koš ukazuje **především názvy souborů**, podle číselného názvu fotografie se špatně identifikuje. **Přidat miniaturu fotografie**, odpovídající vzhledu běžného seznamu fotek, a vhodný náhled/ikonu poznámek. Má být hned vidět, co uživatel obnovuje.
2. Po stisknutí **Obnovit** aplikace oznámila „Položka obnovena“, ale podle uživatelského testu se položka **nevrátila správně do původního umístění**. Ověřit a opravit skutečnou obnovu objektu včetně všech editovatelných kót, poznámek a příloh. Položku z Koše vyřadit až po úspěšném dokončení; neukazovat falešnou hlášku o úspěchu.

**Pozor:** Snímek s hláškou sám o sobě nedokazuje, že soubor chyběl; tento závěr je **výslovné uživatelské pozorování** z historického chatu, nikoli odhad podle jednoho snímku.

**Historický stav:** **NEFUNGUJE SPRÁVNĚ**, dvě schválené opravy. **Zdroj:** 02:52–02:58 (t≈172–176), `1000093551.mp4`, `Screen_Recording_20261104_021857.mp4`, `1000093549.jpg`.

## 23 – Vyhledávání souborů a poznámek

**Původní postup (t≈176–190):** ve vyhledávání zadat část názvu souboru nebo textu poznámky (testováno **„Bla“**), vybrat výsledek a otevřít jej. `1000093552.jpg` zachycuje dialog „Hledat zakázky a poznámky“, hledaný řetězec a výsledek fotografie. Původní `1000093554.mp4` je označené v chatu; nahrané `Screen_Recording_20261104_022456.mp4` ukazuje stejnou oblast.

**Chronologie chyby v předběžném vyhodnocení – nutné zachovat:**
- Asistent **nejprve mylně vyhodnotil**, že „Bla“ patří samostatné poznámce, která se ve výsledcích nezobrazila. Navrhl proto opravovat neexistující chybu prohledávání.
- Uživatel výslovně opravil: **„Přímo ta fotka to byla má v sobě poznámku bla.“** Fotografie se našla právě díky poznámce uvnitř ní.
- Asistent tento závěr opravil a uznal, že **logika vyhledávání fungovala správně**. Nesmí se tedy implementovat „oprava chybějícího výsledku“ podle původního omylu.

**Platná společná dohoda o třech úpravách ovládání (t≈184–190):**
1. **Každý nalezený soubor fotografie zobrazí miniaturu**, aby šlo rozpoznat, co otevíráme. Pokud je důvodem nalezení text v poznámce vložené do fotografie, zobrazit **krátký úryvek odpovídající poznámky**; podle vhodnosti zvýraznit nalezené slovo. Na obrazovce má být jasné, **proč** je výsledek ve vyhledávání.
2. **Dialog vyhledávání a seznam výsledků přesunout/rozložit výš nad systémovou klávesnicí**, aby ji klávesnice nepřekrývala. Při větším počtu výsledků musí jít seznam posouvat.
3. **Zachovat stav vyhledávání po návratu Zpět**: po otevření nalezené fotografie a jejím prohlédnutí se uživatel vrátí **do téhož hledání, se stejným výrazem, sadou výsledků a posunem v seznamu**. Není nutné hledání opakovat. Uživatel označil právě tento bod za zvlášť důležitý.

**Co není schváleno:** původně nejasně navržené automatické přepínání mezi fotografiemi, další tlačítka nebo automatický foto-prohlížeč. Poslední dohoda byla **jen uchovat seznam a stav běžného vyhledávání**.

**Historický stav:** základní vyhledávání **SPLNĚNO**, schváleny tři UX úpravy. **Zdroj:** 02:56–03:10, `1000093552.jpg`, `1000093554.mp4`, `Screen_Recording_20261104_022456.mp4`. Zobrazení ikonky editované fotografie viz související test 25.

## 24 – Řazení souborů

**Původní test (t≈178–190):** nahoře ikona **A–Z**, zkusit přepínání řazení podle názvu a data; ověřit pořadí fotografií a složek a jeho zachování po návratu do složky.

**Přesné potvrzení uživatele:** „A test 24 řazení souborů taky funguje dobře“ (v záznamu kolem t≈190 s). Asistent následně uzavřel „Řazení funguje správně, bez připomínek.“

**Historický stav:** **SPLNĚNO**, ponechat dosavadní fungující funkci a pouze regresně zkontrolovat po budoucí aktualizaci. Samostatná příloha přesně tohoto testu nebyla identifikována. **Zdroj:** 03:00–03:10.

## 25 – Přejmenování a přesouvání souborů + další schválené funkce

**Původní postup (t≈190–204):** zvolit nezamčenou fotografii, přejmenovat ji a ověřit zachování `.jpg`; přesunout mezi složkami; otevřít a ověřit **všechny kóty/poznámky**. Původní přiložené video `1000093555.mp4` v hlavním chatu; novější `Screen_Recording_20261104_023025.mp4` ukazuje soubory a přesun v Zaměřovači.

**Skutečně otestované fungování:** přejmenování **zachovává příponu `.jpg`**, přesun mezi **běžnými nezamčenými složkami** funguje a **anotace zůstávají zachované**. Tyto funkční části nesmí následná oprava pokazit.

**Potvrzená vážná chyba ochrany zámku:** uživatel mohl nezamčený soubor `C.jpg` přesunout **do zamčené složky Zapletal**; to nesmí aplikace dovolit. **Schválené pravidlo centrální ochrany:**
- do zamčené složky nesmí jít přesunout soubor ani další složka;
- ze zamčené složky se nesmí nic přesouvat ven, dokud se neodemkne;
- nesmí jít přidávat, přejmenovávat ani mazat její obsah;
- zamčená složka se v nabídce cílů přesunu **zobrazí**, ale **nebude volitelná jako cíl**;
- srozumitelně sdělit **„Nejdříve odemkněte složku.“**;
- zachovat funkční odemčení a povolený ZIP export.

**Nová funkce výslovně odsouhlasená mimo původní kroky testu – HROMADNÉ OZNAČOVÁNÍ (t≈194–198):**
1. **Dlouhé podržení** fotografie, poznámky nebo složky zapne režim výběru a označí ji.
2. Kliknutím na další položky přidávat do výběru; opětovným kliknutím položku odebrat.
3. V horní části počítadlo **„Vybráno: 8“** (aktuální počet).
4. Společné akce **Přesunout, Kopírovat, Smazat, Exportovat do ZIP, Vybrat vše**.
5. Při hromadných akcích respektovat zámky u vybraných položek i cílových složek; při nemožnosti akci provést zobrazit jasnou zprávu.
6. Po úspěšné akci režim výběru ukončit. Inspirováno běžným správcem souborů Samsung.
**Stav:** schválené zadání pro budoucí společnou aktualizaci, **nepovažovat za již fungující**.

**Nová schválená funkce – ZNAČKA FOTOGRAFIE OBSAHUJÍCÍ ÚPRAVY (t≈200–210):**
- V seznamu fotografií uživatel chce okamžitě odlišit **čistou fotografii místnosti** od fotografie, v níž už nakreslil kóty, čáry, šipky, symboly nebo zapsal poznámku. Nemá jít jen o přítomnost kót.
- Navržena diskrétní **černobílá ikona tužky s pravítkem** v **malém tmavém poloprůhledném čtverci se zaoblenými rohy** na pravém horním rohu miniatury, s lehkým odsazením a jemným světlým obrysem kvůli kontrastu na bílé, tmavé i barevné fotce.
- Orientační rozměry **pozadí 24 × 24 px**, **ikona ~16 × 16 px**; zde jde o tehdejší návrh designu, výsledné Android DP/rendering je třeba realizovat přiměřeně hustotě displeje.
- **Bez značky**, když fotografie nemá žádný dodaný prvek. Značka se objeví automaticky při vložení alespoň jednoho prvku, **zmizí po odstranění všech prvků**.
- Konzistentně v **galerii, seznamech složek a výsledcích vyhledávání**; nezakrývat miniaturu víc, než je nutné.
- Uživatel navrženou podobu výslovně schválil: **„Jo, super nápad. Tak nějak to udělej.“**
- **Důležitá historie implementace:** v původním chatu asistent později napsal, že značku **už přidal do kódu GitHubu včetně vyhledávání**, ale **novou APK ještě nesestavil**. Toto je **historické tvrzení z chatu**; skutečný aktuální commit ani stav na zařízení jsme zde ještě samostatně neověřili. Nesmíme automaticky přepsat jako „hotovo a otestováno“.

**Historický výsledek testu 25:** **ČÁSTEČNĚ SPLNĚNO**, běžné přejmenování a přesun fungovaly, chyba s cílovou zamčenou složkou; zároveň dvě samostatné schválené funkce. **Přílohy:** `1000093555.mp4`, `Screen_Recording_20261104_023025.mp4`, screenshot složky se zámkem `1000093574.jpg`.

## 26 – Export ZIP, struktura obsahu a pojmenování

**Původní test (t≈204–224):** vyexportovat **jednu zkušební složku**, najít vytvořený ZIP v telefonu a otevřít/rozbalit, zkontrolovat složku `media`, `projects.json`, `media-meta.json`. Původní příloha `1000093598.mp4` označena v chatu; v nově nahraném `Screen_Recording_20261104_024728_My Files.mp4` je vidět procházení správcem souborů, ZIP a jeho obsah. Screenshoty `1000093557.jpg`, `1000093570.jpg`, `1000093572.jpg` zachycují rozbalení, JSON soubory a více datových souborů v `media`.

**Potvrzeně fungující:** vytvoření ZIP, vyhledání v Androidu a jeho běžné otevření; založená struktura zálohy je smysluplná:
- `projects.json`: struktura zakázek, fotografií a editovatelných prvků;
- `media-meta.json`: metadata o mediálních souborech;
- složka `media/`: skutečné soubory fotografií a případné další přílohy.

**Nesrovnalost, nikoli dosud prokázaná chyba:** export složky **Zapletal** obsahoval kolem **7 souborů v `media`**, přestože uživatel viděl přibližně **3 fotografie**, a domníval se, že se přibalily dříve přesunuté soubory z jiných složek. Asistent porovnal zkušební složku **Xxx** s **jednou fotografií a jedním médiem** v ZIP, který byl **konzistentní**. Další soubory Zapletal mohou být také přílohy poznámek. Proto **nelze označit ZIP export jako definitivně vadný**. Potřebujeme prokázat, zda se balí pouze aktuální členové vybrané složky a jejich skutečné přílohy, nikoli věci, které už byly přesunuty jinam. Při exportu vycházet z **aktuální struktury v okamžiku exportu**, ne z historických vazeb.

**Schválené doplnění – ZIP jediné fotografie:** vedle existující zálohy celé aplikace a jedné složky umožnit v nabídce **konkrétní fotografie „Exportovat do ZIP“**. Záloha musí obsahovat **původní snímek + editovatelné kóty + poznámky + všechny případné přílohy**, aby šlo po importu vše opět editovat. Udržet existující export celé aplikace a jednotlivé složky.

**Schválené zlepšení srozumitelnosti:** před vytvořením ZIP zobrazit jasný obsah exportu, např. **„Exportovat složku Kuchyně – 3 fotografie“**, aby uživatel věděl, co zálohuje. Počet souborů v ZIP nemusí odpovídat počtu fotografií, protože jsou v něm i JSON a přílohy.

**Schválené automatické pojmenování (uživatel zdůraznil následně při testu 27):**
- Výchozí názvy typu `Zamerovac-slozka.zip` nebo `Zamerovac-zaloha.zip` samy o sobě nepostačují k rozpoznání konkrétní exportované složky.
- Název výsledného ZIP se má **automaticky odvodit od aktuálního názvu aplikace** a **názvu konkrétní složky**, obdobně pro jednotlivou fotografii.
- Příklady z dohody: **`Zaměřovač-Zapletal.zip`**, **`Zaměřovač-Xxx.zip`**, **`Zaměřovač-Kuchyň Novák.zip`**; když aplikaci později přejmenujeme na **Měřák**, automaticky **`Měřák-Zapletal.zip`** nebo **`Měřák-Kuchyň Novák.zip`**. **Nikde natvrdo nevázat výchozí název „Zaměřovač“**.
- Při realizaci se může řešit bezpečná normalizace znaků pro souborový systém, ale **nesmí zaniknout lidsky rozpoznatelný název zakázky**.

**Důležitá návaznost:** v původním chatu asistent uvedl, že kód pro odznak upravené fotografie již změnil, ale **nové APK ještě nebylo sestavené**. To nesouvisí s potvrzením správnosti ZIP exportu.

**Historický stav:** **ČÁSTEČNĚ FUNKČNÍ**; vytvoření ZIP ano, rozsah souborů vyžaduje potvrzení, **úspěšné obnovení zálohy zatím netestováno**. **Zdroj:** 03:24–03:44, screenshoty a videa uvedené výše.

## 27 – Import ZIP / obnovení zálohy

**Původní postup (t≈224–232):** pro bezpečný test použít ZIP malé zkušební složky Xxx (jedna fotografie), v Zaměřovači zvolit **Importovat zakázky ze ZIP**, vybrat archív, zkontrolovat obnovení složky, originální fotografie, kót a poznámek. **Původní složku zatím nemazat**; import může přidat druhou kopii.

**Překážka:** systémový výběr souborů vyvolaný Zaměřovačem v Samsungu **nezobrazoval existující soubory `.zip`**, přestože v běžném správci souborů ve složce Download existovaly, bylo je možné otevřít i prohlížet. Uživatel hlásil „Vypadá to, jak kdyby to nezobrazovalo zipy“. Původní příloha **`1000093686.mp4`** je v hlavním chatu přímo označená; související nahrávka `Screen_Recording_20261104_030119_My Files.mp4` ukazuje práci s výběrem/Downloads a existujícím ZIP.

**Možná technická příčina, ne potvrzená diagnostika:** Android dokumentový výběr spuštěný s filtrem pouze `application/zip` nemusí v některé implementaci Samsung/My Files ukazovat ZIP, pokud mu správce přiřadil neobvyklý MIME typ. Během konverzace asistent toto uvedl jako vysvětlení podle pohledu na kód; **přesnou implementaci nynější verze musí vývojář znovu zkontrolovat**.

**Dohodnutá oprava:**
1. Spolehlivě **zobrazit a dovolit vybrat ZIP** v Downloads a jiných běžných úložištích Androidu i při chybném/neurčitém MIME typu.
2. Po výběru **ověřit skutečný obsah**, že jde o platnou ZIP zálohu aplikace, nikoli libovolný nevhodný soubor. Srozumitelná chyba při neplatném obsahu, bez ztráty stávajících dat.
3. Pak teprve provést skutečný **test importu**: návrat složek, fotografií, všech editovatelných kót, poznámek, příloh, bezpečné řešení duplicit a zachování původních dat.

**Výsledek tehdejšího testu:** **BLOKOVÁNO** samotným výběrem archívu, **obnova dat se vůbec neověřila**. Z pozdějšího závěru videa: ZIP soubory v telefonu skutečně jsou, problém míří k **výběru souboru pro Zaměřovač**, nikoli k neexistující záloze.

**Zdroj:** 03:44–03:52, `1000093686.mp4`, `Screen_Recording_20261104_030119_My Files.mp4`, `1000093570.jpg`, `1000093572.jpg`.

## 28 – Zachování dat po restartu aplikace

**Původní zkouška na zařízení (t≈232–234):** aplikaci plně ukončit a znovu otevřít, projít složky, galerii/fotografie, kóty a poznámky a ověřit, že data zůstala.

**Doslovné podstatné uživatelské vyjádření:** „Jinak zachování dat po restartu funguje.“ Následně: „Teraz vyzkoušel jsem to ukolot a podobně prohlížel jsem galerii a tak snad to funguje u všeho. Složky fotografie, kóty, poznámky. Fungovalo to“ (drobně nepřesná slova kvůli diktování; obsahový smysl je jednoznačný).

**Výsledek:** **SPLNĚNO v původním testu** – složky, fotografie, kóty i poznámky zůstaly po restartu. Zachovat toto chování při implementaci dalších změn. **Pozor:** restart aplikace neověřuje sám o sobě správnost ZIP obnovy, cloud synchronizace ani aktualizace/odinstalace APK.

**Zdroj:** závěr hlavního videa 03:52–03:55; žádné samostatné video aplikace nevyžadováno, výsledek je výslovná odpověď uživatele.

---

## Co následuje po historické kontrole 28
**Test 29 – fungování bez internetu** byl v originálním chatu teprve navržen jako další samostatný test. **Neřadit do původních 28, neoznačovat za dokončený.** Pokračování po této rekonstrukci se bude řídit novou dohodou o malých dávkách přibližně pěti úkolů **po další společné aktualizaci**.

## Významný souhrn chyb a dohod v této části (nenahrazuje kapitoly výše)
- **Opravovat:** skutečné obnovení z koše, ochranu obsahu zamčené složky při přesunu, chování dokumentového výběru při ZIP importu.
- **Doplnit:** náhledy v koši; miniatury, zobrazený nalezený text a ergonomii klávesnice ve vyhledávání včetně zachování stavu; hromadný výběr; značku upravených fotografií; export ZIP jediné fotografie; jasné potvrzení rozsahu exportu; názvy ZIP odvozené od aplikace a složky.
- **Zachovat fungující:** zámek proti přejmenování/smazání, možnost odemknout a zálohovat, základní vyhledávání poznámek uvnitř fotografií, řazení, běžný přesun a přejmenování včetně `.jpg`, vytváření ZIP, perzistenci dat po restartu.
- **Neověřeno:** zda archiv vybrané složky skutečně balil cizí soubory; kompletní ZIP roundtrip; aktuální stav source code; opravy zapsané v GitHubu nebyly v tomto rozboru automaticky fyzicky potvrzené.

[Část 1 – testy 1–10](REKONSTRUKCE_TESTU_01_10.md) · [Část 2 – testy 11–20](REKONSTRUKCE_TESTU_11_20.md) · [Hlavní rozcestník](START_ZDE.md)
