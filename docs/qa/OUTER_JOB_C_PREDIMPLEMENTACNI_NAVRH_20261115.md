# Windows HOME QA – varianta C: předimplementační bezpečnostní návrh
**Stav: DESIGN / kontrola Koordinátora 42 opravila D1–D3 a R42-A–G; koncepční rizika bez native důkazu zůstávají BLOCKED. Nezávislá závěrečná kontrola: Kontrolor 46. ŽÁDNÁ IMPLEMENTACE, MERGE ANI RUNTIME TEST.**
Autor návrhu: Koordinátor 42, 15. 11. 2026.

## 1. Přesná výchozí verze a zdroje
- Repo zaplikj30-ui/Zamerovac-android, návrh vychází z PR #136 HEAD **1d6a786c77aa2a797bf7bd75f9977a3ae6613459**, base PR136 **172b9c8aa32b321609606e285824d02fbab9fa72**, main **8d05d2dd77c4a99f8ad64191c97d37ee3c151e3b** při přípravě. Tento dokument je pouze v oddělené návrhové větvi nad PR136, ne v cizí větvi.
- Rozhodnutí a úplné srovnání A–E od Codexu: https://github.com/zaplikj30-ui/Zamerovac-android/issues/42#issuecomment-6883637034 . Nezávislé delta review aktuálního PR136: https://github.com/zaplikj30-ui/Zamerovac-android/pull/136#pullrequestreview-5906675585 .
- Doložené historické HOME testy: https://github.com/zaplikj30-ui/Zamerovac-android/actions/runs/43629772378 (57/57 modelů) a https://github.com/zaplikj30-ui/Zamerovac-android/actions/runs/43630576900 (normal native no-op + 15/15 TAP). Poslední testoval historický product SHA ae3b4df53c25557f28b4a25ccb65adc2abdff639. **Nic z toho není runtime PASS varianty C ani současného Androidu.**
- Postinstalační HOME inventura: https://github.com/zaplikj30-ui/Zamerovac-android/actions/runs/43665490873 ; Windows 11 / Zamerovac-Win11-QA / účet ZamerovacQA, kontrolní SOURCE SHA 0591009eeb7344b11e638fed674f76cfd909fdac: **MSVC 19.52.37029.0 nalezen, Windows SDK 10.0.26100.0 nalezen, Node.exe 26.13.0.0 nalezen**. node_api.h, node.lib a node-gyp nebyly nalezeny v prověřovaných cestách. Skutečný C++ build / addon LOAD / vnější Job / nesting = NOT RUN. Podrobnosti: https://github.com/zaplikj30-ui/Zamerovac-android/issues/42#issuecomment-6887640844 .
- Relevantní aktuální PR136 kód: tools/qa-process-client.cjs (Node používá child_process.spawn a měkký CANCEL), tools/qa_owned_processes.py (WindowsJob.start, CreateProcessW + JOB_LIST a HANDLE_LIST; self.process až po návratu API; Python drží vnitřní Job), tools/qa_process_supervisor.py (IPC reader/timeout až po scope.start), tools/qa-fixture-gate.cjs a tools/qa35-noop-gate.cjs (PASS brány), tools/qa-fixture-attempts.cjs (STOP/NO RETRY po CreateProcessW).

## 2. Problém, cíl, hranice
**Problém:** Jestliže se synchronní CreateProcessW ve WindowsJob.start nevrátí, Python neprojde na reader/timeout/finally; Node po měkkém timeoutu pouze posílá CANCEL, nemá přístup k Windows Job handle a čeká na close. Jde o **architektonické riziko**, ne reprodukovanou skutečnou chybu kernelu.
**Cíl:** Udržet Node dohled funkční mimo případně zaseklý Python. Založit nezávislý vnější Job, který pokryje Python i potomky a který může Node při selhání ukončit a zkontrolovat. Stávající osvědčené vnitřní řízení Python WindowsJob ani původní 15 TAP nepřepisovat.
**Mimo rozsah:** Android produkt, data, média, fyzický stylus/Bosch/Drive, účet/ACL/služba/Play, runner service, automatický cloud, release, APK, obecný procesní sandbox a záruka vyřešení kernel/driver hard hang. Windows JobObject není plný sandbox ani univerzální rollback nevracejícího se CreateProcessW. Při nejistotě STOP/BLOCKED, nikdy falešný PASS ani automatický retry.

## 3. Důležitá technická podmínka – nestačí „přidat Job“ k Node spawn
Současný Node client používá child_process.spawn přímo pro Python. Post-create AssignProcessToJobObject by ponechal nechráněné okno mezi spuštěním a přiřazením, proto **není přípustnou implementací C**. Pokud nový most nedokáže bezpečně nahradit také první vytvoření Python procesu (včetně stdin/stdout/stderr a jejich přesného řízení), není C v této podobě implementovatelná bez další architektury. Tato integrační složitost nebyla existujícími HOME testy ověřena.
**Podmíněný návrh C:** jeden Node-API (N-API) modul pouze pro Windows x64 a minimální JS adaptér. Žádný nově běžící guardian, žádný obecný FFI framework. Linuxu se tento modul nesmí dotknout. Žádný náhodný stažený .node soubor ani nekontrolovaná distribuce binárek.

