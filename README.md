# Zaměřovač – Android aplikace pro zaměřování nábytku

**Samostatná originální aplikace inspirovaná ovládáním ImageMeteru**, nikoli jeho upravená kopie.
Projekt neobsahuje cizí APK, grafiku ani zdrojový kód ImageMeteru.

## Co je naprogramováno

- Zakázky a zákaznické složky s podsložkami, přesunem, přejmenováním a bezpečným označením odstraněných položek.
- Fotografování a přidávání obrázků, PDF, videí a dalších souborů.
- Kótování fotografií s RUČNĚ zadávanými hodnotami (měřítko snímku se nepoužívá).
- Bodová lupa, přiblížení, posun, výběr/editace kót, undo/redo.
- Čáry, šipky, obdélníky, kruhy, volné kreslení, popisky, úhly a další nástroje.
- Lokální JSON + originální mediální soubory; anotace zůstávají editovatelné.
- Textové poznámky, seznamy úkolů, přílohy, hlasový záznam.
- PNG export, Android PDF print/export, základní nastavení vzhledu a editoru.
- Android výběr složky přes Storage Access Framework pro Google Disk a další kompatibilní poskytovatele.
- Obousměrná synchronizace JSON záznamů a médií; offline provoz; konfliktní kopie při souběžných změnách.
- Plánovaná periodická synchronizace podle možností Android JobScheduler (není přesná časově).
- Bluetooth Classic SPP čtení push paketů GLM 50C/100C a experimentální BLE přenos.

## Omezení a stav ověření

Toto je **zdrojový projekt, nikoli zkompilovaná a na zařízení otestovaná APK**. V tomto prostředí nebyly k dispozici Android SDK ani fyzické měřidlo. JavaScript prošel syntaktickou kontrolou.

- Bluetooth je třeba ověřit s přesným modelem a firmwarem Bosch; rozměry vždy potvrď před použitím ve výrobě. BLE implementace není kompletní pro všechny výrobní protokoly.
- Google Disk přes systémový výběr složky vyžaduje, aby jeho Android poskytovatel podporoval zapisovatelný SAF strom. V opačném případě je potřeba integrace Google Drive API + OAuth.
- Souběžná editace není živá spolupráce; při konfliktu vzniká kopie. Potřebujeme reálné testy s více telefony a tabletem.
- Kopírování záznamů a médií může při větším množství dat trvat; implementace zatím nemá zrychlenou delta synchronizaci a integritní hashe.
- Chybí propojení s Převaděčem na PC – datový formát je otevřený (`schema:1`, `records`, `media`).
- Ovládání se snaží odpovídat klíčovým potřebám, ale plná ekvivalence všech obrazovek ImageMeteru není ověřená.

## Sestavení ve Windows 11

1. Otevři tento projekt ve **stabilním Android Studiu** a nech stáhnout Gradle/Android SDK (compile SDK 35).
2. Použij JDK 17 a synchronizaci Gradle.
3. Zvol **Build > Build APK(s)**. Očekávaný výstup je `app/build/outputs/apk/debug/app-debug.apk`.
4. APK nainstaluj na testovací zařízení. Před produkčním použitím otestuj lokální ukládání, opětovné otevření projektu, média a cloud.
5. V GitHubu se APK sestavuje **pouze na vyžádání**: otevři **Actions → Sestavit a vydat Zaměřovač TEST → Run workflow** na větvi `main`. Uložení změny na GitHub samo nespouští Android build.

## Google Disk

V aplikaci otevři Cloud > Vybrat složku, zvol **vlastní složku Zaměřovač** na Google Disku (pokud je dostupný jako správce dokumentů Androidu) a povol čtení/zápis. Tutéž složku vyber na druhém zařízení. Nevybírej kořen sdíleného disku obsahující jiná data. Neodstraňuj ručně podsložku `media` nebo soubor `projects.json`.

## Bezpečnost a zálohy

