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

## Native/PDF a provozní omezení

Samostatné native/SDK a PDF *skutečné* testy jsou v této etapě **NOT RUN**: nemáme ověřený živý stav WSL SDK, PDF parseru/rendereru ani offline artefaktů. Bez prokázaných schválených závislostí se nespouštějí, bez `pip install` nebo síťových stahování, bez sestavení APK. Fyzický Samsung/S Pen/Bosch/SAF, živý Drive, plný disk a restart jsou také **NOT RUN**.

Před jakýmkoli pozdějším HOME spuštěním: Kontrolor 40 provede nové nezávislé review této QA-only větve a celé výsledné YAML; Koordinátor 19 ověří živě owner source i validator HEAD, nezměněný diff, bezpečné triggery, plnou offline cache, online/idle stav domácího runneru a rozpočet do 12 USD; **vlastník zvlášť schválí spuštění**. Nic z toho tato větev neslibuje ani samo nespouští.

## Autorská validace / evidence

- `tests/test_home_qa_gate.py`: pozitivní a adversariální negativní scénáře generátoru, zdroj SHA/branch, actor, fork, cloud job, trigger, checkout, lint, UTF-8/bez overwrite a oba režimy.
- `tests/browser_qa_runner.js`: nezávislý checkpoint reportu, timeout kontrakt, skutečný 23-suite manifest, syntetický validní 92-case a negativní 93-case/missing/duplicate/wrong SHA.
- `tests/test_sync116_home_qa.py`: syntetická 511+2 brána; třetí FAIL, ERROR, SKIP, chybějící/duplicitní test, stale XML, wrong SHA, změněný autorský wrapper, raw exit0 → HOLD.
- Skutečně provedené lokální testy a jejich prostředí se musí doložit v novém draft PR. **Když prostředí nemá přístup ke zdrojovým souborům a nástrojům, označit NOT RUN, nikdy PASS.**
- Před skutečným testem budou dva oddělené owner-only one-shot vstupy; žádný automatický batch spouštěný vytvořením návrhové větve.

**Integrace/merge/release/APK = HOLD.**
