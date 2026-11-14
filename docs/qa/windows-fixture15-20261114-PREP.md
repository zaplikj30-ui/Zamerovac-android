# PREP – Windows fixture15/CMD/cleanup, neaktivní jednorázový návrh

Autor: Koordinátor 28; datum 14. 11. 2026. Určeno pro nezávislé SOURCE/security review Kontrolora 40 před jakýmkoli Windows během.

## Rozhodnutí a zdroje

- Zdrojově schválený QA checker: PR #127, **`6f98ceffff50d337f7c2999fed0e0878d20a582e`**; Kontrolor 40: https://github.com/zaplikj30-ui/Zamerovac-android/pull/127#pullrequestreview-5900110056
- Schválený produkt: PR #121, **`ae3b4df53c25557f28b4a25ccb65adc2abdff639`**.
- Předloha přísného owner-only mechanismu: PR #126. Historické RUN větve PR #125/#126 byly použity a nesmí se obnovit.
- Závazný postup: issue #42 – Koordinátor 28. Samotná PREP větev **nikdy nespouští test**. Není to release ani APK.

## Co má budoucí schválený běh prověřit

Právě 15 původních Node fixture testů přes **`call tools\qa-fixture-gate.cmd`** v přesném SHA PR #127. Průchod musí potvrdit všech 15 TAP případů, souhrny 15/15/0/0, nativní CMD exit 0 a podle scope supervisoru bezpečné ukončení celé vlastní procesní větve (`cleanupVerified`, nula remaining). Jakékoli FAIL/BLOCKED zastaví job. Běh **nesmí** zahájit Chromium, Playwright, Android emulátor, build ani produktové testy.

## Bezpečnostní hranice

- Workflow reaguje pouze na pozdější **jediný přesný RUN ref + jediný marker soubor + speciální commit message**, jež **v PREP neexistují**. First run/attempt musí být `1`, vytvoření RUN větve nesmí spustit job. Nová RUN větev má vzniknout jen po SOURCE review a výslovném schválení vlastníka.
- Název workflow, skupina concurrency a ref jsou nové; staré PR125/126 RUN nepoužívat. Žádné `workflow_dispatch`, `pull_request`, schedule, fork, automatické instalace, placený cloud runner nebo APK. Dva `actions/checkout` jsou připnuté celým SHA a nemají trvalé credentials/submodules/LFS.
- Před spuštěním checkoutovaného kódu se kontroluje owner, actor/triggering actor, ref, run/attempt, služba `ZamerovacQA`, přítomnost MinGit/Python a přesný čistý SHA QA i produktu. Použije se pouze pinned `Node 26.13.x` a existující Python z `C:\actions-runner\tools\Python313\python.exe`; chybějící prostředí → FAIL, žádná instalace.
- GitHub job 15 minut, povolení `contents: read`, pouze `self-hosted, Windows, X64, zamerovac-qa`. Žádné publikované raw TAP nebo artifact; diagnostiku rediguje již nezávisle zkontrolovaný PR127 gate. Bezpečnost používání Windows JobObject je **SOURCE PASS, runtime NOT RUN**.

## Autorské důkazy / limity

- Lokální syntaktická kontrola YAML: Python 3.13 PyYAML parser PASS – 1 `push` trigger, jediný job; poznámka: PyYAML 1.1 chápe nequoted YAML klíč `on` jako boolean, GitHub Actions nikoli.
- Lokální statický Node test `tests/qa_fixture15_workflow_prep.js`: na Linuxu Node22.16.0 **2 PASS/0 FAIL/0 SKIP**. Pozitivně ověřuje guardy a absence markeru, negativně simuluje odstranění guardů, přidání dispatch/PR/schedule/continue-on-error/cloud/browser/instalace a druhé spuštění CMD.
- **Windows JobObject/Node26/CMD, fixture15, Chromium/UI23/96, HOME4/4: NOT RUN.** `Node22` statický test není Windows PASS. Po SOURCE review kontrolovat přesný PREP HEAD, zda nejsou spuštěné workflow a zda nevznikla RUN větev či marker. Nové kódové SHA vyžaduje opět review a novou konfiguraci.
- Rizika: skutečný nativní Windows runner a jeho současná konfigurace/rozpočet neověřeny během přípravy; pokud kterýkoli guard nebo procesní cleanup selže, STOP. Žádné automatické opakování jobu a nikdy tichý převod BLOCKED na PASS.


## Oprava QA128-SEC-01 po nezávislém review

Nezávislá [kontrola #5900317790](https://github.com/zaplikj30-ui/Zamerovac-android/pull/128#pullrequestreview-5900317790) na původním SHA `e1a80cb053efaa774a4f384bf25efd0436324084` odhalila, že samostatné `if errorlevel 1` může po záporném návratu externího procesu pokračovat; tím by zvláště prázdný status soubor po chybě `git status` mohl být považován za čistý checkout. Nejde o potvrzený Windows incident.

**Oprava:** za oběma `git status --porcelain`, `where node`, `node -e`, `Python --version` a také za `del /q` následuje okamžitě oboustranná kontrola úspěchu: `if errorlevel 1 exit /b 1` i `if not errorlevel 0 exit /b 1`. To odmítne kladné i záporné chybové kódy. Finální `call tools\\qa-fixture-gate.cmd` už tyto obě kontroly měl; nyní jsou všechny výskyty jednostranného `if errorlevel 1` odstraněny. Spouštěcí podmínky, piny QA PR127/produktu PR121, účet runneru, scope, testovaná fixture a návratová diagnostika se nemění.

**Autorské důkazy dostupné bez Windows:** v přesném aktuálním JS testovém zdroji se ověřuje souvislé pořadí každého nutného externího příkazu a obou kontrol, včetně negativní mutace odebrání ochrany. Model CMD signed errorlevel pokrývá `0, 1, 9009, -1, -1073741819`; prázdný přesměrovaný soubor po chybě `git status` **nesmí** povolit spuštění fixture. Na aktuálním obsahu vzdálených souborů proběhlo **5 PASS/0 FAIL** přímým vykonáním kompletního testového JS ve V8 s omezenými náhradami `node:fs`, `node:path`, `node:test`, `node:assert/strict` (nikoli skutečný Node runtime). Změněné testy na lokálním `node --test`, nativní CMD/Windows a GitHub Actions zůstávají **NOT RUN**; vlastní review proto nepovažovat za provozní PASS. Nezávislý reviewer musí potvrdit celý nový fix a jeho limity.

## Další brána

1. Nezávislý kontrolor prověří **celý nový workflow a test**, zejména bezpečnost triggeru/checkoutu/budgetu/job exit a provázání PR127/PR121; review samotné není runtime.
2. Koordinátor ověří přesný finální PREP SHA, nepřítomnost nečekaných Actions a RUN branch a rozhodne, zda lze navrhnout aktivaci.
3. Aktivace vyžaduje **samostatný nový výslovný souhlas vlastníka** na přesnou konfiguraci; až poté vytvořit RUN větev a jediný marker commit. Při selhání nedělat rerun bez nové brány.
