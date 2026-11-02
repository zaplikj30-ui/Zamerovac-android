# AGENTS.md — Zaměřovač (Android)

## Účel a kontext
Tento repozitář je SAMOSTATNÝ projekt `Zamerovac-android`. Neměň repozitář `Prevadec-spojitosti`.
Uživatel vyrábí zakázkový nábytek. Vyvíjíme vlastní Android aplikaci na zaměřování zakázek, inspirovanou pracovním postupem ImageMeteru. Nejde o kopii původního kódu, designových prostředků ani o obcházení jeho licence. Komunikuj česky a používej jednoduché vysvětlení, nevyžaduj znovu už schválené volby.

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

## Stav projektu a omezení
- Projekt obsahuje Android Java shell/WebView a HTML/JS editor v `app/src/main/assets/`, Android nativní most v `app/src/main/java/cz/zamerovac/app/`.
- GitHub Actions workflow `.github/workflows/build-apk.yml` sestavil debug APK při push na main (běh 41524533406 z 2026-11-02). Úspěšný build NENÍ ověření správného fungování.
- Pozor: synchronizace přes Android Storage Access Framework je podmíněna podporou zapisovatelné složky poskytovatelem Google Disku. Pokud nefunguje, zvaž bezpečnou oficiální integraci Drive API/OAuth, nikoli předstírání funkčního cloudu.
- Bluetooth implementace v `BoschClassicReader.java` je experimentální; funkčnost je nutné ověřit na konkrétním laseru Bosch, konkrétním firmware a Android zařízení.
- Žádné reálné zákaznické soubory nepoužívat jako testovací data bez výslovného souhlasu. Preferuj testovací zakázky.
- Neoznačuj aplikaci za plně hotovou, dokud nejsou testované všechny deklarované funkce. Zachovej kompatibilitu uložených záznamů a proveď migrace, pokud se mění schéma.

## Doporučený způsob práce
1. Přečti README.md a existující kód, než cokoliv změníš.
2. Opravuj konkrétní chyby, nevytvářej nový projekt od nuly bez důvodu.
3. Při změnách spouštěj dostupné testy, alespoň `gradle assembleDebug`; kontroluj i běh na zařízení, pokud je dostupné.
4. Průběžně commituj změny do tohoto repozitáře; popisuj přesně co je implementované, co je jen prototyp a co není ověřené.
5. Pokud uživatel pošle screenshot nebo chybu z Androidu, nejprve reprodukuj/diagnostikuj problém a navrhni opravu přímo v repozitáři.
6. Vzájemná spolupráce mezi ChatGPT a Codexem probíhá pomocí commitů v GitHubu. Neznamená to sdílení celé konverzace ani automatické synchronizování kontextu mimo tento repozitář.
