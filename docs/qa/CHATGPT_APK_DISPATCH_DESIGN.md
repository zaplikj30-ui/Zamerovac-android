# Návrh: ChatGPT → SESTAVIT → VYDAT → fyzicky otestovat

**Stav: DESIGN PRO NEZÁVISLÉ SECURITY REVIEW – NEIMPLEMENTOVÁNO.**
Navazuje na [#183](https://github.com/zaplikj30-ui/Zamerovac-android/issues/183) a [#184](https://github.com/zaplikj30-ui/Zamerovac-android/issues/184).
**Rozhodnutí vlastníka:** obě změny jako jeden celek; **ChatGPT Work NEPOUŽÍVAT**.
**Výchozí zdrojový SHA:** `5ecc098d4c9a54d5cf9fb3376834e1e7b238241f` na `main`, poslední vydaná testovací APK `test-v1.4.0`. Před implementací aktualizovat proti skutečnému HEAD.

## Co je prokázané a co není

- Běžný ChatGPT má připojený GitHub nástroj pro zápis komentářů do issues jménem `zaplikj30-ui` (ověřeno v REST komentářích PR #179), čtení kódu, vytváření větví a PR, případně opakování *již existujícího neúspěšného* runu.
- Tento konektor **neposkytuje vytvoření nového `workflow_dispatch`**. Jeho `rerun_failed_workflow_run_jobs` není univerzální spouštěcí API.
- GitHub Actions podporuje `issue_comment: created` a spouští takový workflow z výchozí větve. Jde o **novou veřejnou událost**, kterou je nutné autorizovat **před spuštěním jobu**. Předchozí projektové řešení chráněných owner komentářů existuje v `cloud-pr150-source-qa.yml`, ale jeho komplikované P/V/Q/E brány se nemají přebírat.
- Současný `build-apk.yml` má pouze `workflow_dispatch`, sestavení i publikaci v jednom privilegovaném jobu `contents:write` a `publish_release=true` povinné již pro build. Po úspěšném běhu #44223056380 vyšlo `test-v1.4.0` se SHA256 `d63ea74d343f94278bba200430e165cff93977c8ad36fcb9415e66ff64535609`; již vydané bajty neměnit.
- Pro nový build nelze použít starou verzi `1.4.0`; další produktová testovací verze a changelog se musejí nejdříve řádně připravit. Testování workflow **není samo důvod vydat prázdnou novou APK**.
- **NEOVĚŘENO:** zda se autorizované owner-komentáře dají bezpečně přijímat i v konkrétním budoucím GitHub Actions prostředí, jak bude ověřeno při pilotu. Žádný pilot ani APK build nebyl v rámci tohoto návrhu spuštěn.

## Technické možnosti

| Varianta | Přínos | Riziko/cena | Rozhodnutí |
|---|---|---|---|
| A. Jen existující ruční `workflow_dispatch` | Nejmenší změna; už ověřená publikace | Nesplňuje spouštění z běžného ChatGPT bez klikání | Bezpečný fallback |
| B. **Owner příkaz přes GitHub issue komentář** | Konektor umí vložit komentář, GitHub umí `issue_comment`; bez Work, osobního tokenu či serveru | Nový trigger a zvýšená rizika autorizace/komentářového vstupu; vyžaduje SECURITY REVIEW | **K prověření jako preferovaný návrh** |
| C. Externí služba/webhook, soukromý token nebo nové infrastruktury | Technicky možné přímé API | Náklady, údržba, nové tajné údaje a rozšíření povrchu útoku | **NEDOPORUČENO** |
| D. ChatGPT Work | Umí ovládat browser v podporovaném prostředí | **Vlastník zakázal** | **VYLOUČENO** |

**Nedělat:** automatické vydávání na `push`, změnu `main` jen kvůli spuštění, vlastní manifestové/P/Q/E řetězce, HOME, nahrání sdíleného PAT tokenu, vydání podle neověřeného komentáře.

## Návrh B – minimální řídicí cesta (ke schválení)

1. **Jeden dedikovaný příkazový issue** (navržen #183, pokud kontrolor neodůvodní oddělené issue). Příkazy jako *celý obsah nově vytvořeného komentáře* s přesnou gramatikou, bez Markdownu, dalších řádků nebo volných parametrů:
   - `ZAMEROVAC BUILD <40-hex-main-sha>`
   - `ZAMEROVAC RELEASE <decimal-build-run-id> <64-hex-apk-sha256>`
   Název/přesný tvar může kontrolor zjednodušit, musí ale zůstat jednoznačný a bez interpretace shellu.
2. Asistent komentář vloží **teprve po konkrétním výslovném BUILD GO či RELEASE GO**. Nevyvodí GO z pouhé existence issues, starých schválení, zprávy třetí strany nebo ze zeleného buildu.
3. Workflow na defaultní `main` má `issue_comment: types: [created]`. Podmínka **na úrovni jobu** (před přidělením runneru) musí být současně: přesné repo, přesné číslo issue, `!github.event.issue.pull_request`, `github.event.action == 'created'`, GitHub-autentizovaný **user ID vlastníka** (ne jen `author_association` či text komentáře), `github.actor` owner a očekávaný prefix příkazu. `github.triggering_actor` a rerun oprávnění posoudit nezávisle. Neodpovídající/cizí komentáře ⇒ **job SKIP, žádný build**.
4. **První krok v jobu** načte autentický JSON event přes `GITHUB_EVENT_PATH`, validuje celé tělo proti pevné gramatice a přesné vlastníkově identitě. **Nikdy** nepřesouvat `github.event.comment.body` přímo do `run: shell`, `eval`, shell command substitution či GitHub expression interpolace. Veškerá proměnná data pouze jako validovaná čísla/hex, předávat přes bezpečná environment/output rozhraní. Nepoužívat kód/artefakty z PR.
5. Pro hlavní build zkontrolovat **aktuální `main` proti schválenému SHA**, checkout přesně trusted `main` commit a před sestavením znovu porovnat Git SHA. Pokud mezitím main driftne, FAIL/STOP. Kontrolovat skutečně poslední vydanou APK, podpis/ID, `versionCode` a připravovanou vyšší verzi, zachovat současné `verifyDriveRegistration` + JS/Python + Gradle. **Nepřidávat produktové změny, nové knihovny ani přesměrování Maven zdrojů bez důkazu.**
6. **Build-only job**: `permissions: contents: read`, žádné oprávnění `contents:write`, žádný release/publish step. Úspěšný výstup jediný `Zamerovac-vX.Y.Z.apk` v Actions artifactu s výsledným SHA256, verzí, signer digestem, source commit SHA a jedinečným run ID v logu. Artefakt považovat za **nedůvěryhodné bajty do doby ověření**. Fyzický test = NOT RUN.
7. **Release-only job**: spouští ho nový samostatný owner komentář (nikdy automatické `workflow_run: completed`). Job má právě `contents:write` a `actions:read`, nepoužívá APK build, neinstaluje externí skripty, nekontroluje cizí PR. Ze zadaného run ID přes GitHub API ověří: stejný repo, schválený GitHub owner, očekávaný workflow, přesné `main` SHA, správné `event`, `conclusion=success`, žádný neočekávaný pokus/odlišný artifact, není expirovaný; přesné jméno artefaktu a právě jedna APK. Porovná **SHA256 samotné APK** s hodnotou v owner komentáři (digest ZIP archivu není digest APK). Ověří `apksigner`, `aapt`, package ID, cert, `versionCode`, `versionName`, aktuální latest release a monotónnost. Při jakémkoli nesouladu STOP bez vytvoření tagu či assetu. Před vytvořením release znovu zkontroluje existenci tagu/nejnovější vydání a změnu `main`. Publikuje **přesně stejné ověřené APK bajty** bez rebuildu.
8. Nevydávat neodstraněné #88 race testy za PASS. Každé GitHub testovací vydání pouze pro **syntetická data**; live Drive/SAF, upgrade a fyzický Android NOT RUN, pokud skutečně neproběhly.
9. Zachovat **ruční owner-only fallback** pro případ chybného konektoru nebo příkazu. Vlastník musí před každým novým cloud RUN ověřit rozpočet (strop 12 USD/měsíc; zpožděné účtování), žádné dražší runnery, HOME či další služby.

### Povinná oponentura před implementací

Nezávislý kontrolor musí především vyřešit:
- Zda bezpečně stačí `issue_comment` + číslo issue + neměnná identita autora; re-run, duplicitní komentáře, `github.triggering_actor`, označení `issue.pull_request`, edited/deleted události a cizí komentář v PUBLIC repo.
- Zda je bezpečné jediné workflow vs. dva workflow soubory, aby **read-only BUILD** nemohl získat write token a **release-only** nikdy neprovedl build/cizí kód.
- Jak jednoznačně autentizovat původ, SHA a integritu Actions artefaktu a zabránit `zip-slip`, symlinku, podvrženému `APK`, duplicitnímu/run ID, expirovanému artefaktu a race se změnou `latest` vydání.
- Vhodnost místního GitHub CLI API, práce s tokenem (nikdy neposílat token na jiné hosty), explicitní `permissions`, bezpečné quoting a vhodnost `gh release create` po ověření.
- Jestli nový veřejný trigger přináší nepřiměřené množství `skipped` runů a zda existuje **ještě menší bezpečný způsob** spuštění z konektoru bez Work, bez tokenu a bez další služby.
- Jaký je minimální pilot, který **nepublikuje APK** a přesto prokáže reálné přijetí komentáře, autorizaci owner identity i fail-closed chování.

## Testovací matice

| Scénář | Očekávané chování |
|---|---|
| Owner + výslovný BUILD GO + přesný current-main SHA | Právě build-only artifact; **0 Release** |
| Cizí uživatel / PR komentář / špatné issue / edit starého komentáře | **0 build, 0 publish**, nejlépe job SKIP |
| Owner text s nečekaným řádkem, shell syntaxí, chybějícím SHA | **STOP před checkoutem** |
| Main se po GO změní | **STOP**, nový explicitní souhlas |
| Maven Central 429 / Gradle FAIL | **FAIL**, žádný artifact s tvrzením PASS a žádný Release |
| Owner RELEASE GO pro existující ověřený build | Přesně stejné APK bajty, nový tag pouze jednou |
| Release bez příslušného BUILD GO/úspěšného runu | **STOP** |
| Změněný APK digest, podpis, ID, code, name, původ runu, expirovaný artifact | **STOP bez zveřejnění** |
| Nové vydání vzniklo mezitím, tag již existuje | **STOP bez přepsání** |
| Rerun stejného příkazu nebo konkurenční publish | Nesmí vzniknout duplicitní nebo neověřený Release |
| Fyzická instalace/sync/Bosch/S Pen | **NOT RUN**, dokud se zvlášť fyzicky neotestuje |

## Akceptace a STOP

**DESIGN HOTOVO:** nezávislá SECURITY kontrola vybraného nejmenšího řešení a rizik s přímým URL. Je-li design potřeba změnit, upravit v této jediné větvi a znovu přezkoumat.

**IMPLEMENTACE HOTOVO:** po design GO programátor provede jednu izolovanou změnu stávající infrastruktury, syntaxi/negativní a pozitivní testy, vlastní review; **jiný kontrolor** nezávisle zkontroluje aktuální diff. Výsledek pravdivě `PASS/FAIL/SKIP/NOT RUN/BLOCKED`.

**PILOT HOTOVO:** pouze po samostatném owner RUN GO se skutečně provede nejmenší nezávadný cloud test, z logu potvrdí trusted SHA a fail-closed případy. **Nová APK/release vyžadují vlastní další schválení**, u budoucí verze, nikoli přepsání `test-v1.4.0`.

**STOP:** prokázané neoprávněné sestavení/publikování, neschválený write token, nezajištěná provenance artefaktu, nepřiměřená externí závislost/náklad či nemožnost nezávislého SECURITY review.

**NEMĚNIT:** produktové soubory, data, podpis/debug cert, package ID, #88 diagnostiky, již vydanou 1.4.0 a HOME.

## Podklady

- GitHub [Events that trigger workflows](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows)
- GitHub [Secure use reference](https://docs.github.com/en/actions/reference/security/secure-use)
- GitHub [REST artifacts and integrity](https://docs.github.com/en/rest/actions/artifacts)
- Aktuální main `.github/workflows/build-apk.yml`, `docs/verzovani.md`, `AGENTS.md`.
