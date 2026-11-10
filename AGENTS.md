# AGENTS.md – krátká platná pravidla Zaměřovače

**Aktualizováno: 10. 11. 2026.** Toto je stručný pracovní standard pro další chaty, programátora, kontrolora a Codex. Původní úplné znění je zachováno **beze změny** v [historickém AGENTS.md](docs/historie/AGENTS-2026-11-10.md). Historická technická rozhodnutí zůstávají dohledatelná; při rozporu je nepovažuj za příkaz překonávající novější schválené rozhodnutí.

## 1. Zdroje pravdy a přednost rozhodnutí
- Před prací čti [START_ZDE.md](START_ZDE.md), tuto stručnou verzi, [plán](PROJEKTOVY_PLAN_ZAMEROVACE.md), dotčené issues/komentáře/PR, aktuální main a HEAD, poslední commity a skutečné CI/testy. GitHub je zdroj aktuálního kódu, ne starší chat.
- **Výslovné nejnovější rozhodnutí vlastníka** určuje další směr, nikoli náhodný historický checkpoint. Bezpečnostní stop/brány a ochranu dat nelze obejít jen kvůli rychlosti. Ověř příslušné zdroje a případné rozpory zapiš do [issue #42](https://github.com/zaplikj30-ui/Zamerovac-android/issues/42).
- Rozlišuj: návrh/nápad, schválený úkol, rozpracované, commit/draft PR, runtime PASS, vydanou APK, fyzicky ověřeno. Staré SHA/CI nejsou aktuální PASS. Dokumentace je evidence, ne automatické spuštění Codexu.

## 2. Běžný vývoj = balík oprav, ne každá drobnost zvlášť
- **Výchozí režim: jeden smysluplný balík přibližně 5–10 malých souvisejících a oddělitelných oprav.** Jeden autor, vlastní pracovní větev a jeden draft PR pro balík; cílené testy průběžně po změnách, poté společná regrese a samostatná nezávislá kontrola. Nenařizuj uživateli nové předání po každém bodu. Počet není povinná kvóta; priorita je bezpečný a testovatelný celek.
- **Výjimka:** riziková změna dat, synchronizace, CI oprávnění/runner, nebo izolovaný P1 problém může vyžadovat menší samostatný PR/review. Výjimku konkrétně zdůvodni, ale neuplatňuj ji na všechny drobnosti.
- Důležité změny kontroluje někdo jiný než autor; review nenahrazuje automatické testy. Do jedné větve zapisuje pouze její autor. Nepřepisuj cizí větve a nevytvářej duplicitní issues či řetěz PR bez potřeby.
- ChatGPT může skutečně programovat menší a střední oddělitelné změny, pokud má nástroje a ověření. Codex rezervuj hlavně pro složitý editor/geometrii, ukládání, synchronizaci a nativní Android. Nikdy nepředstírej, že Codex běží, pokud zadání nebylo reálně odesláno.

## 3. Ochrana dat a technická kvalita – nepřekročitelné
- Zachovávej **přesné hodnoty kót, jednotky, editovatelné objekty, geometrii, výrobní výpočty, originální bajty médií a vazby na zakázku**. Neodvozuj skutečnou výrobní míru z pixelů ani neprováděj tiché zaokrouhlení.
- Ošetři uložení, selhání zápisu, Undo/Redo, koš, historii, obnovu, offline, import/export, souběh a konflikty. **Nikdy tiše nepřepiš novější data starší zálohou.** Testovací zakázky lze ztratit, ale navrhuj bezpečně pro budoucí ostrá data. Nevyžaduj nesmyslné opakované zálohy testovacích dat.
- Malá bezpečná oprava před velkým refaktorem. Přepis celé aplikace, výměna technologie, zásadní změny datových formátů, nové funkce, merge a vydání APK vyžadují samostatné schválení vlastníka.
- Zaměřovač, Konfigurátor–Nářezák a Převaděč spojitosti jsou **samostatné projekty, repozitáře a testy**. ImageMeter je reference chování, nikoli zdroj jeho licencovaného kódu.
- Při funkční/ovládací změně oprav offline nápovědu (help.js) a připrav pravdivou historii změn (release-history.js) pro **skutečné vydání**; dokumentační změna sama o sobě není důvodem k nové APK.

## 4. Testy, domácí QA a vydání
- U každého testu uváděj **PASS / FAIL / SKIP / NOT RUN**, testované úplné SHA, prostředí a rozsah. Ověřujte přesná uložená data, pixely a reálné chování, nejen build, JSON nebo čtení kódu; u významných změn pozitivní i negativní scénáře.
- Primární QA: **domácí Windows 11, pevně 16 GB RAM**, runner Zamerovac-Win11-QA pod účtem ZamerovacQA. Důvěryhodný checkout přesného SHA, sériové úlohy s limitovanou RAM; **žádné cizí či nedůvěryhodné PR/forky** na domácím runneru.
- Pro **nový jednorázový owner-only qa/* workflow** používej existující ověřený generátor tools/home_qa_gate.py render-workflow + lint-workflow --strict podle [HOME QA preflight](docs/HOME_QA_PREFLIGHT.md). Nepřidávej ad hoc workflow bez posouzení. Neměň existující čtyřjobovou HOME QA ani release guardy naslepo.
- Před integrací/vydáním vyžaduj podle rozsahu skutečný HOME rychlý test, Chromium/pixely, Java/Gradle/Robolectric/PDF a technické APK sestavení bez vydání na správném SHA. Fyzický Samsung, S Pen, Bosch a reálný Drive jsou **samostatná neprovedená či provedená ověření**, nikdy je nenahrazuje green CI.
- **GitHub Actions rozpočet max. 12 USD/měsíc, bez automatických nákupů.** Cloudové placené běhy pouze s výslovným souhlasem; před commitem/PR zkontroluj triggery. U HOME runneru minimální oprávnění.
- Jedna **společná testovací APK až po hotovém schváleném balíku, nezávislé kontrole a společné regresi**. Zachovej package ID, podpis, kompatibilitu dat, správný versionName a versionCode vyšší než poslední vydaný. Bez souhlasu nic nepublikuj.

## 5. Otevřené bezpečnostní rozhodnutí
- **Synchronizační jádro #88 nyní neopravuj řetězem lokálních záplat.** Dvě diagnostické syntetické Drive/SAF ACK FAIL zůstávají. Codex nejprve provede poctivý **audit celé aplikace s hlubokým posouzením sync**, porovná protokol s principy Joplin, Android WorkManager a oficiálním Google Drive API. Výběr zásadního řešení a implementace až po rozhodnutí vlastníka. Další práce viz [START_ZDE.md](START_ZDE.md) a [#42](https://github.com/zaplikj30-ui/Zamerovac-android/issues/42).
- Budoucí Windows/iOS, další jazyky, hlas, 3D a propojení s Konfigurátorem jsou plánovací požadavky, ne automaticky schválené dnešní implementace. Přesná data a pravidla odděluj od UI a hardwaru.

## 6. Předání a komunikace
- Koordinátor stručně uvádí **hotovo / chyby / rizika / důkazy / další krok / co potřebuje od vlastníka**. Programátor u PR a #42 zapisuje SHA, změny a testy; kontrolor nezávislé hodnocení; koordinátor také vlastní rozhodnutí a odkazy. Pokud je něco neověřené, přiznej to.
- Veškerý **text určený ke kopírování** (zadání, zpráva, příkaz, postup) dej v odpovědi celý do Markdown bloku typu text, aby měl tlačítko Kopírovat.
- Souhrn kvality po významné etapě obsahuje zlepšení/zhoršení, rizika, důkazy, skóre 1–10 a priority **hned / později / neměnit**. Při zásahu na domácím PC dej uživateli jediný přesný postup.

**Historické podrobnosti:** [původní AGENTS.md](docs/historie/AGENTS-2026-11-10.md), [původní START_ZDE.md](docs/historie/START_ZDE-2026-11-10.md), [projektový plán](PROJEKTOVY_PLAN_ZAMEROVACE.md), [issue #42](https://github.com/zaplikj30-ui/Zamerovac-android/issues/42) a [testovací registr #28](https://github.com/zaplikj30-ui/Zamerovac-android/issues/28).
