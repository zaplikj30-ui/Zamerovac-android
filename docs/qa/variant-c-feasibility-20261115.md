# Varianta C — dostupné dílčí kontrakty, Windows integrace BLOCKED

**Novější zadání vlastníka:** žádná nová infrastruktura; nejprve doložit,
zda původní normální QA již opravilo PR136. Viz [konkrétní výsledek a návrh
uzavření](qa136-original-blocker-resolution-20261115.md). C zůstává nezapojená;
o jejím odložení rozhodne koordinátor. Následující text je historický checkpoint.

Toto není kompletní oprava Windows QA ani povolení k HOME testu. Nový Windows
spawn, Node-API addon, tři nativní pipes a skutečná outer Job atestace **nejsou
implementovány**. Dosavadní řízení procesů, Python backend, Linux cesta a všechny
PASS/NO-RETRY podmínky PR136 zůstávají beze změny.

Navazující [konkrétní návrh laboratoře a jediný čtecí postup pro vlastníka](windows-lab-route-20261115.md)
ověřuje možnosti16 GB PC, odděluje compile/load/fault a společnou obsluhu přes
GitHub. Zatím nepotvrzuje dostupnou Windows laboratoř ani neodstraňuje blokér C.

Výchozí base: PR136 `1d6a786c77aa2a797bf7bd75f9977a3ae6613459`.
Návrh: PR138 `e54a787dfcfebc6a2fc2fad6feee34dd6292a823`.
Závazné nové role: PR139 `f4f6504daa8400cf45bfd81914943e98c74b0d46`,
současně přečtena pravidla main `8d05d2dd77c4a99f8ad64191c97d37ee3c151e3b`.
Při práci PR139 postoupilo na `e9bcdaabff5ca2a8e1fc5bd368027f4e34fad961`;
přečtena i tato změna, která výslovně odstraňuje starou volitelnou formulaci
nezávislého review. U tohoto úkolu nové role výslovně vyžaduje vlastník.
Jediný autor/větev: `qa/outer-job-c-20261115`. Žádná cizí větev se nepřepisuje.

Vlastník během práce potvrdil, že není dostupná ověřená obnovitelná Windows
laboratoř. Povolil dokončit samostatně ověřitelné Linux části a zastavit
závislou rizikovou implementaci. Proto vznikají pouze následující **nezapojené**
části a jejich testy. Checkpoint není žádost o závěrečné review Kontrolora46.

## Co je skutečně implementováno

`tools/win32/qa_outer_job_core.hpp` je přenositelné kontraktní jádro:

- synchronizuje rezervaci create/resume, STOP, dokončení startupu/I/O/cleanup;
- rezervace resume má jediný linearizační bod; souběžný STOP po rezervaci
  nevytvoří druhý permit a výsledek zůstane BLOCKED;
- nedovolí úspěch z prázdného Jobu bez ověřeného spuštění, při nenulovém exit,
  nulové generation, nevyřešeném create/resume ani nesprávné identitě witness;
- odděluje fyzicky čistý kontrakt od úspěšného výsledku: po STOP může být
  později modelově clean, ale nikdy success-eligible;
- vyžaduje quiescence → query na stejném Job witness → úspěšné uzavření
  prostředků → potvrzené odstranění TEMP; close/TEMP chyby se nepřepíší na PASS;
- má celkový stdout limit1048576 **bytů**, frontu65536 bytů a maximálně3 I/O
  leases; stderr obsah vůbec neukládá, pouze počítá do stejného celkového capu;
- byte fronta zachová rozdělené UTF-8 bez předčasného dekódování. Plná fronta
  nastaví sticky BLOCKED. To není implementace Windows partial Read/WriteFile.

**Hranice jádra:** witness jsou abstraktní identifikátory dodané důvěryhodným
budoucím OwnerContext. Jádro žádné Windows HANDLE nevytváří, nezavírá, nečeká
na proces a nevolá Job API. `outer_clean` je pouze výsledek předaných kontraktů,
**nikoli nezávislý důkaz skutečného OS cleanupu**. Generation zde není
kryptografická nonce ani autentizace Python JSON. Neexistuje N-API export,
callback, aktivní watchdog nebo integrace do stávajícího klienta. Budoucí native
binding by musel svědectví odvozovat z vlastních retained handles, nikoli IPC.
Samotný mutex/env flag neprokazuje Node teardown ani životnost raw bufferů.

