# P1–P4: integrovaný produkt a připravené, neaktivované HOME4

Autor: Codex. Toto je implementace, vlastní review a autorské důkazy, nikoli
nezávislá kontrola nebo souhlas se spuštěním. Navazuje na
[schválení P1–P4](https://github.com/zaplikj30-ui/Zamerovac-android/pull/149#issuecomment-6899326413),
[review návrhu](https://github.com/zaplikj30-ui/Zamerovac-android/pull/149#pullrequestreview-5912154839)
a [scope freeze](https://github.com/zaplikj30-ui/Zamerovac-android/pull/149#issuecomment-6899460237).

## Identita a návratnost

- BASE: `a3cc8eb3a14a9a6710664b73ba8a5c70ed1a340a`.
- Historický produkt PR121: `ae3b4df53c25557f28b4a25ccb65adc2abdff639`.
- Převzatá L1/H1 oprava PR149: `57c2d6ae4cfdc5fdf50494db45883da78c7d0b83`.
- Nový integrovaný SOURCE: `c7e71327d69bfe87f622ff6293422e2e15332a11`.
- VALIDATOR: `937961e676ac2b68411c332c9afe3cb7e44a7aa4`; jeho plný pin je ve
  finálním workflow. Finální HEAD obsahuje pouze následné připnutí validatoru
  a důkazy; přesné SHA jsou v předání PR. Budoucí schválené MAIN/EVENT **není
  známé** a není nahrazené žádným historickým SHA.

`p1-p4-integration.sources.json` dokládá každou ze 130 převzatých cest.
Společný předek main/PR121 je `8d05d2dd77c4a99f8ad64191c97d37ee3c151e3b`.
Main od něj neměnil žádnou produktovou cestu app/ nebo sync/. Pro každou
vybranou cestu byl main blob shodný s předkem (včetně neexistujícího souboru).
Dvě kolize START_ZDE a browser runner byly porovnány: pravidla i novější
main runner/harness a sandbox zůstaly zachované. Žádný slepý merge ani
převzetí starých workflow/triggerů/varianty C. PR121 a PR149 se nemění.
Návrat: neaktivovanou vlastní větev lze odmítnout, main zůstává beze změny.

`home4-source.json` váže celý SOURCE strom; browser manifest zachovává
**66 původních cest / 23 sad / 96 pojmenovaných případů** a navíc výslovně
pinuje novější main `tools/e2e/sandbox.cjs` jako zdrojovou závislost.
Piny neoznačují samostatné PR121 za dnešní main.

## Co je implementováno

| Oblast | Konkrétní změna | Důkaz / hranice |
|---|---|---|
| P1 | Převzaté ověřené produktové změny: chráněná obnova, původní média, pending audio, ACK/ledger, úložiště a UI. Novější main ochrany zachované. | Obsahové piny všech převzatých cest, JVM/JS a browser registry. Fyzický Android/Drive nejsou děděné PASS. |
| P2 | Ověřený inventář je nutný před payloadem; plné hash registry, verze, žádný fallback. Explicitní Git/Actions read-only přenosy; žádné npm/pip/curl/setup-java. | Šablona je **verified:false**. HOME nebyl inventarizován. Neznámý hash/cache/proof = BLOCKED. |
| P3 | Striktní companion validator přesných JUnit ID, čerstvosti, souhrnů, zdrojů testů a 49 kritických metod. | 64 XML / 513 unikátních metod / 511 raw PASS + 2 přesné raw FAIL; Gradle skutečně exit1. Oddělená acceptance nemění raw výsledek. |
| P4 quick | Jmenný Node/Python registr, podporované strukturované Node události, jednotlivé unittest výsledky; exit0 není dostačující. | Povinné položky nesmějí FAIL/ERROR/SKIP. Platformně nepříslušné položky jsou výslovně NOT RUN mimo povinnou sadu. |
| P4 procesy | Existující Windows Job per-command; nový úzký payload a WSL transport volají stávajícího vlastníka, nevytvářejí nový supervisor. | Runtime Job/supervisor/timeouts/heartbeat a L1/H1 zachovány. Nové obaly vyžadují skutečný HOME/WSL důkaz. |
| STOP | Exkluzivní privátní admission před testy, kontrola identity, soukromý ukazatel důkazů; unknown ponechá STOP i soubory. | Žádný automatický reset/TTL/retry/PID kill. Další příkaz se po BLOCKED nespouští. |
| Disk/logy | Měření před/za běhu, privátní logy, omezené výstupy; Windows 2 GiB, WSL 8 GiB, rezerva 10 GiB, ext4 předem 12 GiB. | Monitor **není hard quota**. Chybějící schválený runtime důkaz bezpečné meze blokuje job. |
| Preview | Čtvrtý job zachován, ale I88 mapping na preview/release není schválen. | Brána skončí BLOCKED **před jakýmkoli buildem**. Žádné nové release-green pravidlo. Původní signer/package/verze/preflight ochrany a jejich regresní testy zachovány; historický workflow je pouze Git DATA. |

## Příčinné opravy a test-first

1. Historický početní I88 classifier přijal přejmenovanou metodu při stejném
   počtu. Nový negativní test prokazuje původní PASS a odmítnutí novým přesným
   registrem. Žádná změna raw FAIL #88 ani synchronizačních asercí.
2. Nový skutečný klientský negativní model reprodukoval `status=PASS` spolu
   s `error`, neplatným reason/exit nebo duplicitním/neplatným protokolem.
   Minimální oprava stávající validace odmítá rozpory, ověřuje nulové potomky
   a rediguje error typ; žádný retry ani owner.kill. Původních 57 modelů
   zůstává samostatně identifikovatelných.
3. Skutečný Linux JVM běh trval 11m51s (součet test time 673.973s), historický
   důkaz 519.953s. Nelze jej vložit do jediného owneru s limitem480s.
   Schválený návrh již požadoval rozdělit dlouhou sadu po příkazech: připraveno
   64 pevných třídových partition bez opakování metod, každá pod stejným
   existujícím scope a nezvýšenými limity. Všechny XML a raw exit vektor se
   ověří společně. Jediná SafSyncV2 partition musí skutečně skončit exit1,
   ostatních63 exit0. Výstup přiznává 64 invokací, nikdy je nevydává za jeden
   plný Gradle příkaz. Skutečný budoucí WSL partition runtime je NOT RUN.
4. Integrace odhalila skutečnou potřebu přidat main sandbox závislost vedle
   původních66 pinů. Bez ní source gate správně blokoval další soubor.
   Nyní se ověřuje i tento konkrétní hash; žádný wildcard/ignorování extra dat.
5. Historické modely předpokládaly, že aktuální pracovní strom je starý main
   nebo že SOURCE stále znamená PR121. Jejich historické negativy čtou pevné
   Git objekty; nové testy současně ověřují aktuální implementační brány.
   Žádná produktová assertion se nevynechává.

## WSL a bezpečnostní hranice

Pouze existující schválený nonroot v `Zamerovac-Ubuntu-QA`, skutečné WSL2,
privátní existující ext4 parent0700, nový run adresář bez reuse. SOURCE a
VALIDATOR se kopírují po přesném manifestu; žádný /root ani URL fallback.
Z předem hashované cache se kopírují pouze schválené `caches/` bajty do
nového mutable Gradle home; cizí init skripty/gradle.properties se nepřebírají.
Původní cache se nemění a kontroluje se před/po.
Gradle --offline, Robolectric offline s přesným lokálním dependency.dir,
JDK17/Gradle8.10.2 a předem ověřené PDF moduly. Žádné doplnění cache.
Stávající Linux pidfd/subreaper scope vlastní každý příkaz zvlášť. PASS se
předá teprve po jeho nulovém scope a odstranění vlastního privátního stromu.
Windows Job na wsl.exe se **nevydává za Linux containment**.

Chybí skutečný schválený HOME inventář, nonroot WSL/cleanup a diskové důkazy.
Šablona je tedy záměrně neautorizující, nikoli hotový profil. Tyto brány se
nesmějí pro zelený běh vyplnit odhadem nebo samotnou existencí souboru.
CreateProcessW hard-hang, forced owner death a bounded rollback **NOT PROVEN**;
nejsou běžnou QA sadou a nebyly spuštěny. Nikde není force-kill owneru.
Neznámý stav = STOP / NO RETRY, privátní důkazy ponechat pro zvlášť schválený
read-only audit; žádný automatický opravný běh nebo čištění cizích cest.

## Co musí zůstat vypnuté

Všechny čtyři joby obsahují bezpodmínečné `false &&`, workflow je jen manual,
EVENT approval prázdný a hash inventáře UNVERIFIED. Push/PR nemůže samo spustit
HOME ani placené Actions. Ostatních šest workflow ani release guard se nemění.
Žádný merge, build APK, upload APK, vydání, instalace nebo HOME inventář/test
nebyl proveden. Finální commit/piny a autorské regresní důkazy jsou v PR;
nezávislý kontrolor posuzuje celý diff, nikoli jen tento dokument.

## Vlastní review autora a zbývající ověření

Kontrola zahrnuje obsahovou návaznost všech130 importovaných cest, dvě kolize,
novější main guardy, produktové CAS/rollback, ochranu archivů/originálů a audia,
Sync ACK/recovery witness, registry 23/96/66+1 a přesné JUnit/quick výsledky.
Dostupné JS/JVM scénáře ověřují hodnoty a původní bajty včetně kombinovaných
selhání/obnovy. Dvě #88 provider-boundary diagnostiky zůstávají skutečné FAIL;
nepředstírá se, že je tato integrace opravila. Geometrický výpočetní základ,
jednotky a schválené úchopy nejsou nově přestavovány.

Kontrola nového QA diffu opravila rozporné PASS, přesné protokolové rámce,
totožnost čtených JSON bajtů/hashů, jmenné registry, omezené kopie, bytecode
zápisy do validatoru, přípustné build výstupy, privátní ACL bootstrap a audit
před/po. Produkční WindowsJob a supervisor/480s limit se nemění. Není přidán
framework, externí závislost ani alternativní procesní backend.

Skutečný Cloud Chromium preflight na tomto produktu skončil BLOCKED:
existující SUID sandbox helper nemá požadovanou konfiguraci. Owner doložil
cleanupVerified=true a remainingProcesses=0. Všech23 browser sad je tedy
**NOT RUN/BLOCKED**, nikoli PASS nebo náhradní SKIP. Oprávnění/sandbox se
nemění. Linux JVM má skutečný výsledek 64XML/513/511PASS/2rawFAIL a tři
archivy prošly nezávislým PDF parserem/renderem; nejde o HOME/Android důkaz.
Finální dostupná Node/Python regrese a přesná SHA/log hashe budou v PR.

**Aktivační blokéry:** ověřený HOME inventář a jeho schválený hash; skutečný
Windows/WSL normální containment/cleanup a disková mez; schválený EVENT/main
SHA; oprávněný sandbox/pixel běh; zvláštní rozhodnutí preview/I88 a čerstvý
lokální release-asset proof před APK. Nejsou to souhlasy k instalacím nebo
nové infrastruktuře. Fyzický Android/S Pen/Bosch/reálný Drive NOT RUN.
Admission není odolnost vůči externímu smazání nebo nahrazení důkazů;
reboot/externí zásah neautorizuje retry bez zvlášť schváleného auditu.

**TEĎ:** nezávisle posoudit tento implementační diff a přesné důkazy;
**POZDĚJI po souhlasu vlastníka:** nezbytný read-only HOME inventář a běžné
runtime ověření, následně rozhodnutí k jedné APK;
**NEMĚNIT:** data/geometrie, raw #88 FAIL, owner/main/manual/attempt1,
NO RETRY, procesní izolace, release guard a vypnutá aktivace.

### Připnuté doklady místo pouhého verified=true

Vlastní negativní test prokázal, že původní nový preflight mohl po hashové
kontrole nástrojů přijmout samotný boolean runtime/disk evidence. Stávající
validace nyní také vyžaduje privátní `file` + `sha256`, stejné načtené bajty,
SOURCE/VALIDATOR vazbu a přesný obsah skutečného runtime dokladu. Modelový
záznam, změněný hash/binding, monitor bez prokázané meze nebo neověřený cleanup
jsou BLOCKED. Native navíc vyžaduje běžné normal/timeout/cancel scope záznamy
s nulovými potomky, ochranou souseda/původních bajtů a odstraněním vlastních
souborů; žádný hard-hang či forced owner death. Schéma určuje přímo
`verify_runtime_evidence` v `home4_contract.py`; nejde o nový supervisor.
Šablona nemá žádný takový doklad. Kontrola autentizuje vlastníkem schválené
připnuté bajty, **sama nevytváří fyzický runtime důkaz**. Jeho získání a
nezávislé posouzení bez nepovolených HOME pokusů zůstává BLOCKED/NOT RUN.


Další vlastní konkrétní negativní model prokázal záměnu souboru mezi hashem
WSL bootstrapu a jeho opětovným otevřením pomocí runpy. Bootstrap nyní spouští
přímo již načtené a hashované bajty, neopakuje čtení cesty. Model běží jen nad
vlastním dočasným Python souborem; není to Windows/WSL runtime test.


Kompoziční kontrola navíc prokázala na skutečném starším validačním řádku,
že samotná shoda bindingu neodmítala worker status BLOCKED. Nyní se ověřuje
i PASS bez chybové diagnostiky a úplné quick souhrny proti registru, včetně
výslovného NOT RUN pro nepříslušné platformní případy. Nejde o Windows runtime
reprodukci: je to přímý test zdrojového rozhodování nad dodaným výsledkem.


Nový adaptér také uchovává omezenou privátní lifecycle projekci a omezený
stdout/stderr testovacího příkazu ještě před posouzením FAIL. Veřejně jde pouze
allowlist fáze a typovaný Win32 kód, nikdy raw log, token, procesní seznam nebo
soukromá cesta. Tím se neztrácí stávající Windows diagnostika při přechodu
přes nový gate; nevyvolává se opravný HOME pokus. Diagnostika je modelově
ověřena, skutečný nový Windows přenos výsledku zůstává NOT RUN.


ACL preflight vyžaduje také propagující OI/CI oprávnění vlastníka, aby nově
vytvořené privátní potomky neodkázal na neověřený default DACL. Jde výhradně
o čtení a fail-closed kontrolu; žádné ACL se nemění. Skutečný Windows ACL/load
test zůstává NOT RUN. Job limity quick25/browser30/native60/preview45 minut
jsou zachovány. Výkon celých64 partition ve WSL na HOME nebyl měřen; je to
konkrétní neověřené riziko, nikoli prokázaná chyba nebo souhlas k prodlužování
limitů. Před aktivací musí běžný runtime důkaz potvrdit i tuto proveditelnost.
