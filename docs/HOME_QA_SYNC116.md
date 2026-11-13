# QA-only příprava PR #116 (Chat 39) — před spuštěním nové SOURCE review

**Stav:** pouze nový draft; **HOME/ACTIONS/runner ani placený cloud nespouštět**. Navazuje pouze na reviewovaný [PR #115](https://github.com/zaplikj30-ui/Zamerovac-android/pull/115), přesný bezpečnostní gate základ `3eed2d9ffe4f38b45c6b6c59dc4c6fba918baaef`. Produktový [PR #116](https://github.com/zaplikj30-ui/Zamerovac-android/pull/116) zůstává **nedotčen**.

Rozhodnutí: [Koordinátor 19 / issue #42](https://github.com/zaplikj30-ui/Zamerovac-android/issues/42#issuecomment-6839410352), [read-only předání operátora](https://github.com/zaplikj30-ui/Zamerovac-android/issues/42#issuecomment-6839342992).

## Identita důvěry a rozsah

- Produkt: **jen owner** `zaplikj30-ui/Zamerovac-android`, **doslovná dvojice** větev `implement/sync-core-b-20261112` a SHA `1527e3377609633c554195b0641e02e3cfb5fb5e`. Výjimka se nevztahuje na jiné `implement/*`, SHA, forky, PR refs nebo změnu HEAD.
- Gate: nejprve samostatné nezávislé SOURCE review **nového** QA-only draftu; pro případné pozdější spuštění se gate větev checkoutuje pouze z owner repo a do workflow se vloží *ověřený HEAD této nové větve*. SHA se kontroluje ze skutečného checkoutu **před jakýmkoli source kódem**. Staré SOURCE PASS PR #115 automaticky neznamená PASS těchto nových změn.
- Recipe: jedna úplná přesně generovaná YAML šablona a `lint-workflow --strict`, jediný self-hosted Windows job, owner-only `qa/*` push na jedinou doslovnou cestu, žádný `pull_request`, `workflow_dispatch`, cloud job, fork nebo neověřená akce. Připnutý `actions/checkout`, read-only `contents:read`, `persist-credentials:false`, serial. Žádné workflow nebylo na této pracovní větvi vytvořeno.
- Dvě **oddělené varianty** generátoru: `--browser` pro Chromium a `--sync-jvm` pro WSL JVM. **Obě používají stejný chráněný výstupní název** `.github/workflows/home-qa-one-shot.yml`, nelze je v jedné `qa/*` větvi automaticky kombinovat nebo přepsat; každá až po samostatné bráně a schválení.
- Původní canonical quick/WSL recipe, hlavní HOME 4/4, `main`, #115/#116 a `tools/sync-ack-acceptance.py` PR #116 se nemění.

## Chromium — úplný rozsah

`tools/local-browser-qa.cjs` běží **z důvěryhodného gate checkoutu**, ale čte assets a spouští `tools/e2e/*.cjs` výhradně ze zdrojového checkoutu po SHA bráně. Pinned Playwright **1.62.1**, `npm ci --offline --ignore-scripts` z izolované lokální cache, ověřený Chromium SHA256 `ce4635cd0e5dc0e21494542a701f347e91c1f1d821970578d97ed8df4ced50ef`; chybějící nebo změněná závislost = STOP, nic nestahovat. Neúspěšné/časově překročené testy končí FAIL a podprocesy se ukončují.

`--all` nyní vyžaduje **přesně 23 sad a 92 skutečně PASS scénářů**, včetně `pending-audio` a `legacy-conflict-persistence`. Každý scénář musí mít skutečný nefalšovaný syntetický report z E2E harnessu `report.json` se shodnou suite, zdrojovým SHA, unikátními názvy a `passed` stavy. Chybějící, duplicitní, stale SHA, FAILED, SKIP, 91 či 93 scénářů nebo přerušená sada = FAIL/HOLD. Příslušné výsledky nesmějí být vydávány za test nativního Androidu.

## WSL/JVM + historické dvě EXPECTED FAIL

Samostatný trusted QA-only `tools/sync116_home_qa.py` **nepouští autorský runner**, který v PR #116 vyžaduje dva workery. Z důvěryhodné dočasné kopie testuje přesně SHA, čistý checkout a původní Git blob autorského klasifikátoru `8359a58f6a39f792f1624fd708d66c47a85d51d5`. Kontroluje původní nezměněné testové SHA256 jako PR #116. Windows pouze koordinuje WSL, ve WSL běží JDK17, Gradle8.10.2 a **jen jeden worker**:

`gradle --offline --no-daemon --max-workers=1 --no-parallel :app:testPreviewUnitTest --rerun-tasks`

Tento jediný Gradle běh vždy obsahuje **obě původní skutečně FAIL** fyzikální ACK diagnostiky (ne `@Ignore`, ne `SKIP`, ne náhrada PASS). Očekávaný **raw Gradle FAIL / exit1**, ale oddělená produktová brána smí PASS jen při **64 čerstvých JUnit XML / 513 unikátních metodách / 511 PASS / přesně 2 původních FAIL / 0 ERROR / 0 SKIP**, úplné shodě assertion message, obou povinných E2E PASS, přítomném SyncReceiptSafetyTest, nezměněných testových bajtech a stejném SHA před i po běhu. Jinak fail-closed. Pokud nelze ověřit offline Java/SDK/Gradle/Robolectric cache, nic neinstalovat — FAIL/HOLD. Vše běží sériově v dočasné izolované WSL kopii, WSL přenos má timeout a čistí kopii.


## QA117-SEC-01 až 04 – ochrany po nezávislé revizi Chatu 40

**SEC-01 P1 – neoprávněný GitHub re-run:** job guard nyní doslovně ověřuje nejen `github.actor`, ale **`github.triggering_actor == 'zaplikj30-ui'` a `github.run_attempt == 1`**. Důvěryhodný Python runtime stejnou politiku vynucuje přes `GITHUB_ACTOR`, `GITHUB_TRIGGERING_ACTOR`, `GITHUB_RUN_ATTEMPT`, numerický `GITHUB_RUN_ID`; chybějící hodnoty, jiný uživatel, attempt 2, PR/fork/hosted = STOP. Oba nové one-shot režimy i původní canonical recipe mají fail-closed guard. GitHub nemá automatické oprávnění k další exekuci na HOME; vyžaduje se nová samostatná výslovná autorizace.

**SEC-02 P1 – povinný aktuální důkaz:** `tools/sync116_evidence.py` je pouze pinned validator, vytváří `results.json` jako **NOT RUN**, výlučně v dosud neexistující složce `qa-evidence/Zamerovac-QA/runs/<GITHUB_RUN_ID>-<GITHUB_RUN_ATTEMPT>/{browser|jvm}/`. Žádný glob ani přepis staršího běhu. Browser i JVM ukládají přesně tento report s identitou **run ID + attempt + testovaný product SHA + validator SHA**; přísná závěrečná kontrola teprve prověří 23/92 nebo 64/513/511+2 včetně integrity a skutečných statusů. Teprve pak může testovací job dojít do PASS. Upload může na neúspěchu zveřejnit aktuální **FAIL/NOT RUN**, ale `if-no-files-found:error` vynutí červený výsledek při chybějícím reportu. Cesta artifact je odvozena **z GitHub expressions stejného run ID a attemptu** a artifact jméno je rovněž jedinečné. Žádné mazání jiných reportů ani pracovních dat.

**SEC-03 P1 – nejnižší oprávnění a timeout:** nová JVM recipe nesmí použít root WSL. Jedině již existující **výchozí neprivilegovaný WSL účet**, explicitně `id -u != 0`; nenastavený/neověřený účet nebo chybějící offline cache znamená **BLOCKED**. Izolovaná soukromá pracovní kopie v `/tmp` (`mktemp`, `umask 077`), beze změn účtů či práv, žádná instalace a maximálně jeden Gradle worker. `setsid timeout` tvoří oddělenou procesovou skupinu; bash trap a kontrolní heartbeat z Windows stdin ji ukončují `TERM` a následně `KILL` při timeoutu, ztrátě komunikace či přerušení, s úklidem jen této dočasné kopie. **Dosud není prokázán live runtime procesový cleanup na domácím WSL** – nezávislé review musí rozhodnout, zda je bezpečné první spuštění; při nemožnosti potvrzení žádný root fallback ani test.

**SEC-04 P2 – bajtová neměnnost Chromium:** pinned browser runner kontroluje skutečný checkout SHA, prázdný `git status --porcelain -z --untracked-files=all`, kompletní seznam a SHA256 **všech sledovaných assets a E2E/harness souborů**. Kontrola běží před prvním scénářem, mezi sadami a po poslední sadě; jakýkoli dirty worktree, jiný digest či změněný HEAD znamená FAIL a neschválený report. Adversariální test používá dočasný syntetický Git checkout: změna tracked HTML/JS při stejném commitu musí být odmítnuta.

**Samostatně otevřené riziko:** produktový Chromium harness v PR #116 používá `--no-sandbox`; nová QA-only větev to bez souhlasu vlastníka nemění. Před spuštěním na HOME vyžaduje další bezpečnostní posouzení izolace tohoto přesně připnutého E2E kódu. V případě neakceptovatelného rizika **HOME BLOCKED**, nikoli tiché spuštění.

### Evidence testů nové opravy

Nové jednotkové testy: `tests/test_sync116_evidence.py`, rozšířené `tests/test_home_qa_gate.py`, `tests/test_sync116_home_qa.py` a `tests/browser_qa_runner.js`. Pokrývají cizího triggering actor, attempt 2/missing run ID, stale/poškozené/missing reporty, nesouhlas SHA/validator/counts, root/WSL fallback/cache, chybějící JVM 513/511+2, dirty tracked soubor a změnu SHA s neměnným HEAD. Výsledky mají status **NOT RUN**, dokud nejsou skutečně spuštěny na důvěryhodném checkoutu; syntaktická/V8 izolovaná kontrola není Python/Node runtime PASS.

## QA117-SEC-05 – přesné identity povinných testů

**Zdroj pravdy:** `tools/sync116_case_manifest.json` je QA-only schválený manifest odvozený výhradně od připnutého produktu PR #116 SHA `1527e3377609633c554195b0641e02e3cfb5fb5e`. Obsahuje doslovná jména všech **23 Chromium sad a 92 pojmenovaných scénářů** ve zdrojovém pořadí, včetně dynamicky tvořených názvů v drawing/latency/quality-regressions/gallery-readability, a schválená skutečná Java `@Test` jména pro **2 SyncAckReconciliationTest E2E, 24 SyncReceiptSafetyTest a 23 DatabaseInstallEvidenceTest**. Všechny tři Java soubory byly na přesném SHA při sestavení manifestu porovnány podle názvů a Git blob SHA.

**Dvě vrstvy kontroly:** pinned `local-browser-qa.cjs` odmítne chybějící/přidanou/přejmenovanou či přeřazenou suite nebo scénář i při čísle 92; `sync116_evidence.py` nezávisle porovná celou uloženou 23×case identitu podle manifestu. `sync116_home_qa.py` ověřuje požadovaných 49 `PASS` JUnit IDs přímo z čerstvých XML, zatímco nezávislý `sync116_evidence.py` odmítne jejich chybějící/přejmenované identity v reportu. `suite0`…`suite22`, fake `p0`…`p510`, chybějící audio nebo vynechaný povinný E2E/24/23 při zachovaných počtech **musí skončit FAIL**.

**Neměněno:** celkových 64 JUnit XML / 513 metod, 511 PASS + **přesně dvě skutečné očekávané FAIL**, raw Gradle FAIL/exit1, source/validator SHA, run/attempt evidence, strict lint, offline závislosti, owner/rerun a nonroot WSL. Zkušební negativní fixture používá syntetické doplňkové `FixtureOtherTest` pouze pro doplnění počtu 511 v izolovaném unittestu, nikoli jako důkaz reálných JUnit metod. `PASS` pro samotné Python/Node testy může být udělen pouze po spuštění v autentizovaném checkoutu (jinak **NOT RUN/BLOCKED**).

## Native/PDF a provozní omezení

Samostatné native/SDK a PDF *skutečné* testy jsou v této etapě **NOT RUN**: nemáme ověřený živý stav WSL SDK, PDF parseru/rendereru ani offline artefaktů. Bez prokázaných schválených závislostí se nespouštějí, bez `pip install` nebo síťových stahování, bez sestavení APK. Fyzický Samsung/S Pen/Bosch/SAF, živý Drive, plný disk a restart jsou také **NOT RUN**.

Před jakýmkoli pozdějším HOME spuštěním: Kontrolor 40 provede nové nezávislé review této QA-only větve a celé výsledné YAML; Koordinátor 19 ověří živě owner source i validator HEAD, nezměněný diff, bezpečné triggery, plnou offline cache, online/idle stav domácího runneru a rozpočet do 12 USD; **vlastník zvlášť schválí spuštění**. Nic z toho tato větev neslibuje ani samo nespouští.

## Autorská validace / evidence

- Navazující Codex validace v izolovaném managed Linux checkoutu odstranila původní blokér přístupu k repozitáři. Na výchozím QA HEAD `488758b1a37b15f34a6360691d0d61b3545bbf45` skutečně prošly zadané Python balíky (42/9/6 metod); Node test skutečně selhal, protože negativní fixture obracela jednopřípadovou sadu. Fixture nyní mění osmipřípadový `pending-audio` a výslovně kontroluje, že vstup změnila; původní FAIL aserce zůstává.
- Cílený Bash unit test reprodukoval před opravou ztracený heartbeat: neinteraktivní background watcher bez explicitního stdin dostal `/dev/null`. Watcher nyní explicitně dědí heartbeat stdin. `tests/test_sync116_watchdog_shell.py` provádí pouze výřez skutečného Bash watcheru s neškodnými náhradami `kill`/`sleep`: platný heartbeat před EOF, chybný heartbeat a EOF. **Nespouští WSL, Java, Gradle ani skutečné signály**; na Windows je výslovně SKIP a nesmí aktivovat Windows bash/WSL. Není to důkaz ukončení reálných WSL potomků.
- Další reprodukovaný negativní test odhalil přepis existujícího `results.json.tmp`. Browser report jej nyní vytváří výlučně přes `wx`; při kolizi nebo symlinku skončí chybou a zachová původní report, dočasnou evidenci i odkazovaný soubor. Node test ověřuje kolizi a na Linuxu také skutečný symlink, bez změny práv Windows.
- Úplné skutečné finální logy, přesný výsledný SHA a předání jsou v [PR #117](https://github.com/zaplikj30-ui/Zamerovac-android/pull/117); výše uvedené původní NOT RUN záznamy jsou historické. Tyto QA-only unit testy používají syntetické fixture, nejsou novým Chromium 23/92 ani JVM 513 během. **Chromium `--no-sandbox` a skutečný WSL cleanup zůstávají před HOME BLOCKED.**
- `tests/test_home_qa_gate.py`: pozitivní a adversariální negativní scénáře generátoru, zdroj SHA/branch, actor, fork, cloud job, trigger, checkout, lint, UTF-8/bez overwrite a oba režimy.
- `tests/browser_qa_runner.js`: nezávislý checkpoint reportu, timeout kontrakt, skutečný 23-suite manifest, syntetický validní 92-case a negativní 93-case/missing/duplicate/wrong SHA.
- `tests/test_sync116_home_qa.py`: syntetická 511+2 brána; třetí FAIL, ERROR, SKIP, chybějící/duplicitní test, stale XML, wrong SHA, změněný autorský wrapper, raw exit0 → HOLD.
- Skutečně provedené lokální testy a jejich prostředí se musí doložit v novém draft PR. **Když prostředí nemá přístup ke zdrojovým souborům a nástrojům, označit NOT RUN, nikdy PASS.**
- Před skutečným testem budou dva oddělené owner-only one-shot vstupy; žádný automatický batch spouštěný vytvořením návrhové větve.

**Integrace/merge/release/APK = HOLD.**
