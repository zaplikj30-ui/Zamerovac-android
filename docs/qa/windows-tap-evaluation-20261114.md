# Vyhodnocení Windows fixture: jeden dokončený SOURCE balík

Zadání [Koordinátora 27](https://github.com/zaplikj30-ui/Zamerovac-android/pull/126#issuecomment-6867221968)
a následné upřesnění vlastníka: ověřit celý řetězec Node → exit code → 15 výsledků
→ souhrny → stav jobu. Výchozí schválený snapshot je PR126
`9fb10bde56a22d34b9e1a6570f42c815fa869b94`, jeho QA rodič PR124
`65a3e4f1981c1f2a1eb96f39e128a4fcc6190729`, produkt PR121
`ae3b4df53c25557f28b4a25ccb65adc2abdff639`. Nová samostatná větev
`qa/windows-tap-evaluation-20261114`, oddělený worktree a draft PR.
Žádný zápis do původních PR/RUN větví a žádná aktivace.

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

`tools/qa-fixture-gate.cjs` spustí přímo stejný `process.execPath`, bez shellu,
s pevnými argumenty `--test --test-reporter=tap` a jediným souborem
`tests/home_qa_integrity.js` ve vlastním QA rootu. Nelze předat jinou sadu,
očekávaný počet, TAP soubor nebo status parametrem či stdin. Aktuální Node proces
musí být předtím autorizován původní owner/ref/SHA/clean-checkout bránou.
Žádné prostředí procesu, produktové soubory nebo původní testy se neupravují.

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

Po autorském finálním SHA a dostupné regresi následuje nezávislý Kontrolor40 nad
celým balíkem. **Windows CMD/Node26/GitHub stav jobu nativně, Chromium, HOME4/4,
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