### 3a. Nativní lifecycle
1. **NEW → JOB_READY:** v procesu Node (mimo vlastní outer Job) vytvořit privátní NEPOJMENOVANÝ vnější JobObject, nastavit KILL_ON_JOB_CLOSE, nezapínat BREAKAWAY. Ownerem handle je Node addon; nikdy nepředávat ani nezdědit tento handle Pythonu/workeru. Kritická chyba Job/ACL/limitu = fail-closed ještě před startem.
2. **JOB_READY → STARTING:** vytvořit stdin, stdout, stderr pipes pouze s nezbytnými konci; práva, identita Python executable, cwd a argumenty přes whitelist, žádný shell. V samostatné nativní asynchronní úloze připravit STARTUPINFOEX; JOB_LIST připojí Python k vnějšímu Job **již při CreateProcessW**, HANDLE_LIST omezí děděné standardní handles, s povoleným inheritem jen pro ně. Volání použije CREATE_SUSPENDED a EXTENDED_STARTUPINFO_PRESENT, unicode zapisovatelný buffer a pevný lpApplicationName. Žádný CREATE_BREAKAWAY_FROM_JOB.
3. **STARTING → VERIFIED_SUSPENDED:** pouze po *prokazatelném návratu* CreateProcessW získat proces/thread handle a před resume ověřit IsProcessInJob vůči konkrétnímu outer Jobu, očekávanou image path, identitu účtu/token a creation time. Při selhání ukončit handlem; nikdy nepokračovat bez doloženého Job membership.
4. **VERIFIED_SUSPENDED → RUNNING:** pod JEDNÍM nativním synchronizačním mechanismem rozhodnout, zda byl STOP už přijat, nebo je rezervovaný jediný pokus o ResumeThread. Po přijatém STOP není povolen žádný další resume. Souběžná, dosud nelinearizovaná žádost o CANCEL může závodit s právě rezervovaným voláním: stále musí být zaručeno at-creation připojení k outer Jobu, sticky BLOCKED a následný prokazatelný úklid; **netvrdit bez důkazu absolutní zákaz fyzického ResumeThread po timestampu JS CANCEL**. Python pak uvnitř vytvoří dosavadní inner Job při vytvoření workeru pomocí JOB_LIST. Testovat skutečné vnoření pod existujícím runner-parent Jobem; neúspěch nesting = BLOCKED, ne fallback bez containmentu.
5. **RUNNING → STOPPING:** při timeoutu, přerušení IPC, pádu ownera, overflow, rozporu protokolu nebo ztrátě heartbeat musí Node zaznamenat sticky BLOCKED, zakázat nový launch/resume, bezpečně požádat o CANCEL a dle politiky následně provést TerminateJobObject na vlastním outer Jobu. Sám Node a jeho runner mimo outer Job. PID-only kill/child.kill, TerminateThread ani jmenné OpenJobObject+NOT_FOUND jako „důkaz úklidu“ nepoužívat.
6. **STOPPING → VERIFIED_CLOSED:** s drženým originálním Job handle vyčkat na doložený exit původního Python procesu a aggregate active-count=0, potvrdit uzavření zděděných pipe/child handles, ukončení *všech dokončených create operací*, bezpečný úklid vlastního TEMP. Teprve poté pozitivní cleanup attestation. Pokud se CreateProcessW stále nevrátil nebo není jistý okamžik přiřazení → **BLOCKED/UNKNOWN, nikdy CLEAN/PASS**, ani když Query Job ukáže momentálně nulu. CloseHandle chyby znamenají nejistý stav, ne PASS.
7. **Smrt Node:** KILL_ON_JOB_CLOSE ukončuje procesy již skutečně přiřazené k outer Jobu. Nezaručuje, že jaderná operace CreateProcessW nemohla být „in-flight“; žádná pozitivní atestace ani neznámé automatické opakování. Smrt Python: Node může použít stále držený outer Job, ale atestace opět vyžaduje skutečné ověření.

### 3b. Asynchronie a IPC – ZÁSADNÍ BLOKÉR NÁVRHU
- Synchronní CreateProcessW nesmí blokovat Node event loop ani watchdog. N-API napi_create_async_work by přesunulo práci do poolu, **ale napi_cancel_async_work neumí zrušit již běžící nativní volání**. Návrh musí před implementací vyřešit životnost nativních bufferů, handle, callbacků a bezpečný odchod Node, i když create úloha visí. Nevynucovat TerminateThread.
- Node klient dnes vyžaduje child.stdin.write/end, child.stdout data a close. Nový adapter musí bezpečně zajišťovat **stejné pořadí a meze IPC** (1 MiB stdout, heartbeat, error/close, redakce stderr), např. nativními čtecími pracovníky a omezenou N-API threadsafe frontou. Toto **není vyřešené zadáním jedné .cc funkce**. Nelze stavět na nepotvrzeném převodu raw Windows HANDLE na Node.js stream.
- Vnější výsledek musí být oddělená nezfalšovatelná stavová evidence modulu/Job handle, ne hodnoty dodané přes stdout z Pythonu. Parser si dál ověřuje token/protocol/exit; PASS až při vnitřním i vnějším cleanup Verified a odstranění vlastního TEMP. Chybějící outer evidence = BLOCKED. Žádný retry po CreateProcessW i při 0 procesů.
- Pokud reprodukovatelná bezpečná implementace pipe/IPC transportu, bootstrap/late-return a Node owner shutdown není prokazatelná bez dalšího guardian procesu, **STOP a nové cílené C-versus-B rozhodnutí**, ne improvizované připojení Jobu po spawn.


### 3c. C44-D1 / P1 – přesný lifecycle, synchronizace a in-flight CreateProcessW

**Jediný zdroj pravdy:** nativní OwnerContext se synchronizovaným stavem, stopRequested a monotónním sticky BLOCKED. JS může požádat o STOP, ale nesmí mít paralelní vlastní „resume povoleno“. Zámek se nesmí držet při blokujících Win32 operacích: CreateProcessW, ReadFile, WriteFile, WaitForSingleObject, TerminateJobObject. N-API async work neznamená zrušitelné běžící CreateProcessW; napi_cancel_async_work to negarantuje.

