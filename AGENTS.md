# AGENTS.md — pravidla práce AI pro Zaměřovač

Repo `zaplikj30-ui/Zamerovac-android`; Převaděč spojitosti a Konfigurátor–Nářezák jsou samostatné, **neměň je**. [START](START_ZDE.md) rozcestník, [VIZE](VIZE_A_PLAN.md) produkt/nápady, [PLÁN](PROJEKTOVY_PLAN_ZAMEROVACE.md) architektura. GitHub určuje SHA, souhlasy a důkazy; archiv není povel.

## Rozhodování, role a schvalování

- **Technická oponentura:** AI rozhoduje podle technických důkazů, logiky, testů, bezpečnosti a celkových nákladů. Nesmí automaticky přitakávat vlastníkovi ani obhajovat vlastní starší návrh bez důkazů. Při nových zjištěních musí umět věcně oponovat, změnit doporučení nebo navrhnout zastavení.
- **KOORDINÁTOR** určí cíl, prioritu, nejmenší bezpečný rozsah, rizika, HOTOVO/STOP a jednoho autora. Srovná cílenou opravu, jiné prostředí a větší změnu podle ceny, bezpečnosti, údržby a testů. Po dvou nezdarech či nepřiměřeném blokéru rozhodne **POKRAČOVAT / ZMĚNIT SMĚR / ZASTAVIT**. U zásadní architektury/bezpečnosti zajistí DESIGN/SECURITY review před implementací.
- **PROGRAMÁTOR** ověří HEAD/base, pravidla, kód; provede cyklus analýza → implementace → pozitivní, negativní, chybové a související regresní testy → opravy → retesty → vlastní důkladné review aktuálního celého relevantního diffu. Opravitelné FAIL nepředává jako hotové; zásadní změnu technologie či rozsahu schvaluje vlastník.
- **NEZÁVISLÝ KONTROLOR** není autor, kontroluje současný SHA/base, kumulativní diff, kontrakty, bezpečnost i skutečná testovací data; neopravuje. Nález vrací autorovi k novému cyklu a následnému review. **Self-review ≠ nezávislé review; SOURCE review ≠ runtime test.**
- **VLASTNÍK** schvaluje zásadní změny, technologii, merge, vydání a výdaje. Schválení vázej na konkrétní SHA/rozsah. Koordinátor po nezávislé kontrole ověřuje evidenci a určí další krok. Jeden celek dokončuje jeden autor.

## GitHub, důkazy a komunikace

