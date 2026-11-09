# HOME QA – bezpečné jednotné spuštění Windows/WSL (bez APK)

Vlastník: koordinace issue [#42](https://github.com/zaplikj30-ui/Zamerovac-android/issues/42), zadání [#6754426160](https://github.com/zaplikj30-ui/Zamerovac-android/issues/42#issuecomment-6754426160). Samostatná malá infrastruktura; produkční Android, PR #61 a B16 PR #92/#93 zůstávají nedotčené.

## Proč a kterou variantu používáme

**Varianta A (zvolena):** jeden sdílený standard-library spouštěč `tools/home_qa_gate.py`, při nových jednorázových workflow jeho přísná kontrola před dlouhými testy. `windows-quick` spouští **Node i všechny Python unittest** na Windows, `wsl-native` kontroluje **JDK17, Python3 a připnutý Gradle** ve WSL, aniž tam vyžaduje Node. `wsl-jdk-probes` ve WSL spustí jen dvě přesně povolené skupiny testů adres a Bosch, které **Node nepotřebují**. Vše na stejném a předem ověřeném skutečném git SOURCE SHA.

**Varianta B (nezvolena):** instalovat druhý Node do WSL. Sama nebrání tomu, aby někdo zase sestavil špatné jednorázové QA workflow; přidává druhou závislost a její aktualizace. Node již běží na domácím Windows 11, takže B nepřináší měřitelnou výhodu.

Dřívější selhání [#42713844748](https://github.com/zaplikj30-ui/Zamerovac-android/actions/runs/42713844748) a [#42718615743](https://github.com/zaplikj30-ui/Zamerovac-android/actions/runs/42718615743): Java cíleně PASS, **celý běh FAIL** – `python3 -m unittest discover` ve WSL zavolal chybějící `node`. Nejde o ztrátu dat aplikace, ale o závažný problém pravdivosti a ceny testovací evidence.

## Vyžadovaný postup pro nové jednorázové HOME QA

1. Pouze důvěryhodná **owner-controlled** větev `qa/*`, pouze `push` od `zaplikj30-ui`, nikdy `pull_request`, fork ani cloud. Použij `runs-on: [self-hosted, Windows, X64, zamerovac-qa]`, `permissions: contents: read`, `persist-credentials: false` a `actions/checkout@11d5960a326750d5838078e36cf38b85af677262`. Sestavení a vydání APK nepatří do této práce.
2. Checkout aplikace musí mít **doslovný úplný 40znakový SOURCE SHA**; source refs nejsou libovolné vstupy workflow. Druhý read-only checkout konkrétního vlastního QA workflow může vynechat `ref`, čímž GitHub použije přesný trusted `github.sha` aktuálního push, pouze pro přečtení vlastního YAML.
3. Ještě před jakýmkoli Gradle testem na Windows spusť:
   ```bat
   python tools\home_qa_gate.py lint-workflow ..\runner-recipe\.github\workflows\nazev-jednorazoveho.yml --strict
   python tools\home_qa_gate.py windows-quick --expected-sha PLNE_SOURCE_SHA --root . --check-only
   ```
   Je-li splněno, rychlou kompletní Node/Python část spustíš **jediným standardním příkazem**:
   ```bat
   python tools\home_qa_gate.py windows-quick --expected-sha PLNE_SOURCE_SHA --root .
   ```
   Nevyvolávej potom stejný `local-qa.cjs --quick` podruhé.
4. Před každým delším WSL JDK/Gradle během ze skutečného checkoutu:
   ```bash
   export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
   export PATH="$JAVA_HOME/bin:$PATH"
   python3 tools/home_qa_gate.py wsl-native --expected-sha PLNE_SOURCE_SHA --root . --gradle /opt/gradle-8.10.2/bin/gradle
   # teprve pak GRADLE --offline --no-daemon --max-workers=1 ...
   ```
   WSL Python testy, které volají `node`, **nikdy** nesmějí běžet pomocí `python3 -m unittest discover`. Pokud je potřeba potvrdit dříve Windows-service SKIP kvůli JDK PATH:
   ```bash
   python3 tools/home_qa_gate.py wsl-jdk-probes --expected-sha PLNE_SOURCE_SHA --root . --gradle /opt/gradle-8.10.2/bin/gradle
   ```
5. Linter odmítá chybějící předběžné kontroly, špatně umístěný WSL unittest, chybné/nekonzistentní source SHA, nezabezpečený checkout, placený cloud a PR události **před** 382 případy Robolectric. Negativní i pozitivní mikrotesty jsou v `tests/test_home_qa_gate.py` a jsou zahrnuty do obvyklého Python quick.
6. Před commitem/testovací akcí znovu ověř skutečný HEAD, triggery, trust gate a dostupný měsíční limit. Domácí PC má **pevně 16 GB RAM**; testuj postupně s 1 Gradle workerem. Důkaz vždy uvádí reálný `TESTED_SOURCE_SHA`, Windows/WSL prostředí, PASS/FAIL/SKIP/NOT RUN. Nezacházej s `SKIP` jako `PASS`.

## Rozsah ochrany

Pojistka je vykonatelná, ale **není univerzální bezpečnostní bránou GitHubu**: zcela nové workflow, které úmyslně nepoužije sdílený entrypoint ani quick testy, nelze zakázat jen Python skriptem v repozitáři. Nezávislá kontrola PR a pravidla schvalování workflow jsou stále nutná. Původní `.github/workflows/windows-self-hosted-qa.yml` už umí správné oddělení a nebyl kvůli této opravě přepsán; PR #61 si drží svou infrastrukturu a testovací/sestavovací rozsah.