| Stav | Povolený další krok | STOP a fail-closed |
| --- | --- | --- |
| NEW | ověřit účet, vytvořit outer Job a nastavit KILL_ON_JOB_CLOSE; teprve po úspěchu → JOB_READY | bez nového procesu při STOP; chyba vytváření Jobu je BLOCKED |
| JOB_READY | připravit tři pipe a STARTUPINFOEX, vstoupit do STARTING; zvýšit in-flight počítadlo **před** uvolněním zámku | STOPPING bez CreateProcess; nesmí vzniknout druhý Job handle |
| STARTING | po prokazatelném návratu CreateProcessW převzít originální process/thread handles → VERIFIED_SUSPENDED | při CANCEL před / během / po API: STOPPING; pokud CreateProcessW nevrací, UNKNOWN a nikdy PASS |
| VERIFIED_SUSPENDED | ověřit IsProcessInJob + image/token/time; pod jedinou nativní synchronizací buď přijmout STOP, nebo rezervovat jediný ResumeThread permit → RUNNING | Po přijatém STOP žádný nový permit; žádost souběžící s již rezervovaným ResumeThread = sticky BLOCKED a výhradně contained cleanup; neprokázaná atomika => BLOCKED |
| RUNNING | bounded IPC, wait originálního process handle, pipe EOF → STOPPING | timeout/IPC/kill/cancel sticky BLOCKED |
| STOPPING | TerminateJobObject na **vlastním** outer Job, uzavřít veškerý in-flight/pipe/proc lifecycle, audit → VERIFIED_CLOSED | nejistý handle nebo in-flight → UNKNOWN; STOP nesmí vytvořit další proces |
| UNKNOWN | pouze BLOCKED a izolovaná diagnostika; NO RETRY | žádný fiktivní cleanup/Job=0 PASS |
| VERIFIED_CLOSED | terminální stav pouze po všech C44-D3 atestacích | žádný návrat do RUNNING, žádný druhý close |

**Kritická podmínka STOP vs. ResumeThread:** prostá kontrola bool pod zámkem před odemčením není dostatečná. Implementátor musí vymezit linearizační bod výhradního „resume lease“ a prokázat, že STOP/finalize současně neuzavře použitý HANDLE, neumožní druhý resume a nepustí proces mimo již při vytvoření připojený Job. Přijde-li STOP těsně po rezervaci, ale před reálným ResumeThread, nelze bez dalšího tvrdit „žádné fyzicky pozdní ResumeThread“. Buď je doložen bezpečný atomický mechanismus, nebo musí být přechod označen BLOCKED/UNKNOWN a nesmí nikdy vzniknout falešný PASS. Tato konkrétní volba zůstává **otevřenou implementační branou**, ne důkazem hotové bezpečnosti.

**Vlastnictví:** každému Job/process/thread/pipe HANDLE právě jeden vlastník, atomické předání mezi etapami a jednoruční, kontrolovaný CloseHandle. Outer Job vlastní výhradně Node OwnerContext; Python/worker jej nezdědí a Python dál výhradně vlastní inner Job. Před CreateProcess zvýšit refcount/in-flight; startup argumenty, writable command line, STARTUPINFOEX, seznam atributů a handle list zůstávají živé, dokud se native API **prokazatelně nevrátí**. Jediný final callback/promise, idempotentní STOP/close, žádný double-free, use-after-free ani TerminateThread.

**Node teardown:** po zániku napi_env už žádný callback do JS. Frontu bezpečně uzavřít, zachovat platnost OwnerContext do doběhnutí posledního native volání; nezastavená funkce nesmí číst uvolněné buffery. Nelze-li prokázat bezpečné ukončení/teardown při trvale zaseknutém CreateProcessW, je to UNKNOWN/BLOCKED bez runtime testu na cenném HOME hostu; před implementací je nutný důkazně realizovatelný native ownership/shutdown návrh.

### 3d. C44-D2 / P1 – creation-time Python, 3 pipes a přesný IPC kontrakt

Nový at-creation bootstrap je **náhradou** nynějšího Node child_process.spawn pouze na Windows, nikoli pouhým post-spawn AssignProcessToJobObject. Process creation: pevné lpApplicationName (ověřený Python executable), writeable command line, bez shell/PATH fallbacku, STARTUPINFOEX se správnou velikostí, STARTF_USESTDHANDLES, EXTENDED_STARTUPINFO_PRESENT, CREATE_SUSPENDED, bInheritHandles=TRUE, PROC_THREAD_ATTRIBUTE_JOB_LIST obsahuje **jen původní outer Job**, PROC_THREAD_ATTRIBUTE_HANDLE_LIST **jen 3 child stdio ends**. Žádný BREAKAWAY. Neřídit dědičnost sdílených parent handles; vytvořit samostatné inheritable child ends.

| Roura | Jediný děděný child konec v HANDLE_LIST | Neděděný parent konec v Node | Směr |
| --- | --- | --- | --- |
| stdin | child READ (inheritable) | parent WRITE (non-inheritable) | Node → Python: serializované ALIVE/CANCEL + token |
| stdout | child WRITE (inheritable) | parent READ (non-inheritable) | Python → Node: bounded byte buffer |
| stderr | child WRITE (inheritable) | parent READ (non-inheritable) | Python → Node: vždy vyčíst a zahodit osobní obsah |

Všech šest pipe konců má jednoznačného vlastníka. Parent po úspěšném CreateProcess uzavře vlastní child-end kopie; child nedědí parent ends ani Job handle. Chyba create nebo suspend/resume nesmí přeskočit cleanup; při in-flight API se žádné jím používané handles/buffery neuvolňují. Musí být dokázána bezpečná možnost současného spuštění více pokusů bez leakage cizích konců.

