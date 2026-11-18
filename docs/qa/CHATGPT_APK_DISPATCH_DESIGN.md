# DESIGN #183 + #184: ChatGPT → SESTAVIT → VYDAT → fyzicky otestovat

**STAV: DESIGN SCHVÁLEN na `ce92628f3dfa052ff4bbaf69fd9b7104a6e48015`; implementační návrh v témže draft PR #186, SOURCE/SECURITY RE-REVIEW a živý RUN dosud NOT RUN.** Jediný společný [PR #186](https://github.com/zaplikj30-ui/Zamerovac-android/pull/186) pro [#183](https://github.com/zaplikj30-ui/Zamerovac-android/issues/183) (spuštění z běžného ChatGPT) a [#184](https://github.com/zaplikj30-ui/Zamerovac-android/issues/184) (oddělené BUILD, RELEASE a fyzické ověření). ChatGPT Work je **zakázán**. Dokument **není** souhlas ke spuštění, implementaci, merge ani vydání.

## 0. Skutečný základ a hranice

- Při návrhové kontrole main/base **5ecc098d4c9a54d5cf9fb3376834e1e7b238241f**; původní PR HEAD **91678af6bd114cb9ca4c6149810248563fce2460**. Před implementací vše znovu ověřit.
- Poslední opravdu publikované vydání je **test-v1.4.0** s assetem **Zamerovac-v1.4.0.apk** a GitHub API digestem **sha256:d63ea74d343f94278bba200430e165cff93977c8ad36fcb9415e66ff64535609**. Zachovat beze změny. Současné **config/app-version.properties: versionName=1.4.0** je již vydaná verze. Novou APK nevytvářet ani nevydávat bez skutečných produktových změn, nové verze, changelogu a samostatných souhlasů.
- Stávající **.github/workflows/build-apk.yml** je potvrzená stará přímá BUILD→RELEASE cesta: owner workflow_dispatch na main, cloud_run_approved=true a publish_release=true, jeden job s **contents:write**, po Gradlu přímo gh release create. Existující kontroly staré/nové APK (apksigner, aapt, package, signer, verze, versionCode, Drive) zachovat v nových samostatných fázích.
- Inventura main odhalila **další starou vydávací cestu .github/workflows/windows-home-apk-release.yml** (workflow_dispatch, self-hosted HOME, lokální build + publish, contents:write). HOME podle současného vlastníka pravděpodobně už nebude používaný: **nepoužívat, neinstalovat, nezapínat, nevyvíjet nový HOME fallback**. V **budoucím implementačním PR** doporučuji vyřadit jeho vykonatelný release job/spouštěč nebo soubor jako jednu z podmínek odstranění obchvatu; dokumentace může zůstat archivně. **Nyní HOME nic neměnit** a „pravděpodobně“ nepovažovat za definitivní schválení odstranění. Nelze-li starou publikační cestu bezpečně uzavřít, **STOP** před merge návrhu do použití. Ostatní zjištěné workflow (QUICK, native, Chromium, emulator) nejsou publikační; před implementačním merge obnovit inventuru všech skutečně aktivních vydávacích cest.
- GitHub konektor běžného ChatGPT prokazatelně umí vytvořit komentář pod účtem **zaplikj30-ui / neměnné user ID 351234773**, ale dnes **nenabízí vytvoření nového workflow_dispatch**. Zápis komentáře neprokazuje schopnost bezpečně spustit job. Owner účet neprokazuje, zda příkaz zadal ChatGPT, nebo jej vlastník vytvořil ručně; jde záměrně o **stejné oprávnění účtu**, nikoli o druhý faktor.
- Repo je PUBLIC; běžný GitHub-hosted Ubuntu standard compute pro public repozitář je bezplatný, strop 12 USD platí pro reálně placené služby. **Žádný nový běh bez konkrétního RUN GO**. Nikdy zákaznická data, nové tajné tokeny, HOME ani ChatGPT Work. Dvě známé **raw FAIL #88** se neprohlašují za opravené.

