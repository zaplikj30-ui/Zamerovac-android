# HOME QA – schválená Windows/WSL pojistka

> **HOME RETIRED (18. 11. 2026): HISTORICKÁ DOKUMENTACE – NENÍ NÁVOD KE SPUŠTĚNÍ.** Rozhodnutím [vlastníka v PR #186](https://github.com/zaplikj30-ui/Zamerovac-android/pull/186#issuecomment-6978003077) byly oba aktivní HOME workflow odstraněny z návrhové větve. Níže uvedené dřívější postupy, příkazy a schválení nejsou nynější oprávnění spouštět HOME, vytvářet nové workflow, instalovat software ani vydat APK. Historická evidence zůstává zachovaná; na `main` do schváleného merge staré soubory stále jsou.

Řízeno v [issue #42](https://github.com/zaplikj30-ui/Zamerovac-android/issues/42), nezávislý REQUEST FIX [#6754944468](https://github.com/zaplikj30-ui/Zamerovac-android/issues/42#issuecomment-6754944468), opravné zadání [#6755055908](https://github.com/zaplikj30-ui/Zamerovac-android/issues/42#issuecomment-6755055908). Samostatný infrastrukturní kód; Android produkt, PR #61/#92/#93/#94 a main zůstávají nedotčené.

## Problém a zvolená oprava

Ad hoc HOME YAML spouštěl obecné Python unittest ve WSL, kde není Node. Původní `lint-workflow --strict` chybně schvaloval i další nechráněné cloudové joby, PR triggery a skryté Python→WSL příkazy, protože jen hledal správné řetězce v libovolné části souboru. Test-first RED nezávisle ověřil šest těchto příkladů.

**Varianta A (vybrána):** pouze jediná bezpečná, přesně generovaná YAML šablona, nikoli regexy vydávající se za plný YAML parser. `render-workflow` vloží doslovnou důvěryhodnou větev `qa/*` a úplné 40znakové SOURCE SHA. `lint-workflow --strict` porovná celý výsledný YAML s jedinou povolenou šablonou. Cokoli navíc nebo jinak, například `ubuntu-24.04`, `on: [push,pull_request]`, další job/step, nepinovaný checkout, jiná oprávnění, maskovaný komentář, PowerShell proměnná `$cmd`, `bash -lc` nebo Python `script=r"""..."""`, skončí **STOP**.

Varianta B (instalace dalšího Node do WSL) nebyla zvolena: nepomohla by proti falešnému schvalování neznámých workflow a zdvojila by údržbu runtime.

## Výroba jednoho schváleného HOME workflow

Pouze nad důvěryhodným vlastním checkoutem po předběžné kontrole HEAD a GitHub triggerů:

```bat
python tools\home_qa_gate.py render-workflow --branch qa/schvaleny-test --expected-sha PLNY_SOURCE_SHA --output .github\workflows\home-qa-one-shot.yml
python tools\home_qa_gate.py lint-workflow .github\workflows\home-qa-one-shot.yml --strict
```

**UTF-8 na českém Windows:** Používej `--output` místo běžného přesměrování `>`. Generátor zapisuje přímo **UTF-8 bez BOM** i při `PYTHONUTF8=0` a systémovém CP1250, kontroluje přesný povolený název souboru a **odmítne přepsat existující** YAML. Chceš-li zachovat přesměrování `>`, nová verze zapisuje na binární stdout bajty UTF-8, nikoliv ANSI/CP1250. Explicitní `python -X utf8 tools\\home_qa_gate.py render-workflow ...` zůstává kompatibilní. Po vytvoření vždy proveď `lint-workflow --strict`; chyba UTF‑8 je STOP, nikoli důvod vypnout linter. Pokud soubor již existuje, nejprve samostatně ověř jeho původ a aktuální SHA, neodstraňuj jej automaticky.

`PLNY_SOURCE_SHA` musí být doslovných 40 hex znaků skutečně vybraného a schváleného commitu. Recept vynucuje jediný owner-only Windows `self-hosted` job, pouze vlastní `push` do přesné `qa/*` větve, `contents: read`, připnutý checkout bez přetrvávajících přihlašovacích údajů, původní SOURCE SHA a pořadí **lint + testy → Windows quick → řízený WSL launcher**. Soubor se jmenuje přesně `.github/workflows/home-qa-one-shot.yml`. Není přípustné jej ručně rozšiřovat o neověřené kroky.

## Skutečný fail-fast preflight

- Windows `windows-quick`: ověří Windows, Node, Python3, důvěryhodnou událost, přesný checkout SHA; pak provede všechny Node/Python quick testy.
- WSL `wsl-native`: ověří WSL2, Java17 **skutečným spuštěním** `java -version` a `javac -version`, spustitelný Gradle s výstupem **8.10.2**, Python3, Git a přesný SHA. Node v Linuxu nepotřebuje.
- WSL `wsl-jdk-probes`: pouze pět Node-independent JDK/Python kontrol (adresy a Bosch), které pokrývají dva dřívější Windows-service SKIP.
- `wsl-python-node`: zakázané spuštění skončí očekávaným návratovým kódem 2 ještě před dlouhými testy.

Ověření verze není totéž co ověření SHA256 instalovaného Gradle/JDK; původ binárek zůstává odpovědností důvěryhodné domácí infrastruktury.

## Dočasné pozastavení HOME – platné dokud vlastník nerozhodne jinak

**Doložený stav k 16. 11. 2026:** `Zamerovac-Win11-QA` OFFLINE, Windows služba STOP/Disabled a workflow `windows-self-hosted-qa.yml` / `windows-home-apk-release.yml` Disabled. Nejde o povolení spustit cokoliv z níže uvedeného historického postupu: HOME bez nového výslovného schválení neaktivovat, na runneru nic neinstalovat, nestahovat a neměnit systém/práva; nedůvěryhodná PR nikdy na HOME. Jednorázový `render-workflow`/strict lint je jen **podmíněná šablona pro schválenou důvěryhodnou owner-only větev a SHA**, není univerzální ochrana ani příkaz oživit staré workflow. Před případným návratem nové bezpečnostní review, správná větev+SHA, timeout/cancel/unknown a cleanup, GitHub stav a owner GO. Historické QA PASS ≠ současné HOME 4/4.

## Hranice

**Nejde o univerzální GitHub bezpečnostní pravidlo.** Zcela novému workflow, které schválenou šablonu nepoužije, tento skript sám nezabrání ve spuštění. Musí ho zastavit review změn workflows a koordinátor/branch policy. Ani stávající main workflow ani PR #61 nejsou tímto jednoúčelovým linterem automaticky certifikované či upravované.

## Předintegrační bezpečnostní brána – POUZE plán, nic neslučovat

1. **Těsně před integrací** ověř na GitHubu nejnovější `main`, HEAD všech relevantních draft PR a skutečný diff. Při přípravě byl `main` `5411eb04e174c54c6c649084872f31f0d1b421a0`, ale stav může zastarat.
2. **Nepoužívat PR #61 jako merge zdroj.** Aktuální `main` obsahuje novější `.github/workflows/windows-self-hosted-qa.yml`, `.github/workflows/windows-home-apk-release.yml` a `docs/ci-home-runner.md`. Nový kumulativní balík z PR #94→#95→navazujícího UTF-8 PR se má přenést **jen jako tři nové soubory** `tools/home_qa_gate.py`, `tests/test_home_qa_gate.py`, `docs/HOME_QA_PREFLIGHT.md` plus krátké doplnění `AGENTS.md`; žádný historický CI/release YAML ani jeho starší konfigurace.
3. Připrav důvěryhodnou **integrační draft větev z aktuálního main**, ne přepis žádné paralelní větve. Nezávislý kontrolor porovná skutečný výsledný diff, zachování domácích čtyř jobů, `on.push/workflow_dispatch`, owner/main guardů, plně připnutých checkoutů, vypnutého automatického placeného cloudu, release podpisových a verzovacích kontrol a ochrany dat. Neznámé změny = STOP.
4. Teprve po **výslovném souhlasu vlastníka** lze rozhodnout o merge. Na **novém skutečném main SHA** potom zopakuj cílený canonical UTF-8 test/Windows quick/WSL preflight a určenou bezpečnostní regresi hlavního čtyřjobového QA; žádný PASS z historického SHA ani automatický release/APK nepřebírat. Při integraci s pozdější B16 provést zvláštní plnou společnou regresi.
5. Podklady, PASS/FAIL/SKIP/NOT RUN, skutečný zdrojový SHA a nezávislé schválení zapiš do existujícího issue #42. Po skončení odstraň jen jednorázové QA triggery z vlastních větví, zachovej logy. **Nikdy** automaticky nespouštěj placený cloud (limit 12 USD) ani nepřepisuj staršími workflow funkční domácí runner.

Domácí PC Windows11 má pevně 16 GB RAM; WSL2 4GB/2CPU a Gradle nejvýše jeden worker. Žádná placená cloudová VM, APK, emulátor ani vydání. Tato krátká QA testuje preflight, quick a pět WSL JDK scénářů. Kompletní 382 JVM, Chromium/pixely, PDF i fyzický Samsung/Bosch zůstávají pro pozdější společnou regresi **NOT RUN** na aktuálním integrovaném SHA.