**I/O model:** ReadFile, WriteFile a WaitForSingleObject pouze mimo Node JS event loop (oddělené native threads nebo auditované overlapped IO), nikoli blokující JS volání. Vstupní/výstupní data do JS přenášet přes omezenou napi_threadsafe_function frontu či ekvivalent; po zaplnění okamžitý sticky BLOCKED + STOP, nikoli neomezená alokace nebo blokování watchdogu. Nepředpokládat automatickou transformaci Windows HANDLE na Node stream bez potvrzeného adapteru. stdout celkem max **1 048 576 BYTŮ**, ne znaků JS; stdin pending nejvýš navržených 64 KiB; stdout/stderr event queue nejvýš 64 KiB na směr (ověřit v testech). stderr nikdy neposílat do veřejného logu/reportu; pokud přijatých raw stderr dat překročí rozumný cap, BLOCKED. U partial write/read musí být zachováno pořadí, UTF-8 hranice, backpressure, heartbeat a CANCEL; po CANCEL už žádné další ALIVE.

**Události:** nanejvýš jeden error, data před EOF, exit až po signalizovaném originálním process handle, close až po obou výstupních EOF, dokončených I/O a uzavření parent/child handles. Po close nesmějí přicházet data/error. Chybějící close/EOF, porušené pořadí, overflow, write-after-close, zaniklé napi_env nebo poškozený token => BLOCKED bez retry. Stdout JSON Pythonu se ověřuje dosavadním token/event/platform/exit/diagnostic kontraktem, ale nesmí sám potvrdit outer cleanup.

**Předimplementační STOP bod:** jestli nelze doložit bezpečné Windows pipe/async adapter chování bez dalšího guardian procesu a bez nezajištěného překladu raw HANDLE→JS stream, neimplementovat addon a předložit krátké C vs. B vs. ponechat A (PR136).

### 3e. C44-D3 / P1 – důkaz outer cleanup a přesná PASS podmínka

Nativní outerCleanupVerified=true smí vzniknout **jen** z původního OwnerContext, nikoliv z dat stdout Pythonu, a při SOUČASNÉ platnosti:

1. Všechny CreateProcessW/ResumeThread/Stop/nativní pipe operace dokončeny, žádný neznámý in-flight call, žádný nerozhodnutý STOP/START závod, žádná možnost pozdního přiřazení či resume.
2. Originální Python process HANDLE potvrzuje skutečný exit (úspěšný TerminateJobObject, PID lookup, boolean killed či samotný GH timeout nestačí); token/image/creation identity odpovídají ověřenému procesu.
3. Úspěšný QueryInformationJobObject **na stále otevřeném stejném outer Job HANDLE** ukáže ActiveProcesses=0; vyloučeno nové pozdní připojení procesu. Job=0 u in-flight CreateProcess není důkaz bezpečí.
4. Všechny pipe/child/process/thread handles i nativní workers dokončily, byly bezpečně uzavřeny; chybný/duplicitní CloseHandle = cleanup NOT VERIFIED.
5. Oddělená interní identita OwnerContext/generation nonce váže attestation na právě tento pokus; nesmí ji poskytnout či podvrhnout stdout Pythonu; chybějící atestace = BLOCKED.
6. Úklid vlastního TEMP **po** ukončení pipe/native workers a nezávisle ověřená nepřítomnost TEMP.

**Celkový PASS** jen pokud outerCleanupVerified + vnitřní Python cleanupVerified + inner remainingProcesses=0 + přesný dosavadní token, protocol, worker exit0, 15-TAP marker při příslušném testu, stderr bez protokolu, žádné timeout/abort/diagnostic/IPC/close chyby a TEMP skutečně pryč. Každý STOP/CANCEL, timeout, chyba API/pipe, neprokázaný cleanup nebo nesoulad protokolu nastavuje sticky BLOCKED **i kdyby** později fyzicky proběhl úklid. outerCleanupVerified=false + ownedRemaining=null při nejistém stavu; nikdy měnit na 0/PASS z domněnky či stejného JSON zdroje.

**Smrt Pythonu:** Node ukončí a ověří vlastní outer Job, nenahradí to Python exit message. **Smrt Node:** nelze vydat PASS; KILL_ON_JOB_CLOSE chrání jen již připojené procesy, neprokazuje rollback libovolného in-flight CreateProcessW. Žádné PID-only kill, cizí procesy, automatický retry, OpenJobObject NOT_FOUND jako důkaz ani schovávání neznámých potomků.

**Předběžné povinné kontraktní testy:** C44-D1 stavové přechody a bariéry CANCEL před/během/po native create, late return + STOP před resume, refcount/teardown/single close, native event loop nezablokovaný; C44-D2 inheritance všech 6 pipe ends, partial I/O, Unicode na 1 MiB hranici, stderr backpressure a redakce, pořadí EOF/exit/close, raw HANDLE leak; C44-D3 Job0 s in-flight, chybějící process exit, záměna Job handle, opožděný callback, forged Python PASS, no TEMP cleanup, dvojí Job attestace a NO RETRY. Všech 57 historických modelů a původních 15 TAP zachovat bez oslabení. Skutečné native failure/crash/hang testy jen obnovitelná Windows VM, nikoli 16GB domácí PC.

**NO-RETRY je závazné i pro zdánlivě čistý CreateProcessW fail, Job ActiveProcesses=0 či úspěšný outer Terminate.**

**Konkrétní rozhodovací brána:** Pokud autor nedoloží v jednom úzkém N-API addon adapteru bezpečné ownership + bounded transport + no late resume/cleanup bez dalších procesů, tento návrh C je STOP; koordinátor vyhodnotí nejmenší bezpečnou variantu B nebo zachování osvědčené A. Tento dokument není runtime PASS ani souhlas s programováním.