`tools/qa_c_build_inputs.py` je read-only kontrola stagingu připnutých vstupů na
POSIX. Prochází každý komponent cesty přes directory FD + O_NOFOLLOW, odmítá
symlink/hardlink/reparse, kontroluje změnu identity a obsahu při hashování,
omezuje velikost a zavře všechny otevřené FD i po chybě. Bez síťového přístupu,
extrakce archivu, kompilace, addon load nebo spuštění ověřované binárky. CLI
nemá možnost měnit povolené hashe a loguje jen pevné důvody, štítky a digests.
Na Windows se úmyslně odmítne `platform-unverified`: POSIX path proof se nesmí
vydávat za ověřenou Win32 ochranu proti reparse/TOCTOU. Budoucí Windows build
nebo loader touto implementací **nejsou pokryté**.

```text
python3 tools/qa_c_build_inputs.py --headers <archive> --node-lib <node.lib> --node-exe <node.exe>
```

`ARTIFACTS_VERIFIED` znamená pouze shodu tří místních souborů. Výstup vždy
odděleně uvádí `build=NOT_RUN`, `nativeLoad=NOT_RUN`. Není to build/provenance
atestace celé binárky nebo toolchainu. Původ MSVC/SDK a skutečného cílového
node.exe na runneru ani Authenticode/GPG tímto krokem nejsou ověřeny.

## Ověřené upstream bajty

Oficiální vstupy byly v Linux Cloud skutečně staženy a hashovány, nikoli pouze
přečteny ze seznamu. Windows node.exe byl jen datový vstup, nikdy spuštěn.
Hashe souhlasí s připnutými hodnotami v PR138 a oficiálním SHASUMS/release.

| Soubor Node26.13.0 | Bajtů | SHA256 |
| --- | ---: | --- |
| node-v26.13.0-headers.tar.gz |10318467|9b3fad89be6bb3ffc5057afcbceaf58a9489d67846fdb243eaf44947167a1a1b|
| win-x64/node.lib |3029908|caad0090dc3add94c06abd01e395e8ec0f1586c10071bda1f99480445d695f6f|
| win-x64/node.exe |100097864|14319838b3f355e0398c13569a90270bce4fc68f25189f58c59b03dadae0e6d5|

Zdroj: https://nodejs.org/download/release/v26.13.0/SHASUMS256.txt a
https://nodejs.org/en/blog/release/v26.13.0 . Node headers deklarují version26.13.0,
NODE_MODULE_VERSION147 a Node-API max10. Host je **Linux Node24.22.1,
modules137**; to se nezaměňuje za cílový Windows Node. Ani kompatibilní Node-API
nenahrazuje skutečný build/load na přesné cílové konfiguraci.

## Testy, nalezené chyby a vlastní kontrola

Příkazy pro nové samostatné části:

```text
g++ -std=c++17 -Wall -Wextra -Werror -pthread -fsanitize=address,undefined -fno-omit-frame-pointer tests/qa_outer_job_core.cpp -o /tmp/qa-c-core
/tmp/qa-c-core
python3 -Werror::ResourceWarning tests/test_qa_c_build_inputs.py -v
```

Test-first: oba nové soubory nejprve selhaly kvůli chybějící implementaci.
Při kritické kontrole byly doplněny dva negativní kontrakty, které skutečně
odhalily falešnou success-eligibility bez workeru a přijímání stdout před resume
permitem (25 testů,2 FAIL). Opraveny příčiny, stejné testy prošly. Další negativní
test pro generation0 odhalil chybějící odmítnutí při registraci Jobu (28 testů,
1 FAIL); guard opraven. Doplněn nenulový procesní exit, přesná UTF-8 fragmentace
a fixní limit I/O leases. Původní RED logy se uchovávají odděleně od GREEN.

Opakovaná kontrola celého jádra navíc našla3 povolené pozdní operace po
quiescent query: nový create, resume po dokončeném startupu/exitu a nové stdout
data. Negativní testy všechny3 chyby reprodukovaly; terminální query nyní
uzavírá příjem nové práce/dat a resume vyžaduje stále aktivní startup lease.
Starou query tak nelze použít jako atestaci po nově zahájené práci.
Další2 negativní kontroly prokázaly, že pozdní stdout a duplicitní native close
musí zrušit nejen úspěch, ale i cleanup eligibility. Opraveno: pozdní I/O nebo
opakovaná close evidence nastaví trvalou cleanup chybu a zakáže TEMP atestaci.

Vlastní kontrola vstupního checkeru nahradila pouhé pre/post pathname kontroly
FD-relative O_NOFOLLOW průchodem a přidala negativní záměnu adresáře a selhání
close. Proto neobsahuje neověřený Windows fallback. Pozitivní testy používají
malé hashe injektované pouze přes unittest mock; navíc byl checker spuštěn nad
skutečnými výše uvedenými schválenými artefakty. Mock pin není CLI možnost.

