# Vyhodnocení Windows fixture: jeden dokončený SOURCE balík

Zadání [Koordinátora 27](https://github.com/zaplikj30-ui/Zamerovac-android/pull/126#issuecomment-6867221968)
a následné upřesnění vlastníka: ověřit celý řetězec Node → exit code → 15 výsledků
→ souhrny → stav jobu. Výchozí schválený snapshot je PR126
`9fb10bde56a22d34b9e1a6570f42c815fa869b94`, jeho QA rodič PR124
`65a3e4f1981c1f2a1eb96f39e128a4fcc6190729`, produkt PR121
`ae3b4df53c25557f28b4a25ccb65adc2abdff639`. Nová samostatná větev
`qa/windows-tap-evaluation-20261114`, oddělený worktree a draft PR.
Žádný zápis do původních PR/RUN větví a žádná aktivace.

## Aktuální dokončení QA127-SEC-01 a audit celého mechanismu

Navazuje na [REQUEST FIX Kontrolora40](https://github.com/zaplikj30-ui/Zamerovac-android/pull/127#pullrequestreview-5899645492)
a [rozhodnutí koordinátora](https://github.com/zaplikj30-ui/Zamerovac-android/issues/42#issuecomment-6867817312).
Poslední upřesnění vlastníka vyžaduje vlastní kritický audit **celého souvisejícího
mechanismu** a následnou nezávislou kontrolu Kontrolora40 rovněž celého mechanismu.
Původní autorův SHA `b2371d81e412b6e0e1b7aead1c8a8f046a6abdb8` neobsahoval
procesní scope; jeho 54 PASS nebylo důkazem tree cleanupu. Finální nový SHA a
regrese jsou v aktuálním autorském předání tohoto stejného PR127.

**Zvolené minimální řešení:** zachovat původní TAP parser/CMD a přesunout původní
Node testovací spuštění do `qa-fixture-worker.cjs`. Veřejná `qa-fixture-gate.cjs`
ho spustí přes existující `ownedWorker` → `qa_process_supervisor.py` → existující
Linux pidfd/subreaper nebo Windows private JobObject. Scope tak obsahuje worker,
`node --test`, jeho izolovaný test-file proces i skutečné Git/ostatní potomky.
`--test-isolation=none` nebylo zvoleno: odstranilo by jen jeden child a nedokázalo
cleanup Git potomků. Žádný nový procesní framework nebo změna OS práv.

Veřejný PASS se uvolní až po současném splnění: přesný worker PASS marker,
normální worker exit0, autentizovaný token/platform/event supervisoru, supervisor
exit0 bez signálu/chyby, `cleanupVerified=true`, `remainingProcesses=0`, úspěšné
smazání soukromé složky a žádné zrušení. Vyhodnocení TAP a whitelist jsou proti
`b2371d81` **bajtově beze změny**, stejně CMD adaptér, oba Chromium profily,
symlink/junction/hardlink/SHA256/TOCTOU, sandbox a implementace OS scopes.

SIGINT/SIGTERM/SIGHUP předají tokened cancel a čekají na owner cleanup; supervisor
se nezabíjí jako timeout strategie. Nezávislý supervisor má 120s deadline i když
workerův `spawnSync` uvízne na procesu ignorujícím SIGTERM. Kratší deadline
250–120000ms slouží pouze exportovanému API pro skutečné procesní testy; CLI
nepřijímá žádný parametr a vždy používá 120s. Interní worker navíc odmítne běh
bez odpovídajícího parent/scope prostředí. Tento guard proti náhodnému přímému
spuštění nenahrazuje skutečný OS scope ani finální cleanup důkaz.

Raw TAP zůstává pouze v omezené paměti workeru. Existující supervisor potřebuje
log handle: do nové soukromé složky proto zapisuje pouze workerův redigovaný
verdikt a vlastní config; parent čte maximálně16KiB ověřeného pravidelného
single-link souboru bez symlinku a s kontrolou fd/name identity a stability.
Nečekaný obsah, panic/OS metadata či chyba čtení se nikdy nepřenášejí do logu.
Per-child TEMP/TMP/TMPDIR ukazují do podadresáře téže soukromé složky, takže se
po timeoutu odstraní i rozpracované syntetické fixture. Globální env, oprávnění
nebo produktové soubory se nemění. Při chybě/no-op smazání nelze vrátit PASS.

BLOCKED zachovává původní whitelist TAP diagnostiku a přidává jen pevný
`FIXTURE_SCOPE_BLOCKED` s booleany `cleanupVerified/temporaryFilesRemoved/
workerPassed/ownerSucceeded/cancelled`. Žádná PID, token, skutečná cesta, raw
TAP, stderr ani chybová zpráva se nevypisuje. Při chybě scope může být workerův
TAP validní, ale výsledný job musí být FAIL.

**Další opravený nález vlastního auditu:** `qa-process-client.cjs` po překročení
1MiB stdout jen poslal CANCEL, dále přidával data a poslední validní PASS řádek
mohl výsledek znovu označit PASS. Counterexample nad skutečným starým JS kódem
s modelovanými streamy prokázal **before=PASS / after=BLOCKED**, v obou případech
jeden cancel. Nyní je overflow nevratný BLOCKED, další data se neakumulují,
client stále čeká na close supervisoru/cleanup. Také stderr limit16k platí i
pro jeden oversized chunk. Jde o úzkou opravu existujícího klienta, ne přepis
jeho protokolu; právě proto se opakuje i regrese ostatních jeho konzumentů.

### Kritický audit celého řetězce – konkrétní důkazy

| Oblast / možnost falešného PASS | Ověření a výsledek |
| --- | --- |
| Spuštění / izolovaný Node child / Git descendants | Pevný worker command, stejný Node executable, původní pevná sada bez shellu; celá větev v existujícím scope. Skutečné Node test-file + detached child/grandchild procesy na Linuxu. |
| Normal / FAIL / timeout / TAP overflow / cancel | Pět skutečných procesních případů; po gate return žádný známý owned PID/zombie, inner cleanup true, temp prázdný, mimo scope živý neighbour a sentinel beze změny. Overflow musí skončit chybou workeru, nikoli být maskován testovým timeoutem. |
| Ztráta rodiče / EOF | Gate parent po vytvoření stromu ihned skončí. Samostatný witness před startem vnějšího safety-cleanupu ověří ukončený vnitřní owner a zmizení jeho workloadu; pak vnější testový owner reapne i orphan zombie. Žádný veřejný PASS. |
| Neúčinný primární cleanup | Ve skutečné izolované kopii scope se injektuje cleanup no-op. Ověření surviving procesů odmítne PASS, emergency close je odstraní; finální gate zůstává BLOCKED i po úspěšném recovery. |
| Chybějící či cizí proof / zbývající procesy | Modely false/missing cleanup, remaining1, jiný token/platform, error/signal/exit/status/reason; ani přesný PASS marker nestačí. |
| Dočasné soubory / redakce | Skutečný zanechaný testový soubor na worker TEMP se uklidí; modely neúspěšného a no-op rm, hardlink verdiktu na outside sentinel, oversized/špatný report a soukromé sentinel zprávy ⇒ BLOCKED bez úniku dat. |
| Stream limit supervisoru | Reprodukční model before PASS → after BLOCKED, cancel jednou, bounded stdout/stderr. Skutečný raw TAP overflow má vlastní procesní test výše. |
| TAP | Původních14 scénářů zachováno, včetně CRLF/LF/BOM, čtyř unikátních counts, 15 identit, FAIL/SKIP/TODO, plan/encoding/truncation a skutečných child fixture. Parser se nepřepisuje. |
| CMD / GitHub job | CMD0/1 a pozitivní/záporné chyby beze změny, model přebírá reálný nový CLI status v syntetických checkoutech. Skutečný Windows CMD/GitHub job stále NOT RUN. Žádný continue-on-error nebo změna workflow. |
| Vnější trust / domácí runner | Žádné nové triggery/markery, původní owner/ref/SHA/clean-checkout/first-run/first-attempt guardy beze změny. Scope na Windows vyžaduje původní ne-elevated ZamerovacQA token a assign před resume, KILL_ON_JOB_CLOSE bez breakaway; dosavadní Win32 API kontrakty se regresně ověřují. |

Procesní sada používá vnější existující supervisor pouze jako bezpečnostní síť
pro případ vadné implementace. PASS důkaz musí pocházet z **vnitřního gate**;
timeout vnější sítě se nesmí vydávat za opravu. Konkrétní nulový počet známých
procesů se ověřuje na `/proc`, žádný produkční proces se nezabíjí podle cizího
PID/názvu. Modelové fault injekce a Windows API modely jsou oddělené od skutečných
Linux procesů. Windows JobObject runtime nebyl proveden.

**Zbývající limity:** při násilném zániku gate parenta může zůstat jeho soukromá
složka s configem/redigovaným verdiktem a syntetickými TEMP daty; test ji po
ověření procesů explicitně odstraní. Bez žijícího rodiče se žádný PASS nevrací.
Násilné ukončení celého hosta nebo samotného Linux owneru není doklad úspěšného
userspace cleanupu; Windows má v původním scope kernelový kill-on-job-close,
jeho nativní chování zde zůstává NOT RUN. Python musí již existovat; chybějící
interpreter/unsupported scope skončí BLOCKED před provedením testové sady,
bez instalace či změny runneru. Pro reálný Windows/CMD/job výsledek je po
review stále potřeba nové samostatné schválení. **Následný Kontrolor40 má
nezávisle posoudit celý související mechanismus, nejen poslední diff.**

## Příčina a hranice dostupného důkazu

Originální [job 132225342246](https://github.com/zaplikj30-ui/Zamerovac-android/actions/runs/43524071686/job/132225342246)
na Windows Node26.13.0 má přesně 15 známých `ok` a žádný `not ok`, ale následný
`BLOCKED: TAP counts differ from 15/15/0/0`. Selhala vyhodnocovací větev po čtyřech
`findstr /X /C:...`. **Není zachován ani jeden skutečný souhrnný řádek**, index
neúspěšné kontroly ani bajty původního TAP. Soubor byl úmyslně odstraněn.
Retained fixture `tests/fixtures/windows-fixture-43524071686.txt` obsahuje pouze
15 doslovných redigovaných výsledků porovnaných s originálním logem; nedoplňuje
neexistující header, plan nebo summary a nová brána ji správně odmítne.

**Prokázaný problém SOURCE:** vyhodnocení bylo závislé na Windows textovém nástroji,
nemělo per-key diagnostiku, nekontrolovalo unikátnost souhrnů ani úplnou identitu
všech výsledků. Nelze z něj bezpečně rozlišit vadný souhrn od nekompatibilního
matching. Navíc `if errorlevel 1` samo nepokrývá záporné návratové kódy. Běžný
průchod v historickém logu podporuje Node exit0, ale kód nebyl explicitně zachován;
záporný návrat je další SOURCE mezera, **nikoli doložená příčina tohoto běhu**.

| Kandidát historického mismatch | Doloženo / výsledek analýzy |
| --- | --- |
| Chybějící klíč nebo jiný počet | Z původního logu nerozhodnutelné; 15 `ok` samo nedokládá čtyři souhrny. |
| Duplicitní nebo rozporné klíče | Z původního logu nerozhodnutelné; staré hledání existence neumělo duplicitu odmítnout, pokud existovala i očekávaná hodnota. |
| LF proti CRLF / FINDSTR `/X` | Silná pracovní hypotéza, nikoli potvrzený Windows root cause. [Node26.13 TAP source](https://github.com/nodejs/node/blob/v26.13.0/lib/internal/test_runner/reporter/tap.js) explicitně skládá řádky s LF; skutečný Windows souhrn a FINDSTR zde nebyly dostupné k nativní reprodukci. |
| Kódování / BOM / nečekaná mezera / verze reportéru | Z původních bajtů neověřitelné. Nový kontrakt přijímá UTF-8 s volitelným úvodním BOM a LF/CRLF; vadné/UTF-16/NUL a neznámou strukturu odmítá. |
| Samotný Node exit code / CMD předání | Nová brána ověřuje přímo procesní status `===0`, signál a spawn chybu. CMD adaptér odmítá pozitivní i záporné chyby bez `%ERRORLEVEL%` expanze. |

**Přesnou historickou bajtovou příčinu nelze z chybějícího důkazu definitivně
rekonstruovat.** Tato změna nahrazuje vadný kontrakt jako celek a připravuje
diagnostiku pro jedno příští samostatně schválené Windows ověření. Nevydává
Linux model nebo SOURCE analýzu za Windows runtime PASS.

## Implementace a PASS/FAIL jobu

Interní `tools/qa-fixture-worker.cjs` v ověřeném scope spustí stejný `process.execPath`, bez shellu,
s pevnými argumenty `--test --test-reporter=tap` a jediným souborem
`tests/home_qa_integrity.js` ve vlastním QA rootu. Nelze předat jinou sadu,
očekávaný počet, TAP soubor nebo status parametrem či stdin. Aktuální Node proces
musí být předtím autorizován původní owner/ref/SHA/clean-checkout bránou.
Globální prostředí, produktové soubory a původní testy se neupravují; per-child
TEMP je nyní izolován a odstraňuje se až po ověřeném cleanupu.

Výstup a stderr dítěte zůstávají v omezené paměti (`maxBuffer` 1 MiB na stream,
120s timeout). Raw TAP se nikam neukládá, nevypisuje a nenahrává. Spawn error,
timeout, přetečení bufferu, signál, nečíselný/nenulový/nezjištěný status nebo
nečekaný přímý stderr znamená BLOCKED. Úspěšné komentáře s výstupem testů se
mohou ignorovat, jejich obsah se nikdy nepřenáší do logu.

`tools/qa-fixture-tap.cjs` vyžaduje současně:

- Úplný podporovaný flat TAP13, dokončené diagnostické bloky, právě jeden plan
  `1..15` po výsledcích a žádný bailout, vnořené či neznámé raw výsledky.
- Právě všech 15 výsledků v pevném pořadí a s přesnými whitelist názvy a indexy;
  žádný chybějící, přidaný, duplicitní, přejmenovaný, FAIL/SKIP/TODO/expected-failure.
- Každý z klíčů `tests/pass/fail/skipped` právě jednou, kanonické celé číslo a
  hodnoty **15/15/0/0**. Přítomné `suites/cancelled/todo` musí být jedinečné nuly.
- Skutečný Node status 0, žádný signál/spawn error a prázdný přímý stderr.

PASS vypíše jediný pevný marker `WINDOWS_FIXTURE_15_PASS_0_FAIL_0_SKIP` a vrátí 0.
Jinak vrátí 1 a loguje jen `FIXTURE_GATE_BLOCKED` + JSON s pevnými klíči,
whitelist názvy a booleany: `nodeExitOk/processOk/stderrEmpty/encodingOk/structureOk/
planOk/casesOk`, u každého souhrnu `available/unique/integer/matches`, u každého
známého testu `available/passed`. Žádný skutečný počet, exit code, jméno cizího
testu, cesta, účet, OS ID, raw error, stack, actual/expected ani raw TAP.
Formatter znovu skládá whitelist; nekopíruje libovolný vstupní objekt.

`tools/qa-fixture-gate.cmd` po Node ihned zkontroluje oba směry `errorlevel` a
explicitně vrátí pouze 0 nebo 1. Nepoužívá `%ERRORLEVEL%` (možné stínění env
proměnnou) ani expanzi uvnitř bloku. Chybějící Node (9009) i záporná havárie jsou
FAIL. Konkrétní budoucí krok po ověření obou checkoutů musí mít poslední/jediný
příkaz níže a žádné `continue-on-error` nebo přepis statusu:

```yaml
- name: Verify exactly 15 reviewed fixtures
  shell: cmd
  working-directory: gate
  run: call tools\qa-fixture-gate.cmd
```

Toto je integrační kontrakt, **nikoli nové workflow**. Skutečný GitHub job spustit
nelze bez nového schválení. V tomto PR jsou veškeré `.github/workflows/**`, oba
spotřebované RUN, marker soubory a původní SHA/owner/runner/first-run/first-attempt
guardy beze změn. Při budoucí přípravě musí být nový checker i CMD v přesném nově
reviewovaném QA SHA; starý pinned checkout `65a3e4f` je ještě neobsahuje. Nekopírovat
skripty z neověřeného PR/forku do gate a nereaktivovat PR125/126.

## Testy celého dostupného řetězce a registr pokrytí

`tests/qa_fixture_tap_gate.js` má 14 scénářů:

| Pokrytí | Důkaz / limit |
| --- | --- |
| Skutečných 15 schválených identit | Whitelist se porovnává se všemi 15 statickými názvy původního neměněného souboru. |
| LF, CRLF, mix, UTF-8 BOM | Pozitivní fixture i skutečný Node TAP; změna kódování na UTF-16, vadné UTF-8/NUL nebo oversize = BLOCKED. |
| Každý souhrnný klíč | Chybění, stejné/rozporné duplicity, nesprávná hodnota a vadné číslo; kontrola přesných diagnostických booleanů. |
| Výsledky a konec streamu | 15 `ok` bez souhrnů nestačí; chybění/přebytek/duplicita/pořadí/jméno, FAIL/SKIP/TODO, bailout, plan, skrytý souhrn a nedokončená diagnostika = BLOCKED. |
| Skutečný child Node | Reálné PASS/FAIL/SKIP/TODO TAP fixture na Linuxu, nikoli pouze ručně sestavený text. |
| Skutečná CLI v syntetickém checkoutu | Byte-identické kopie obou produkčních checker skriptů, skutečný child Node a pět režimů: PASS/FAIL/SKIP/TODO/exit-error. PASS jen v prvním, ostatní exit1, bez úniku raw zpráv a cest. |
| Exit a job kontrakt | VM pro status1/záporný status/signál/timeout-like spawn error/overflow/stderr a nepovolené argv; model skutečného CMD adaptéru propaguje 0, 1, 7, 77, 9009 a záporné havárie. CMD/GitHub runtime NOT RUN. |
| Redakce | Úmyslné soukromé sentinel cesty/jména/čísla ve FAIL i PASS komentářích a OS chybě se nesmějí dostat do výstupu. |
| Originální Windows důkaz | 15 doslovných známých výsledků bez nedochovaných souhrnů = BLOCKED; nic se nevydává za rekonstruovaný Windows PASS. |

Test-first: původně checker neexistoval (MODULE_NOT_FOUND), po rozšíření kontraktu
6 FAIL/7 PASS; po implementaci všech podmínek 14 PASS/0 FAIL/0 SKIP. Jeden vývojový
FAIL skutečné child fixture pod `node --test` odhalil zděděné `NODE_TEST_CONTEXT`:
nezávislá **testovací** fixture nyní odstraňuje jen tento interní kontext z kopie
svého prostředí. Produkční checker prostředí nemění; nečekaný stderr nebo prázdný
TAP správně blokuje. Konečná společná regrese, SHA a SHA256 logů jsou v autorském
předání nového PR/#42.

Samostatný skutečný běh nové CLI nad původní 15-testovou sadou na Linuxu:
Node exit0, integrity14 PASS/1 Windows-junction SKIP → správně gate exit1,
`tests/fail.matches=true`, `pass/skipped.matches=false`. Toto je **PASS negativní
kontroly**, nikoli Windows PASS nebo nezpracovaný nalezený FAIL.

Produkční Chromium path/profile/hash, symlink/junction/hardlink/TOCTOU, file locks,
sandbox/JobObject, původní suite/manifest23/96, app/data/média/sync#88, instalace,
ACL/Play a všechny staré větve zůstávají beze změny. Nápověda/changelog aplikace
se nemění, protože produktové chování se nemění. Existující publikované prostředí
Linux/Node24.22.1/Python3.12.14, explicitní activate.sh v každém shellu; žádný nový
preflight ani instalace.

## Jediný další krok a zbývající rizika

Po autorském finálním SHA, vlastním kritickém auditu a dostupné regresi následuje
nezávislý Kontrolor40 nad celým souvisejícím mechanismem. **Windows CMD/Node26/GitHub stav jobu nativně, Chromium, HOME4/4,
UI23/96, merge/APK: NOT RUN.** Linux end-to-end a CMD model tato tvrzení nenahrazují.

Teprve po review a novém výslovném souhlasu vlastníka připravit novou inertní
one-shot cestu se všemi původními owner/ref/marker/parent-diff/SHA/clean-checkout/
first-run/first-attempt/runner/budget guardy, připnout finální checker SHA a
produkt PR121, neprovést žádnou další instalaci a spustit pouze 15 fixture přes
uvedený CMD adaptér. Ověřit skutečný job exit a marker, při BLOCKED zachovat jen
jeho booleany a whitelist, STOP před Chromium. Tyto booleany už přímo rozliší
chybějící/duplicitní/vadný/nesouhlasící souhrn od chyby procesu či výsledků.
Nadále nelze slibovat formát libovolné budoucí verze Node; neznámá struktura
musí zůstat BLOCKED, nikoli fallback PASS. Násilné ukončení hosta, skutečné
Windows CMD chování a nativní runtime vyžadují právě tuto oddělenou bránu.