### 3f. Koordinátor 42 – hloubková kontrola integrace, opravy a přetrvávající hranice

Tato kapitola doplňuje D1–D3 po věcné kontrole **skutečného** Node klienta (qa-process-client.cjs), Python supervisoru a WindowsJob (qa_process_supervisor.py, qa_owned_processes.py), gate (qa-fixture-gate.cjs, qa35-noop-gate.cjs, qa-fixture-attempts.cjs) na PR136 HEAD 1d6a786c77aa2a797bf7bd75f9977a3ae6613459. Nejde o test nebo nezávislé review. Dále vychází z oficiálních Microsoft CreateProcessW / nested jobs / pipe inheritance a Node-API TSFN dokumentace.

**R42-A – D1, přesný okamžik STOP/resume (P1):**
- Existují dva okamžiky: (a) uživatelský/JS požadavek na CANCEL a (b) **linearizované přijetí STOP nativním stavovým automatem**. Samotný JS timestamp, callback ani čtení boolean před ResumeThread nestačí k jednoznačnému určení, který úkon nastal dříve.
- Jedno vlastnictví „resume permit“: pod stejným synchronizačním primitivem buď STOP změní stav na STOPPING, **nebo** se jednoznačně rezervuje jediný závazný pokus o ResumeThread; po STOPPING/UNKNOWN žádný nový permit. STOP mezitím může okamžitě nastavit sticky žádost a z oddělené dohledové cesty ukončit **pouze vlastní outer Job** bez čekání na případně zablokovaný CreateProcessW. Resume permit nesmí být překlasifikován za „PASS“. Pokud vznikne STOP během již rezervovaného/spouštěného ResumeThread, proces zůstává v ochranném Jobu, výsledek BLOCKED a musí se prověřit jeho dokončení. Přísnější fyzické tvrzení „ani jeden ResumeThread nezačne po prvním časovém okamžiku JS CANCEL“ **není prokázáno** a nesmí být vydáváno za splněný kontrakt.
- Nutný důkaz: tabulka paralelních časování před zámkem, při rezervaci, bezprostředně před Win32 voláním, během volání a po návratu; každá běhová větev zachová jediný start, žádný necontainovaný proces a nikdy PASS po STOP. Pokud nejde prokázat tuto linearizaci s neblokujícím dohledem, implementace C se **nespouští**.

**R42-B – D3, dvoufázová pozitivní atestace (P1):**
- Vnější Job nelze současně „mít stále otevřený pro Query“ a „mít jej úspěšně zavřený“. Zavést dvě samostatné fáze: (1) při vlastnictví **otevřeného původního** handle QueryInformationJobObject + ověření ActiveProcesses=0, doložený exit originálního Python process handle a žádný in-flight START; (2) poté kontrolovaně uzavřít pipe/process/thread/Job handles a až po úspěchu všech CloseHandle zapsat finální outerCleanupVerified. Při selhání CloseHandle, vynechání Query, sporném posledním referentu Jobu nebo souběžném in-flight nemůže být atestace kladná. Pozitivní výsledek existuje až po druhé fázi a bezpečném TEMP cleanup. „Query po uzavření“ i „PASS před uzavřením“ jsou zakázány.
- Dosavadní Python inner attestation je **převzatá ze stdout** a nadále se musí ověřit tokenem/protokolem; **nepovažovat ji za vnější OS důkaz**. Vnější atestace musí být svázaná s původním nativním OwnerContext a pořadovým nonce.

**R42-C – fail-closed integrace Node klienta (P1):**
- Současný Windows Node používá child_process.spawn. Nový adaptor jej **musí nahradit na Windows** pro konkrétní QA owner; nesmí při chybě načtení binárky, neshodě hash, unsupported Node version/nesting ani selhání bootstrapu tiše spadnout zpět na nechráněný spawn. Výsledek STOP/BLOCKED před jakýmkoli novým Python procesem. Linux cesta může ponechat současné chování; není tím povolen fallback pro Windows.
- Zachovat původní IPC smlouvu: heartbeat ALIVE, CANCEL, limit stdout, chybějící close, error při startu, stderr redakce, source identity, sticky BLOCKED, přesné marker/exit podmínky a fail closed při odlišnosti protokolu. Native „child-like“ adaptor nesmí svou strukturou obejít kontrolu ve fixture/no-op gate.

**R42-D – TSFN/backpressure a paměť (P1):**
- Node-API max_queue_size pro napi_threadsafe_function je **počet položek**, nikoli limit bajtů; samostatně účtovat **bajty** atomickým čítačem včetně alokovaných kopií chunků, s malými horními hranicemi a event položek. Fronta v každém směru musí mít byte cap i item cap a při plnosti napi_queue_full přejít na STOP/BLOCKED, aniž zablokuje JS thread.
- Při napi_closing, chybě enqueue, odloženém callbacku nebo napi_tsfn_abort bez výjimky bezpečně uvolnit pouze vlastní payload, nezavolat JS v zaniklém napi_env a neprovést double-free. Worker threads si samostatně drží/release TSFN reference; po posledním release je nelze používat. Zrušení již běžícího napi_async_work není možné považovat za cleanup.
- Stderr i stdout se musí průběžně odčerpávat, jinak může Python uvíznout na zaplněné rouře; po překročení limitu vyhlásit sticky BLOCKED a ukončit vlastní Job, ale na naplněnou pipe nesmí navazovat další neomezené alokace. Výstupní limit stdout se měří na **skutečných byte chunkech** (1 MiB) ještě před převodem do JS UTF-16, nikoliv přes JS string.length. Limit privátního stderr je lokální omezení přečteného obsahu, nikoliv důvod vypisovat či uchovávat citlivé bajty.