## 1. Nejmenší společná cesta – C1

**Preferovaná varianta: změnit jediný stávající .github/workflows/build-apk.yml** tak, aby podporoval GitHub-native komentář a ruční záložní spuštění, ale **nikdy současně BUILD a RELEASE**. Možné jobs:
1. **PILOT** – read-only, bez APK, Gradlu a checkoutu; ověřuje jen vlastníkovu identitu a příkaz.
2. **BUILD-ONLY** – jediný trusted main checkout, kontrola zdroje, verze, předchozí APK a cílené testy; práva pouze **contents:read** a právě jeden ověřený APK Actions artifact. **Žádné GitHub Release, tag, contents:write ani publish krok.**
3. **RELEASE-ONLY** – pouze na druhou samostatnou autorizační událost, práva **contents:write + actions:read**, kontrola původu a bajtů již hotové APK, **žádný build, Gradle nebo product checkout**. Release vytvoří přesně schválené APK.

**Izolace oprávnění:** workflow default permissions co nejmenší (např. contents:read), práva se nastaví zvlášť pro každý job. BUILD nesmí přes reusable workflow, matrix, cache či sdílený token získat contents:write; checkout **persist-credentials:false**, žádná neodůvodněná secrets. RELEASE nespouští cizí checkout ani skripty ze ZIP. Žádný workflow_run:completed automatický publish.

**Migrace v jednom schváleném implementačním PR (ne teď):**
- Odstranit starou podmínku umožňující zveřejnění jedinou dvojicí vstupů **cloud_run_approved=true, publish_release=true**, starý privilegovaný jednojobsový publish krok a automatické propojení s buildem. Pozitivně zachovat preflight/postflight kontrolu podpisu/verzí.
- **workflow_dispatch** zůstane pouze jako manuální owner fallback s novým povinným **operation=pilot|build|release** a odpovídajícími parametry. Neznámá či legacy kombinace vstupů (včetně pouhých dvou starých booleanů) musí **SKIP/STOP, 0 Release**. Manuální fallback používá **tutéž BUILD-ONLY/RELEASE-ONLY větev, parser/verifikaci a práva**, žádný druhý publikační mechanismus.
- Současně technicky **uzavřít starý HOME build+publish** (preferovaně odebrat jeho spustitelný release workflow, po výslovném schválení rozsahu), nikoli jej testovat nebo aktivovat. Auditovat aktivní workflow a nové změny main. **Nesmí být po merge dvě funkční vydávací cesty**, ani přechodný okamžik umožňující starý one-shot.
- Před merge: statický/negativní test vyžadující, že staré **cloud_run_approved=true + publish_release=true** samo nesestaví a nevydá APK; starý HOME dispatch také nesmí zveřejnit. Pokud vlastník ponechání HOME požaduje, musí HOME nejprve prokázat **stejné oddělené jobs**, jinak STOP.

## 2. Autentizace komentáře a ručního fallbacku – C2

**Jediný běžný issue #183** v repo zaplikj30-ui/Zamerovac-android (ne PR #186, jiné issue ani PR komentář). Workflow na aktuálním defaultním main: **issue_comment: types: [created]** a **workflow_dispatch**. Celý text příkazu je vždy právě jedna ASCII řádka, bez Markdownu, CR/LF, whitespace navíc a shell expanzí:

~~~text
ZAMEROVAC PILOT
ZAMEROVAC BUILD 0123456789abcdef0123456789abcdef01234567
ZAMEROVAC RELEASE 123456789 d63ea74d343f94278bba200430e165cff93977c8ad36fcb9415e66ff64535609
~~~

Druhá a třetí řádka jsou **jen vzor tvaru**, nikoli souhlas ani platné parametry. Striktní parser **re.fullmatch**:
- PILOT: přesně **ZAMEROVAC PILOT**
- BUILD: **ZAMEROVAC BUILD [0-9a-f]{40}**
- RELEASE: **ZAMEROVAC RELEASE [1-9][0-9]{0,18} [0-9a-f]{64}**