Finální počty, přesný testovaný HEAD, příkazy, SHA256 logů a výsledky širší
společné regrese jsou v autorském checkpointu tohoto draft PR a issue42.
Linux concurrency/model/ASan/UBSan výsledek není Win32 ABI ani native fault důkaz.
Test nové POSIX utility je na Windows výslovně SKIP; historických57 scénářů
se toto omezení netýká. Původních15 na Linuxu má Windows-only junction SKIP.

První plná regrese měla63/65 úspěšných příkazů,2 FAIL příkazy. Našla také dvě
předexistující chyby testovacího zapojení PR136: VM mock v
`qa_fixture_process_scope.js` nedodával aktuální diagnostické exports
(`safeErrorType is not a function`,2 modelové FAIL), a `test_diag41.py` vytvářel
údajně veřejný adresář přes mkdir0755, ale umask077 z něj udělal0700
(1 Python FAIL). Mock nyní přebírá skutečné exports a nahrazuje pouze ownedWorker;
permissions test nastaví a ověří0755 jen na vlastní dočasné podfixture pod
privátním parentem. Globální umask ani systémová práva se nemění. Assertions,
privacy guard i reálné Linux lifecycle testy jsou zachovány. FAIL index/logy
zůstaly oddělené před opakováním společné regrese.

Kontrolovaný kumulativní rozsah: toto nové jádro, vstupní utility, jejich
testy, opravy2 existujících testovacích fixtures a tento dokument. Žádná změna app/dat/médií/sync, procesního klienta,
Python backendu, CMD/TAP/workeru, workflow/markeru nebo Windows permissions.
Kód není volán produkčním runtime. Byly prověřeny všechny nové metody a
chybové cesty, meze, duplicitní dokončení, synchronizace a fail-closed výstupy;
po opravách se kontrola celého nového rozsahu opakuje spolu s regresí.

## Přesný blokér závislé implementace

V této relaci není obnovitelná Windows laboratoř; vlastník to výslovně potvrdil.
Dostupný Linux má GCC14.2, Node24.22.1 a Python3.12.14, nikoli MSVC, Windows SDK,
Windows runtime/loader. Nejsou dostupné cl.exe, cmd.exe, Windows cross-compiler
nebo Wine. Nic nebylo instalováno. Domácí inventura potvrzuje přítomnost
MSVC19.52/SDK10.0.26100/Node26.13 na jiném PC, **ne** addon build nebo load.

| Brána zadání | Aktuální důkaz / hranice |
| --- | --- |
| Creation-time JOB_LIST a HANDLE_LIST | Microsoft kontrakt a návrh PR138; nový native bootstrap NOT RUN/neimplementován |
| Bounded IPC a přesné EOF/close | Otestovány byte meze/fragments jádra; native tři pipes, stdin partial write a EOF/close NOT RUN/neimplementováno |
| Node watchdog bez blokace | Přenositelné jádro nemá Win32/NAPI volání; skutečný Node/native souběh NOT RUN/neimplementován |
| START/STOP/resume | Otestovány rezervace a závody přenositelného jádra; skutečný native lease/ResumeThread NOT RUN |
| Handles, buffery, native threads a napi_env | Modelové stavové podmínky; skutečný RAII/NAPI teardown a pozdní native return BLOCKED |
| Vnější+vnitřní atestace | Jádro odmítá rozporné witness, ale nedává OS důkaz; retained handle query/nesting/cleanup BLOCKED |
| Přesný MSVC/SDK/Node build/provenance | Tři upstream artefakty skutečně hashovány PASS; MSVC kompilace/reprodukovatelnost/.node hash/load BLOCKED |

Proto se nepřipojuje náhrada Windows spawn ani nevytváří neověřená .node
binárka. Neznámý in-flight create, native teardown nebo cleanup je BLOCKED;
žádný necontainovaný spawn fallback ani automatický retry. Matice21 scénářů
PR138 není prohlášena za splněnou tím, že existují podobné modelové testy.

Krátké C/B/A rozhodnutí: **C zůstává schváleným cílem**, nový compiler/input
proof částečně pokročil. B neodstraňuje potřebu prokázat bootstrap, transport,
teardown a cleanup; přidáním Python guardianu by vznikl další proces a jiná
architektura bez nového schválení. A/PR136 ponechává doloženou normální cestu,
ale hard-hang neřeší. Na B ani A jako údajný fix se automaticky nepřechází.

Další bezpečný krok: zpřístupnit schválenou obnovitelnou Windows laboratoř
bez hostitelských dat a s požadovaným toolchainem. V téže autorské větvi teprve
dokončit a ověřit native OwnerContext/IPC/Node teardown, pinovaný MSVC build/load
a21 negativních kontraktů včetně nested jobs; poté plná související regrese,
znovu úplné self-review a až pak finální Kontrolor46. Žádný HOME fault nebo
automatické Actions; žádný merge/APK. Tento dokument není předání kompletní C.
