# Domácí GitHub Actions runner – zaměřování a stav migrace

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