Decimal run ID musí být pozitivní celé číslo, bez počátečních nul, pod bezpečným API limitem (ověřit 64-bit a GitHub REST rozsah). Žádný další volný parametr. Příkaz vloží asistent až po **výslovném, konkrétním owner PILOT/BUILD/RELEASE GO**; text jiného issue, PR, starý komentář či stav úspěšného buildu není GO.

**Job-level if před přidělením runneru a zařazením do sdílené concurrency fronty** pro komentář vyžaduje současně:
- github.repository == **zaplikj30-ui/Zamerovac-android** a github.ref == **refs/heads/main** (workflow na defaultním main), github.event_name == **issue_comment**, github.event.action == **created**;
- github.event.issue.number == **183**, issue.pull_request **neexistuje**, event.repository identita odpovídá repo;
- github.event.comment.user.id == **351234773**, login == **zaplikj30-ui**, github.actor == **zaplikj30-ui**, github.triggering_actor == **zaplikj30-ui**;
- **github.run_attempt == 1**, comment body má jen očekávaný typ příkazu / přesný PILOT (bez shell interpolace). Úplný regex až v parseru prvního kroku: job-level GitHub expressions regex fullmatch nenabízí.

Pro ruční workflow_dispatch: repo/main, github.actor a github.triggering_actor owner, run_attempt=1, povinné operation a parametry přesného tvaru; nemá komentář, ostatní bezpečnostní kontroly stejné. **Každý job má vlastní minimální job-level if podle operation, stejné job-level concurrency a vlastní job-level permissions; nedovolený typ nesmí získat ani read-only pilot runner, natož release write token.** **Edited/deleted/untrusted** a libovolné PR issue_comment => job **SKIPPED před runnerem** (GitHub může přesto evidovat skipped workflow run, 0 job compute a 0 publikace). Odlišný owner komentář s chybným payloadem může projít hrubým job-level prefixem, ale musí okamžitě FAIL při parsování, **před checkoutem, Gradlem i privileged operací**. Veřejné komentáře mohou spamovat skipped metadata; neslibovat nula run záznamů.

**První krok všech oprávněných jobs** načte autentický **GITHUB_EVENT_PATH** a společný malý parser v důvěryhodném workflow. Znovu porovná repository.full_name/id, issue.number/pull_request absence, action, comment.id (kladné unikátní číslo), owner user.id/login, sender.id, body, github.actor/triggering_actor, run_attempt, event/ref/main, workflow identity. U běžného komentáře vyžadovat **created_at == updated_at**, ověřit přes GitHub REST, že konkrétní comment ID stále existuje **v #183**, nebylo dodatečně změněné a má přesné stejné tělo; pokud owner edituje/smaže po založení, **STOP**. Stejné parser vstupy pro ruční dispatch z důvěryhodných inputs. Předat jen validované řetězce přes **env/GITHUB_OUTPUT s hex/čísly**, nikdy vložit comment.body do YAML run:, Bash eval, interpolation ani spustit cizí skript. Token pouze na api.github.com a důvěryhodné GitHub endpointy, ne do logu ani na cizí host.

