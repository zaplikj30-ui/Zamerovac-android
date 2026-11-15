# Windows HOME QA – varianta C: předimplementační bezpečnostní návrh
**Stav: DESIGN / ČEKÁ NA NEZÁVISLÉ SECURITY REVIEW A SCHVÁLENÍ VLASTNÍKA. ŽÁDNÁ IMPLEMENTACE, MERGE ANI RUNTIME TEST.**
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
4. **VERIFIED_SUSPENDED → RUNNING:** pod synchronizovanou stavovou podmínkou zkontrolovat, že během startu nepřišel CANCEL/timeout; až potom provést ResumeThread. Pokud mezitím nastal STOP, **nikdy pozdě nezavést nový resume**, jen evidence a cleanup. Python pak uvnitř vytvoří dosavadní inner Job při vytvoření workeru pomocí JOB_LIST. Testovat skutečné vnoření pod existujícím případným runner-parent Jobem; neúspěch nesting = BLOCKED, ne fallback bez containmentu.
5. **RUNNING → STOPPING:** při timeoutu, přerušení IPC, pádu ownera, overflow, rozporu protokolu nebo ztrátě heartbeat musí Node zaznamenat sticky BLOCKED, zakázat nový launch/resume, bezpečně požádat o CANCEL a dle politiky následně provést TerminateJobObject na vlastním outer Jobu. Sám Node a jeho runner mimo outer Job. PID-only kill/child.kill, TerminateThread ani jmenné OpenJobObject+NOT_FOUND jako „důkaz úklidu“ nepoužívat.
6. **STOPPING → VERIFIED_CLOSED:** s drženým originálním Job handle vyčkat na doložený exit původního Python procesu a aggregate active-count=0, potvrdit uzavření zděděných pipe/child handles, ukončení *všech dokončených create operací*, bezpečný úklid vlastního TEMP. Teprve poté pozitivní cleanup attestation. Pokud se CreateProcessW stále nevrátil nebo není jistý okamžik přiřazení → **BLOCKED/UNKNOWN, nikdy CLEAN/PASS**, ani když Query Job ukáže momentálně nulu. CloseHandle chyby znamenají nejistý stav, ne PASS.
7. **Smrt Node:** KILL_ON_JOB_CLOSE ukončuje procesy již skutečně přiřazené k outer Jobu. Nezaručuje, že jaderná operace CreateProcessW nemohla být „in-flight“; žádná pozitivní atestace ani neznámé automatické opakování. Smrt Python: Node může použít stále držený outer Job, ale atestace opět vyžaduje skutečné ověření.

### 3b. Asynchronie a IPC – ZÁSADNÍ BLOKÉR NÁVRHU
- Synchronní CreateProcessW nesmí blokovat Node event loop ani watchdog. N-API napi_create_async_work by přesunulo práci do poolu, **ale napi_cancel_async_work neumí zrušit již běžící nativní volání**. Návrh musí před implementací vyřešit životnost nativních bufferů, handle, callbacků a bezpečný odchod Node, i když create úloha visí. Nevynucovat TerminateThread.
- Node klient dnes vyžaduje child.stdin.write/end, child.stdout data a close. Nový adapter musí bezpečně zajišťovat **stejné pořadí a meze IPC** (1 MiB stdout, heartbeat, error/close, redakce stderr), např. nativními čtecími pracovníky a omezenou N-API threadsafe frontou. Toto **není vyřešené zadáním jedné .cc funkce**. Nelze stavět na nepotvrzeném převodu raw Windows HANDLE na Node.js stream.
- Vnější výsledek musí být oddělená nezfalšovatelná stavová evidence modulu/Job handle, ne hodnoty dodané přes stdout z Pythonu. Parser si dál ověřuje token/protocol/exit; PASS až při vnitřním i vnějším cleanup Verified a odstranění vlastního TEMP. Chybějící outer evidence = BLOCKED. Žádný retry po CreateProcessW i při 0 procesů.
- Pokud reprodukovatelná bezpečná implementace pipe/IPC transportu, bootstrap/late-return a Node owner shutdown není prokazatelná bez dalšího guardian procesu, **STOP a nové cílené C-versus-B rozhodnutí**, ne improvizované připojení Jobu po spawn.

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
