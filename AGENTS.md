# AGENTS.md — Zaměřovač (Android)

## Účel a kontext
Tento repozitář je SAMOSTATNÝ projekt `Zamerovac-android`. Neměň repozitář `Prevadec-spojitosti`.
Uživatel vyrábí zakázkový nábytek. Vyvíjíme vlastní Android aplikaci na zaměřování zakázek, inspirovanou pracovním postupem ImageMeteru. Nejde o kopii původního kódu, designových prostředků ani o obcházení jeho licence. Komunikuj česky a používej jednoduché vysvětlení, nevyžaduj znovu už schválené volby.

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
