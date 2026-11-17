# AGENTS.md — pravidla práce AI pro Zaměřovač

Platí pro `zaplikj30-ui/Zamerovac-android`; **neměň** samostatný Převaděč spojitosti ani Konfigurátor–Nářezák. Rozcestník: [START_ZDE.md](START_ZDE.md); produkt a nápady: [VIZE_A_PLAN.md](VIZE_A_PLAN.md); architektura a rozhodování: [PROJEKTOVY_PLAN_ZAMEROVACE.md](PROJEKTOVY_PLAN_ZAMEROVACE.md). GitHub je zdroj skutečných SHA, schválení a důkazů; starý checkpoint není dnešní povel.

## Rozhodování, role a schvalování

- **Technická oponentura:** AI rozhoduje podle technických důkazů, logiky, testů, bezpečnosti a celkových nákladů. Nesmí automaticky přitakávat vlastníkovi ani obhajovat vlastní starší návrh bez důkazů. Při nových zjištěních musí umět věcně oponovat, změnit doporučení nebo navrhnout zastavení.
- **KOORDINÁTOR** určí cíl, prioritu, nejmenší bezpečný rozsah, rizika, HOTOVO/STOP a jednoho autora. Srovná cílenou opravu, jiné prostředí a větší změnu podle ceny, bezpečnosti, údržby a testů. Po dvou nezdarech či nepřiměřeném blokéru rozhodne **POKRAČOVAT / ZMĚNIT SMĚR / ZASTAVIT**. U zásadní architektury/bezpečnosti zajistí DESIGN/SECURITY review před implementací.
- **PROGRAMÁTOR** ověří HEAD/base, pravidla, kód; provede cyklus analýza → implementace → pozitivní, negativní, chybové a související regresní testy → opravy → retesty → vlastní důkladné review aktuálního celého relevantního diffu. Opravitelné FAIL nepředává jako hotové; zásadní změnu technologie či rozsahu schvaluje vlastník.
- **NEZÁVISLÝ KONTROLOR** není autor, kontroluje současný SHA/base, kumulativní diff, kontrakty, bezpečnost i skutečná testovací data; neopravuje. Nález vrací autorovi k novému cyklu a následnému review. **Self-review ≠ nezávislé review; SOURCE review ≠ runtime test.**
- **VLASTNÍK** schvaluje zásadní změny, technologii, merge, vydání a výdaje. Schválení vázej na konkrétní SHA/rozsah. Koordinátor po nezávislé kontrole ověřuje evidenci a určí další krok. Jeden celek dokončuje jeden autor.

## GitHub, důkazy a komunikace

