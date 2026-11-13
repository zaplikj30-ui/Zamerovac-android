# QA-only: jeden řízený domácí Chromium smoke (13. 11. 2026)

**Neaktivní REVIEW návrh. Nepouštět, dokud nezávislý kontrolor neudělí SOURCE/security PASS a koordinátor s vlastníkem nepotvrdí konkrétní aktivační push.**

## Identita a důvod
- Výchozí reviewovaná QA implementace PR #122: `c9958dff58cf04829c1aa269b49c9b81d9020288`.
- Přesný produktový zdroj PR #121: `ae3b4df53c25557f28b4a25ccb65adc2abdff639`.
- Inventura HOME PR #123: `43476705453` PASS pro účet `ZamerovacQA` a plné Chromium SHA256 `409805a16d6416087e6b2f778df1cf8f7bbb267d6b99f6b5bb0a618eace234f2`; **Chromium se při inventuře nespustilo**.
- Původní QA `executionIdentity` hardcodovalo `refs/heads/qa/home-props-security-20261113`. Proto nový RUN ref musí být změněn **v izolované kopii QA**, ne spoofován přes Windows prostředí.
- Jediná funkční změna původního QA je výměna tohoto doslovného ref v `tools/qa-integrity.cjs` a přesně odpovídající testové fixture `tests/home_qa_integrity.js`; produkt, sandbox/Job guardy, všechna E2E data a 23/96 manifest zůstávají z PR122 beze změny.

## Nepřekročitelná aktivace
1. REVIEW větev `qa/browser-smoke-20261113-review` nesplňuje jediný spouštěcí trigger. Nová RUN větev `qa/browser-smoke-20261113-run` zatím neexistuje; workflow reaguje **pouze** na owner push do RUN s přesným markerem `docs/qa/browser-smoke-20261113.trigger`. Žádný PR, main ani workflow_dispatch trigger.
2. Nezávisle zkontrolovat celý relevantní diff, zejména jedinou změnu identity, CMD, `on.push`, `if`, obě SHA, checkout, GitHub event.before a fail-closed návraty. Nejprve získat SOURCE PASS **na finálním review HEAD**. Bez něj STOP.
3. Před vytvořením RUN větve opět ověřit finální reviewed SHA, repo owner, původ/cizí změny, aktuální hlavní workflow a skutečné Windows runner online/idle. Vytvořit RUN větev **přesně z reviewed HEAD**. Ověřit `compare` identitu 0 změn.
4. **Jediný** aktivační commit smí přidat výhradně marker; parent musí být reviewed SHA, message musí být `APPROVED-ONE-SHOT-BROWSER-SMOKE-20261113`, žádné přepisování YAML/QA kódu. Kompletní diff, parent, aktéra a připnuté SHA ověřit **PŘED push**; jinak STOP. `github.event.before` z této jediné události tvoří neměnné SHA QA validatoru. Nejedná se o repo-wide immutable lock; `run_number==1`, `run_attempt==1` a `event.created==false` brání opakovanému vykonání jobu; samostatný SKIPPED záznam při dalším push je přípustný.
5. Po skutečném provedení zachovat run/job ID, přesné Git SHA, výsledky, účet, browser hash, sandbox/CDP, procesy a případný BLOCKED; marker deaktivovat, RUN větev bezpečně odstranit v UI, pokud to dostupné oprávnění umožní. Nespouštět opakovaně při FAIL. Bez merge/APK/release.

