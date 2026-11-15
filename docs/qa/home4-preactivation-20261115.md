# HOME QA 4/4 po PR141 — neaktivovaný autorský návrh

Stav: **NÁVRH / PREIMPLEMENTATION REVIEW**, žádné povolení běhu, merge nebo APK.
Výchozí main `a3cc8eb3a14a9a6710664b73ba8a5c70ed1a340a` (PR141 a PR148 merged).
PR121 je OPEN/DRAFT `ae3b4df53c25557f28b4a25ccb65adc2abdff639`; není předkem main.
Přesný HEAD tohoto předání, prostředí a opakované výsledky jsou v propojeném
autorském komentáři PR / issue42. Vlastní review autora není nezávislé review.

## Návaznost a doložený stav

Toto je adaptace existujícího
[HOME_GATE_PROPOSAL PR121](https://github.com/zaplikj30-ui/Zamerovac-android/blob/ae3b4df53c25557f28b4a25ccb65adc2abdff639/docs/qa/integration-20261113/HOME_GATE_PROPOSAL.md),
ne nový návrh od nuly. Zachovává jeho nonroot/ext4/offline a oddělenou raw JVM
pravdu. Nahrazuje historické „main-only push/dispatch“ **manual-only** z PR148;
závěrečná historická zmínka o povoleném technickém APK se na tento úkol nevztahuje.
Aktuální zdroje:

- [koordinátor](https://github.com/zaplikj30-ui/Zamerovac-android/issues/42#issuecomment-6896676144),
  [REQUEST FIX](https://github.com/zaplikj30-ui/Zamerovac-android/issues/42#issuecomment-6896827881),
  [doplnění návaznosti](https://github.com/zaplikj30-ui/Zamerovac-android/issues/42#issuecomment-6896907999),
  [protokol rolí](https://github.com/zaplikj30-ui/Zamerovac-android/issues/42#issuecomment-6737954337).
- [selektivní integrace](windows-qa-integration-20261115.md) a její piny/omezení;
  AGENTS.md, START_ZDE.md a aktuální čtyřjobový/release workflow jsou autorita
  pro současný kód, nikoli důkaz budoucího runtime PASS.
- Historický NORMAL [run43722510319](https://github.com/zaplikj30-ui/Zamerovac-android/actions/runs/43722510319)
  je důkaz 57 modelů, normální no-op, 15 TAP a checkout cleanup na RUN SHA
  `db2127abf22030088fbab21bacb0ca11c1d5890b`, QA zdroj `58b456c8ad3f603c57cf2ee8c6d784c76c2446fb`.
  Není HOME4/4 pro nový main ani důkaz hard-hang rollbacku.

V tomto balíku jsou implementovány **pouze dokument a test-only modely**.
Workflow, guardy, produkt, release a původní testy se nemění. Následující
tabulka uvádí budoucí dotčené soubory, nikoli již provedené změny.

## Sedm nálezů — jednotný návrh a brána rozhodnutí

| Nález | Minimální navržené řešení | Budoucí soubory | Pozitivní / negativní důkaz | Riziko / rozhodnutí vlastníka |
| --- | --- | --- | --- | --- |
| A Browser identita | Samostatné přesné SOURCE, VALIDATOR, EVENT SHA; nový manifest pouze pro schválený produkt, žádný obecný allowlist. Přesný Chromium profil níže. | tools/qa-integrity.cjs, qa-pr121-manifest.json nebo samostatný schválený main manifest, qa-browser-profiles.json, local-browser-qa.cjs; stávající QA workflow | Stávající home_qa_integrity.js ověřuje skutečný validátor 23/96, missing/duplicate/FAIL/SKIP/sandbox/hash; nový model odmítá PR121 vydávaný za main a nevyplněné piny. | Main se liší v 19/66 byte-pin souborech. Volba produktu a nový manifest/identity policy vyžadují rozhodnutí P1. |
| B Offline/preverified | Žádná instalace ani online dependency resolution; přesný soupis existujících nástrojů/cache a SHA256, read-only vstupy, privátní výstupy. Přenosy rozdělit podle tabulky níže. | QA workflow, app/build.gradle pouze při nutné schválené offline Robolectric konfiguraci; release/home_qa_version_preflight.py pouze pro schválený offline vstup | Model hashuje syntetické bajty; missing/corrupt/extra/unapproved hash blokuje. Existující binary/redirect/preflight negativy zůstávají. | Existence a verze nejsou hash. Kompletní lokální cache na HOME nebyla inventarizována. P2; nic nestahovat pro „opravu“ prostředí. |
| C Git/WSL | Ověřené přesné historické objekty; nový run-specific ext4 strom v již existujícím nonroot účtu, nikdy root/stale reuse. Ověření celého obsahu před/po. | QA workflow, případná úzká adaptace tools/home_qa_gate.py; tests/helpers/qa-reference-bootstrap.cjs a qa-fixture-checkout.cjs ponechat | Existující reference/shallow negativy + model fresh/ext4/nonroot/obsah; chybějící objekt, modifikovaný či ignored soubor, reuse => BLOCKED. | Nonroot účet, cache a limity nejsou z této relace ověřeny. P2; bez nových účtů/práv/sudo. |
| D Spuštění/rerun | Owner/repo/main/manual/actor/triggering_actor/attempt1 před checkoutem a znovu před payloadem; plné SHA a checkout bez tokenu; žádný volný ref. | Stávající QA workflow a úzce qa-integrity.cjs; release guard až v samostatně schváleném rozsahu | Nový pozitivní model + push/PR/fork/cizí actor/triggering_actor/rerun/SHA mismatch; stávající integrity gate stále odmítá main/manual. | Model není autorizační kód. Změna policy P1/P4 a nezávislé review před implementací. |
| E Procesy/cleanup | Použít existující Windows Job pro běžné povinné podprocesy, per-command timeout/CANCEL; žádný PID kill ani nový framework. Privátní run adresáře, audit, disky a STOP níže. | local-qa.cjs, stávající QA workflow; stávající qa-process-client.cjs / qa_process_supervisor.py / qa_owned_processes.py bez přestavby | Model normal/FAIL/crash/cancel/timeout/unknown/disk overflow; stávající 57 + parser/gate + Linux owned-process regrese. | Windows Job neřídí Linux procesy uvnitř WSL. Hard-hang/owner-death/bounded rollback NOT PROVEN. P2/P4; unknown = STOP/NO RETRY. |
| F Quick | Explicitní Node/Python EXE + SHA256/verze, nikdy py -3/PATH fallback; manifest jednotlivých povinných případů, návratový kód i obsah. Oddělit schválené nepovinné NOT RUN. | local-qa.cjs a QA workflow; test-only registry pro schválený finální SHA | Model jména/duplicity/počet/FAIL/SKIP/exit/diagnostika; skutečný qa-fixture-tap parser LF/CRLF a negativy. | Aktuální quick je command-exit souhrn a může skrýt unittest SKIP. Povinný registr nad rámec 57/15 musí být předem zmrazen, ne odvozen z neúplného výsledku. P4. |
| G JVM/APK | Přesný jmenný XML kontrakt pro vybraný produkt, oddělený raw stav; negativní Drive, 3 PDF render fixtures, signer/package/version a odstranění všech APK. | QA workflow, budoucí strict companion k tools/sync-ack-acceptance.py (v PR121); release preflight, případně release workflow po schválení | Syntetický 64/513 model včetně přesných dvou raw FAIL a varianty bez schválení; existující preflight package/cert/verze/redirect negativy. Reálné XML/PDF/APK NOT RUN. | Produktová acceptance dvou #88 FAIL není automaticky pro main. P3, release přenosy P2; build není vydání ani fyzický test. |

## A + D: konkrétní identity a dvě produktové možnosti

Současný `qa-pr121-manifest.json` pinuje `ae3b4df...`, 66 souborů,
23 pojmenovaných sad / 96 případů (včetně pixelů). `sourceSnapshot` vyžaduje
tentýž HEAD, čistotu a přesné bajty; main má 19 odlišných souborů, nejen jiný
commit: 11 app assets a 8 e2e souborů včetně harnessu. `executionIdentity`
vyžaduje owner/push/`refs/heads/qa/browser-smoke-winfix-20261113-run`/attempt1
a očekávaný validator SHA. Z těchto19 rozdílů je15 změněných souborů a4
chybějící: app/src/main/assets/pending-audio.js a tools/e2e/{legacy-conflict-persistence,
pending-audio,protected-data}.cjs. První dvě chybějící e2e sady obsahují1+8
povinných případů. Main workflow má owner/manual/main; `CHROMIUM_PATH`
nenastavuje. Tento rozpor je **prokázaný zdrojově**, nikoli nový HOME experiment.

| Identita | M — test dnešního main | I — budoucí schválený integrovaný PR121 produkt |
| --- | --- | --- |
| SOURCE / EVENT SHA dnes | `a3cc8eb3a14a9a6710664b73ba8a5c70ed1a340a` / stejné SHA; po jakémkoli merge nutný nový přesný pin | Zatím **NEEXISTUJE**; PR121 `ae3b4df53c25557f28b4a25ccb65adc2abdff639` je pouze historický vstup, není finální integrovaný main |
| VALIDATOR dnes | Reviewovaný základ `a3cc8eb3a14a9a6710664b73ba8a5c70ed1a340a`; současná politika M odmítne | Tentýž základ je pouze návrhový vstup; žádný schválený nový validátor |
| VALIDATOR pro běh | Plný budoucí V po implementaci a nezávislém review; **nevyplněno = BLOCKED**, nelze vybrat branch/latest | Totéž; V musí pinovat konkrétní finální integrovaný SOURCE, nikoli pouze ae3 |
| Browser kontrakt | Zachovat úplný 23/96 jmenný rozsah. Dnes chybí2 sady/9 případů a jejich produktová závislost, takže varianta bez další změny není dostupná. Nový manifest musí zahrnout všech66 původních cest, jednotlivě schválené bajty a případné dodatečné závislosti; žádné snížení pokrytí | Zachovat 23/96, porovnat finální produkt s66 původními piny, všechny cesty a nové závislosti ponechat, změny jednotlivě přezkoumat a vytvořit finální manifest |
| Co nelze tvrdit | Starý ae3 manifest ani synthetic PASS nedokazuje browser main | Běh samostatného ae3 checkoutu s novým QA by byl PR121 evidence, nikdy main HOME4/4 nebo release evidence |
| Cena / rozhodnutí | Nejmenší zásah do produktu; pokud některý scénář vyžaduje funkci jen PR121, STOP a rozhodnutí o I, žádný SKIP/oslabení | Samostatná produktová integrace + její testy/review/souhlas; tento balík ji neprovádí |

Zdrojové ověření M: existující test home4_preactivation_boundaries.js
prokazuje chybějící soubory/sady a skutečné odmítnutí sourceSnapshot i
executionIdentity; nejde o pouhý model nové policy. **Doporučení P1: I**,
samostatné rozhodnutí o produktové integraci s ponecháním novější QA. M by
vyžadovala samostatně schválený backport chybějícího produktu/scénářů; pouhá
změna manifestu není řešení a test ae3 jako main by byl falešná identita.
Ani jedna varianta není tímto aktivována. Není možné nyní poctivě uvést
budoucí schválený V/I SHA; jejich absence je explicitní blokér.

Pro obě varianty konkrétní navržený Windows profil z existujícího allowlistu:

```text
CHROMIUM_PATH=C:\actions-runner\tools\ms-playwright\chromium-1234\chrome-win64\chrome.exe
SHA256=409805a16d6416087e6b2f778df1cf8f7bbb267d6b99f6b5bb0a618eace234f2
magic=4d5a
repo=zaplikj30-ui/Zamerovac-android
event=workflow_dispatch; ref=refs/heads/main
actor=zaplikj30-ui; triggering_actor=zaplikj30-ui; run_attempt=1
```

Tento hash je **pin z kódu**, nikoli aktuálně změřená HOME binárka ani nový
digitální podpis výrobce. Zachovat native realpath, file identity, hardlink,
reparse/symlink/TOCTOU, image/hash, sandbox a child cleanup kontroly. Žádné
normalizování jiné binárky na schválenou, `--no-sandbox` ani case filter.
Run ID musí být konkrétní kladné ID čerstvé schválené události; reporty váže
run token, run ID, attempt, SOURCE, VALIDATOR, platforma a obsahové hashe.
Validator se načítá z odděleného přesného V před produktem, bez uloženého
tokenu, ne ze skriptu neprověřeného produktu. Pokud je V jiný než EVENT,
musí být tato dvojice výslovně schválená, nikoli přijatá z volného inputu.
Owner/main/manual-only platí současně na job i payload hranici; nevracet push.

## B: úplný síťový a instalační inventář související cesty

Řádky odkazují na workflow na výchozím main. Tato relace stáhla pouze
zdrojová metadata GitHubu do Linuxu, nikoli nástroje či APK na Windows.

| Dnešní místo / přenos | Navržená neaktivovaná politika |
| --- | --- |
| workflow L120 curl.exe MinGit ZIP + tar | Odstranit fallback až po schválení; chybějící lokální Git BLOCKED. Archivní SHA `e3bf78351fe777fba47ddee5950082f8a98bb0f02604fdc7ba3ee2cb68ffa877` neověřuje existující rozbalený git.exe a DLL; potřebný předem schválený manifest skutečných souborů. |
| L164 npm install playwright@1.62.1, L166 npx playwright install chromium | Zakázat oba. tools/qa-browser/package-lock.json pinuje Playwright/core 1.62.1 a npm integrity, nikoli důkaz nainstalované sady. Použít již existující úplné hashované rozbalené balíky; ani offline npm ci není v tomto návrhu povolená instalace. Chybějící balík/cache => BLOCKED. |
| L275 curl Gradle 8.10.2 + unzip /opt | Bez fallbacku. ZIP pin `31c55713e40233a8303827ceb42ca48a47267a0ad4bab9177123121e71524c26` sám neověřuje existující Gradle distribuci. Přesný JDK17/Gradle8.10.2 tree manifest zvlášť pro Windows a WSL. |
| L289/294/427 Gradle bez offline; settings.gradle google/mavenCentral/pluginPortal, app/build.gradle Robolectric Maven URL | Všechny Drive/JVM/preview příkazy --offline; navíc Robolectric runtime resolver offline + pevný lokální dependencyDir s úplným manifestem, protože Gradle --offline nekryje tento samostatný resolver. Žádný wrapper distribution download, sdkmanager ani Maven fallback. SDK android-35/build-tools34, plugins, JAR/AAR/native knihovny a cache metadat musí být předem k dispozici a hashovány. |
| L345 pip install pypdf[image]>=5,<7 a pymupdf>=1.24,<2 | Zakázat. Vybrat přesné již přítomné verze modulů i native DLL/extension a hash manifest; read-only import identity před renderem. Rozsahy verzí ani pouhá importovatelnost nestačí. |
| L398 setup-java (pinovaný Action SHA, version17) | Action pin není pin JDK payloadu. Použít existující přesný JDK17 přímo, bez setup-java download/cache restore fallbacku. |
| 4× checkout / Action runtime kód, API/Git data | Navržené P2a: samostatně schválit jen read-only přenos přesných prověřených SHA a pinovaných Actions, žádné PR skripty, žádné uložené credentials. Zákaz všech přenosů by blokoval i toto. Přenosy musí předcházet offline testovací fázi. |
| upload-artifact L180/351 | Navržené P2b: pouze explicitně povolený redigovaný JSON/index, omezená velikost/retence; nikdy raw TAP/stderr/JUnit system-out/snímky osobních dat/tokeny/cesty/APK. Redakční chyba nebo chybějící povinný důkaz => BLOCKED. Dosavadní wildcard upload není důkaz redakce. |
| release/home_qa_version_preflight.py L98–127: releases API + poslední APK asset/CDN | Volba P2c-online: schválit pouze read-only release metadata a jeden přesný asset; token jen API origin, HTTPS redirect redakce zachována, velikost/hash před parsováním, podpis/package/verze, odstranění. Volba P2c-offline: předem schválená lokální APK + asset ID/hash + čerstvě důvěryhodný doklad „poslední vydaná“; bez důkazu aktuálnosti BLOCKED. Žádná z variant zde implementována. |

„Offline“ zde znamená žádnou síťovou dependency resolution během testů.
Povolené control/data přenosy nejsou povolení instalací. Prokázané odmítnutí
nečekané sítě v HOME/WSL zatím chybí; bez změn firewallu/ACL nelze tvrdit
síťovou izolaci jen z přepínače --offline. Read-only inventář musí dodat
path, verzi, SHA256 všech spouštěných EXE/DLL/modules/cache, původ a datum;
neznámá hodnota je BLOCKED. Linux Node24/Python3.12 této relace nejsou piny HOME.

## C + E: příprava, izolace, audit, STOP

1. Předem schválený datový přenos zajistí lokální Git objekty PR121
   `ae3b4df53c25557f28b4a25ccb65adc2abdff639` a PR136
   `1d6a786c77aa2a797bf7bd75f9977a3ae6613459`; test-only YAML blob
   `ec8a2664d2d051f2ef40ee4b51564cc95dcb7485`, SHA256
   `e31e02bc0938a6ba28c514765380c5bbd1b99c230117d0b0128618d562431120`.
   Pouhé fetch-depth1 HEAD nestačí. Ověřit commit/blob typ, hash a obsah před
   testem; helper neměníme, žádný URL fallback, alternativní hash nebo SKIP.
   Historické YAML jsou data, ne workflow ke spuštění. Child disposable clone
   dostává přesný ae3 objekt pouze z již ověřené absolutní lokální cesty.
2. Před během inventarizovat vlastní procesy podle PID + creation time,
   Job membership/handles a WSL distribuce/procesy, existující privátní temp,
   workspace, disk/free space a výstupy. Nikdy nezabíjet cizí proces podle
   názvu/PID, nikdy „uklidit všechno“ pod /root či runner workspace.
3. Windows normální podprocesy vést existujícím vlastníkem s Job-list při
   CreateProcessW, suspend/membership/image/time před resume, private handle,
   KILL_ON_JOB_CLOSE a no-breakaway. Quick potřebuje úzkou adaptaci per-command
   workeru na tuto existující cestu; spawnSync timeout sám potomky neprokazuje.
   Timeout payloadu musí být kratší než timeout owneru (stávající maximum
   480 s), logy omezené; dlouhou sadu rozdělit podle jednotlivých příkazů.
   Žádný nový thread/Job framework, owner PID kill nebo automatický retry.
4. WSL použije **pouze již existující schválený nonroot** v Zamerovac-Ubuntu-QA,
   nový privátní ext4 run adresář, nikoli /root/zamerovac-qa-commits/$sha.
   Pokud cesta existuje, STOP, nikoli reset/rm/reuse. Ověřit tracked/untracked
   i ignored obsah proti schválenému manifestu před/po (HEAD nestačí), cache
   read-only a mutable Gradle home/reporty odděleně. Nastavení /root/.gradle
   z dnešního workflow nepřebírat. Node-dependent Python discovery zůstává
   Windows-only; WSL spouští jen schválené Java/PDF a Node-independent sondy.
5. Skutečně ověřit WSL2 limit 4096 MiB / 2 CPU, Gradle 1 worker,
   -Xmx1536m + MaxMetaspace384m, bez emulátoru. Vypsaná věta není ověření.
   Návrh diskových stop mezí P4: quick 2 GiB, browser 2 GiB, WSL mutable
   8 GiB, preview 4 GiB; host rezerva nejméně 10 GiB a ext4 12 GiB před
   začátkem. Rozměry jsou **navržené, nezměřené**, ne existující hard quota.
   Měřit všechny vlastní zápisy/logy/profily/reporty/cache změny, přerušit
   kooperativně před rezervou a prokázat cleanup. Monitor není hard limit;
   pokud bezpečnou mez nelze ověřit/vynutit dostupnými prostředky bez změn
   PC, daný job BLOCKED a koordinátor rozhodne další krok, nikoli nový download.
6. Windows Job na wsl.exe není důkaz containment Linux procesů. Existující
   WSL launcher potřebuje schválenou lokální procesní skupinu/identitu v
   nonroot run scope, bounded kooperativní STOP a ověření nulových potomků
   uvnitř distribuce. Bez runtime důkazu se native-jvm nespustí. Žádný
   distro-wide wsl --terminate/shutdown ani změna práv jako cleanup fallback.
7. Po každém normálním/failure/cancel konci nezávisle ověřit Job active=0,
   wait/close origin handles, WSL scope empty, odstranění vlastních temp,
   profilů, staged checkoutů, logů a všech technických APK včetně předchozí
   stažené. Nejen del bez kontroly: ověřit absenci a audit před/po, žádnou
   změnu ostatních cest. Ponechat jen schválený redigovaný důkaz. Cleanup
   failure, disk overflow, timeout či cancel nikdy nemůže skončit PASS.

**STOP pravidlo:** neznámý cleanup/handle/proces nebo přerušený runner znamená
BLOCKED, zastavit frontu dalších QA pokusů a vyžádat read-only audit vlastníkem
podle schváleného postupu. NO RETRY, žádný rerun ani mazání stavu pro zelený
výsledek. `if:always` nedokazuje úklid při smrti runneru. Zaseknutý CreateProcessW,
forced owner death a bounded rollback jsou **NOT PROVEN**; syntetické modely
ani normální no-op je neprokazují. Nezařazovat je do běžného HOME4/4; varianta C
z PR140 se zde neintegruje.

## F: přesné výsledky a quick

Před vstupem do povinné sady určit absolutní existující Node EXE a Python EXE
(kandidát Python `C:\actions-runner\tools\Python313\python.exe`), přesnou verzi
a SHA256. Node path/hash a Python hash zatím chybí. Použít process.execPath a
ZAMEROVAC_PYTHON po ověření, nikdy py -3 ani hledání jiného Pythonu.

Původní model57 registry beze změny: Python test_qa_process_diagnostic 10,
test_qa_windows_job_contract 9, test_qa36_supervisor_model 3; Node
qa36_soft_timeout 2, qa34_client_gate_integration 9, qa41_diag 10,
qa_fixture_attempts 13 a jediný R44-01 z qa_gate_3try_integration 1.
Celkem **22 Python + 35 Node = 57**, nula FAIL/SKIP. Nezdvojovat metody při
počítání opakovaného preflightu. Původních15 home_qa_integrity má přesná jména
a pořadí v qa-fixture-tap.cjs; povinně 15/15/0/0 ve Windows, žádná záměna
za 14/15 Linux nebo HTTP --self-test. Nový návrhový modul přidává 9 modelových
unittest metod s negativními subscénáři; není součástí původních57.

Celý quick na base obsahuje 62 JS a 23 Python testových souborů, nikoli 57
testů. Před aktivací zmrazit **jmenný registr všech povinných případů pro
finální SHA**, včetně plain-assert JS (Node wrapper count není počet jejich
assertions); nesmí vzniknout z právě ořezaného výsledku. Schválená nepovinná
platformní část musí být jmenovitě NOT RUN/SKIP mimo povinnou sadu. Existujících
3 JS + 11 Python Linux-only kernel fault testů se ve Windows nesmí odblokovat.
Žádný Windows fault payload pod záminkou dosažení nuly SKIP.

Povinný PASS vyžaduje přesné unikátní metody/cases + souhrn + ukončení bez
signálu + exit0 + žádné chybové diagnostiky + ověřený cleanup. Unittest/TAP
summary samotný nestačí; nedůvěřovat command exit0, duplikovanému souhrnu ani
chybějící metodě. Zachovat existující parser15 včetně CRLF/redakce. CMD musí
zachytit errorlevel bez pipe/findstr a skončit nenulově při každém BLOCKED;
žádné continue-on-error, timeout => PASS či chybějící report => SKIP.

## G: dvě JVM acceptance možnosti a navazující APK

**M0 — dnešní main:** nepřebírat 513/511+2 z PR121. Zmrazit aktuální jmenný
manifest skutečných main XML/metod a chráněných diagnostik; každá povinná
metoda PASS, zero FAIL/ERROR/SKIP, raw exit0, přesný počet a čerstvost.
Přesný main runtime manifest zatím chybí: BLOCKED; >=265 není acceptance.
Pokud má main také #88 FAIL, zůstávají raw FAIL a M0 neprojde, žádná automatická
výjimka. Nevyvozovat počet provedených metod ze zdrojového počtu @Test.

**I0 — integrovaný PR121 bez výjimky:** celý jmenný registr 64 XML / 513 metod,
zero FAIL/ERROR/SKIP + raw exit0. Známé dvě raw FAIL #88 to nyní blokují;
oprava sync by byla samostatný schválený produktový úkol, ne změna očekávání QA.

**I88 — explicitně schválená oddělená acceptance:** přesně64 čerstvých XML /
513 unikátních metod, 511 PASS + 2 raw FAIL / 0 ERROR / 0 SKIP, raw Gradle
exit1. Názvy i přesné zprávy jsou v původním proposal (a novém testu):
driveStagedAckMustNotPublishAfterLocalAuthorityLostInsideProviderCommit a
safDirectAckMustNotPublishAfterLocalAuthorityLostInsideProviderWrite z
cz.zamerovac.app.SafSyncV2Test. Zachovat celý jmenný manifest, SHA256 původních
diagnostik/helperů/E2E a všech49 chráněných metod (2 reconciliation + 24 safety
+ 23 DB evidence). Missing/duplicate/rename/extra/stale XML, jiná aserce/type/
message, třetí FAIL, raw exit0/2 nebo diagnostika PASS/SKIP/ERROR => BLOCKED.
Případný product_acceptance=PASS je jiná veličina; **raw Gradle zůstává FAIL**.

Nové související zdrojové zjištění: existující PR121 sync-ack-acceptance.py
není tento striktní companion: používá >=64/>=513, substring zprávy, jen část
registru, 2 workery a subprocess bez tohoto containment/timeout kontraktu.
Nekopírovat jej rovnou do HOME. Navržený strict companion a prověřenou recipe
#117 adaptovat až po P3; starý skript v cizím PR se zde nemění.

Pro každou variantu zachovat negativní tools/drive-config-checks verify,
verifyDriveRegistration a Java compile. Čerstvě generované tři ZIP
customer-pdf-1, customer-pdf-3 a customer-pdf-multipage musí projít nezávislým
tools/check-customer-pdf.py včetně renderu/obsahu/počtů, nikoli jen existencí.

Preview až po obsahově doloženém úspěchu quick/browser/native podle schválené
acceptance a stejného SOURCE/V/run/attempt. Současné needs zachovat; netvrdit
4/4 z pouhé GitHub conclusion ani ze SKIP jobu. I88 by navíc vyžadovala
výslovné schválení mapování oddělené acceptance na job/release policy, nové
ověřování acceptance reportu v release guardu a pravdivý název jobu. Bez něj
preview/release BLOCKED. Žádné continue-on-error.

Poslední načtená release metadata: test-v1.3.0, asset Zamerovac-v1.3.0.apk,
3 220 629 B, API digest d9c1c214771732a7dac4ff890eb0df8e48c3f0d3559f01c0d1d106f8b39c75e7.
APK nebyla stažena ani podpis ověřen v této relaci. Před budoucím technickým
buildem znovu ověřit aktuální poslední publikovanou relevantní release,
asset ID/hash, skutečný apksigner verify, cert
c828c96739e554e8da4f5851913356134f1359a98d5013772ad5587e74a2d229,
package cz.zamerovac.app.preview a skutečný vyšší versionCode (nikoli fix1155
či jen workflow counter), odpovídající versionName. Release změněná mezi
preflightem a výsledkem => STOP. Po technickém testu ověřené smazání všech APK;
žádný upload/release/instalace. Aktuální zadání **žádný build nepovoluje**.

## Rozhodnutí pro koordinátora/vlastníka — před implementací

| ID | Konkrétní výběr / podmínka | Výchozí stav |
| --- | --- | --- |
| P1 | M (main, pouze při zachování23/96) nebo I (nejprve samostatně schválená integracePR121). Schválit exact SOURCE/EVENT/V a úzkou manual/main browser policy, nový byte manifest po SOURCE review. | NEROZHODNUTO, budoucí piny chybí. |
| P2 | a) přesné Git/Actions read-only vstupy; b) pouze redigované omezené důkazy; c) release asset online zvlášť, nebo předem ověřený offline asset s čerstvou autoritou. Existující nástroje/cache/nonroot/limity nejdříve read-only doložit, žádná instalace. | NEROZHODNUTO / dostupnost NOT VERIFIED. |
| P3 | M0, I0, nebo I88 s transparentní oddělenou acceptance a přísným companionem; žádná automatická výjimka pro main. | NEROZHODNUTO; rawFAIL nelze označit PASS. |
| P4 | Schválit kompletní required/optional registry quick, per-command existing Job adaptaci, WSL cleanup důkaz, měřitelné diskové meze a STOP postup, nikoli hard-hang experimenty. | NEROZHODNUTO; runtime containment/limity mimo browser nejsou doložené. |

Po rozhodnutí až samostatná úzká implementace změn aktivní policy + nové
nezávislé SOURCE review a souhlas s jedním přesným ručním během. Existující
home_qa_gate.py generuje jinou canonical one-shot push recipe; není generátor
main manual4/4 a jeho strict lint nelze použít jako falešné schválení jiné
YAML. Zvláštní kontrola změny stávajícího workflow podle AGENTS je nutná.

## Ověření tohoto balíku a hranice důkazu

Nový tests/test_home4_preactivation_design.py obsahuje jen unittest a čisté
in-memory reference modely. Fiktivní validator b×40, syntetické cache,513
metod a64 XML **nejsou skutečné registry, prostředí ani schválení**. Model
nic nespouští, nestahuje, neopravuje ani neautorizuje; nesmí být importován
do runtime. Další2 read-only Node testy v home4_preactivation_boundaries.js
ověřují reálný pin/obsah checkoutu a skutečné stávající odmítnutí browser
validátorem (pozitivní control je historická predicate, nikoli spuštění).
Statický test potvrzuje dosavadní manual workflow a neslučitelnou
historickou browser policy, nesnaží se je změnit.

Relevantní opakovaná regrese používá skutečné stávající validátory: 57,
15-case integritu (Linux14PASS/1Windows junctionSKIP), TAP LF/CRLF/summary/
exit/redakci, browser hash/path/sandbox modely, reference/shallow a platformní
dispatch guardy, procesní modely, preflight/cert/package/version/redirect a
home_qa_gate strict generator negativy. Výsledek každého příkazu, SHA a hash
důkazu jsou v autorském předání. Nevymýšlet Windows PASS z Linux modelu.

**Nový regresní blokér L1:** při opakování na `0292718df8252eb4ffa62c0a80b7ec0f631d0eda`
selhalo vytváření kompletního stromu původní Linux-only fixture v
test_qa_process_supervisor.OwnedRunnerTests.test_cleanup_error; samostatné
opakování zachytilo stejnou assertion v test_cancel (další dva průchody11
metod byly PASS). Vlastní nové9+2 testy a původních57 prošly. Tyto výsledky
nejsou stabilní celá zelená regrese. Zdroj fixture čeká na leader/child/leaf
před spuštěním heartbeat senderu, ale owner má heartbeatTimeout0,35 s a
worker timeout0,8 s; samotný tree wait má2 s. Tato neslučitelná okna jsou
zdrojový fakt; že způsobila konkrétní zachycené selhání, je **hypotéza**, bez
zachyceného owner verdictu ji nelze vydávat za prokázanou příčinu.

Před runtime aktivací L1 došetřit v Linuxu: minimální další krok je v původní
fixture zachytit redigovaný owner reason při neúspěchu formation a test-first
ověřit pomalou přípravu stromu. Případná oprava musí oddělit přípravu fixture
od měřeného fault scénáře a nepřepisovat produkční timeouty/guardy ani Windows
skip. V tomto **výhradně inertním návrhovém** balíku se existující živý
process-fault payload ani jeho harness nemění; blokér se neskrývá opakováním
do PASS. L1 vyžaduje cílené autorské řešení před tvrzením úplné runtime regrese,
nikoli HOME experiment. Předimplementační review tohoto návrhu může přímo
posoudit i tento zaznamenaný blokér; není to žádost o aktivaci.

**NOT RUN/BLOCKED:** HOME4/4 a Windows token/Job/junction na novém SHA,
Chromium/CDP/pixely/IndexedDB, WSL/JVM a skutečné64/513 XML, PDF ZIP render,
APK build/signer/asset download/cleanup na Windows, Android/S Pen/Bosch/
reálný Drive. Bounded hard-hang/owner-death rollback NOT PROVEN. Nula
spuštěných Actions/HOME/buildů v tomto úkolu. Dokončení návrhu neodblokovává
aktivaci; předává se jinému kontrolorovi k **předimplementačnímu** review.
