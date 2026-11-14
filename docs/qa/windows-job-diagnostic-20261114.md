# Časný Windows BLOCKED: srovnání přímé a supervised cesty

**Výsledek autorské analýzy:** konkrétní příčina Windows jobu
[132286044053 / run43542503124](https://github.com/zaplikj30-ui/Zamerovac-android/actions/runs/43542503124/job/132286044053)
**zůstává NEPROKÁZANÁ / BLOCKED**. Původní log neobsahuje fázi selhání ani native
error code. Tento balík prokazatelně opravuje ztrátu této diagnostiky; netvrdí
opravu dosud neidentifikované Windows chyby. Žádná náhrada Job Objects, framework,
dependency instalace, workflow/marker nebo Windows změna.

Výchozí přesný QA127 SHA `6f98ceffff50d337f7c2999fed0e0878d20a582e`; samostatná
větev `qa/windows-job-diagnostic-20261114`, nový draft PR proti PR127. PR128 PREP
`03693168bc6eecd6d073f29c991ef2a210a385f0`, RUN
`7f039d4044a55bcdb627144df38ace1cd749a3da`, produkt PR121
`ae3b4df53c25557f28b4a25ccb65adc2abdff639` se nemění. Koordinace:
[#6869828302](https://github.com/zaplikj30-ui/Zamerovac-android/issues/42#issuecomment-6869828302),
[srovnání historie](https://github.com/zaplikj30-ui/Zamerovac-android/issues/42#issuecomment-6869948093),
[ověření hypotéz Claude](https://github.com/zaplikj30-ui/Zamerovac-android/issues/42#issuecomment-6870083493).

## Co je prokázáno

| Hranice | Dříve PR126 / run43524071686 | Nyní PR128 / run43542503124 |
| --- | --- | --- |
| Account, pinned checkout, SHA/clean | PASS | PASS; Node preflight a Python3.13.17 dostupné |
| Spuštění | CMD přímo `node --test --test-reporter=tap tests/home_qa_integrity.js` | CMD → JS gate → JS client → Python owner → Windows JobObject → JS worker → stejné `node --test` |
| Původních15 testů | 15 individuálních `ok`; formální souhrnná brána FAIL | Jednotlivé výsledky NOT VERIFIED, žádné dochované validní summary |
| Backend/supervisor | V repozitáři přítomen, ale touto přímou cestou se nepoužil | Nově součást supervised cesty; dosažení backendu není doloženo, jeho zdroj byl stejný |
| Výsledek | FINDSTR souhrn mismatch; původní summary bajty nedochovány | Výchozí `FIXTURE_GATE_BLOCKED`; scope cleanup/worker/owner=false, temporaryFilesRemoved=true |

`tests/home_qa_integrity.js` má v obou QA SHA stejný Git blob
`275a40f9ccb9fd61bd20f5e1ea42ac449b4b927c`. Samotné testy se nezměnily.
Stejné byly i JobObject a Python supervisor; nová je jejich aktivní integrace,
JS gate/worker a upravený klient. Nelze z toho vyvodit ani regresi testů, ani
nefunkčnost technologie Job Objects. Backend dřívějších15 `ok` neověřovalo.

Od vypsání Python3.13.17 v01:46:57.4675 UTC k BLOCKED v01:46:57.9672 uplynulo
přibližně0.5s. To podporuje hypotézu časného start/protocol/scope problému,
**nedokazuje konkrétní příčinu**. Checkout síťový retry už skončil PASS.
False v `evaluateTap(undefined)` neprokazuje skutečný nenulový stderr ani15 FAIL.
`cleanupVerified=false` neprokazuje živé potomky. `temporaryFilesRemoved=true`
znamená úspěšné odstranění vlastní složky **nebo že složka ještě nevznikla**.

## Porovnání s oficiálním kontraktem

| Zdroj | Kontrakt a skutečný kód |
| --- | --- |
| [Microsoft Job Objects](https://learn.microsoft.com/en-us/windows/win32/procthread/job-objects) | Job řídí skupinu procesů; děti se standardně dědí. Stávající kód používá private Job s KILL_ON_JOB_CLOSE, bez BREAKAWAY. Zachováno. |
| [CreateProcessW](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-createprocessw) | Zapisovatelný command buffer, STARTUPINFOEX a extended flag; kód už používá create_unicode_buffer, suspended start, inherited env a původní flag0x08080004. Nic z toho nechybí a nemění se. |
| [UpdateProcThreadAttribute](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-updateprocthreadattribute) | Omezený seznam děděných handlů vyžaduje inheritable handles a bInheritHandles. Kód už má get_osfhandle, set_handle_inheritable, HANDLE_LIST a True. Nejde o doloženou absenci. |
| [AssignProcessToJobObject](https://learn.microsoft.com/en-us/windows/win32/api/jobapi2/nf-jobapi2-assignprocesstojobobject), [Nested Jobs](https://learn.microsoft.com/en-us/windows/win32/procthread/nested-jobs) | Job musí být přiřazen před resume; případné nested/UI/session/limit odmítnutí potřebuje skutečný error code. Kód přiřazuje suspended child a teprve pak resume; žádný bypass/breakaway. Nedoložený nested problém se neopravuje. |
| [TerminateJobObject](https://learn.microsoft.com/en-us/windows/win32/api/jobapi2/nf-jobapi2-terminatejobobject) | Ukončí i přidružené child jobs. Kód potomky ukončuje tímto API, nikoli náhradním PID sweepem či Process.Kill. |
| [QueryInformationJobObject](https://learn.microsoft.com/en-us/windows/win32/api/jobapi2/nf-jobapi2-queryinformationjobobject), [Basic Accounting](https://learn.microsoft.com/en-us/windows/win32/api/winnt/ns-winnt-jobobject_basic_accounting_information) | Používá class1 a ActiveProcesses==0. Polling/deadline už existuje, nejde jen o jediné okamžité čtení. Bez změny algoritmu. |
| [GetLastError](https://learn.microsoft.com/en-us/windows/win32/api/errhandlingapi/nf-errhandlingapi-getlasterror) | Chybu získat po neúspěšném API před dalšími voláními. Nová diagnostika ji uchová dříve, než cleanup přepíše thread-local hodnotu; logická chyba žádný stale code nedostane. |
| [Node test isolation](https://nodejs.org/api/cli.html#--test-isolationmode), [Node26.13 spawnSync](https://nodejs.org/download/release/v26.13.0/docs/api/child_process.html#child_processspawnsynccommand-args-options) | Výchozí test-file child zůstává v supervised stromu. Přímý spawnSync timeout nedokládá celý strom; owner/scope se proto neodstraňuje ani nenahrazuje. |

Python platform a JS platform už jsou `win32`. Env je kopií původního env plus
vlastní TEMP/TMP/TMPDIR; workflow měl pevný existující Python executable.
Netvrdí se chybějící PATH, Unicode buffer, platforma, handle inheritance nebo
polling. Neověřené hypotézy nejsou opravami root cause.

## Jedna minimální oprava diagnostické mezery

Původní gate zamlčel interní error a navenek vydal stejné false booleany pro
odlišné fáze. Nová diagnostika putuje po stejné cestě jako původní výsledek:

1. `ScopeError` nese jen volitelný pevný stage a native Win32 code. Na hranici
   neúspěšných existujících API se kód zachytí okamžitě. Žádný API postup,
   security flag, permission, suspend/assign/resume nebo cleanup podmínka se
   nemění. U logických guardů (elevated/account/image) je Win32 code null.
2. Supervisor uloží tuto dvojici do interního result frame; startup, worker,
   cleanup a close mají pevné fallback fáze. Původní status/reason/error a
   cleanup rozhodování zůstává. První zachycená chyba se při pozdějším čtení
   chybějícího verdictu neztratí.
3. Klient ověří identitu frame a znovu sestaví pouze whitelist diagnostiku.
   Spawn failure, malformed/missing protocol a overflow mají vlastní fázi.
   Ready/result LF i Windows CRLF se regresně ověřují. Raw stderr se neparsuje.
4. Gate při BLOCKED přidá jediný řádek `FIXTURE_DIAGNOSTIC` s přesně dvěma poli
   `stage` a `win32Error`. PASS log zůstává původní jediný konstantní marker.

Sdílený `qa-process-diagnostic.json` je jen seznam povolených identifikátorů,
žádný framework nebo externí dependency. Oba jazyky z něho vytvoří whitelist.
Win32 code se přijímá pouze u native API stage jako skutečný uint32 integer;
string, bool, záporná/out-of-range hodnota nebo stale kód logického guardu
znamená null. Žádná raw exception, message, stderr, TAP, účet, token, PID,
osobní cesta či neznámý klíč se do veřejného řádku nekopíruje. Neznámá fáze
zůstává `unknown`, nikoli PASS.

Například **injektovaný model**, nikoli zjištění domácího běhu:

```text
FIXTURE_DIAGNOSTIC {"stage":"AssignProcessToJobObject","win32Error":5}
```

Tato dvojice sama neřeší oprávnění ani nepotvrzuje nulu procesů. Všechny původní
fail-closed podmínky, cleanupVerified/remaining0, token/platform/exit kontroly,
cancel, TEMP cleanup, SHA, non-elevated ZamerovacQA a izolace zůstávají povinné.

## Test-first, audit a hranice tvrzení

- Nejprve nové JS testy0 PASS/2 FAIL a Python0 PASS/3 ERROR: diagnostika chyběla.
- Nová JS sada3 PASS: whitelist/redakce, chyby transportu + LF/CRLF, celý skutečný
  Linux Node→Python→gate řetězec s **injektovanou** známou chybou. Přesný starý
  gate6f98 ji skryl, nový ji předal jako stage/code a oba vrátily exit1/BLOCKED.
- Nová Python sada5 PASS: typované metadata, neparsování raw textu, validace,
  stale logical error a18 Win32 failure injections přes skutečný ctypes/control
  flow s mocked API včetně Close a cleanup přepisujícího LastError. **Modely,
  nikoli nativní Windows/ABI/runtime důkaz.**
- Cílená společná JS regrese30 PASS/0 FAIL/0 SKIP (transport, gate, TAP, procesní
  client), původní Win32 Job kontrakty5 PASS. Plná finální regrese a přesný SHA,
  environment a SHA256 logů jsou v autorském předání nového PR/#42.
- Kritický audit celého souvisejícího mechanismu: payload15, TAP parser/formatter,
  CMD, owner identity, zero descendants, timeout/cancel/overflow, privátní TEMP
  a raw-log ochrany se nepřepisují. Zůstávají skutečné Linux scénáře normal,
  FAIL, crash/exit-error, timeout, cancel, detached child/grandchild, EOF a
  ineffective cleanup; outside proces/sentinel beze změny. Nová diagnostika
  chybu neautorizuje ani nepřeznačí na PASS.

**Autorský závěr:** prokázána a otestována ztráta vysvětlení v nové vrstvě;
skutečný Windows root cause NEPROKÁZÁN. Dřívější summary problém není důkazem
této nové časné chyby. Nelze tvrdit15 FAIL, že testy nezačaly, JobObject bug,
živé potomky, jiná PC práva nebo konkrétní WinError. Bez native dat se neprovádí
žádná experimentální funkční oprava backendu.

Další krok po dokončení: nezávislý Kontrolor40 nad celou dotčenou cestou a
redakcí. Až po jeho review a novém výslovném souhlasu vlastníka případná jediná
nová SHA-pinned owner-only Windows diagnostika přes původní CMD entry point se
stejnými15 testy. Bez nového smoke workloadu, instalace, ACL změn, breakaway,
Chromia, APK nebo merge. Staré PR127/128/RUN se nepřepisují či nereaktivují.
Native Windows/CMD/JobObject/GitHub job runtime **NOT RUN** v tomto balíku.

Při případném příštím BLOCKED se uloží pouze původní whitelist booleany a nová
stage/code dvojice, nikoli interní raw soubory. Neznámý/unavailable result,
Python startup před result frame nebo nečekaný transport zůstane bezpečně
BLOCKED s označením vrstvy; ani diagnostika nemůže garantovat root cause bez
dostupného native výsledku. Stávající limity násilného zániku hosta/ownera a
zbytkového privátního TEMP po hard-exitu rodiče nadále platí.
