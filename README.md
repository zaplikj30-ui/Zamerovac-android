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
5. Pro vzdálené sestavení lze projekt vložit do samostatného GitHub repozitáře; workflow `.github/workflows/build-apk.yml` sestaví debug APK při push nebo ručním spuštění.

## Google Disk

V aplikaci otevři Cloud > Vybrat složku, zvol **vlastní složku Zaměřovač** na Google Disku (pokud je dostupný jako správce dokumentů Androidu) a povol čtení/zápis. Tutéž složku vyber na druhém zařízení. Nevybírej kořen sdíleného disku obsahující jiná data. Neodstraňuj ručně podsložku `media` nebo soubor `projects.json`.

## Bezpečnost a zálohy

Soubory zakázek mohou obsahovat citlivá data zákazníků a fotografie interiérů. Používej zabezpečený Google účet a omez sdílení složky. Před testováním synchronizace si ponech zálohu souborů.

## Co nemá být součástí aplikace

Referenční měřítko, perspektivní reference, perspektivní délka, počítadlo a výsledková listina.

## Převaděč spojitosti

Datový model je zamýšlen jako budoucí vstup PC modulu. Editovatelné kóty jsou uložené v obrazových pixelech odděleně od uživatelem zadaných skutečných rozměrů.

## Instalace a aktualizace Zaměřovače TEST

**Aktuální APK ke stažení: [GitHub Releases – poslední vydání](https://github.com/zaplikj30-ui/Zamerovac-android/releases/latest)**.

- Každé úspěšné sestavení z větve `main` automaticky vytvoří číslované vydání obsahující přímo soubor `Zamerovac-TEST-v1.1.N.apk` (bez ZIP).
- Na telefonu otevři odkaz, přihlas se ke svému GitHub účtu, vyber soubor `.apk`, otevři jej přes **Moje soubory → Stažené** a potvrď **Aktualizovat**. ChatGPT odkazy na dočasné soubory k instalaci nepoužívej.
- Aplikace `Zaměřovač TEST` má identifikátor `cz.zamerovac.app.preview` a stálý testovací podpis v `tools/debug-signing.p12.b64`. Všechny běhy workflow používají tento podpis a postupně rostoucí `versionCode` `1000 + GITHUB_RUN_NUMBER`. Aktualizace by proto neměla mazat data.
- `Zaměřovač` (bez TEST) a `Zaměřovač TEST` jsou dvě **odlišné aplikace** a data se mezi nimi nepřenášejí automaticky.
- Certifikát v repozitáři je pouze **vývojový/testovací**. Pro budoucí ostré vydání je nutné vytvořit soukromý produkční podpis a zacházet s ním jako s tajemstvím; tenhle testovací klíč nelze považovat za bezpečný pro veřejnou distribuci.
- Upozornění: Android může instalaci blokovat z jiných důvodů (například zákaz instalace z daného zdroje). Bez instalačního protokolu nelze potvrdit, proč konkrétní historická aktualizace selhala. Starou aplikaci nemaž bez zálohy.
