# HOME QA – schválená Windows/WSL pojistka

Řízeno v [issue #42](https://github.com/zaplikj30-ui/Zamerovac-android/issues/42), nezávislý REQUEST FIX [#6754944468](https://github.com/zaplikj30-ui/Zamerovac-android/issues/42#issuecomment-6754944468), opravné zadání [#6755055908](https://github.com/zaplikj30-ui/Zamerovac-android/issues/42#issuecomment-6755055908). Samostatný infrastrukturní kód; Android produkt, PR #61/#92/#93/#94 a main zůstávají nedotčené.

## Problém a zvolená oprava

Ad hoc HOME YAML spouštěl obecné Python unittest ve WSL, kde není Node. Původní `lint-workflow --strict` chybně schvaloval i další nechráněné cloudové joby, PR triggery a skryté Python→WSL příkazy, protože jen hledal správné řetězce v libovolné části souboru. Test-first RED nezávisle ověřil šest těchto příkladů.

**Varianta A (vybrána):** pouze výslovně povolené, přesně generované YAML šablony, nikoli regexy vydávající se za plný YAML parser. `render-workflow` vloží doslovnou důvěryhodnou větev `qa/*` a úplné 40znakové SOURCE SHA. `lint-workflow --strict` porovná celý výsledný YAML s výslovně povolenou šablonou. Původní quick/WSL šablona zůstává beze změny; nová samostatná varianta Chromium má vlastní přesnou šablonu. Cokoli navíc nebo jinak, například `ubuntu-24.04`, `on: [push,pull_request]`, další job/step, nepinovaný checkout, jiná oprávnění, maskovaný komentář, PowerShell proměnná `$cmd`, `bash -lc` nebo Python `script=r"""..."""`, skončí **STOP**.

Varianta B (instalace dalšího Node do WSL) nebyla zvolena: nepomohla by proti falešnému schvalování neznámých workflow a zdvojila by údržbu runtime.

## Výroba jednoho schváleného HOME workflow

Pouze nad důvěryhodným vlastním checkoutem po předběžné kontrole HEAD a GitHub triggerů:

```bat
python tools\home_qa_gate.py render-workflow --branch qa/schvaleny-test --expected-sha PLNY_SOURCE_SHA --output .github\workflows\home-qa-one-shot.yml
python tools\home_qa_gate.py lint-workflow .github\workflows\home-qa-one-shot.yml --strict
```

**UTF-8 na českém Windows:** Používej `--output` místo běžného přesměrování `>`. Generátor zapisuje přímo **UTF-8 bez BOM** i při `PYTHONUTF8=0` a systémovém CP1250, kontroluje přesný povolený název souboru a **odmítne přepsat existující** YAML. Chceš-li zachovat přesměrování `>`, nová verze zapisuje na binární stdout bajty UTF-8, nikoliv ANSI/CP1250. Explicitní `python -X utf8 tools\\home_qa_gate.py render-workflow ...` zůstává kompatibilní. Po vytvoření vždy proveď `lint-workflow --strict`; chyba UTF‑8 je STOP, nikoli důvod vypnout linter. Pokud soubor již existuje, nejprve samostatně ověř jeho původ a aktuální SHA, neodstraňuj jej automaticky.

`PLNY_SOURCE_SHA` musí být doslovných 40 hex znaků skutečně vybraného a schváleného commitu. Recept vynucuje jediný owner-only Windows `self-hosted` job, pouze vlastní `push` do přesné `qa/*` větve, `contents: read`, připnutý checkout bez přetrvávajících přihlašovacích údajů, původní SOURCE SHA a pořadí **lint + testy → Windows quick → řízený WSL launcher**. Soubor se jmenuje přesně `.github/workflows/home-qa-one-shot.yml`. Není přípustné jej ručně rozšiřovat o neověřené kroky.

## Doplňková QA varianta Chromium pro rozpracovaný SHA (bez merge)

Tento režim **nenahrazuje** fungující čtyřjobové HOME QA na `main`. Jde o druhý přesně generovaný kanonický one-shot pro vlastní důvěryhodnou `qa/*` větev, aby se před merge daly otestovat pixely a ovládání z konkrétního SHA. Nejde o obecné spouštění libovolných PR/forků; vstupní commit musí být výslovně prověřen jako vlastníkova větev v našem repozitáři. Zásadní změna pracovního postupu vyžaduje nezávislé bezpečnostní review, dříve než bude režim poprvé skutečně spuštěn.

Po ověření úplného SOURCE SHA a kontrole triggerů použije důvěryhodný koordinátor na **nové, neexistující** `qa/*` větvi kanonický generátor v režimu `--browser`. Má vlastní testy, které odmítají změněný job, nechráněný branch trigger, fork/PR, cloud, nepinovanou verzi Playwright, odstranění SHA preflightu či výměnu checkoutu.

```bat
python tools\home_qa_gate.py render-workflow --browser --branch qa/overena-browser-qa --expected-sha PLNY_SOURCE_SHA --output .github\workflows\home-qa-one-shot.yml
python tools\home_qa_gate.py lint-workflow .github\workflows\home-qa-one-shot.yml --strict
```

Prohlížečová varianta používá `actions/checkout` s doslovným zdrojovým SHA, **oddělený read-only checkout receptu**, kontrolu receptu vlastním kanonickým `lint-workflow --strict` a další `windows-quick --check-only` kontrolu skutečně checkoutovaného SHA. Jediný Windows `self-hosted` job pak sériově spustí bezpečnostní self-test lokálního webserveru, připnutý Playwright `1.62.1`, Chromium a existující `node tools/local-browser-qa.cjs --all`. Vyžaduje funkční domácí službu; nevyžaduje APK, Android emulátor, WSL Node ani placený GitHub-hosted runner. Zveřejňují se jen omezené protokoly syntetických scénářů (3 dny), ne původní fotografie či mediální soubory. Runner pracuje sekvenčně na PC s pevnými 16 GB RAM.

Kanonická šablona **neblokuje vytvoření úplně jiného workflow**, a proto je nezbytné posuzovat i samotný GitHub diff nových souborů a triggerů před každým spuštěním. Pokud nejde potvrdit vlastnictví zdroje, přesný SHA, předchozí bezpečnostní review nebo stabilitu runneru, **STOP**. Výsledek vždy uvést jako PASS/FAIL/SKIP/NOT RUN, prostředí a skutečný testovaný SHA. Nový SHA po úpravě kódu vyžaduje novou testovací kontrolu; historický PASS se nepřenáší.

## Skutečný fail-fast preflight

- Windows `windows-quick`: ověří Windows, Node, Python3, důvěryhodnou událost, přesný checkout SHA; pak provede všechny Node/Python quick testy.
- WSL `wsl-native`: ověří WSL2, Java17 **skutečným spuštěním** `java -version` a `javac -version`, spustitelný Gradle s výstupem **8.10.2**, Python3, Git a přesný SHA. Node v Linuxu nepotřebuje.
- WSL `wsl-jdk-probes`: pouze pět Node-independent JDK/Python kontrol (adresy a Bosch), které pokrývají dva dřívější Windows-service SKIP.
- `wsl-python-node`: zakázané spuštění skončí očekávaným návratovým kódem 2 ještě před dlouhými testy.

Ověření verze není totéž co ověření SHA256 instalovaného Gradle/JDK; původ binárek zůstává odpovědností důvěryhodné domácí infrastruktury.

## Hranice

**Nejde o univerzální GitHub bezpečnostní pravidlo.** Zcela novému workflow, které schválenou šablonu nepoužije, tento skript sám nezabrání ve spuštění. Musí ho zastavit review změn workflows a koordinátor/branch policy. Ani stávající main workflow ani PR #61 nejsou tímto jednoúčelovým linterem automaticky certifikované či upravované.

## Předintegrační bezpečnostní brána – POUZE plán, nic neslučovat

1. **Těsně před integrací** ověř na GitHubu nejnovější `main`, HEAD všech relevantních draft PR a skutečný diff. Při přípravě byl `main` `5411eb04e174c54c6c649084872f31f0d1b421a0`, ale stav může zastarat.
2. **Nepoužívat PR #61 jako merge zdroj.** Aktuální `main` obsahuje novější `.github/workflows/windows-self-hosted-qa.yml`, `.github/workflows/windows-home-apk-release.yml` a `docs/ci-home-runner.md`. Nový kumulativní balík z PR #94→#95→navazujícího UTF-8 PR se má přenést **jen jako tři nové soubory** `tools/home_qa_gate.py`, `tests/test_home_qa_gate.py`, `docs/HOME_QA_PREFLIGHT.md` plus krátké doplnění `AGENTS.md`; žádný historický CI/release YAML ani jeho starší konfigurace.
3. Připrav důvěryhodnou **integrační draft větev z aktuálního main**, ne přepis žádné paralelní větve. Nezávislý kontrolor porovná skutečný výsledný diff, zachování domácích čtyř jobů, `on.push/workflow_dispatch`, owner/main guardů, plně připnutých checkoutů, vypnutého automatického placeného cloudu, release podpisových a verzovacích kontrol a ochrany dat. Neznámé změny = STOP.
4. Teprve po **výslovném souhlasu vlastníka** lze rozhodnout o merge. Na **novém skutečném main SHA** potom zopakuj cílený canonical UTF-8 test/Windows quick/WSL preflight a určenou bezpečnostní regresi hlavního čtyřjobového QA; žádný PASS z historického SHA ani automatický release/APK nepřebírat. Při integraci s pozdější B16 provést zvláštní plnou společnou regresi.
5. Podklady, PASS/FAIL/SKIP/NOT RUN, skutečný zdrojový SHA a nezávislé schválení zapiš do existujícího issue #42. Po skončení odstraň jen jednorázové QA triggery z vlastních větví, zachovej logy. **Nikdy** automaticky nespouštěj placený cloud (limit 12 USD) ani nepřepisuj staršími workflow funkční domácí runner.

Domácí PC Windows11 má pevně 16 GB RAM; WSL2 4GB/2CPU a Gradle nejvýše jeden worker. Žádná placená cloudová VM, APK, emulátor ani vydání. Tato krátká QA testuje preflight, quick a pět WSL JDK scénářů. Kompletní 382 JVM, Chromium/pixely, PDF i fyzický Samsung/Bosch zůstávají pro pozdější společnou regresi **NOT RUN** na aktuálním integrovaném SHA.

## Bezpečné Chromium před sloučením (PR #115)

Varianta `render-workflow --browser` povinně vyžaduje `--source-branch`
(větev v **owner repozitáři**), `--expected-sha` (neměnný HEAD této
větve), `--validator-sha` (samostatně prověřený připnutý SHA kontrolního
kódu z owner repozitáře), `--validator-branch` (owner větev tohoto
kontrolního kódu; běžně `infra/qa-browser-one-shot-20261112` před merge,
`main` až po schváleném začlenění) a `--browser-sha256` (předem prověřený SHA256
již nainstalovaného Chromium). Nestačí pouze syntakticky platné SHA.
Všechny hodnoty se před generováním a spuštěním musí ověřit proti
schválenému GitHub HEAD, zdroji větve a nezávislému review.

Browser workflow stáhne zdroj **pod jménem owner větve** (nikoli PR/fork
ref nebo libovolný hash), validator z výslovné owner větve s kontrolou jejího přesného připnutého SHA a recipe
z triggering owner-only `qa/*` větve. **Před jakýmkoli spuštěním kódu
ze source** zkontroluje oba skutečné `git rev-parse HEAD`, následně
spustí `lint-workflow --strict` z připnutého validatoru, nikdy
self-lint ze spouštěné QA větve. Nesouhlas znamená STOP.

Playwright 1.62.1 je uzamčen v `tools/qa-browser/package-lock.json`
včetně SHA512 integrity. `npm ci --offline --ignore-scripts` instaluje
pouze do izolované pracovní složky; neprobíhá síťové stahování balíčků
ani instalace binárky Chromium. Existující lokální Chromium je jen čteno
a musí odpovídat přesnému předem schválenému SHA256; při chybě se test
bezpečně zastaví. Pokud offline cache/chromium není připravené, je to
**HOLD**, ne důvod obejít integritu nebo nainstalovat náhodné artefakty.

Node Chromium spouštěč průběžně atomicky zapisuje `results.json` po
každé suite. Rozlišuje dokončené PASS/FAIL, přerušené FAIL a zbývající
NOT RUN včetně testovaného SHA. Při timeoutu ukončuje podprocesy
stromově (`taskkill /T /F` na Windows), s limitem 38 minut uvnitř
50min workflow a bez falešného PASS. Systém je určen pro HOME Windows
11, sériové UI testy a syntetické údaje, bez APK/release.

**Nový browser režim se nesmí poprvé spustit před nezávislým SOURCE
security PASS a výslovně ověřeným trust bindingem i přítomností
offline artefaktů.** Původní main HOME 4/4 ani canonical quick+WSL
šablona se nemění. Neplatí zde automatické povolení merge či release.

**Pozor na první spuštění:** otisk headless Chromium byl přečten bez úprav PC
z [HOME quick běhu #43189084331](https://github.com/zaplikj30-ui/Zamerovac-android/actions/runs/43189084331):
`ce4635cd0e5dc0e21494542a701f347e91c1f1d821970578d97ed8df4ced50ef`
(`chromium_headless_shell-1234`). To dokládá lokální totožnost při měření,
nikoli původ distributora ani PASS E2E. Hash se nesmí nahradit automatickým
akceptováním libovolného souboru. Srovnání s očekávanou verzí a první reálný
browser běh jsou stále HOLD do závěrečného bezpečnostního posouzení.