**Rerun / dvojité příkazy / konkurence:**
- run_attempt != 1 => job-level **SKIP**, nedávat tlačítku „Re-run“ právo znovu publikovat. Opakovaný BUILD po skutečném FAIL potřebuje **nový GO a nové owner comment ID nebo nový ruční dispatch**.
- Dva různé owner komentáře mají různá comment ID; run_attempt je sám nededuplikuje. Použít **stejnou konstantní JOB-level concurrency group** (nikoli workflow-level) na všech třech oprávněných PILOT/BUILD/RELEASE jobs včetně manuálního fallbacku, **cancel-in-progress:false, queue:max**. **Job-level if musí proběhnout před zařazením do concurrency fronty**, aby veřejné cizí komentáře nemohly neomezeným počtem skipped workflow runů vytlačit či zablokovat legitimní BUILD/RELEASE. GitHub Actions v roce 2026 podporuje queue:max (až 100 pending, překročení => CANCELLED a ruční kontrola). Žádná dvě oprávněná vydávání nesmějí běžet souběžně; před každým side-effect ověřit aktuální stav pod serializací. Pokud v implementačním pilotu cizí komentář přesto dokáže blokovat frontu, **STOP / návrat k ručnímu workflow_dispatch**.
- BUILD v serializovaném jobu kontroluje přes Actions API **všechny relevantní dostupné stránky** dřívějších BUILD runů tohoto workflow a jejich úspěšné BUILD joby/artefakty, source SHA, verzi a vydání. **Právě jeden úspěšný BUILD pro stejnou verzi/main SHA:** druhý shodný owner comment/dispatch => STOP, nikoli druhá APK. Neúspěšný/přerušený run není PASS ani použitelný artifact. Nejednoznačná historie, nedostupné API či závod => STOP a nové ruční posouzení, ne výjimka skrytým tokenem.
- RELEASE vždy znovu zkontroluje původ, identitu vydání a existující tag/release, a to **uvnitř** serializovaného jobu. Opakovaný RELEASE příkaz, jiný run se stejnou versionName, externí vznik tagu i paralelní editace main => STOP. Žádná nucená úprava tagu, --clobber, force, delete-and-retry nebo automatický retry při nejasném výsledku. Concurrency sama nechrání před jinými workflows — ty budou C1 migrací vyřazeny.

## 3. Oddělený BUILD-ONLY – C3

**Vstup:** pouze aktuální main commit SHA schválený vlastníkem, nikdy cizí PR SHA. Před checkoutem GitHub API main head == schválených 40 hex; checkout přesné SHA z main, verify git rev-parse HEAD, po testech a před uploadem znovu ověřit, že main se nezměnil. Pouze trusted source bez secrets, nic ze soukromých zákaznických dat.

**Před vydáním další verze** musí již existovat schválený produktový commit s pravdivě upravenými **config/app-version.properties**, offline release-history a případně offline help/testy; versionName **striktně vyšší** než skutečný poslední vydaný semver. Stávající 1.4.0 není povoleným novým BUILD cílem. BUILD ověří:
- poslední skutečný GitHub Release/test APK (přes API, nikoli zastaralý dokument), přesně jedno .apk; signer cert SHA256 **c828c96739e554e8da4f5851913356134f1359a98d5013772ad5587e74a2d229**, package **cz.zamerovac.app.preview**, versionName a poslední reálný versionCode;
- vložené bezpečnostní kontroly z dnes existující build-apk.yml; JS/Python, Drive registration, příslušná dostupná regresní sada podle změny; Gradle compile/assemblePreview s výpočtem **nový versionCode = previous real APK versionCode + 1**, nikoliv pořadí nového workflow. HTTP 429 / Gradle FAIL => žádný PASS artifact/Release, bez automatického falešného retry.
- výsledná APK: **apksigner verify**, cert, package, **versionName=X.Y.Z-test**, **versionCode > poslední vydané** a rovné stanovenému bezpečnému novému code; skutečný **sha256sum APK**. Následně jediný soubor **Zamerovac-vX.Y.Z.apk** v Actions artifactu. Artifact název deterministicky váže **build run ID, run attempt=1, source SHA a owner comment ID** (u ručního fallbacku explicitní marker manual), takže při čtení nejsou možné nejednoznačné kandidáty. V artifactu **žádný manifest ani další soubory**.
- log/step summary musí zaznamenat source SHA, build workflow path, run ID+attempt, event, autorizační komentář ID nebo manual, APK SHA256, signer, package, versionName/code, předchozí release ID/tag/code a výsledky testů. Bez tajných údajů. BUILD job success je nutný pro RELEASE, není důkaz fyzického testu ani opravy #88.

