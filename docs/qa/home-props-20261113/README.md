# PR #122 – připravený bezpečný QA runner, HOME dosud BLOCKED

Vlastní větev `qa/home-props-security-20261113`, base/main
`8d05d2dd77c4a99f8ad64191c97d37ee3c151e3b`. Aktuální finální SHA a čerstvé
výsledky jsou v popisu PR a issue #42. Předchozí `073d2dd...` a jeho 48/121 PASS
jsou historická etapa, nikoli výsledek tohoto dokončeného balíku.

[Zadání/schválení](https://github.com/zaplikj30-ui/Zamerovac-android/issues/42#issuecomment-6853678011),
[security review](https://github.com/zaplikj30-ui/Zamerovac-android/pull/122#pullrequestreview-5892180049),
[korekce závažnosti](https://github.com/zaplikj30-ui/Zamerovac-android/pull/122#issuecomment-6855199818).
Nové přímé zadání vlastníka schválilo dokončení souvisejícího SOURCE/test balíku;
HOME spuštění, Actions, merge, release a APK nadále neschválilo.

## Co runner skutečně vynucuje

- **Binárka před startem:** sdílený `qa-browser-profiles.json` obsahuje přesnou
  absolutní cestu, SHA256 a formát skutečného ELF/PE obrazu. Wrapper, jiná cesta,
  odkaz/junction, hardlink nebo jiné bajty znamenají BLOCKED před launch.
  Windows cesta/hash jsou převzaty z autentického staršího read-only logu jobu
  131083537605 / běhu 43189084331, nikoli z odhadu nebo nového HOME běhu.
  Linux profil je přímo `/usr/lib/chromium/chromium`, nikoli shell `/usr/bin/chromium`.
- Python supervisor navíc drží binárku po celou dobu pokusu: na Windows native
  handle s FILE_SHARE_READ a držený řetězec adresářů bez DELETE sharing, který
  zakazuje záměnu souboru i přesměrování přejmenováním rodiče; na Linuxu ověřuje
  existující instalaci nezapisovatelnou testovacím účtem a drží O_NOFOLLOW fd.
  Očekávaný hash nelze přepsat prostředím. Nic se neinstaluje ani nepřepisuje.
- **Sandbox:** pouze `chromiumSandbox:true`, žádné vlastní flagy či fallback.
  CDP odmítá vypínače sandboxu a `chrome://sandbox` musí do 7 s potvrdit platformní
  diagnostiku. Linux vyžaduje Namespace/SUID, PID/network namespaces a Seccomp/TSYNC;
  Windows renderer PID, Lockdown a Untrusted integritu. Browser close je omezen
  na 2 s. Vše běží uvnitř OS scope; zavěšený launch/close nebo Node nemůže udělit PASS.
- **Úplnost:** `qa-pr121-manifest.json` má přesných **23 sad / 96 jmen** z produktu
  `ae3b4df53c25557f28b4a25ccb65adc2abdff639`, porovnaných i se skutečnou registrací
  všech případů, a SHA256 66 skutečně používaných zdrojových souborů. Všechny případy
  musí mít `passed`, správné pořadí/identitu, source/validator SHA a nový run token.
  Duplicity, extra/missing/renamed/stale/filtered/partial report ani exit0 bez důkazů
  nemohou být PASS. `ZAMEROVAC_CASES` je v complete/smoke režimu zakázán i jako prázdná
  proměnná. Samostatný vývojový filtr harness označí PARTIAL.
- **Oddělený produkt:** runner z QA checkoutu čte přesný čistý PR121 checkout přes
  `ZAMEROVAC_SOURCE_ROOT`. Kontroluje skutečné bajty i při assume-unchanged a zakazuje
  extra ignorované soubory v assets/E2E. Zkopíruje E2E do vlastního scratch prostoru
  a tam nahradí pouze QA harness/policy. Produktový původní harness se nespouští
  ani nepřepisuje. Java WebContentPolicy, kterou jedna sada čte, je také připnutá.
- **Procesy přímo v runneru:** preflight i každá sada používají stejnou cestu
  JS client → Python supervisor → Node/Chromium. Linux subreaper sleduje i nové SID,
  ověřuje živou ancestry/starttime/UID a drží pidfds; nepoužívá numerický PID kill
  ani cizí procesové skupiny. Windows vytváří worker suspended a před ResumeThread
  jej přiřadí do vlastního Job Object s KILL_ON_JOB_CLOSE a bez breakaway. Dědí jen
  explicitní log/NUL handles. Native token musí být neelevovaný `ZamerovacQA`.
  Procesy se řídí vlastními handles; Job musí hlásit active-process count 0.
- Timeout, EOF, heartbeat loss, zrušení, Node crash i normální konec vždy vedou
  přes úklid celého vlastního stromu. Chyba primary/emergency/handle cleanupu je
  BLOCKED. Živé testy obsahují skutečné detached potomky, neúčinný primary cleanup,
  cizí kontrolní proces a sentinel. Zombie znamená nedokončený úklid.
- Profily/cache/temp Chromium jsou uvnitř vlastního nového run scratch; mimo něj
  se nic nečistí. Scratch se odstraní až při prokázaném process cleanupu. Jinak se
  zachová k diagnostice. Linux core dump limit se mění jen pro vlastní proces a děti.
- Celkový PASS se zapisuje teprve po poslední kontrole source/validator bajtů,
  uzavření serveru a úklidu. Průběžný report není finalizovaný a nemůže být PASS.
  V Actions se zachovává owner + triggering_actor, přesný QA ref/SHA a attempt1.
  Výsledky nadále mohou ležet pod `LOCALAPPDATA/Zamerovac-QA/browser/run-*`.

## Dostupná a nedostupná ověření

Nové `home_qa_integrity.js`, rozšířené sandbox testy, `qa_process_client.js` a
Python procesové/identity/Windows-contract testy navazují na celou původní sadu.
Po poslední změně musí autor znovu provést všechny JS/Python testy na čistém SHA.
Úplné aktuální výsledky, prostředí a logy jsou v PR. Pozitivní fixture dokazují
rozhodování guardů; nenahrazují živý browser ani Windows kernelový běh.

Původní procesová sonda zůstala zachována a opravil se atomický zápis READY JSON.
Nový `home_qa_wsl_bridge.py` připravuje budoucí skutečnou Windows→WSL pipe zkoušku:
existující default nonroot účet, konkrétní QA SHA/bajty, explicitní čistě Python
procesový test soubor (nikoli WSL unittest discovery), normal/EOF/heartbeat/timeout/
cancel/invalid a následná read-only kontrola PID v /proc. Na Linuxu odmítá volání
před jakýmkoli WSL procesem. Nikdy nevolá Gradle, sudo, root user ani WSL shutdown.

**Windows Job, token, file-sharing lock a Windows→WSL transport nyní NOT RUN.**
API/protokol fixture na Linuxu nejsou Windows runtime PASS. Linux sonda ani Node
fixture nejsou Chromium 23/96 PASS. Je-li skutečný bezpečný browser v managed Linuxu
nedostupný, jeho raw exit/log a přesný BLOCKED se zachovají; ochrana se nevypíná.

## Jeden postup pro budoucí výslovně schválený HOME test

Toto je připravený payload, **nikoli souhlas jej spustit**. Po jediné nezávislé
SOURCE kontrole musí vlastník zvlášť schválit konkrétní QA SHA, product SHA a
owner-only způsob provedení. Použít jen již existující důvěryhodný execution channel
pod neelevovaným ZamerovacQA; není-li takový schválený kanál dostupný, zůstat BLOCKED.
Neotvírat interaktivní přihlášení, neměnit service/ACL, neinstalovat závislosti a
nepoužívat obecný main browser workflow, který dosud obsahuje instalaci.

1. V již schváleném kontextu připravit dva **read-only checkouty**, `gate` = finální
   nezávisle schválený QA SHA z tohoto PR, `source` = přesně produkt SHA uvedený výše.
   Ověřit jejich HEAD a čistotu. Checkouts musí mít kanonické bajty bez CRLF konverze;
   použít pouze pro tento checkout `git -c core.autocrlf=false`, nikoli změnu globální
   Git/PC konfigurace. Jakýkoli rozdíl bajtů je BLOCKED. Žádný checkout nebezpečného PR/forku, re-run či cizí
   větev. V Actions pouze owner push do přesné QA větve, attempt1; payload nedává
   oprávnění vyrobit/pushnout nové YAML. Případný nový workflow musí samostatně
   splnit generátor/strict lint pravidla a dostat vlastní schválení před spuštěním.
2. Použít **již existující** Python3, Node, MinGit a Playwright1.62.1, existující
   schválený Chromium a WSL distro. Chybějící offline dependency/binárka znamená STOP;
   žádné npm/npx/pip/install/změny cache. PATH/NODE_PATH jen dočasně pro tento proces
   z předem ověřených existujících cest. Nastavit:

   ```bat
   set "ZAMEROVAC_SOURCE_ROOT=%GITHUB_WORKSPACE%\source"
   set "ZAMEROVAC_EXPECTED_QA_SHA=PLNY_NEZAVISLE_SCHVALENY_FINALNI_QA_SHA"
   set "CHROMIUM_PATH=C:\actions-runner\tools\ms-playwright\chromium_headless_shell-1234\chrome-headless-shell-win64\chrome-headless-shell.exe"
   set "LOCALAPPDATA=%RUNNER_TEMP%\zamerovac-owned-qa-evidence"
   cd /d "%GITHUB_WORKSPACE%\gate"
   ```

   Konkrétní finální QA SHA a tentýž payload s doslovnou hodnotou jsou v konečném
   předání PR; hodnotu nelze odvodit z nedůvěryhodného aktuálního HEAD.
3. Sériově spustit Windows quick regresi všech `tests/*.js` a `test_*.py`; zaznamenat
   i platformní SKIP. Potom `node tools/local-browser-qa.cjs --self-test` a
   `node tools/local-browser-qa.cjs --all`. Každý nenulový exit/BLOCKED znamená STOP.
   Full browser PASS vyžaduje nový finalizovaný report **23/96**, správný OS/source/
   validator/run token (a případný Actions runID/attempt), binary a cleanup evidence;
   žádný filtr či dědění starých důkazů. Při sandbox/Job nekompatibilitě nic nepovolovat.
4. Po browser části zavolat přesně
   `python tools/home_qa_wsl_bridge.py --run-home --expected-qa-sha STEJNY_SCHVALENY_QA_SHA`.
   Zachovat stdout/PID důkazy i Windows výsledky; žádné JVM testy, kopírování klientských
   souborů či oprava WSL/cache. Neúspěch = BLOCKED. Na 16 GB běžet sériově, bez dalšího
   browser/Gradle/emulátoru. Výsledky společně nezávisle posoudit v PR a issue #42.

Ani tento úspěšný neprodukční HOME test by nebyl HOME 4/4, JVM513 či release PASS.
Read-only/offline JDK/Gradle/SDK cache a původní 511+2 raw JVM pravidla se musí ověřit
v samostatně schválené finální integraci; dvě skutečné #88 FAIL se nesmějí přebarvit.

## Zachované hranice a historie

`app/**`, data/geometrie, média, ukládání/archivy/sync, dvě #88 diagnostiky, podpis,
package/version a všech sedm workflow jsou byte-exact proti base beze změny.
PR #121/#117/#119 ani jejich větve se nepřepisují. Nápověda a changelog aplikace se
nemění, protože nejde o produktovou změnu. Žádný merge, release, APK ani Actions.

Historické RED a průběžné FAIL jsou v `evidence/`; počáteční procesový RED znamenal
chybějící sondu, nikoli prokázaný únik starého #117. V tomto cyklu jsou navíc zachovány
RED pro manifest/filter/binárku, stale ancestry při PID reuse, publikaci neúplného
READY a skutečný owner SIGABRT před opravou daemon buffered stdin. Skutečný Node crash
je testován. Násilné SIGKILL Linux supervisoru/OS power-loss není zárukou pidfd backendu;
Windows kernelový Job má kill-on-close, ale jeho skutečný běh čeká na povolení HOME.
