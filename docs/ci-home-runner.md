# Domácí GitHub Actions runner – zaměřování a stav migrace

> **HOME RETIRED – HISTORIE, NIKOLI AKTUÁLNÍ PLÁN.** Vlastník [18. 11. 2026 rozhodl](https://github.com/zaplikj30-ui/Zamerovac-android/pull/186#issuecomment-6978003077) ukončit HOME QA i domácí vydávání; v PR #186 jsou smazána obě odpovídající aktivní workflow. Původní běhy a údaje níže se zachovávají pouze jako archivní důkazy. HOME počítač, runner, WSL ani jeho služba nebyly změněny a nesmějí být zapnuty. `main` bude bez HOME workflow až po zvlášť schváleném merge.

## Aktuální kontrolní bod 8. 11. 2026 – domácí migrace je na main 4/4 PASS; B14 otestována

- **Migrace skutečně hotová na `main` `a309a060dad7075b16cd9d23fd2a3f4c6e12972f`:** [HOME run #42497594300](https://github.com/zaplikj30-ui/Zamerovac-android/actions/runs/42497594300) – **4/4 SUCCESS** (76 rychlých, 21 Chromium, 265 Java/Robolectric + PDF, podepsaný lokální APK smoke). PR #69 byl výslovně schválen a sloučen. Níže uvedený původní text „main nemá QA“ je starý historický záznam.
- **Navazující B14 v [draft PR #71](https://github.com/zaplikj30-ui/Zamerovac-android/pull/71):** [home full run #42519327260](https://github.com/zaplikj30-ui/Zamerovac-android/actions/runs/42519327260), ověřený zdroj `050fab53f48890d1eca2bc12d9b2938f49d67191`: **4/4 SUCCESS** – 79 rychlých Node/Python, 21 Chromium/CDP/pixely, 265 Java/Robolectric + PDF a místní APK smoke (signer/package/code 1155 > 1154), pak **APK smazána**. Jednorázový owner-only workflow byl smazán, zůstaly nové testy a runtime; následně jen doplnění uživatelských textů/dokumentace před integrací. **Přesný B14 main SHA je nutné samostatně otestovat po merge, neodvozovat PASS z této branch.**
- Cloud fallback pouze manuální se schválením vlastníka a limitem 12 USD/měsíc. Domácí runner 16 GB RAM a WSL2 s omezením paměti, sériové těžké joby. **Nezvyšovat HW; nezapínat automatický placený cloud.** Fyzická zkouška STOP/START, Samsung, Bosch, Drive/sync zatím NOT RUN. Schválené vydání jediné APK je samostatný krok a nebylo provedeno.


## Aktualizace migrace 8. 11. 2026 – domácí B12/B13 + release guardy 4/4 PASS, na main zatím NE

- **Cloudová fáze 1 HOTOVO:** `main` `45e1758` má přesně pět GitHub-hosted workflow pouze na `workflow_dispatch`, `cloud_run_approved=false` default, owner + repo + main guard, nouzový cloud APK navíc `publish_release=true`; při přepnutí **0 placených běhů**. [Záznam #68](https://github.com/zaplikj30-ui/Zamerovac-android/pull/68#issuecomment-6723218494).
- **Fáze 2 STAGING, NIKOLIV MERGE:** [PR #69](https://github.com/zaplikj30-ui/Zamerovac-android/pull/69) integruje B1–B13, čtyři domácí joby, domácí release a dvě opravy [PR #70](https://github.com/zaplikj30-ui/Zamerovac-android/pull/70): technický APK smoke má živé ověření předchozí publikované podepsané APK + `versionCode=previous+1` místo pevné 1155; release uploader odmítá neověřené URL a autorizovaná přesměrování.
- **Skutečný domácí full QA [#42496018861](https://github.com/zaplikj30-ui/Zamerovac-android/actions/runs/42496018861): 4/4 SUCCESS**, zdroj `9368cafae3be5f8ebaa06b0f851dd63833c9ca19`, domácí Windows 11 služba 16 GB, WSL2 ext4 4 GB RAM / 2 CPU, těžké práce postupně: rychlé **76 PASS/0 FAIL**, Chromium **21 PASS/0 FAIL**, Robolectric **265 PASS/0 failures/errors/skips** + PDF parser i pixely 3 fixtures **PASS**, podpis/package/versionName technické APK **PASS**. Živé read-only GitHub Releases API ověřilo poslední vydanou `test-v1.3.0`, code 1154, následná lokální testovací APK code 1155 správná a **odstraněná bez uploadu/release**. Nových **17/17 bezpečnostních offline Python testů PASS** [#42495643843](https://github.com/zaplikj30-ui/Zamerovac-android/actions/runs/42495643843).
- Jednorázový čtyřjobový workflow po PASS odstraněn `dd9b51a7`; v následném `4be907b8` přibyla jen dokumentace. Testovaný aplikační/testovací/vydávací kód je nezměněný; **žádné nové runtime 4/4 na úklidovém nebo dokumentačním SHA**. `main` nemá domácí QA, proto na main **NOT RUN**, fyzický Samsung/S Pen/Bosch/Drive i ikony STOP/START **NOT RUN**.
- **Bezpečnostní hranice:** zásadní merge do main pouze s výslovným schválením a po nezávislé finální kontrole. Po sloučení vyvolat ownerem HOME QA přesného main SHA a vyžadovat 4/4 PASS, nikoli SKIP. Žádný placený cloud bez souhlasu (12 USD/měsíční strop), žádná průběžně vydaná APK.



## Nový plný domácí integrační checkpoint 4/4 — 8. 11. 2026

[**Skutečná domácí Windows QA #42487162258](https://github.com/zaplikj30-ui/Zamerovac-android/actions/runs/42487162258) skončila 4/4 SUCCESS** na přesném trusted SHA `ca8ea1420d7ee42dbc6f1bbf6147a8ab0cc1cd85`. Nešlo o cloud nebo simulaci běhu, ale o skutečnou Windows 11 službu `Zamerovac-Win11-QA` a WSL2 omezené na 4 GB RAM / 2 CPU:

1. **Quick Windows Node/Python: 76 PASS, 0 FAIL**; zahrnuje bezpečnostní testy vydávání a opravenou regresi verze.
2. **Windows Chromium: 21 scénářů PASS, 0 FAIL**; kreslení, zobrazované pixely, galerie, zoom, přesnost, editace, synchronizační simulace a čitelnost.
3. **WSL2 Java + Robolectric: 265/265 PASS** (44 XML reportů, 0 failures/errors/skipped), konfigurace Drive, tři PDF fixtures samostatně přezkoušené striktním parserem i vykreslením barev **PASS**.
4. **Domácí Windows technické preview sestavení: PASS**, podpis shodný s 1.3.0, `cz.zamerovac.app.preview`, `versionCode=1155` nad skutečnou vydanou `1154`, `versionName=1.3.0-test`. **APK odstraněna, žádný upload, release ani instalace**.

Dočasný owner-only workflow měl čtyři joby a přesně **stejná těla testovacích jobů a kroky** jako navržený `windows-self-hosted-qa.yml` (ověřeno přímým porovnáním od `permissions:`); rozdíl byl pouze bezpečně omezený `push` na připravenou větev a její čtyři vnitřní kontroly `github.ref`. Žádné `pull_request`, hostované cloud běhy ani release. Po PASS dočasné workflow odstraněno v `45ce325`. **Pozdější čistý HEAD nemá vlastní 4/4 run**: produkční a testové soubory jsou však stejné jako na testovaném SHA; další dokumentační commity je nemění. **Skutečná main-only workflow pořád NOT RUN**; hlavní větev `main` zatím neobsahuje migrované postupy.

**Předvídaná budoucí slabina, nikoli dnešní FAIL:** smoke build v domácí QA stále používá pevně `GITHUB_RUN_NUMBER=155`, tedy `versionCode 1155`, a porovnává proti **zatím poslední vydané 1154**. Po budoucím vydání code 1155 už nesmí test tvrdit, že code 1155 je novější; bude nutné adaptovat QA smoke podle poslední vydané APK. Oddělený domácí a nouzový cloudový **vydávací** postup již používají code `latest+1` a staré APK ověřují. Tuto věc vést jako prioritu před **následujícím** vydáním, nesnižovat bezpečnost tím, že se test číslování odstraní.

**Pořadí dalšího kroku:** technická nezávislá revize celého integračního staging; řešení rizika automatických placených `pull_request` workflow na dnešním `main` ještě **před založením PR do main**, uživatelovo schválení zásadního spojení, přechod všech pěti cloud fallbacků na ruční opt-in a hlavní domácí QA na skutečném `main` SHA. Bez toho sloučení ani vydání APK. **NOT RUN:** fyzický Samsung, S Pen, Bosch Bluetooth, Google Drive ostrá data a automatický provoz Windows služby bez uživatelského přihlášení. **Kontrolovaná kvalita domácí QA staging 8/10**; přímý main akceptační průchod dosud chybí.

## Sjednocená přípravná větev B12/B13 a obě vydávací ochrany — 8. 11. 2026

**Větev `integration/b12-b13-safe-home-20261108` je čistý STAGING, bez PR do `main` a bez release.** Vznikla z [domácího release security PR #67](https://github.com/zaplikj30-ui/Zamerovac-android/pull/67) a přebrala bajtově identické čtyři B13 aplikační/testové bloby z [PR #65](https://github.com/zaplikj30-ui/Zamerovac-android/pull/65). Dále obsahuje [záložní cloud versionCode ochranu z #66](https://github.com/zaplikj30-ui/Zamerovac-android/pull/66) a bezpečně upravený regresní `tests/versioning.js`.

[Domácí kontrola celého kombinovaného kódu #42479492037](https://github.com/zaplikj30-ui/Zamerovac-android/actions/runs/42479492037), testovaný SHA `807ce643c8424522448da334098c0675ae035d65`:

- **76 PASS, 0 FAIL, 0 SKIP** rychlé Node/Python testy, včetně B13 tři prsty, historie, verze, a přímé kontroly přesného zdrojového SHA. `tools/local-qa.cjs --quick` vypsal 4 nesouvisející `NOT RUN` pro těžší kontroly (Chromium/APK/fyzická zařízení).
- **8/8 PASS** off-line ochrana přesměrování GitHub tokenu; pouze falešné tokeny, bez internetu a bez skutečného GitHub API.
- **6/6 PASS** offline brány cloud fallbacku pro rozpočet a monotonicitu Android versionCode.
- **FAIL [předchozí pokus #42479354813](https://github.com/zaplikj30-ui/Zamerovac-android/actions/runs/42479354813)**: v rámci integrace se projevil zastaralý JS test (očekával staré `NEW_CODE <= PREVIOUS_CODE` místo bezpečného `RELEASE_VERSION_CODE <= PREVIOUS_VERSION_CODE`) a neúplný `PATH` pro Python v dočasném workflow. Test `tests/versioning.js` byl v **původní vlastnící větvi #66** aktualizován, do integrace přesně převzat a nyní ověřuje **silnější** pravidlo (nezmizel); Python nastaven ve stejném `cmd` prostředí. Následný PASS není maskovaný či vynechaný test.
- **Dočasný workflow** pro integrační test po PASS odstraněn; současný integrační HEAD má stejné aplikační/testovací a vydávací soubory jako zdroj testovaný v #42479492037, ale změněné SHA kvůli úklidu a dokumentaci.

**Důležité rozlišení:** kompletní 4/4 home QA na aplikaci s B13 má [starší PASS #42474058575](https://github.com/zaplikj30-ui/Zamerovac-android/actions/runs/42474058575), nikoli na novém kombinovaném HEAD. **Na finálním staging commitu 4/4 NOT RUN**. Neproběhla žádná nová APK release ani ověření na fyzickém Samsung/Bosch. K budoucímu spojení do `main` je potřeba nezávislé review a bezpečný přechod placených spouštěčů (stále aktivní na současném main), který nesmí vyvolat překročení měsíčního limitu 12 USD.

## Nezávislá bezpečnostní oprava stažení staré APK pro domácí vydání (8. 11. 2026)

Při čtení vydaného APK přes `https://api.github.com/repos/.../releases/assets/{id}` umí standardní `urllib.request.HTTPRedirectHandler` zkopírovat původní hlavičku **Authorization: Bearer ...** do požadavku na jiný host (GitHub CDN). To je nežádoucí šíření oprávnění; **nemáme důkaz, že se to stalo v reálném provozu**, protože domácí release workflow dosud **NOT RUN**.

V izolované větvi `infra/home-release-asset-auth-guard-20261108` je opraven soubor `.github/workflows/windows-home-apk-release.yml`: ověřuje HTTPS a host původního GitHub API požadavku, při HTTPS přesměrování na jiný host smaže citlivé hlavičky bez ohledu na velikost písmen, HTTP přesměrování odmítne. Vedle toho vzniklo **8 offline regresí** `tests/test_home_release_asset_redirect.py` s pouze falešným tokenem. Původní standardní přesměrování v testu prokazatelně obsahovalo Authorization, nová verze jej už nepřenáší.

- [Původní domácí FAIL #42478884578](https://github.com/zaplikj30-ui/Zamerovac-android/actions/runs/42478884578): 7/8 PASS, jedna chyba v kontrole hlavičky GitHub API verze (neměla tajný token). Příčina opravena case-insensitive odstraněním hlaviček.
- [Opravený domácí běh #42479032731](https://github.com/zaplikj30-ui/Zamerovac-android/actions/runs/42479032731): **8/8 redirect bezpečnostních PASS + 6/6 cloud release budget/version PASS**, ověřen checkout přesného SHA `92cf99f9`, domácí Windows 11. Testy se nedotkly žádného reálného tokenu, API, placeného cloudu ani APK.
- Po získání PASS byly oba jednorázové workflow YAML odstraněny ze zdrojové větve; produkční skript i Python test zůstaly beze změny. Další krátký běh mohl být už zařazen do fronty; každý výsledek se posuzuje samostatně. Finální větev se po úklidu liší od testovaného SHA pouze odstraněním dočasných workflow a dokumentací.

**NOT RUN:** skutečné přesměrování při stahování ostrého release assetu, kompletní workflow vydávání a update Android na fyzickém zařízení. Před jediným schváleným vydáním nadále vyžadujeme hlavní domácí QA 4/4 PASS na přesném `main` SHA a nezávislou revizi publikace.

## Ověřené spouštěče aktuálního main — proč ještě není bezpečné sloučit PR (8. 11. 2026)

Na **main `4953d66`** existuje přesně pět původních workflow; domácí QA a domácí vydání jsou dosud jen v draftu. Zkontrolována skutečná GitHub YAML v `main`, nikoli jen popis z chatu:

- `quick-check.yml` – placený `ubuntu-latest` při `push main` i `pull_request` do `main`, s cestami včetně `app/**`, `tests/**` a **vlastního YAML souboru**. Nový PR zaměřený přímo na `main` s touto změnou **může spustit placený běh ještě před ochranným převodem**.
- `verify-native.yml` – placený `ubuntu-latest` při `pull_request` do `main`, cesty Java/Gradle/tests/PDF a **vlastní YAML**. PR do `main` není rozpočtově bezpečný bez brány.
- `export-audit-sources.yml` – placený `ubuntu-latest` při `push main` se změnou **vlastního YAML**, dále ruční spuštění.
- `build-apk.yml` – placený `ubuntu-latest` ručně či při `push main` pouze se změnou `.github/apk-build-request.txt`; **ruční režim dosud nemá vyžadovaný budget checkbox**.
- `emulator-smoke.yml` – ruční, ale placený `ubuntu-latest` bez budget checkboxu.

**Praktická brána bez překročení 12 USD:** nejprve nezávisle revidovat připravený kompletní integrační balík #64 + #65 + #66; před jakoukoli změnou `main`, jeho PR spouštěčů či událostí zajistit prokazatelné dočasné zablokování placených automatických workflow (pokud je potřeba, zásah vlastníka do GitHub nastavení s výslovným souhlasem), potom **atomicky aktivovat všech pět ručně schvalovaných cloudových workflow** a domácí `main` QA. Až po opětovné kontrole a zelené domácí QA pustit navazující editor a regresi. Záložní cloud se nesmí natrvalo zrušit; vrátí se jen jako ruční schvalovaná možnost. **Bez potvrzené bezpečné cesty nic neslučovat; nemáme nástroj pro bezpečné administrativní pozastavení GitHub workflow v tomto chatu.** Není to důkaz, že změna automaticky spustí placený běh; je to doložené riziko podle přesných `on` + `paths` pravidel.

## Ověřený integrační checkpoint — B12 + B13 (8. 11. 2026)

[Integrační draft PR #64](https://github.com/zaplikj30-ui/Zamerovac-android/pull/64) slučuje B12 QA testovací kód (včetně `tools/local-qa.cjs`, který chybí na `main`) se zajištěnou domácí infrastrukturou a pěti manuálními cloudovými fallback workflow. Jde o **staging**, nikoli aktivní `main`; původní automatické placené spouštěče na `main` stále existují. Další izolovaný [draft PR #65](https://github.com/zaplikj30-ui/Zamerovac-android/pull/65) opravuje jednu reprodukovanou chybu tří prstů v gestu bez úpravy uložených rozměrů.

**Nový společný domácí běh [#42474058575](https://github.com/zaplikj30-ui/Zamerovac-android/actions/runs/42474058575): 4/4 SUCCESS** na přesném checkoutu B13 commitu `d59eea0c1aac476bac68b5fd8c97367b99ffac1d`:

- Windows Node/Python: **76 PASS, 0 FAIL**.
- Windows skutečný Chromium CDP, kreslení a pixely: **21 PASS, 0 FAIL**.
- WSL2 ext4 / Java 17 / Robolectric: **265/265 PASS, 0 fail, 0 error, 0 skipped**, 44 XML reportů; nezávislý Python PDF parser a renderer kontrolovaly 1stránkovou, 3stránkovou a vícestránkovou sadu, včetně barev fixtures – **PASS**.
- Windows technická `assemblePreview`: **PASS**, certifikát a `cz.zamerovac.app.preview` zachovány, testovací `versionCode=1155` > vydané `1154`, `versionName=1.3.0-test`. Kontrolní APK ihned smazána; **žádné vydání/artefakt APK**.

Regrese tří prstů má [RED důkaz #42473552211](https://github.com/zaplikj30-ui/Zamerovac-android/actions/runs/42473552211) a [GREEN #42473642573](https://github.com/zaplikj30-ui/Zamerovac-android/actions/runs/42473642573); po celé regresi byl **dočasný** `.github/workflows/windows-b13-full-qa.yml` odstraněn v B13 `63c6e45`. **Finální B13 HEAD není totožný s testovaným SHA**, ale rozdíl spočívá výlučně v odstranění dočasného CI YAML (produkční a testové soubory beze změny). Není tedy pravdivé tvrdit 4/4 přímý PASS na finálním HEAD.

Pro integrační #64 byl zkontrolován obsah **všech pěti** cloudových workflow: pouze `workflow_dispatch` + explicitní `cloud_run_approved` + omezení vlastníka a `main`; cloudové vydání ještě vyžaduje `publish_release`. Domácí release je samostatný manuální workflow a **NOT RUN**. **Další bezpečnostní oprava je oddělená v [draft PR #66](https://github.com/zaplikj30-ui/Zamerovac-android/pull/66):** původní cloudový fallback z PR #64 používal nevhodné `1000 + GITHUB_RUN_NUMBER`; PR #66 již **před placeným sestavením** čte a ověřuje poslední skutečně vydanou APK, její podpis/balíček a počítá `versionCode=previous+1` nezávisle na čítači workflow. **Šest trvalých statických bezpečnostních kontrol PASS na domácím Windows** ([běh #42476952979](https://github.com/zaplikj30-ui/Zamerovac-android/actions/runs/42476952979)); dočasný validační workflow byl odstraněn, takže finální HEAD se liší jen úklidem a případnou dokumentací. **Navíc je ověřena syntaxe skutečného Bash cloud workflow v domácím WSL2: 5/5 PASS** ([běh #42477412201](https://github.com/zaplikj30-ui/Zamerovac-android/actions/runs/42477412201), přesné testované SHA; poté odstraněn pouze dočasný workflow). Předchozí [FAIL #42477264555](https://github.com/zaplikj30-ui/Zamerovac-android/actions/runs/42477264555) vznikl **chybou testovacího nástroje**, který při posílání textu z Windows do Linuxu převáděl LF na CRLF; po přepnutí na bajtový přenos je stejný produkční Bash PASS. **Skutečný cloudový build/publikování stále NOT RUN a vyžaduje nezávislou revizi vydávací logiky.** Oprava #66 není na `main`; preferovaný release je připravený domácí workflow. V žádném případě nespouštět placenou alternativu bez výslovného souhlasu vlastníka.

Na PC byl vytvořen ZIP ovládacích ikon STOP/START a uživatel nahlásil úspěšné vytvoření ikon na ploše. **Jejich skutečná funkce NOT RUN**; stop služby může přerušit job. Fyzický Android, S Pen, Bosch, živá sync, instalace přes původní verzi a test služby bez hlavního Windows přihlášení **NOT RUN**.

**Rozhodovací brána:** všechno stage, nic neslučovat/vydávat bez bezpečné migrace placených triggerů a souhlasu. Po schválení nejdříve aktivovat ochranu cloud fallback na `main`, ověřit `main` self-hosted QA se skutečným main SHA, až potom sloučit editor a B13, po společné regresi připravit **jedinou** APK. Stávající starší kapitoly níže jsou historické checkpointy.

**Datum:** 8. 11. 2026. **Účel:** zdrojový kód, výsledky, PR a schválená vydání zůstávají na GitHubu; samotné výpočty QA a build preview APK provádí Windows 11 domácí počítač, bez placeného GitHub-hosted runneru.

## Provoz a zabezpečení

- Pevný limit domácího PC **16 GB RAM**, žádný návrh rozšíření hardwaru. Runner `Zamerovac-Win11-QA` je Windows služba pod odděleným účtem `ZamerovacQA`, základ v `C:\actions-runner`.
- GitHub workflow je připraveno pouze pro **vlastní `push` na `main`** a ruční `workflow_dispatch` vlastníkem **na `main`**. Dočasný infra push i pevný B12 ref byly odstraněny. Žádné `pull_request`, `pull_request_target`, forky nebo nedůvěryhodné checkouty na domácím PC. **Main zatím tyto změny neobsahuje – PR #61 je DRAFT.**
- **Skutečný checkout commit SHA** se ověřuje před testováním; při `push main` i ručním spuštění na `main` platí přímo `github.sha`. Původní kompletní PASS testoval připnutý B12 QA SHA `bc67b1a`; po odstranění infra triggeru se nový main-only YAML **ještě znovu nespouštěl** (bez automatického spuštění a bez cloudových minut).
- Git `MinGit 2.56.0.4` v izolovaných nástrojích, Python 3.13, Node.js, Playwright 1.62.1/Chromium, Java 17, Gradle 8.10.2, Android SDK API 35 + build-tools 34/35. Nástroje, které se instalovaly, byly ověřovány pomocí SHA256 či pevné verze.
- WSL2 distro `Zamerovac-Ubuntu-QA` vzniklo importem oficiálního Ubuntu 24.04 rootfs (SHA256 `2a790896740b14d637dbdc583cce1ba081ac53b9e9cdb46dc09a2f73abbd9934`) **pod servisním účtem**. Jeho `.wslconfig` omezuje RAM na 4 GB, CPU na 2 a swap na 1 GB; naměřeno 3919 MiB. Gradle Linux `--max-workers=1` a heap max 1536 MiB. Neměnit uživatelský Windows účet.
- Automatický start služby při současném přihlášení hlavního účtu byl doložen; **provoz bez přihlášení do hlavního účtu ještě NOT RUN**.
- GitHub Actions maximálně **12 USD/měsíc**, bez automatického dobíjení. Cloudové buildy/testy **nespouštět bez výslovného schválení**; skutečný účetní zůstatek nelze prohlásit za ověřený.

## Proč Linux pro nativní Android testy

Přímý Windows Robolectric nad B12 testovací SHA `bc67b1a3507829a39be46a2b41e04198c71fe767` skončil **85 FAIL / 265 testů** (zejména rozdíly atomického ukládání na souborovém systému a oprávnění symbolických odkazů). Nesnižovat počet testů ani neoslabovat bezpečné ukládání.

[Domácí WSL Linux důkaz #42463157484](https://github.com/zaplikj30-ui/Zamerovac-android/actions/runs/42463157484): skutečný ext4 / Java 17 / API 35, **265 testů PASS, 0 FAIL, 0 ERROR, 0 SKIP**, 44 XML JUnit souborů, 19 negativních Drive konfigurací. Soubory reportů jsou na GitHub Actions; nejsou to fyzické Android testy.

## Společné workflow

Soubor `.github/workflows/windows-self-hosted-qa.yml` v infra PR #61:

1. Rychlé Node/Python testy na Windows.
2. Chromium plné scénáře kreslení, pixelů, galerie, uložení/Undo/Redo.
3. Linux WSL2: ve stejném ověřeném SHA zkontrolovat Drive, Java, **všech 265 Robolectric**, a na Windows nezávisle parsovat/vykreslit vygenerované PDF.
4. Pouze po **všech** PASS lokální technická zkouška podepsané preview APK: správný certifikát, aplikace `cz.zamerovac.app.preview`, vzestupné `versionCode`, správné `versionName`. Testovací soubor se **smaže**; žádný release, žádný APK artefakt.

**Společný domácí běh [#42465583431](https://github.com/zaplikj30-ui/Zamerovac-android/actions/runs/42465583431) dokončen 4/4 PASS**: Node/Python, plné Chromium/pixelové kontroly, WSL Java + **265/265 Robolectric** (0 FAIL, 0 SKIP) + nezávislé PDF a technické sestavení APK s kontrolou podpisu/balíčku/`versionCode=1155`. Kontrolní APK byla odstraněna, **nic nevydáno**. Dřívější oddělené kontroly PDF [#42441872063](https://github.com/zaplikj30-ui/Zamerovac-android/actions/runs/42441872063) a build [#42441640443](https://github.com/zaplikj30-ui/Zamerovac-android/actions/runs/42441640443) také PASS. Audit původního vydaného `1.3.0` (`versionCode=1154`, stejný podpis i balíček) [#42466074842](https://github.com/zaplikj30-ui/Zamerovac-android/actions/runs/42466074842) PASS.

**Nové publikování APK** je připravené jen jako manuální workflow `.github/workflows/windows-home-apk-release.yml`. Požaduje vlastníka, `main`, výslovný příznak vydání, ID dokončeného domácího QA běhu se všemi čtyřmi PASS na **stejném SHA**, důkaz správného původního certifikátu/čísla reálně poslední vydané APK a `versionCode` o 1 větší. Respektuje existující pravidlo `1000 + GITHUB_RUN_NUMBER` nastavením lokálního offsetu od předchozí vydané verze, ne od čítače nového workflow. Soubor **nebyl spuštěn ani vydán**; před ostrým spuštěním jej nezávisle revidovat.

## Placený cloud jako ruční záloha

Větev `infra/stage-cloud-fallback-20261108` připravuje `quick-check.yml`, `verify-native.yml`, `build-apk.yml`, `emulator-smoke.yml` a `export-audit-sources.yml` jako **workflow_dispatch ONLY** s požadovaným `cloud_run_approved=true`, omezením na vlastníka. Cloud build k vydání navíc vyžaduje `publish_release=true` a `main`. **Statický audit všech pěti [#42465713082](https://github.com/zaplikj30-ui/Zamerovac-android/actions/runs/42465713082) = PASS**, ale staging **není sloučen do `main`**. Na `main` stále běží staré automatické `pull_request` / `push` cloud workflow. **Neotvírat nový PR ani neslučovat změny bez kontroly vyhodnocování PR triggerů**; cílem je nejprve bezpečně aktivovat všechny manuální cloudové brány a teprve pak integrovat domácí QA/editor, bez placeného běhu. Stav účtování není ověřený.

## Pozor na navazující editor PR

Editorové drafty **#60 → #62 → #63** navazují jeden na druhý, ale všechny v diffu proti `main` obsahují i `.github/workflows/quick-check.yml` a `.github/workflows/emulator-smoke.yml`. QA B12 `quick-check.yml` stále obsahuje **automatické `push` a `pull_request` cloud triggery**, a navíc přináší nové browser/latency/pixelové QA sady. **Při budoucím sloučení editoru nesmí dojít k vrácení těchto placených triggerů ani ke ztrátě nově přidaných kontrol.** Sloučení/rebase je nutné předem připravit tak, aby se zachovalo obojí: rozšířená QA a manuální cloud fallback s budget gate. Dosud se těchto větví nedotýkat bez potřeby.

## Co je ještě potřeba

- **Hotovo:** 4/4 domácí PASS na B12 SHA; pokrytí změn `app/build.gradle`, `AndroidManifest.xml`, `res/**`, `config/**`, `gradle/**`; **10 jednorázových workflow smazáno** (commit `80848214`), zbývají hlavní domácí QA a ruční domácí release.
- **Hotovo v draftu, ale zatím neověřeno spuštěním:** odstranění infra `push` a pinned B12 SHA; budoucí běhy budou ověřovat `main` SHA události, nezměnily se testovací scénáře.
- **Před merge:** bezpečně sjednotit ruční cloud fallback s novými QA scénáři #63 a zamezit obnově automatických placených workflow. Znovu prověřit release skript nezávislým kontrolorem a spustit první main QA po bezpečném přechodu. Zvážit budoucí odvození technického preview versionCode od skutečně vydané APK (současný technický proof je pevně 1155).
- PR #61 a navazující editor PR #60/#62/#63 zůstávají DRAFT. **Bez schválení neslučovat a nevydávat APK.**
- Android hardware Galaxy S24 Ultra/Tab S11 Ultra, S Pen, Bosch, živá synchronizace a instalace přes stávající verzi **NOT RUN**. Emulátor jen pokud 16GB domácí PC prokazatelně zvládne.