**Práva BUILD:** job-level contents:read; případné actions:read pro přesné vyhledání dřívějších BUILD runů, explicitně bez contents:write. Upload artifact GitHub Actions přes runtime token, nikoliv přístup k Releases.

## 4. Oddělený RELEASE-ONLY a stejná APK – C3

**Vstup:** nový samostatně schválený owner příkaz (nebo ruční dispatch) s **decimal BUILD run ID** a **64 lower-hex SHA256 samotného APK**. RELEASE job bez kódu z produktu, Gradlu, sestavování, odemykání HOME nebo instalace externích věcí z artefaktu. Jediné nutné write právo **contents:write**; navíc **actions:read** pro přečtení konkrétního workflow runu a Actions artifactu.

1. **Provenance přes GitHub API, fail closed:** owner komentář nebo ruční fallback znovu validován jako C2; run ID existuje v **tomtéž repo a repo ID**, je z **výslovně povoleného workflow id/path** na **main**, event pouze **issue_comment(created owner #183)** nebo owner workflow_dispatch(operation=build), run **completed/success** a **run_attempt == 1**, actor i triggering_actor owner, head_repository_id správný, head_branch=main a source head_sha důvěryhodný. Build job v jobs API přesně identifikován a **conclusion=success**; žádný release-only/pilot run nesmí sloužit jako zdroj. Pro komentářový původ identita původního comment ID z názvu artifactu + GitHub REST issue comments: přesné #183, author ID, nezměněný created/updated a přesný původní BUILD příkaz na schválený SHA; pro manual ověřit operation/build a jeho původní ověřený event/step summary, jinak STOP. Provenance z názvu ani z logu samotná nestačí, musí současně souhlasit nezávislá REST metadata runu, jobu, komentáře a artefaktu. UNKNOWN metadata nebo nepřístupné ověření => STOP, ne předpoklad PASS.
2. **Source a existence artifactu:** aktuální HEAD main musí být **rovný source SHA původního buildu**, případný drift => STOP a nový BUILD GO. Pro run musí být právě **jediný očekávaný, neexpirovaný artifact** s korektním názvem, ID, workflow_run.id/head_sha/repository_id/head_repository_id; všechny stránky artefaktového seznamu kontrolovat na duplicity. Artifact od jiného runu, po jiném pokusu, vypršelý artifact, jiné name, další soubory v ZIP => STOP. Run attempt=1 řeší nejednoznačnost obnovy pokusu. GitHub artifact **ZIP digest je jen doplňková kontrola archivu, NENÍ hash APK**.
3. **Bezpečné ZIP:** stažení pouze přes GitHub REST s omezením velikosti, HTTPS a kontrolovanými přesměrováními; **Authorization nesmí odejít z api.github.com na externí redirect host** (po prvním ověřeném 302 použít oddělené požadavky bez bearer tokenu, reject neznámý host/schéma). Python stdlib zipfile: **právě jedna** central-directory položka se jménem přesně **Zamerovac-vX.Y.Z.apk**, žádné další entry (ani skryté), dirs, absolutní cesty, ../, backslash, symlink/hardlink, executable/script, nenormální typ nebo encrypted; povolit jen očekávaný typ komprese, odmítnout duplicitní názvy, chybnou CRC, ZIP bomb a příliš velký kompresní poměr. Horní limit archivu i rozbalené APK (navrženě 100 MiB; před implementací změřit skutečnou velikost), bezpečný TEMP se zápisem jednoho obyčejného souboru, bez jeho spuštění. Jakákoli neověřená vlastnost ZIP => STOP.
4. **Binární nezávislé ověření:** spočítat **SHA256 rozbalené APK** a porovnat s **owner-supplied 64hex**; apksigner verify včetně předem pinovaného certu, aapt package **cz.zamerovac.app.preview**, **versionName=X.Y.Z-test**, **versionCode > poslední SKUTEČNĚ vydané APK**; release version X.Y.Z semver > poslední skutečně vydaná X.Y.Z. Z API main SHA načíst **config/app-version.properties jako data** (bez checkoutu a spouštění skriptů) a vyžadovat jeho shodu s ověřenou APK. Z GitHub Release API stáhnout poslední zveřejněnou APK a prověřit její signer/code stejně jako dnešní preflight. Žádný „PASS“ jen podle popisu či původního logu.
5. **Zákaz dvojitého vydání / TOCTOU:** uvnitř jediné concurrency group (C2) po kontrolách **bezprostředně znovu načíst main HEAD, latest release ID/tag/code, existenci cílového tagu v Git refs i existenci release a assetu**; pokud změna, existující tag nebo nejistý REST timeout => **STOP**, žádné přepsání. Jediný create bez --clobber/force/retag/delete a bez retry smyčky; tag cílit na ověřený source SHA. Pokud vytvoření tagu/release/upload assetu skončí částečně nebo UNKNOWN, **zastavit a ručně prověřit**, nesmazat automaticky a nezkoušet vytvořit znovu. Vydat **tentýž právě zvalidovaný temp APK soubor** bez recompilation či přepisu bajtů. Po uploadu GitHub release asset stáhnout a **znovu ověřit SHA256 proti schválenému APK**; teprve potom hlásit RELEASE PASS. Nejde-li download ověřit, oznámit UNKNOWN/STOP, nikoli PASS.
6. **Metadata:** zaznamenat owner comment ID (nebo manual), BUILD run ID+attempt, approved SHA256 APK, product source SHA, nový Release ID/tag/asset ID a výsledný digest do GitHub run summary / PR. Nic nevydávat jen proto, že BUILD PASS nebo workflow skončil zeleně.

## 5. Pilot a přesná negativní testovací matice – C4

**Pilot 0 = žádný APK a žádný publish**. Teprve po nezávislém DESIGN APPROVE, bezpečné implementaci a jejím SOURCE review + samostatném owner PILOT RUN GO:
- owner zadá do issue #183 **ZAMEROVAC PILOT**; read-only job bez checkoutu/Gradlu/artefaktu/Release ověří autentický komentář, actor, ref, workflow/run attempt a zapíše skutečný run URL a výsledek;
- statickými a lokálně simulovanými event fixture testy prokázat, že **cizí user ID/actor/triggering_actor**, cizí issue a PR comment, edited/deleted, rerun, jiné repo/ref, jiný command, multiline, shell payload, Unicode/whitespace neprojdou; pro live negativní pilot vytvořit pouze odděleně schválené neškodné owner comment ve špatném issue / neplatný příkaz a ověřit **job SKIP/STOP a nulové přidělené write oprávnění**. Cizí účet/test comment se nepožaduje, pokud není právně a technicky dostupný; simulace ≠ live důkaz.
- Neočekávaný live trigger, permission nebo běh = **STOP**; nesměšovat „skipped workflow metadata“ s runtime START. Pilot PASS neznamená úspěšnou bezpečnou publikaci.

**BUILD pilot** až pro pozdější skutečnou vyšší produktovou verzi, nový owner BUILD GO; **RELEASE** teprve po kontrole konkrétního BUILD artifactu, novém RELEASE GO. **Fyzická instalace a reálný Bosch/S Pen/Drive/SAF samostatně** – fyzický PASS se z CI nevyvozuje.

| Scénář (pozitivní i negativní) | Povinný výsledek |
|---|---|
| Owner PILOT, správný issue/ref/actor/ID, attempt=1 | read-only PASS, **0 APK, 0 Release** |
| Cizí issue/PR, actor nebo user ID, edited/deleted, rerun attempt=2, no GO | job SKIP před runnerem; **0 build, 0 publish** |
| Příkaz s dalšími řádky, Markdownem, shell payloadem, nevalidní SHA/run ID/hash | parser FAIL před checkoutem či write |
| Dva současné owner BUILD pro stejný SHA/verzi, opakovaný komentář | jeden přijatý BUILD nejvýše; druhý STOP; žádná tichá změna kódu |
| SHA drift / source není current main / změna release během buildu | STOP; nevydávat, žádný „PASS artifact“ |
| HTTP 429, chybějící Gradle dependency, neplatný podpis/package/name/code | BUILD FAIL, 0 release, žádný schválený APK |
| BUILD GO bez nového RELEASE GO | jediný ověřitelný Actions artifact, **0 Release/tag** |
| RELEASE bez konkrétního úspěšného BUILD/run attempt=1, z jiného repo, expired/duplicate artifact | STOP |
| ZIP s ../, absolutní cestou, symlinkem, extra APK, duplicitním entry, zip bomb | STOP bez extrakce/spuštění nebezpečného payloadu |
| Jiný SHA256 APK, ZIP digest zaměněný za APK, podpis/cert/package/verze/code | STOP |
| RELEASE pro už vydanou 1.4.0, prázdnou novou verzi, tag exists, latest drift | STOP bez přepsání |
| Dva současné RELEASE, dva různé RUN k téže verzi, rerun, neznámý výsledek HTTP | nejvýše 1 vydání, druhý STOP / UNKNOWN ručně vyřešit |
| RELEASE GO pro plně ověřený nový BUILD | **jeden nový Release, stejný SHA256 bajtů před a po uploadu** |
| Původní build-apk.yml se starými booleany / HOME legacy publish | 0 možnost BUILD→RELEASE jedním souhlasem |
| Fyzický Android upgrade, data, S Pen/Bosch, live Drive/SAF | **NOT RUN**, dokud vlastník fyzický test výslovně nezahájí |

**Závazný doklad**: u každé etapy aktuální runner/produkt SHA, prostředí, přesné PASS/FAIL/SKIP/NOT RUN/BLOCKED, URL a chybějící důkazy; žádný skutečný build/pilot nebyl při této DESIGN úpravě spuštěn. Neodůvodněné další bezpečnostní vrstvy, P/Q/E manifesty, vlastní backend či secret PAT jsou zakázané.

## 6. Varianty, rizika, HOTOVO / STOP

| Varianta | V čem je lepší / horší | Verdikt |
|---|---|---|
| **A – malá úprava současného GitHub Actions**: jeden soubor, oddělené jobs + owner issue_comment, manuální fallback | Splní #183 i #184 bez nových serverů/tokenů. Riziko PUBLIC skipped metadata, parseru, race a artefaktu vyžaduje konkrétní testy. | **PODMÍNĚNĚ PREFEROVÁNO – až po nezávislém DESIGN APPROVE** |
| **B – pouze bezpečný ruční workflow_dispatch** se stejným BUILD/RELEASE oddělením | Nejmenší nové autorizační riziko; nesplní automatické spuštění z běžného ChatGPT. Při neúspěšném bezpečnostním pilotu návrat k B. | **Bezpečná záloha** |
| **C – externí webhook/server/token** | Více tajných údajů, provozu, údržby, ceny i míst selhání. | **NEDOPORUČENO** |

**Zbývající rizika:** GitHub owner účet může být kompromitovaný (není druhý faktor), PUBLIC komentáře mohou vytvářet skipped běhy, třetí strany mohou ovlivnit externí síť/dodávky, API a artifact mohou selhat v neurčitém stavu, concurrency fronta má strop 100 a její pořadí není garantované. Fail-closed a serializace nejsou matematický důkaz absence závodu; implementační testy a nezávislý kontrolor musí ověřit skutečný YAML/REST/ZIP. HOME zůstává vypnutý, bez nové instalace. Žádné zákaznické ostré soubory.

**DESIGN HOTOVO:** všechny C1–C4 jsou konkrétně navržené, ověřené oproti skutečnému main, a **jiný kontrolor** schválí nový přesný SHA. **IMPLEMENTACE HOTOVO:** po DESIGN APPROVE autor ve *stejném PR #186* udělá jediný izolovaný workflow celek, vlastní pozitivní/negativní testy a kumulativní self-review, následně **nové nezávislé SOURCE/SECURITY review**. **PILOT HOTOVO:** pouze po zvláštním RUN GO skutečně prokázaný read-only komentář a odmítnutí chybných vstupů. BUILD, RELEASE a fyzický Android jsou další **oddělené souhlasy a evidence**.

**STOP:** přetrvávající stará one-shot release cesta, nemožnost oddělit contents:read/write, autentizovat akci, ověřit artifact a jeho bajty, bezpečně ukončit UNKNOWN publish nebo neúměrné náklady. **NEMĚNIT:** produktový kód a zákaznická data, podpis a package ID, hotové test-v1.4.0, sync #88, HOME.

### Podklady

- [Nezávislé review PR #186 – CHANGES REQUIRED](https://github.com/zaplikj30-ui/Zamerovac-android/pull/186#pullrequestreview-5953495936).
- [GitHub Actions events – issue_comment](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows).
- [GitHub Workflow syntax – jobs permissions a concurrency queue:max](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax).
- [GitHub REST – artifacts](https://docs.github.com/en/rest/actions/artifacts).
- [GitHub REST – workflow runs](https://docs.github.com/en/rest/actions/workflow-runs).
- Skutečný main **.github/workflows/build-apk.yml**, **.github/workflows/windows-home-apk-release.yml**, **config/app-version.properties**, **AGENTS.md**, **START_ZDE.md**, [#42](https://github.com/zaplikj30-ui/Zamerovac-android/issues/42).

## Stav implementace po schválení DESIGN (18. 11. 2026)

Nezávislé [APPROVE DESIGN](https://github.com/zaplikj30-ui/Zamerovac-android/pull/186#pullrequestreview-5954205381) autorizovalo pouze implementaci, ne její spuštění ani merge. V témže PR #186 je nyní navržena změna `.github/workflows/build-apk.yml` a pomocné soubory `tools/release/apk_gate.py`, `tests/test_apk_gate.py` bez zásahu do produktových funkcí, package ID a podpisu. **Pouze SOURCE / offline kontrola**, nikoli prokázaný běh GitHub Actions. Finální SHA, cílené testy a rizika jsou uvedeny v navazujícím PR komentáři.

**HOME RETIRED – rozhodnutí vlastníka 18. 11. 2026:** [přesný souhlas](https://github.com/zaplikj30-ui/Zamerovac-android/pull/186#issuecomment-6978003077) výslovně ukončuje HOME jako aktivní součást projektu. Ve stejném PR #186 jsou odstraněna obě aktivní YAML: `.github/workflows/windows-home-apk-release.yml` (starý BUILD→RELEASE obchvat) a `.github/workflows/windows-self-hosted-qa.yml` (HOME QA). **Historický odstavec v sekci 0 a staré implementační podmínky výše popisují stav PŘED tímto rozhodnutím a nejsou dnešním pokynem HOME znovu vytvořit.** Repo pouze přestává mít HOME workflow; PC, runner, služba, registrace, historie, staré logy a APK nebyly změněny. **Původní HOME merge blocker je na úrovni zdrojových souborů odstraněn**, pokud nový HEAD a celá aktivní nabídka workflow obstojí v regresi. Ostatní merge podmínky (cílené PASS, nezávislý SOURCE/SECURITY review a nový owner MERGE GO) zůstávají.

**PILOT/BUILD/RELEASE/Android fyzický test NOT RUN**. Poslední reálná APK `test-v1.4.0` nedotčena. Žádné nové spouštění, merge ani automatický release.