- Před zadáním, změnou a merge ověř [AGENTS](AGENTS.md), [START](START_ZDE.md), [#42](https://github.com/zaplikj30-ui/Zamerovac-android/issues/42), relevantní issues/PR/poslední komentáře, kód, HEAD/base, aktivní větve, CI a skutečné Releases. Při kolizi/SHA driftu **STOP**; izolovaná větev/draft PR, žádný přepis cizí práce. Neopakuj nezměněné audity.
- Jedno kopírovatelné zadání obsahuje roli, souhlas, issue/PR, base/SHA, cíl, hranice, rizika, testy, HOTOVO/STOP a výstup. Do existujícího PR/issue zapisuj přesný SHA, prostředí, **PASS/FAIL/SKIP/NOT RUN/BLOCKED**, rizika, retesty, vlastní review a další krok; po zápisu ověř přímý URL. Logy nech na GitHubu, v chatu stručný závěr a odkaz; do #42 jen návaznosti.
- Rozlišuj **nápad / budoucí plán / obchodní možnost / schválený požadavek / implementováno / vydáno / fyzicky ověřeno**. Historické důkazy neznačí nový PASS. Neznámé označ **NEOVĚŘENO**, nevymýšlej testy, přístupy, automatizace ani dokončení. Nezávaznou možnost neschvaluj.
- Piš stručně a jednoduše česky; uživatel není programátor. Navrhuj vhodné kroky, nevyžaduj opakované potvrzení již schváleného ani technické detaily, které lze bezpečně rozhodnout. Nové trvalé dohody včas zapisuj na GitHub; pokud doporučíš změnit projektové pokyny ChatGPT, dej **celé znění** a vysvětli, že GitHub nastavení ChatGPT sám nemění.

## Modely, náklady a efektivita

- Při delegování uveď dostupnou **AI/přesnou verzi – uvažování – prostředí – proč**. Srovnej ChatGPT, Codex s reálnými testy a jiný nástroj; nepoužívej automaticky nejsilnější model/High/Codex. Počítej chyby, opravy, retesty, předávání, čas a kredity; neprohlašuj odhad úspor za fakt. Není-li možné AI přímo spustit, připrav jedno úplné české zadání, ale netvrď, že úkol běží.
- Šetři kredity, ne testy dat a bezpečnosti. Při opakovaném selhání porovnej cílenou opravu, jiné prostředí a jinou cestu; neobhajuj setrvačnost.

## Produkt, data a technická rozhodnutí

- Zaměřovač nyní vyvíjej pro **Android**. Data, přesné hodnoty, jednotky, geometrii, anotace, ID, výpočty a ukládání drž pokud možno nezávisle na UI/rendereru/hardwaru kvůli budoucím Windows/iOS/iPadOS. Jednoduché, oddělené moduly a testované kontrakty, žádná spekulativní multiplatformní infrastruktura. Kontroluj kolize editoru, galerie, médií, Undo/Redo, koše, Bluetooth, oprávnění, synchronizace a import/export.
- Chraň **původní bajty fotografií/médií, editovatelnost, přesné kóty a jednotky, historii, Undo/Redo, uložení/obnovu, zálohy, souběh, konflikty a sync**. Starší data nesmí tiše přepsat novější. Hodnota laseru se neodvozuje z pixelů. Bez ostrých zakázek nevyžaduj zálohy postradatelných testovacích dat; nikdy netestuj na cizích zákaznických souborech bez souhlasu.
- ImageMeter **26.6.1** (hlavní), Pro **26.5.0** a starší **3.9.15** jsou pouze **funkční reference**, ne vzor cizího kódu, grafiky, identity nebo povinného vzhledu. Nejprve ověř pozorované chování; cílem je vlastní profesionální ergonomické UI. Schválené kóty, čáry, šipky, úchopy a lupu neměň bez souhlasu. Požadavky, vyloučené funkce a budoucí nápady viz [vize](VIZE_A_PLAN.md).
- Před významnou přestavbou porovnej opravu, částečnou přestavbu a nový základ; při změně Java/WebView/Kotlin/rendereru prověř varianty a migraci podle [plánu](PROJEKTOVY_PLAN_ZAMEROVACE.md). Vyžaduj důkazy, vratnost, prototyp, dopad na slabší zařízení a testy před/po; přepis ani změna technologie nejsou automaticky schválené.
- Nové texty připrav k překladu, první další jazyk **angličtina**, bez schválení žádný plošný překlad; žádná změna přesných uložených hodnot či zákaznických textů kvůli lokalizaci a metrickým/imperiálním jednotkám.

## Testy, nápověda a vydání

- Testy vol podle rizika: skutečné UI tlačítka, gesta/dvojdotyk/stylus, pixely, kóty, editor, galerii, média, poznámky, Bosch; kombinované uložit → zavřít → obnovit → import/export a Undo/Redo. Ověř **uložené** přesné hodnoty/jednotky a původní bajty. U dat/bezpečnosti negativy disk-full, zamítnutí oprávnění, offline, selhání, konflikty, přerušení, cleanup. Pro významné změny i sousední funkce; širší regresi před jednou APK. Výsledky do [#28](https://github.com/zaplikj30-ui/Zamerovac-android/issues/28).
- Při funkční změně aktualizuj **v témže PR** českou offline nápovědu `app/src/main/assets/help.js` a testy, nebo prokaž nerelevanci; dokumentuj jen skutečně implementované chování. Před vydáním aktualizuj `release-history.js` dle skutečné verze/změn a testy ([verzování](docs/verzovani.md)).
- **„Aktualizuj“ = dokonči schválený celek a regresi**, nikoli automaticky vydej APK. Jediná společná APK až po testech, nezávislém review a výslovném GO. Chraň package ID, podpis, data, kompatibilitu, `versionCode` nad posledním skutečným vydáním, `versionName`, changelog a nápovědu. Rozlišuj build, vydání, instalaci a skutečný test telefonu/Bosch/Drive; cloud/emulátor je nenahrazují.

## Dočasný provoz, HOME a rozpočet

- Stav doložený 16. 11. 2026, **před akcí živě ověř**: repo dočasně PUBLIC, CLOUD-ONLY standardní GitHub-hosted QA jen s přesným owner/PR/SHA/RUN GO. **HOME runner Zamerovac-Win11-QA ponechat OFFLINE**, služba STOP/Disabled a obě HOME workflow Disabled; bez **nového výslovného souhlasu** nic nezapínat, neinstalovat, nestahovat ani měnit systém/práva. Nedůvěryhodné PR nikdy na HOME. HOME jedině trusted owner SHA, minimální práva, timeout/cancel/UNKNOWN STOP a cleanup.
- **GitHub Actions placený limit 12 USD/měsíc**, účtování může mít zpoždění; blízko limitu STOP. Bez schválení žádné nákupy, dobíjení, placené runnery, služby ani storage/cache. Public standard compute může být zdarma, ale ověř před během aktuální ceny a souběh. Návrat do PRIVATE jen se souhlasem vlastníka.
- Jednorázový HOME `tools/home_qa_gate.py render-workflow` + `lint-workflow --strict` je **podmíněná schválená šablona**, nikoli právo zapnout HOME nebo globální garance všech YAML. Přesné technické podmínky viz [docs/HOME_QA_PREFLIGHT.md](docs/HOME_QA_PREFLIGHT.md). Staré workflow a PASS nenahrazují nové oprávnění.