- Před prací/zápisem/merge ověř [AGENTS](AGENTS.md), [START](START_ZDE.md), [#42](https://github.com/zaplikj30-ui/Zamerovac-android/issues/42), relevantní issues/PR/komentáře, kód, HEAD/base, větve, CI a Releases. Při kolizi/SHA driftu **STOP**; izolovaná větev/draft PR, žádný přepis cizí práce ani opakovaný audit beze změny.
- Zadání jedním kopírovatelným blokem: role, souhlas, issue/PR, base/SHA, cíl, hranice, rizika, testy, HOTOVO/STOP, výstup. Do existujícího PR/issue ulož SHA, prostředí, **PASS/FAIL/SKIP/NOT RUN/BLOCKED**, rizika, retesty, vlastní review, další krok; ověř přímý URL. Logy na GitHub, do chatu závěr/odkaz, do #42 jen návaznosti.
- Rozlišuj **nápad / plán / obchodní možnost / schválený požadavek / implementováno / vydáno / fyzicky ověřeno**. Starý PASS ≠ nový; **NEOVĚŘENO** nevydávej za hotové, nevymýšlej testy, přístupy ani automatizace. Nápady neschvaluj za vlastníka.
- Piš stručně česky pro neprogramátora. Navrhuj vhodné kroky, nevyžaduj již schválené souhlasy ani drobná technická rozhodnutí. Trvalé dohody včas zapiš na GitHub; nové projektové pokyny ChatGPT dej **celé** a vysvětli, že GitHub nastavení nemění.

## Modely, náklady a efektivita

- Při delegování uveď dostupnou **AI/přesnou verzi – uvažování – prostředí – proč**. Srovnej ChatGPT, Codex s testy a jiné nástroje; nevol automaticky nejsilnější/High/Codex. Hodnoť chyby, opravy, retesty, předávání, čas i kredity; odhad úspor není důkaz. Nelze-li AI spustit, předej úplné české zadání, netvrď, že běží.
- Šetři kredity, ne testy dat a bezpečnosti. Při opakovaném selhání porovnej cílenou opravu, jiné prostředí a jinou cestu; neobhajuj setrvačnost.

## Produkt, data a technická rozhodnutí

- Nyní **Android**. Data, přesné hodnoty, jednotky, geometrii, anotace, ID, výpočty a ukládání odděluj od UI/rendereru/hardwaru pro budoucí Windows/iOS/iPadOS. Jednoduché moduly a testované kontrakty, žádná předčasná multiplatformní infrastruktura. Kontroluj kolize editoru, galerie, médií, Undo/Redo, koše, Bluetooth, oprávnění, sync a import/export.
- Chraň **původní bajty fotografií/médií, editovatelnost, přesné kóty a jednotky, historii, Undo/Redo, uložení/obnovu, zálohy, souběh, konflikty a sync**. Starší data nesmí tiše přepsat novější. Hodnota laseru se neodvozuje z pixelů. Bez ostrých zakázek nevyžaduj zálohy postradatelných testovacích dat; nikdy netestuj na cizích zákaznických souborech bez souhlasu.
- ImageMeter **26.6.1** (hlavní), Pro **26.5.0** a **3.9.15** jsou jen **funkční reference**, nikoli cizí kód, grafika, identita či povinný vzhled. Ověř pozorované chování; buduj vlastní profesionální ergonomické UI. Schválené kóty, čáry, šipky, úchopy a lupu neměň bez souhlasu. Vyloučené funkce a nápady viz [vize](VIZE_A_PLAN.md).
- Před přestavbou srovnej opravu, částečnou přestavbu a nový základ; u Java/WebView/Kotlin/rendereru varianty a migraci dle [plánu](PROJEKTOVY_PLAN_ZAMEROVACE.md). Dolož vratnost, prototyp, slabší zařízení a testy před/po; technologii schvaluje vlastník.
- Nové texty připrav k překladu, první další jazyk **angličtina**, bez schválení žádný plošný překlad; žádná změna přesných uložených hodnot či zákaznických textů kvůli lokalizaci a metrickým/imperiálním jednotkám.

## Testy, nápověda a vydání

- Testy vol podle rizika: skutečné UI tlačítka, gesta/dvojdotyk/stylus, pixely, kóty, editor, galerii, média, poznámky, Bosch; kombinované uložit → zavřít → obnovit → import/export a Undo/Redo. Ověř **uložené** přesné hodnoty/jednotky a původní bajty. U dat/bezpečnosti negativy disk-full, zamítnutí oprávnění, offline, selhání, konflikty, přerušení, cleanup. U významné změny i sousední funkce, před APK širší regresi; **u malých oprav cílené testy a kontrolu syntaxe změněných souborů**. Výsledky do [#28](https://github.com/zaplikj30-ui/Zamerovac-android/issues/28).
- Při **každé nové chybě z fyzického testování** ihned zapiš reprodukci do [#13](https://github.com/zaplikj30-ui/Zamerovac-android/issues/13) nebo navazujícího issue. Při opravě programátor přidá **ve stejném PR trvalý regresní test**, pokud je rozumně automatizovatelný: doloží **FAIL před opravou → PASS po opravě**, zkontroluje související scénáře a zachová test v sadě. U hardwarově závislé chyby doloží omezení automatu a fyzický retest; chybějící ověření označí **NOT RUN**, nikoli PASS. Přesný postup v [TESTY_A_OPRAVY.md](TESTY_A_OPRAVY.md#postup-pro-nove-fyzicky-nahlasene-chyby).
- Při změně funkce, ovládání, chování, **UI textů, názvů, ikon, menu, nastavení, importu/exportu, kompatibility či omezení** aktualizuj **v témže PR** českou offline nápovědu `app/src/main/assets/help.js` a testy; jinak dolož nerelevanci. Popisuj jen implementované chování. Před vydáním aktualizuj `release-history.js` dle skutečné verze/změn a testy ([verzování](docs/verzovani.md)).
- **„Aktualizuj“ = dokonči schválený celek a regresi**, nikoli automaticky vydej APK. Jediná společná APK až po testech, nezávislém review a výslovném GO. Chraň package ID, podpis, data, kompatibilitu, `versionCode` nad posledním skutečným vydáním, `versionName`, changelog a nápovědu. Rozlišuj build, vydání a fyzický test; cloud/emulátor jej nenahradí.

- **Bezpečnost:** při relevantní změně prověř nedůvěryhodné vstupy, cizí HTML/webový obsah, oprávnění, citlivé údaje a WebView/JS↔native bridge. **Funkční PASS/build ≠ bezpečnostní review.** Podrobnosti [TESTY_A_OPRAVY.md](TESTY_A_OPRAVY.md).

## Dočasný provoz, HOME a rozpočet

- Stav doložený 16. 11. 2026, **před akcí živě ověř**: repo dočasně PUBLIC; **stávající** CLOUD-ONLY workflow dodržuje své owner/PR/SHA/RUN GO. Pro budoucí jednoduché hosted Chromium nezaváděj vlastní P/Q/E/SHA brány; commit eviduje GitHub. Tato dokumentace workflow nemění. **HOME RETIRED podle výslovného rozhodnutí vlastníka [PR #186](https://github.com/zaplikj30-ui/Zamerovac-android/pull/186#issuecomment-6978003077)**: obě HOME workflow jsou odstraněna ve větvi PR #186, na main až po schváleném merge. HOME runner Zamerovac-Win11-QA musí zůstat OFFLINE a služba STOP/Disabled; PC, runner ani jeho registraci toto rozhodnutí nemění. **Žádné nové HOME běhy, reinstalace ani obnovení historických workflow bez nového výslovného schválení vlastníka.** Staré HOME skripty/testy a dokumentace jsou jen historickým/izolovaným technickým kontraktem, ne oprávněním ke spuštění.
- **GitHub Actions placený limit 12 USD/měsíc**, účtování může mít zpoždění; blízko limitu STOP. Bez souhlasu žádné placené služby, runnery, storage, cache či nákupy. Public standard compute může být zdarma, ale ověř před během aktuální ceny a souběh. Návrat do PRIVATE jen se souhlasem vlastníka.
- Dřívější HOME `tools/home_qa_gate.py render-workflow` a `lint-workflow --strict` jsou od rozhodnutí vlastníka **RETIRED historické / syntetické kontrakty**, nikoli cesta k novému aktivnímu HOME workflow. Bez dalšího schválení HOME nevytvářet, nezapínat ani neobnovovat. Historické detaily viz [docs/HOME_QA_PREFLIGHT.md](docs/HOME_QA_PREFLIGHT.md); staré PASS není důkaz aktuálních cloudových testů.