Soubory zakázek mohou obsahovat citlivá data zákazníků a fotografie interiérů. Používej zabezpečený Google účet a omez sdílení složky. Před testováním synchronizace si ponech zálohu souborů.

## Co nemá být součástí aplikace

Referenční měřítko, perspektivní reference, perspektivní délka, počítadlo a výsledková listina.

## Převaděč spojitosti

Datový model je zamýšlen jako budoucí vstup PC modulu. Editovatelné kóty jsou uložené v obrazových pixelech odděleně od uživatelem zadaných skutečných rozměrů.

## Instalace a aktualizace Zaměřovače (vývojová APK)

**Aktuální APK ke stažení: [GitHub Releases – poslední vydání](https://github.com/zaplikj30-ui/Zamerovac-android/releases/latest)**.

Novou APK vytvoříš ručním spuštěním [Actions – Sestavit a vydat Zaměřovač TEST](https://github.com/zaplikj30-ui/Zamerovac-android/actions/workflows/build-apk.yml) přes **Run workflow**. Při běžných změnách se APK nevyrábí, ale při ručním sestavení zůstávají ověření a kontrola podpisu.

- Každé úspěšné **ručně spuštěné** sestavení z větve `main` vytvoří číslované vydání obsahující přímo soubor `Zamerovac-v1.2.N.apk` (bez ZIP).
- Na telefonu otevři odkaz, přihlas se ke svému GitHub účtu, vyber soubor `.apk`, otevři jej přes **Moje soubory → Stažené** a potvrď **Aktualizovat**. ChatGPT odkazy na dočasné soubory k instalaci nepoužívej.
- Vývojová aplikace zůstává pod názvem **Zaměřovač** a má identifikátor `cz.zamerovac.app.preview` a stálý testovací podpis v `tools/debug-signing.p12.b64`. Všechny běhy workflow používají tento podpis a postupně rostoucí `versionCode` `1000 + GITHUB_RUN_NUMBER`. Aktualizace by proto neměla mazat data.
- Původní ostrá varianta (cz.zamerovac.app) a testovací varianta (cz.zamerovac.app.preview) jsou dvě **odlišné aplikace** a data se mezi nimi nepřenášejí automaticky.
- Certifikát v repozitáři je pouze **vývojový/testovací**. Pro budoucí ostré vydání je nutné vytvořit soukromý produkční podpis a zacházet s ním jako s tajemstvím; tenhle testovací klíč nelze považovat za bezpečný pro veřejnou distribuci.
- Upozornění: Android může instalaci blokovat z jiných důvodů (například zákaz instalace z daného zdroje). Bez instalačního protokolu nelze potvrdit, proč konkrétní historická aktualizace selhala. Starou aplikaci nemaž bez zálohy.

## Vývoj z telefonu přes ChatGPT a GitHub – Android emulátor

Repozitář obsahuje samostatný workflow **Zaměřovač – Android emulátor a snímky obrazovky**:
[Otevřít GitHub Actions](https://github.com/zaplikj30-ui/Zamerovac-android/actions/workflows/emulator-smoke.yml).

- Spouští se **pouze ručně**, když je potřeba důkladně otestovat obrazovky nebo dotyky: **Actions → Zaměřovač – Android emulátor a snímky obrazovky → Run workflow**. Žádná změna kódu ho automaticky nespouští.
- Na hostovaném virtuálním telefonu Pixel s Androidem 13 nainstaluje **Zaměřovač TEST**.
- Uloží snímky domovské obrazovky, nabídky a, pokud je zpřístupněné ovládání, také plátna a lupy při tažení kóty. Přidá přístupnostní XML a `logcat` pro diagnostiku.
- Výstup najdeš v konkrétním běhu pod **Artifacts → Zamerovac-EMULATOR-snimky-a-logy**; soubory jsou dostupné 30 dní. Jde o ZIP se snímky PNG a logy, nikoliv o instalační APK.
- Pro instalaci do vlastního mobilu stále slouží samostatná stránka [GitHub Releases – poslední APK](https://github.com/zaplikj30-ui/Zamerovac-android/releases/latest).
- **Nezaměňuj emulátor za ověření na Samsungu:** ovládání prstem, obrazovka, Bluetooth Bosch a přístup k souborům je nutné potvrdit na reálném telefonu.
- Cizí APK ImageMeteru nejsou součástí repozitáře a emulator je automaticky nespouští. ImageMeter zůstává referenční aplikací pro porovnávání chování, ne zdrojem převzatého proprietárního kódu.
- Android emulátor v GitHub Actions spotřebovává minuty Actions, podle typu účtu mohou být účtované. Spouštěj ho jen když výsledky skutečně potřebujeme.


## Velká aktualizace 1.2 – nové funkce

V této větvi přibývá originální implementace následujících funkcí:

- Tmavý fialovo-antracitový vzhled s volitelnou akcentní barvou a hlavní ikonou skříněk se žlutými kótami.
- Galerie fotografií, rychlý přechod mezi snímky při kótování a lokální přehrávání audio/video souborů.
- Poznámky ve fotografii: text, hlas, detailní fotografie a její samostatné editovatelné kóty s popisky.
- Vrstvy zobrazení kót, textových poznámek a kreseb, vlastní oblíbené nástroje, rychlé symboly.
- Ručně označené navazující kóty a kontrola součtu, historie uložených podob anotací.
- Rozšířené hledání v názvech, adresách a textových poznámkách; adresy ČR lze vyhledat přes RÚIAN a prohlédnout na mapě.
- Uzamykání dokončených zakázek, automatické ukládání textu poznámek a podpora skic S Pen.
- Diagnostický záznam pouze na zařízení, jeho sdílení na výslovné vyžádání, historie měření Bosch, rozlišení skutečného připojení laseru.
- ZIP export **všech zakázek** včetně originálních příloh a editovatelných kót, možnost bezpečné obnovy jako novou složku (při importu se stávající zakázky nepřepisují).
- Novinky po aktualizaci a přehled změn v nastavení.

### Výslovně neověřené nebo nedokončené

- **Google Disk:** současný SAF mechanismus je omezen podporou poskytovatele dokumentů. Skutečná obousměrná synchronizace mezi telefonem a tabletem se musí ověřit a případně přepsat na oficiální Drive API/OAuth.
- **Bosch:** protokoly BLE/Classic, dostupnost modelů a stav připojení se musí otestovat s fyzickým laserem.
- **Samsung Notes:** veřejně zdokumentované obousměrné rozhraní pro automatickou synchronizaci cizí aplikace nebylo ověřeno. Skici fungují uvnitř Zaměřovače; neznamená to automatickou synchronizaci se Samsung Notes.
- Pro předání zákazníkovi je nutný běh na zařízení a zátěžový test importu/exportu ZIP a přesnosti rozměrů. Emulátor a úspěšný Gradle build nestačí.

**Uživatelsky odložené nápady, které nejsou součástí 1.2:** propojení fotek s půdorysem, dvě fotky vedle sebe, šablony zakázek, karta zákazníka, pokročilé magnetické přichytávání a výměna fotky při zachování kót.

### Bezpečnost aktualizací

- Vývojový build drží applicationId = cz.zamerovac.app.preview a původní testovací podpis; změnil se jen viditelný název aplikace. **Neodinstalovávat**, nejprve uchovat ZIP zálohu.
- Nové datové atributy jsou volitelné, základní struktura databáze zůstává schema: 1, takže staré projekty není třeba mazat nebo převádět.
- Import ZIP záměrně vytvoří nové identifikátory a nadřazenou složku; nezničí existující projekty, ale může vytvořit duplicitní obsah, pokud ZIP importuješ dvakrát.