**R42-E – životnost workerů, pipe EOF a close (P1):**
- V současném PR136 `qa-fixture-gate.cjs` maže per-attempt TEMP v `finally` bez znalosti nového outer in-flight stavu. **Po implementaci C to nesmí zůstat bez úpravy:** při `UNKNOWN` či nevráceném CreateProcessW nesmí gate předčasně odstranit konfiguraci/log/pracovní prostor, který ještě může používat native owner či Python. Zachovat důvěrné privátní TEMP pod kontrolou vlastníka a označit `temporaryFilesRemoved=false`, `cleanupVerified=false`, BLOCKED; následný bezpečný úklid pouze po potvrzení nečinnosti, bez přeznačení původního pokusu na PASS. V běžném prokázaně dokončeném běhu musí úklid TEMP dál proběhnout a být ověřen.
- Exit z process handle a EOF stdout/stderr jsou **dvě různé události**. Samotný Python exit ještě neprokazuje EOF (jiný proces může nechtěně držet inherited end), proto finální close potřebuje obě potvrzení a ukončená native I/O vlákna. Naopak neúplný EOF po omezené době není důvod k PASS či neomezenému čekání bez označení BLOCKED. Nevytvářet novou globální PID cleanup smyčku; špatně zděděné pipe je bezpečnostní FAIL.
- Pokud native CreateProcessW nikdy nedokončí, addon nemá prokázaný bezpečný způsob force-free in-flight buffers nebo dokončení Node process teardown. V tomto stavu **nelze tvrdit bounded shutdown ani uklizení**. Udržet refcount/lifetime, označit UNKNOWN, zastavit další pokusy a neslibovat automatickou obnovu; extrémní experiment pouze v obnovitelné izolované VM. „Event loop je responzivní“ samo nedokazuje možnost Node bezpečně opustit.

**R42-F – parent Job, identita a původ binárky (P1):**
- V HOME runneru může být Node již členem Job hierarchy nadřízeného runneru. Node musí být mimo **svůj** outer Job, nikoli nutně mimo runner-parent Job. Python musí být bez BREAKAWAY at-creation v outer Jobu a v platné hierarchii s nadřazeným Jobem; Pythonův worker navíc v inner Jobu. Jakékoli nested UI limit/parent-breakaway/identita selhání = BLOCKED, žádný necontainovaný fallback. Nevyvozovat HOME PASS z pouhé dokumentace podpory nesting Windows 11.
- Node 26.13.0 oficiální headers/node.lib nejsou zatím stažené ani ověřené na QA PC. Navržený build musí ověřit vstupní SHA256, binární původ Node.exe a výsledného .node, odpovídající ABI a MSVC/SDK. Hash známý pouze z téhož právě vytvořeného neověřeného buildu neprokazuje supply chain; schválený manifest musí svázat source SHA, vstupní artefakty a výsledek. Žádný další systémový instalátor/permissions/service zásah.

**R42-H – lifetime atributů a Node-API environment cleanup (P1, z oficiální dokumentace):**
- Microsoft výslovně požaduje platnost hodnot předaných UpdateProcThreadAttribute až do DeleteProcThreadAttributeList. Nestačí je udržet pouze do okamžiku návratu CreateProcessW, pokud následuje pozdější destrukce seznamu. Vlastnictví proto musí držet pohromadě: backing array JOB_LIST/HANDLE_LIST, child handles, mutable command line a STARTUPINFOEX po celou dobu CreateProcessW, potom až do bezpečné DeleteProcThreadAttributeList; při hung API **nesmí** být destrukce předčasná. Konkrétní pořadí deinitializace zapsat do RAII kontraktu a otestovat pro každou chybu i pozdní návrat. Zdroj: https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-updateprocthreadattribute .
- Node-API doporučuje koordinovat konec prostředí přes napi_add_env_cleanup_hook / napi_add_async_cleanup_hook, protože finalizers mohou běžet nezávisle a napi_env se může zrušit dřív, než callbacky doběhnou. Nutný deterministický cleanup ordering pro TSFN a OwnerContext: nejprve uzavřít vstup nových událostí, požádat worker o STOP, vypořádat naplánované callbacky, počkat na **dokončitelné** native workers, release TSFN reference a teprve pak uvolnit kontext. Ani asynchronní cleanup hook neumožní bezpečně zrušit trvale hung CreateProcessW; v této větvi nelze tvrdit bounded shutdown či PASS. Zdroj: https://nodejs.org/api/n-api.html#napi_add_async_cleanup_hook .
- Bez skutečného kompilovaného addon proof je to **návrhová povinnost a BLOCKED pro native runtime**, nikoli již otestovaný mechanismus. Žádná násilná destrukce, TerminateThread nebo uvolnění bufferu pod běžícím systémovým voláním.

**R42-G – pravdivé testovací důkazy a přechod do implementace (P1):**
- Před implementací musí být konzistentní modelové kontrakty pro výše uvedené chyby a návrh konkrétního nativního I/O/launch adaptéru. Při nedostupnosti ověřitelného řešení STOP a úzké nové C-vs-B-vs-A rozhodnutí, bez slévání několika neověřených variant.
- Vlastní technická kontrola návrhu a Microsoft/Node dokumentace **není** PASS nativní implementace. SOURCE-ONLY review připravenosti návrhu je možné označit „zlepšeno / požadavky specifikovány“, ne „C bezpečnost PASS“. Po dokončení autorských pozitivních i negativních testů a celého balíku patří nezávislé závěrečné review **Kontrolorovi 46**.

### 3g. Negativní rozhodovací matice (kontrakty pro implementaci, nikoliv vykonané testy)

