# HOME QA – schválená Windows/WSL pojistka

Řízeno v [issue #42](https://github.com/zaplikj30-ui/Zamerovac-android/issues/42), nezávislý REQUEST FIX [#6754944468](https://github.com/zaplikj30-ui/Zamerovac-android/issues/42#issuecomment-6754944468), opravné zadání [#6755055908](https://github.com/zaplikj30-ui/Zamerovac-android/issues/42#issuecomment-6755055908). Samostatný infrastrukturní kód; Android produkt, PR #61/#92/#93/#94 a main zůstávají nedotčené.

## Problém a zvolená oprava

Ad hoc HOME YAML spouštěl obecné Python unittest ve WSL, kde není Node. Původní `lint-workflow --strict` chybně schvaloval i další nechráněné cloudové joby, PR triggery a skryté Python→WSL příkazy, protože jen hledal správné řetězce v libovolné části souboru. Test-first RED nezávisle ověřil šest těchto příkladů.

**Varianta A (vybrána):** pouze jediná bezpečná, přesně generovaná YAML šablona, nikoli regexy vydávající se za plný YAML parser. `render-workflow` vloží doslovnou důvěryhodnou větev `qa/*` a úplné 40znakové SOURCE SHA. `lint-workflow --strict` porovná celý výsledný YAML s jedinou povolenou šablonou. Cokoli navíc nebo jinak, například `ubuntu-24.04`, `on: [push,pull_request]`, další job/step, nepinovaný checkout, jiná oprávnění, maskovaný komentář, PowerShell proměnná `$cmd`, `bash -lc` nebo Python `script=r"""..."""`, skončí **STOP**.

Varianta B (instalace dalšího Node do WSL) nebyla zvolena: nepomohla by proti falešnému schvalování neznámých workflow a zdvojila by údržbu runtime.

## Výroba jednoho schváleného HOME workflow

Pouze nad důvěryhodným vlastním checkoutem po předběžné kontrole HEAD a GitHub triggerů:

```bat
python tools\home_qa_gate.py render-workflow --branch qa/schvaleny-test --expected-sha PLNY_SOURCE_SHA > .github\workflows\home-qa-one-shot.yml
python tools\home_qa_gate.py lint-workflow .github\workflows\home-qa-one-shot.yml --strict
```

`PLNY_SOURCE_SHA` musí být doslovných 40 hex znaků skutečně vybraného a schváleného commitu. Recept vynucuje jediný owner-only Windows `self-hosted` job, pouze vlastní `push` do přesné `qa/*` větve, `contents: read`, připnutý checkout bez přetrvávajících přihlašovacích údajů, původní SOURCE SHA a pořadí **lint + testy → Windows quick → řízený WSL launcher**. Soubor se jmenuje přesně `.github/workflows/home-qa-one-shot.yml`. Není přípustné jej ručně rozšiřovat o neověřené kroky.

## Skutečný fail-fast preflight

- Windows `windows-quick`: ověří Windows, Node, Python3, důvěryhodnou událost, přesný checkout SHA; pak provede všechny Node/Python quick testy.
- WSL `wsl-native`: ověří WSL2, Java17 **skutečným spuštěním** `java -version` a `javac -version`, spustitelný Gradle s výstupem **8.10.2**, Python3, Git a přesný SHA. Node v Linuxu nepotřebuje.
- WSL `wsl-jdk-probes`: pouze pět Node-independent JDK/Python kontrol (adresy a Bosch), které pokrývají dva dřívější Windows-service SKIP.
- `wsl-python-node`: zakázané spuštění skončí očekávaným návratovým kódem 2 ještě před dlouhými testy.

Ověření verze není totéž co ověření SHA256 instalovaného Gradle/JDK; původ binárek zůstává odpovědností důvěryhodné domácí infrastruktury.

## Hranice

**Nejde o univerzální GitHub bezpečnostní pravidlo.** Zcela novému workflow, které schválenou šablonu nepoužije, tento skript sám nezabrání ve spuštění. Musí ho zastavit review změn workflows a koordinátor/branch policy. Ani stávající main workflow ani PR #61 nejsou tímto jednoúčelovým linterem automaticky certifikované či upravované.

Domácí PC Windows11 má pevně 16 GB RAM; WSL2 4GB/2CPU a Gradle nejvýše jeden worker. Žádná placená cloudová VM, APK, emulátor ani vydání. Tato krátká QA testuje preflight, quick a pět WSL JDK scénářů. Kompletní 382 JVM, Chromium/pixely, PDF i fyzický Samsung/Bosch zůstávají pro pozdější společnou regresi **NOT RUN** na aktuálním integrovaném SHA.
