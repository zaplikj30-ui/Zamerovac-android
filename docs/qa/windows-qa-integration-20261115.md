# Selektivní integrace hotové normální Windows QA

Jedna vlastní větev `integration/windows-qa-selective-20261115`, base main
`3e3f4ae4384f39c4599c5b0e43a43877e93b3a9f`. Podklad:
[rozhodnutí koordinátora](https://github.com/zaplikj30-ui/Zamerovac-android/issues/42#issuecomment-6889528667).
Nejde o merge stacku PR136/140, nasazení nové QA infrastruktury ani povolení
spuštění HOME. Výsledný přesný SHA a opakované testy jsou v autorském komentáři
integračního PR a #42; historický Windows PASS se na nový SHA nepřenáší.

## Výběr a závislosti

[Přesný původ každého ze47 vybraných souborů a jejich Git blob](windows-qa-integration-20261115.sources.json).
Většina pochází beze změny z finálního PR136
`1d6a786c77aa2a797bf7bd75f9977a3ae6613459`. Pouze opravené fixtures
`qa_fixture_process_scope.js` a `test_diag41.py` pocházejí z PR140
`dcb44e2652a9ee3da678d91ca1e71d4fc79593ec`. Přizpůsobení tří původních
testových souborů je popsáno níže. Procesní a bezpečnostní runtime je převzat
beze změny. Jediná funkční adaptace dvou browser souborů zachovává existující
novější diagnostický režim PR121, jak je popsáno níže. Zvlášť jsou nové
test-only helpery a dokumentace.

| Potřebná skupina | Důvod |
| --- | --- |
| qa_owned_processes.py, qa_process_supervisor.py, qa-process-client.cjs, diagnostic JSON, qa_browser_lock.py | Jeden existující owner, Windows token/Job, Linux pidfd, cleanup/STOP/NO RETRY a bezpečná diagnostika. |
| qa-fixture gate/worker/TAP/CMD, attempts a normální qa35 no-op vstupy | Původních15 TAP a striktní exit/cleanup vyhodnocení; existující no-op bez browseru. Žádný trigger. |
| local-browser-qa, e2e harness/sandbox, browser identity/profiles/worker/package pins, qa-integrity a PR121 manifest | Skutečné závislosti původních15: úplný23/96 kontrakt, identita binárky, sandbox a staging neměnného produktu. Vynechání by znefunkčnilo či oslabilo původní testy. |
| Související JS/Python testy, fixture-checkout a redigovaná TAP fixture | Zachované57 modely,15 TAP, skutečné Linux process scénáře a negativní path/hash/token/protocol případy. |

**Nepřevzato:** žádný soubor `.github/workflows`, žádný `.trigger`, historie
diagnostických logů, WSL/procesní experimentální sondy bez návaznosti na tyto
zdroje, C++/Node-API/OwnerCore ani POSIX build gate varianty C. Nezměněny
AGENTS/START z aktuálního main, aplikace, Java, app testy, média/data/sync,
release/4job workflow a aktivní PR121. Žádná instalace závislosti z package pins.

## Tři nutná testová přizpůsobení

1. Původní třetí15-case test čte historický one-shot YAML. Jeho kopie by
   porušila zadání. Test nyní používá **tentýž původní obsah z Git object
   databáze**, nikoli soubor ve workflows. `qa-reference-bootstrap.cjs`
   požaduje doslovný Git blob `ec8a2664d2d051f2ef40ee4b51564cc95dcb7485`
   a současně SHA256
   `e31e02bc0938a6ba28c514765380c5bbd1b99c230117d0b0128618d562431120`.
   Všechna původní pozitivní i negativní guard/fragment assertions zůstala.
   Žádný fetch, instalace, shell, vytvoření YAML či fallback v helperu. Chybějící objekt
   je skutečný FAIL, nikoli přeskočený test nebo vymyšlená úspěšná fixture.
2. `qa_process_client.js` spouštělo skutečný normal/timeout/cancel procesní
   strom i ve Windows. Při běžném automatickém testování nyní spouští tento
   kernelový důkaz pouze na Linuxu, mimo Linux se všechny3 případy explicitně
   registrují jako SKIP s důvodem. Žádná assertion odstraněna.
3. Stejně11 případů `OwnedRunnerTests` v test_qa_process_supervisor.py nyní
   vyžaduje nonroot Linux. Windows skutečné crash/timeout/cleanup-injection
   nepatří do automatického HOME quick. Model57 ani původních15 to neomezuje;
   normální explicitní Windows no-op gate zůstává. Windows fault proof
   NOT RUN/BLOCKED; pro jeho spuštění neexistuje skrytý env přepínač.

Nové pozitivní/negativní testy ověřují skutečný reference helper (včetně chyby
Gitu, chybného obsahu a přesného omezeného příkazu) a Windows registraci těchto
sad **bez spuštění jejich payloadu**. Odstraněný skip guard je negativní model,
ne Windows fault experiment. Python model ověřuje všech11 zachovaných metod.

## Kolize s novějším produktem PR121

Přímé porovnání vybraných cest s produktovým PR121 našlo jediný překryv:
`tools/local-browser-qa.cjs`. Původní QA136 runner už má stejných23 suite
v manifestu, ale postrádal existující PR121 CLI režim `--legacy-conflict`.
Zachován tento konkrétní diagnostický režim (jen legacy-conflict-persistence)
v `qa-integrity.modes` i CLI help. Není přidán nový produktový scénář ani obecný
filtr. Owner/ref/SHA, source pin, sandbox a cleanup se nemění.
Nový test porovnává všechny tři režimy a jejich pořadí přímo s pinovaným
PR121. Druhý pozitivní/negativní test prokazuje1 suite/1 case diagnostického
výsledku a odmítnutí stejného výsledku pro plné `--all`23/96; libovolný
ZAMEROVAC_CASES filtr je dál BLOCKED. Při budoucím začlenění PR121 se tato
novější funkce nesmí přepsat starším QA runnerem.

První integrace prokázala chybějící historický YAML:15 testů,13 PASS/1 FAIL/
1 Windows-only SKIP. Reference helper odstranil tuto závislost na workflow
souboru. Při výběru pinu byl nejprve omylem použit blob jiného historického
workflow; pozitivní test i původní15-case test jej odmítly. Pin opraven podle
skutečného blobu PR136 a doplněna SHA256 kontrola; RED důkazy zachovány.
Po opravě reference:18 PASS/0 FAIL/1 SKIP v kombinované19-case sadě.
První širší regrese vybraného working tree:62/62 příkazů PASS, Python166;
po následné bezpečnostní kontrole doplněny Linux-only dispatch guardy a testy
a opakuje se celý finální balík na commitovaném SHA.

## Reprodukovatelné vstupy a mělký checkout

Tyto testy záměrně vyžadují dvě připnuté referenční vstupní historie: PR121
produkt `ae3b4df53c25557f28b4a25ccb65adc2abdff639` pro23/96 registration a
source-bytes testy a výše uvedený Git blob dostupný z PR136
`1d6a786c77aa2a797bf7bd75f9977a3ae6613459`. Nejde o kód načítaný/spouštěný
z cizí větve: reference YAML se pouze kontroluje jako data. PR121 scénáře se
v15-case testu registrují s blokovaným harness/mock callbackem; browser se nespouští.

V použitém Linux workspace byly oba připnuté commity ověřeny a jejich Git
objekty byly dostupné před testy. U čistého shallow clone musí operátor při
samostatně schválené přípravě získat tyto exact-SHA objekty z důvěryhodného
origin; samotné fetch-depth1 nestačí. Příklad **přípravy dat, ne spuštění QA**:

```text
git fetch --no-tags origin 1d6a786c77aa2a797bf7bd75f9977a3ae6613459 ae3b4df53c25557f28b4a25ccb65adc2abdff639
```

Žádný checkout spotřebovaných RUN, žádný merge ani aktivní workflow tím
nevzniká. Testy nikdy samy nedostupný vstup nestahují ze sítě a nepovolují
alternativní hash. Vnitřní disposable produktový clone převezme přesný již
lokálně připravený PR121 commit samostatným lokálním Git fetch; bez tohoto
kroku se v mělkém clone nezveřejněný commit nepřenesl a původní test skutečně
selhal na `unable to read tree`. Negativní shallow běh je zachován; oprava
mění jen přenos dat, nikoli assertions nebo povolený produkt. Absolutní místní
cesta nemůže přejít na URL fallback. Chybějící externí vstup není PASS. Pro případný Windows běh musí být
tyto vstupy zahrnuty do předem schváleného pinned receptu; zde nový YAML není.

## Zachované hranice, skutečné testy a další brána

Runtime zachovává schválený neadmin SCM token guard, creation-time JOB_LIST/
HANDLE_LIST, suspend/membership/image/time před resume, KILL_ON_JOB_CLOSE bez
breakaway, nezávislé cleanup kroky, první a sekundární chybu, redakci a dvojitý
NO RETRY po CreateProcessW. Měkký CANCEL nezískává záruku bounded hard-stop.
Neznámý cleanup, exit/close, timeout či rozpor je BLOCKED a STOP dalšího běhu.
SHA256/path/reparse/hardlink/TOCTOU a sandbox policy se neuvolňuje.

Původních57 modelových zdrojů z PR136 je beze změny.15 případů má stejná jména,
pořadí a význam; parser nemá upravené počty nebo povolení SKIP. Linux15 =
14 PASS/1 Windows-only junction SKIP; skutečný nový Windows15 NOT RUN.
Přenos starého Windows PASS na integrační SHA je zakázán.

**Browser spouštěcí politika nebyla rozšířena:** zachován přesný PR121 produkt
a původní owner/ref/SHA/run-attempt allowlist. Současný main nebo tato nová
integrační větev jím nejsou automaticky autorizovány. Běžný browser příkaz
main4/4 tak může správně skončit BLOCKED před spuštěním místo starého
neověřeného běhu. **Tento draft proto není připraven k bezpodmínečnému merge
se spuštěním původního main workflow.** Koordinátor musí před integrací/
aktivací rozhodnout konkrétní schválený produkt/validator/workflow SHA,
referenční data a rozsah. Přepsání source pinu či přidání obecného `qa/*`
allowlistu kvůli zelenému4/4 by bylo nepovolené oslabení; zde se neprovádí.

Dostupná ověření jsou nonroot Linux Node/Python/modely a HTTP self-test bez
Chromium. Výsledný nový SHA, prostředí, PASS/FAIL/SKIP a log hashe jsou v PR/#42.
Windows native/token/junction, HOME4/4/WSL, Chromium/CDP/pixely, Android/Gradle/
Robolectric/fyzický hardware a technický APK na novém SHA **NOT RUN**, chybí
příslušný souhlas nebo cílové prostředí. C/hard-hang rollback zůstává oddělené
neprokázané riziko a nebyl integrován.

Vlastní kontrola zahrnuje celý výběr vs main/PR121/136/140, relativní imports,
živé workflow triggery, testy, owner/token/API/IPC/TAP/exit/cleanup, redakci,
immutable data piny a rozdíl mezi novým Linux důkazem a historickým Windows
PASS. Po nalezených problémech a úpravách celá dostupná regrese i kontrola
znovu. Dokončený zdrojový integrační draft se předává nezávislému kontrolorovi;
bez nového souhlasu se nic na HOME nespouští a nic se neslučuje/nevydává.