Každý řádek má mít v budoucí implementaci **konkrétní negativní automatický test** s PASS/FAIL/NOT RUN, prostředím a SHA. Tento seznam je kontrola konzistence návrhu, **žádné testy zde neběžely**.

| Scénář | Výslovný očekávaný bezpečný výsledek |
| --- | --- |
| STOP před zahájením outer create | žádný Python start; BLOCKED, žádný retry |
| STOP během CreateProcessW, API dosud nevrací | UNKNOWN; žádný resume/cleanup PASS, context/handles neuvolňovat předčasně |
| CreateProcessW se vrátí po přijatém STOP | ověřit handle pouze pro bezpečný cleanup, **nikdy nový resume**, finální výsledek BLOCKED |
| STOP souběžný s již rezervovaným ResumeThread | proces po celý závod v outer Jobu, sticky BLOCKED, nanejvýš jeden pokus o resume; fyzické časování neslibovat bez důkazu |
| Neplatný JOB_LIST, HANDLE_LIST, UI limit či nesting | BLOCKED před spuštěním nebo bezpečné ukončení stále suspendovaného dítěte, bez necontainovaného fallbacku |
| V Node chybí .node / nesedí hash, ABI nebo Node verze | STOP **před** spouštěním Pythonu; nikdy zpět na child_process.spawn ve Windows |
| Vynechaný stderr reader, zaplněná pipe, napi_queue_full | bounded STOP/BLOCKED, žádná deadlock závislost na JS event loop, stderr soukromý obsah neuniká |
| Stdout překročí 1 048 576 bytů nebo rozdělené UTF-8 | byte-exact limit a bezpečný parsing; přesah BLOCKED; nevypisovat raw payload |
| Stdin partial write, CANCEL mezi zápisy, write po close | žádné další ALIVE po přijímaném CANCEL, bezpečné uzavření, BLOCKED pokud není přesný protokol |
| Python exit bez EOF stdout/stderr nebo bez native close | timeout/protokol BLOCKED, žádný falešný PASS ani neomezený čekací úspěch |
| Podvržený Python JSON říká cleanupVerified=true | bez vlastní vnější handle atestace **BLOCKED** |
| Outer Job ActiveProcesses=0, ale in-flight create trvá | UNKNOWN/BLOCKED, **ani čistá nula není důkaz úklidu** |
| TerminateJobObject vrátí SUCCESS, ale Python process handle nesignalizuje exit | BLOCKED; kill request není exit |
| Query úspěšná, ale následný CloseHandle selže | outerCleanupVerified=false, BLOCKED; neoznačit cleanupVerified=true |
| Chybí inner cleanup nebo TAP/exit/token přesná shoda | celkový BLOCKED i při ověřeném outer=0 |
| TEMP/konfigurační soubor nelze vytvořit/odstranit (plný disk, práva, chyba zápisu) | fail-closed, žádný PASS ani mazání cizích cest; nezkoušet bez kontroly ostatních procesů |
| Současné dva pokusy / duplicitní callback / stará generation nonce | izolované own handles/dirs a serializace; žádné křížové potvrzení, double-close ani falešný PASS |
| NAPI env zmizí před dokončením native workeru | žádný callback do mrtvého env, OwnerContext stále živý pro in-flight; bez ukončení BLOCKED/UNKNOWN |
| Node/Python náhle skončí v nested hierarchii | vnější/inner cleanup dle skutečných handles, bez pozitivního reportu při chybějícím ownerovi |
| Mimo vlastní scope existuje cizí sentinel proces | **nesmí být ukončen**, žádný celosystémový PID sweep ani změna ACL |
| Skutečný nevracející se Win32 API/kernel fault | pouze izolovaná obnovitelná Windows VM; HOME host **NOT RUN/BLOCKED** |

**Interpretace:** všechny „bezpečně skončil BLOCKED“ výsledky jsou negativní kontrakty PASS, pouze pokud je implementace a testy opravdu doloží; nejsou PASS už z této tabulky. Na HOME runneru se netestuje nebezpečný hung/force-kill fault. Pokud autor neprokáže některý kritický kontrakt D1–D3 v rámci C, neimplementovat „přibližnou“ verzi a znovu cíleně rozhodnout C/B/A.

## 4. Build, dodávka, licence a původ
- Aktuální Windows runner používá Node **26.13.0.0**. Přesný zdroj hlaviček a knihovny existuje u výrobce; bez potřeby další Visual Studio instalace:
  - https://nodejs.org/download/release/v26.13.0/node-v26.13.0-headers.tar.gz
    SHA256 **9b3fad89be6bb3ffc5057afcbceaf58a9489d67846fdb243eaf44947167a1a1b**
  - https://nodejs.org/download/release/v26.13.0/win-x64/node.lib
    SHA256 **caad0090dc3add94c06abd01e395e8ec0f1586c10071bda1f99480445d695f6f**
  - SHA uvedena v oficiálním https://nodejs.org/en/blog/release/v26.13.0 . Samotné artefakty **NEBYLY** na HOME staženy, hashované ani použity. Verze souboru node.exe ≠ důkaz shody jeho obsahu/původu.
- Navrhnout samostatný krátký owner-only build recept pro MSVC 19.52 / SDK 10.0.26100 / Node 26.13.0 x64. Přesně připnutá cesta ke zdrojům + verze + SHA256 obou upstream artefaktů i výsledného .node; žádné automatické aktualizace node-gyp ani npm install; kontrola licence Node + third-party částí, explicitní manifest build command/environment. Pokud pro stabilní přenos nebo kompilaci chybí ověřený nástroj, označit BLOCKED, nepřidávat náhodný downloader.
- Před každým load: kontrola expected hash připnuté .node a ABI/Node runtime + identity/cesty i podpisu/původu dle schválené build politiky. Nikdy nespoléhat na samotné pojmenování nebo SHA dodané ze stejného nedůvěryhodného zdroje. Běh se služebním účtem bez elevation, bez globálního PATH/ACL/service/Play zásahu.
- SOURCE návrh sestavení teprve po nezávislém předběžném security review; skutečný compile/load nejprve v izolované testovací Windows VM, a teprve po schválení běžný kontrolovaný HOME no-op. Na domácím PC žádný force kill/hang fault test.