## Runtime hranice
- Jen jeden Windows self-hosted `zamerovac-qa` job, servisní účet bez elevace, 16 GB RAM, testy sériově; žádný runner GitHub-hosted, žádný PowerShell/WSL/Gradle/Android.
- Dva samostatné `actions/checkout` s přesně fixovaným PR121 SHA a QA parent SHA, `persist-credentials:false`, žádné submoduly/LFS. `core.autocrlf=false` jen pro tyto checkout procesy. Nejprve přesný HEAD a clean status, až potom vykonávání kódu ze zdrojů.
- Jen existující MinGit, Node, Python313, Playwright1.62.1 a plné Chromium z ověřené cesty. **Žádný npm/npx/pip, žádný download, žádná změna ACL/Defender/Play/runneru a žádný fallback na headless shell či `--no-sandbox`.** Pokud Playwright nelze z uživatelského kontextu služby již vyřešit, STOP/BLOCKED bez instalace.
- Po preflightu přesný `node --test tests/home_qa_integrity.js`, `--self-test` HTTP serveru a živý `--smoke` (sandbox/CDP a 3 sady). Zachovat Windows JobObject scope, stop při selhání kontroly oprávnění/sandboxu, cleanup musí být ověřen; selhání se nenahrazuje filtrem ani ignorací.
- Artifact obsahuje pouze textové výsledky/reporty/logy ze syntetických běhů, **nikoliv cache, prohlížečové profily, klientské soubory, APK ani zákaznická data**. Bez artifactu/čerstvého run ID žádný HOME PASS.
- Úspěšný SMOKE není **23/96 plný UI PASS**, HOME4/4, WSL511+2, PDF ani fyzický Android. Tyto testy zůstávají samostatně NOT RUN; dvě historické #88 FAIL se nesmějí maskovat.

## Důkazy a limity přípravy
Koordinátor 25 provedl nad skutečným textem uloženého GitHub workflow **24 PASS, 0 FAIL** syntetických/static kontrol: 1 správná owner událost, 9 zakázaných událostí (repo, owner, triggering_actor, review ref, PR, nový push, rerun, branch-creation, špatná commit message), 14 invariantů (dva checkouty, exact SHA, rodičovský commit, žádný předčasný source code, absence instalačních příkazů/sandbox bypass/PowerShell/manual/PR trigger, runner, marker, smoke only, QA identity a unit fixture). Tyto V8 modelové/statické kontroly **nejsou Windows CMD ani YAML event parser runtime PASS**. Skutečný Windows/Node/Chromium a Actions spouštěč pro nový SHA: **NOT RUN**. Kompletní testy v autentickém offline Windows prostředí budou probíhat teprve po samostatném SOURCE review a bezpečné aktivaci.

## Historická validační chyba opravená ještě v REVIEW
První neaktivní YAML `.github/workflows/browser-smoke-20261113.yml` obsahoval výraz `${{ runner.temp }}` přímo v `jobs.windows-browser-smoke.env`. Oficiální GitHub **context availability** dovoluje kontext `runner` až na úrovni **step**, nikoli job-level `env`. To je doložená neplatná konstrukce a pravděpodobná příčina tří workflow-validation FAIL:
- [43480218762](https://github.com/zaplikj30-ui/Zamerovac-android/actions/runs/43480218762)
- [43480387567](https://github.com/zaplikj30-ui/Zamerovac-android/actions/runs/43480387567)
- [43480863305](https://github.com/zaplikj30-ui/Zamerovac-android/actions/runs/43480863305)

**GitHub API pro všechna tato selhání potvrdilo 0 jobs**: žádný Windows/cloud/runner job neběžel. Billable timing záznam má prázdný objekt, neprokazuje účtování. Původní workflow byl **z REVIEW odstraněn**, protože jeho 3 validační pokusy spotřebovaly `run_number` 1–3. Opravený a stále neaktivní workflow je nyní **`.github/workflows/browser-smoke-once-20261113.yml`** pod novou workflow identitou; `ZAMEROVAC_QA_RESULT_PARENT` se nastavuje až uvnitř CMD testovacího kroku z lokálního `%RUNNER_TEMP%`. Následný read-only GitHub check ukázal **žádný nový workflow run** na REVIEW ani RUN větvi po vytvoření opraveného souboru. Nejde o skutečný GH runtime parser PASS do aktivace.

Oficiální zdroj kontextové tabulky: https://docs.github.com/en/actions/reference/workflows-and-actions/contexts#context-availability

**Povinná nová statická regrese:** v job-level `env:` nesmí být `${{ runner.* }}`; případná `runner.temp` výrazy smějí být jen v `steps.with` nebo `steps.env` a v CMD jen skutečné `%RUNNER_TEMP%`. Každý nový `if`/job musí respektovat přiměřené review a neobcházet 1. běh.
