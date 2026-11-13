# Windows TEMP fixture: cílená autorská oprava

Rozsah: PR124, výchozí `023ae630ee6ed161f99a3b80c5a3eca752b29725`,
[zadání](https://github.com/zaplikj30-ui/Zamerovac-android/pull/124#issuecomment-6865578897),
[koordinace](https://github.com/zaplikj30-ui/Zamerovac-android/issues/42#issuecomment-6866219627).
Toto je autorská analýza a testování, nikoli nezávislý SOURCE verdikt nebo Windows PASS.

## Co skutečně dokazuje Windows log

Originální [job 132182322602](https://github.com/zaplikj30-ui/Zamerovac-android/actions/runs/43511412090/job/132182322602)
na Windows Node26.13.0 ověřil dva čisté checkouty (QA výchozí SHA, produkt
`ae3b4df53c25557f28b4a25ccb65adc2abdff639`). Výsledek: **15 testů, 13 PASS, 2 FAIL, 0 SKIP**.
Filtr zachoval dvě položky `error:` se stejným `Chromium path resolves elsewhere`;
mezi nimi je ještě kopie chyby uvnitř assertion `Input`. Nejde o tři různé FAIL.
Názvy, indexy ani stacky neprošly filtrem; lokální TAP byl odstraněn.

Obě chybové položky mají `inputNamespace=nativeNamespace=dos`,
`componentCounts=[7,7]`, `rootSame=leafSame=true`, `differentComponents=[1]`,
`shortNameInputComponents=[1]`, `portable.inputEquivalent=true`,
`portable.nativeEquivalent=false` a `fileIdentity.available/same/regular/singleLink=true`.
To dokazuje rozdílný výstup native a portable realpath a okamžitou shodu file ID.
Velmi silná indicie 8.3 aliasu není ověření přes GetShortPathName/GetLongPathName;
v logu nejsou ani obě skutečné cesty. File ID samo neprokazuje nepřítomnost reparse
nebo závodu a nikdy zde nepovoluje jinou cestu.

SOURCE kandidáti jsou test 9 `pin verifier rejects changed bytes, wrong paths,
symlinks and hardlinks` a test 12 `real binary mutation during hashing and name
replacement fail closed`. První začne pozitivním ověřením TEMP binárky. Druhý
očekává chybu až při mutaci, ale stejná dřívější canonical chyba přeruší test před
hashováním a nesouhlasí s očekávaným regexem. To vysvětluje i kopii chyby uvnitř
assertion Input. **Identita druhého skutečně selhaného testu zůstává HYPOTÉZA**;
model reprodukuje tento mechanismus, nedoplňuje ztracené Windows důkazy.

## Jedna oprava bez změny akceptačního pravidla

`binaryFixtureDirectory` v `tests/home_qa_integrity.js` vytvoří unikátní TEMP
složku a získá její `fs.realpathSync.native` zápis. Teprve potom se uvnitř vytvoří
syntetické bajty a lokální testovací profil. Oba dotčené testy používají tuto
přípravu. Selhání native rozlišení vyvolá chybu a uklidí vytvořenou složku;
neexistuje portable fallback. Počet původních testů zůstává 15.

Tento postup nekanonizuje vstup produkčního verifieru ani nepřipíná hash existující
cizí binárky. Produkční `tools/qa-browser-identity.cjs`, oba schválené profily,
file locks, sandbox, supervisor, JobObject, manifest 23/96, workflow a produktové
soubory mají proti výchozímu SHA nulový diff. Proto se nemění bezpečnostní
podmínka přijímání binárky a není potřeba schvalovat její novou výjimku.

Kontroly `file===profile.path`, lstat komponent, native canonical shoda,
O_NOFOLLOW, nlink, fd/name dev/ino, magic, úplný SHA256, size/mtime před a po,
výměna pojmenovaného souboru zůstávají v původním pořadí a znění.
Pokud by skutečné připnuté Chromium mělo alias/reparse odchylku, dál skončí BLOCKED.

| Alternativa | Posouzení |
| --- | --- |
| Výjimka pro 8.3 pouze podle tvaru a dev/ino | Nezvolena. Tvar `~1` není důkaz aliasu; nezaručuje bezpečný řetězec a vyžadovala by změnu akceptační hranice a schválení. |
| Normalizovat již deklarovaný produkční `profile.path` před ověřením | Nezvolena. Mohla by skrýt přesměrování a porušila by přesný schválený vstup. |
| Native Windows canonical/short-path API + retained handles | Možný budoucí návrh pro skutečnou runtime potřebu; složitější trust/race/reparse kontrakt, vyžaduje samostatný návrh, schválení a nativní testy. |
| Native zápis nové prázdné fixture složky před vytvořením profilu | Zvoleno. Opravuje chybné předpoklady syntetické přípravy, nerozšiřuje přijetí produkčního verifieru. |

Hrozby: falešný alias / jiný cíl se nesmí přijmout, shodný inode nesmí být
náhradou canonical guardu, reparse/symlink/junction/hardlink nesmí obejít kontrolu,
změna bajtů/metadat nebo výměna názvu se nesmí stát PASS. Nové testy kontrolují
přímé odmítnutí aliasu před open i při shodném file ID a portable zápisu.
Příprava testů není bezpečnostní API pro přijímání libovolných externích souborů.

## Registr pokrytí a důkazů

| Požadavek | Test / důkaz | Limit |
| --- | --- | --- |
| Příčinná reprodukce obou kandidátů | `tests/qa_binary_fixture_paths.js` spouští skutečné callbacky testů 9 a 12 s FS alias modelem, skutečnými bajty, hardlinky, mutací a rename; před opravou 2 canonical FAIL, po opravě oba PASS | API model běžící na Linuxu, nikoli Windows runtime |
| Alias stále nepřijat | Třetí test stejného souboru; native/portable divergence a stejné ID, přesto HOME_BLOCKED před open | Neprokazuje skutečné Windows 8.3 API |
| Windows spellings a chybné cíle | Stávající win32 VM model v `home_qa_integrity.js`: namespace/case/separátor PASS; jiný disk/list, reparse, nlink a fd/name mismatch FAIL | Model |
| SHA256, magic, size/mtime | Doplněné negativní případy uvnitř stávajícího Windows modelu; skutečná mutace a výměna ve fixture | Windows rename semantics NOT RUN |
| Symlink/hardlink a TOCTOU | Skutečné Linux fixture + uvedené modely | Nativní Windows junction na Linuxu SKIP |
| Návaznosti ochrany runneru | `home_sandbox_security.js`, `qa_process_client.js`, Python file-lock/JobObject/identity/supervisor/gate testy a související regrese | Linux cleanup skutečný; Windows JobObject/file-lock kontrakty modelové |

Test-first výsledek a finální dostupná regrese jsou doloženy v autorském komentáři
PR124/#42 s přesným SHA, příkazy, počty a SHA256 logů. Při prvním lokálním běhu
chyběly Git objekty produktu pro dvě registrační/checkout kontroly; po read-only
fetch přesného schváleného produktu baseline **14 PASS / 0 FAIL / 1 SKIP**.
Nešlo o novou chybu zdrojů ani důvod k instalaci nebo opakování preflightu.

## Bezpečná budoucí diagnostika, bez spuštění v této etapě

Při samostatně schváleném příštím běhu doporučuji verzovaný Node reporter, který
povolí pouze přesný allowlist 15 známých syntetických názvů a indexů. Z `test:fail`
vypíše index/název a důvod z uzavřeného enumu (canonical mismatch, hash/mutation,
replacement, assertion, unknown); žádný raw message/stack/actual/expected/location
ani OS error. Neznámý název se vypíše jako `unknown` a způsobí BLOCKED.
Souhrn PASS/FAIL/SKIP a dosavadní redigovaný pathDiagnostic mají zůstat zachovány.
Raw TAP ani cesty se nesmějí publikovat. Návrh není implementací nebo schválením
nového workflow; PR125, jeho spotřebovaný RUN a YAML se nemění.

Existující publikované prostředí Linux, Node24.22.1/Python3.12.14; aktivace vždy
`source /workspace/toolchains/activate.sh`. Bez instalací a opakování preflightu.
Nativní Windows 15/15, Chromium/sandbox/CDP/JobObject, UI 23/96 a HOME 4/4:
**NOT RUN / HOME BLOCKED**. APK/merge/release/Actions nebyly spuštěny.
Nápověda ani changelog aplikace se nemění, protože jde výhradně o QA fixture.
Po úplném autorském předání následuje nezávislá kontrola Kontrolora 40 a až pak
případné nové výslovné schválení Windows runtime.