## 5. C versus úzká alternativa B (rozhodovací brána, ne nový všeobecný audit)
- **C Node outer Job + stávající Python inner Job:** nejméně změn v odzkoušeném Python backendu; vyžaduje však bezpečnou náhradu Node spawn, nativní správu pipe/IPC, nested Job/handle race a reprodukovatelný .node build. Dokud to neověříme, tvrzení o „malé“ změně není prokázané.
- **B externí Python guardian + ctypes / jeden kontrolovaný Job:** může vystačit s již dostupným Pythonem bez C++ addonu, ale přidá proces + řídicí protokol a nesmí opakovat tutéž chybu „owner visí uvnitř CreateProcess a má jediný Job handle“. Jestli externí Node nemůže nezávisle ukončit rozsah, nepřináší vůči A dostatečné zlepšení. Zkoumat pouze pokud padne konkrétní C feasibility brána.
- **A stávající PR136:** normální Windows cesta je doložená a SOURCE review PASS, krajní hang stále BLOCKED. Bez důkazů z nového návrhu ji **nepřepisovat**.

## 6. Povinné testovací brány a STOP podmínky
1. **Předběžné nezávislé architektonické/security review** tohoto návrhu JINÝM kontrolorem než autorem. Prověřit, zda nový Node bootstrap vůbec umí atomic JOB_LIST a důvěryhodný stdin/stdout/stderr transport bez narušení watcheru; validaci handle ownership, nestingu, in-flight lifetime, fail-closed, 1 MiB limitu, Node exit, původu binárky a rozpočtu. Verdikt PASS/REQUEST FIX/BLOCKED v #42/PR, nikoli pouze „vypadá dobře“.
2. Po výslovném schválení konkrétní varianty C: jediný autor v odděleném implementačním DRAFT PR; pozitivní i negativní zdrojové/mock/model testy na checkout SHA. Zajistit stávajících 57 modelových scénářů a 15 TAP beze ztráty významu. JS Linux path beze změny.
3. Negativní kontrakty: chyby každého Win32 API/hook, unknown / inherited wrong handle, failed SetInformation, IsProcessInJob/Query/Terminate/Wait/Close, race STOP před/po CreateProcess, pozdní return, dvojité dokončení, IPC/stderr/overflow, shození Python/Node, nesting v runner-like parent Jobu, nezměněný cizí sentinel, přesný Job identity, přesný stderr redaction a ověření původních TEMP bytes. Přesné prostředí/SHA a PASS/FAIL/SKIP/NOT RUN.
4. Real native fault/hang **jen v samostatné obnovitelné VM bez cenných dat, se samostatným souhlasem**, jinak NOT RUN/BLOCKED. Běžný no-op a původních 15 TAP až po bezpečnostním source review, hash/signature, důvěryhodném runner IDLE, jednorázovém owner-only workflow a bezpečnostní rozpočtové bráně. Žádný přenos úspěchu starého SHA na nové.
5. Při jakémkoli nejasném in-flight CreateProcessW, neověřeném cleanup, podezření na uncontained child, nedostupném stderr transportu nebo neprokázaném Node lifecycle: **STOP/NO RETRY**. Nevyřazovat test a nevrstvit další procesní záplaty. Neprovádět merge/APK/release bez odděleného schválení a společné QA.

## 7. Konkrétní otevřené otázky pro nezávislého kontrolora
1. Je technicky realizovatelný vstup Node-API, který na Windows vytvoří Python *at-creation* s JOB_LIST, bezpečným HANDLE_LIST/stdin/stdout/stderr transportem a nikdy neblokuje dohled? Jaký nejmenší ověřitelný návrh bez nové služby/procesu?
2. Lze při nevracejícím se CreateProcessW a smrti Node vůbec prokázat containment/rollback? Pokud ne, stanovit přesnou hranici BLOCKED a bezpečné nepokračování.
3. Co nastane při nesting s už existujícím runner parent JobObject, jiným UI limit/nesting constraint, bez breakaway?
4. Jak zajistit no late resume, no double free/close, lifetime nativního async work a fail-closed attestace při závodu cancel/finish?
5. Nezhorší nový řídicí modul bezpečnost (PIPE/HANDLE leakage, CLI path, token, stderr) natolik, že je B nebo ponechání A na této etapě bezpečnější?
6. Které testy lze spustit bezpečně na běžném HOME hostu, a které vyžadují izolovanou VM?

**Tento dokument je pouze brána rozhodnutí a review. Neznamená souhlas s implementací C, instalací závislostí, Windows runtime testem, změnou PR136, merge či APK.**

### Oficiální technické podklady
- Windows CreateProcessW: https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-createprocessw
- Windows STARTUPINFOEX/JOB_LIST + HANDLE_LIST: https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-updateprocthreadattribute
- JobObjects + nested Jobs: https://learn.microsoft.com/en-us/windows/win32/procthread/job-objects ; https://learn.microsoft.com/en-us/windows/win32/procthread/nested-jobs
- Node-API asynchronous work and limitation of cancel on running task: https://nodejs.org/api/n-api.html#napi_cancel_async_work
- Node 26.13.0 official release and hashes: https://nodejs.org/en/blog/release/v26.13.0
