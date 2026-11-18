# QA-107-03: trvalá ochrana hlasových nahrávek (varianta B)

Schválení a rozsah: [#42/6796061421](https://github.com/zaplikj30-ui/Zamerovac-android/issues/42#issuecomment-6796061421), přidělení Codexu [#42/6820736252](https://github.com/zaplikj30-ui/Zamerovac-android/issues/42#issuecomment-6820736252). Pokračování existujícího PR #107 z `22369966d02fe49feb227042f49daa8a1f4a4372`; historický base `c604860db4fddeefc077e27411bc1941815f7d94`. Před úpravou i při autorské kontrole ověřen main `cf7807905f77f6fd8478c137b1b41aca6ebc3275`. Žádný merge, APK, nová závislost, změna synchronizace #88, workflow, identity/podpisu/verze nebo zápis do #110/#114/#115.

## Kontrakt a pořadí

1. `PendingAudio.begin` pod `TrashPurger.LOCK` ověří ID, soubory, rezervace a cesty bez symlinků. V privátním `files/media` vytvoří unikátní `.audio-ID--UUID.tmp`. V `files/pending-audio-v1/UUID.json` uloží verzovanou evidenci `recording`, název rezervace, ID a čas. Každý pokus má vlastní Android `AtomicFile`, omezenou velikost a SHA-256 obálku. Zápis zahrnuje explicitní fsync, dokončení, fsync adresáře a kontrolní dočtení. Recorder se spustí až po tomto potvrzení a mimo globální I/O lock.
2. Po skutečně úspěšném `Recorder.stop` se uvolní recorder, synchronizují a hashují skutečné bajty. Evidence `completed=true`, `pending`, velikost a hash musí být ověřeně uložená **před** publikací. Při libovolné chybě zůstane zdroj. Selhání recorderu, prázdný soubor, nepovedený fsync nebo chybějící důkaz dokončení nejsou úspěšně dokončená nahrávka.
3. `MediaStaging.publishAudio` publikuje ve stejném adresáři přes atomický `Files.createLink`, který odmítá existující cíl. `ATOMIC_MOVE` na Linuxu může existující cíl přepsat, proto se pro zvuk nepoužívá. Zdrojový hardlink se v této etapě **nikdy nemaže**; dvě jména stejného inode nespotřebují dvě kopie obsahu. Při nepodporovaném hardlinku zůstane originál a evidence pro kontrolu/export. Žádný destruktivní fallback.
4. Následuje synchronní potvrzení MIME/jména přes prefs. False/exception neodstraní žádný audio soubor. Obnova opakuje `commit()` i tehdy, když `getString()` vrací stejné hodnoty: SharedPreferences mění paměť i při neúspěšném diskovém zápisu.
5. `saveDataChecked` provede stávající CAS a durable project write. Až poté se znovu načte **primární** `projects.json`, synchronizuje jeho adresář a ověří konkrétní současná vazba record/note/audio. Záložní JSON není oprávněním označit zvuk `bound`. Explicitní bridge `confirmPendingAudio` navíc porovnává přesný uložený snapshot a všechny identity. Nedůvěřuje JS booleanu; opakování nepřepisuje projekt. Selhání následného ledgeru nevrací již uložený projekt zpět.
6. Obnova při startu, po Save a otevření přehledu kontroluje ledger, hash skutečných médií a primární projekt. `pending`, `bound` a `needs-review` se odvozují bez úpravy projektu. `recording` bez aktivního recorderu vyžaduje kontrolu. Poškozená/chybějící evidence, nepodporovaná verze, `.new`, osiřelá rezervace, starý `.capture` i neznámý nereferencovaný soubor se hlásí jako nejistota. `.new` se neodstraňuje přes AtomicFile.openRead. Platná `.bak` využívá standardní obnovu AtomicFile; poškozená evidence se neresetuje.

## UI a hranice retence

`pending-audio.js` doplňuje na hlavní obrazovku tlačítko **Uchované hlasové nahrávky** a v otevřené poznámce možnost připojit dokončenou nahrávku. U bodové poznámky jde do Save o návrh. Nejistý originál lze zkopírovat systémovým výběrem dokumentu pro kontrolu, bez předstírání jeho dokončení/přehratelnosti. Cíl musí mít schéma content a nesmí být vlastní media provider; file URI nesmí umožnit zkrácení originálu. Nové JS texty jsou v i18n, nativní texty exportu ve strings.xml. Nápověda a test vyhledávání odpovídají skutečným akcím.

Cancel, Back, failed Save, CAS/rebase ani Undo/Redo neodstraňují audio. Historie, detailItems, koš a starší záloha nejsou přímým potvrzením aktuální vazby, nikdy povolením k mazání. `TrashPurger` ponechává audio podle trvalé evidence, rezervací, MIME a audio referencí včetně historie; poškozená evidence chrání všechny nejisté kandidáty. Staré cleanup intent bez metadat se také nemažou. Běžné fotografické přílohy se nadále čistí podle původních referenčních pravidel. Dva staré auditní testy očekávající smazání hlasu byly změněny na explicitní byte-exact KEEP; kontrola smazání historické fotografie zůstává.

Běžný ZIP/synchronizace projektů obsahuje jejich referencovaná média, **ne nepřipojené privátní nahrávky**. K jejich přenosu slouží explicitní kopie. Nezavádí se audio GC, migrace ani synchronizační protokol. Ostatní importní cesty MediaStaging.commit/MediaIngest zůstávají mimo změnu recorderového kontraktu.

## Důkazy a reprodukce

Původní syntetické bajty: `[0,1,2,3,4,5,20,40,80,255]`; SHA-256 `86d5b35cddd2c4be8c0ba478afe72ab809717878b5bce1d8e9865f5cb3f7d50a`.

- Původní ruční JDK probe z PR #110 na přesných původních Java blobech: **RED**, po commit(false) nezůstala žádná kopie. Kontrola commit(true) měla přesný hash.
- Nový **stejný** `AudioCompletedKeepTest` spuštěný ve zvláštním worktree na původním `22369966…`: Java compile PASS, **1 test / 1 FAIL**, assertion `Completed original deleted after prefs failure; expected KEEP`. Robolectric sdk35/JDK17, žádná změna původních produkčních tříd.
- Nové produkční testy: zachování přesných bajtů/SHA při prefs false; všechny instrumentované hranice fsync/ledger/publication/metadata; opakovaná obnova; chybějící/poškozené `.bak`/`.new`; neplatné cesty/symlinky; rezervace a souběh; kolize cíle; prázdný a 4MiB soubor; historie/koš/starší backup; selhání ledgeru po uloženém projektu; skutečný Native CAS bridge; odmítnutí file URI před otevřením exportu.
- Node vykonává produkční rich-note funkci a history wrapper, včetně nevolání potvrzení při failed Save/Cancel. Chromium vykonává skutečné UI, Stop/Cancel/restart/reattach/Save, Back, chybu vazby po Save a nejistý export. **Chromium Native je výslovně model**, nenahrazuje Robolectric/Android recorder.
- Registry `qa/coverage-v1.json` mapuje specifikaci → produkci → testy → limity; nový Chromium suite je v `local-browser-qa --all`.

Reprodukční příkazy (JDK17, Gradle8.10.2, SDK35; bez APK):

```sh
gradle --offline --no-daemon --max-workers=1 :app:testPreviewUnitTest
python tests/manual_audio_completed_keep_regression.py
node tools/local-qa.cjs --quick
# Se spuštěným lokálním HTTP serverem assets a Playwright/Chromium:
node tools/e2e/pending-audio.cjs
node tools/e2e/note-sync.cjs
node tools/e2e/quality-regressions.cjs
node tools/e2e/help.cjs
node tools/e2e/media-import.cjs
```

Po přidání reálného AtomicFile ledgeru používá výchozí ruční test reálnou Robolectric regresi, nikoli mock nového úložiště. Historické `--expect-red` zůstává omezeno na shodné původní bloby. Finální přesný SHA, PASS/FAIL/SKIP/NOT RUN a logy se zaznamenávají **po** posledním commitu a opakování testů; předchozí průběžné výsledky nejsou PASS finálního SHA.

## Autorská kontrola a zbývající hranice

Kritická invariantní vlastnost: po úspěšném stop existuje zachovaná původní kopie nezávislá na úspěchu metadat/projektu. Žádný kód této retence nemaže audio; automatické odvození vazby nepíše projekt. Chybný/cizí snapshot nemůže přepsat novější data. Poškozený ledger nesmí být prázdným seznamem. GC zůstává zakázáno. Změny vizuálů kót/geometrie/exportu a #88 nejsou součástí.

Pro budoucí ostrá data jde o podstatně bezpečnější ukládací kontrakt, **ne o doklad odolnosti konkrétního telefonu proti výpadku napájení nebo selhání úložiště**. NOT RUN: fyzický Android/recorder, OS kill/power loss, reálný plný disk, SAF poskytovatel, hardlink/directory fsync a platformní symlinky na cílových telefonech, Samsung/IME/Bosch/živý Drive. Injektovaná I/O selhání nenahrazují fyzický ENOSPC. Hashování/obnova probíhá streamovaně pod společným lokálním zámkem, čas je úměrný médiím (do 2GiB na soubor); odezvu velkých reálných kolekcí je třeba změřit na zařízení. Privátní adresáře a I/O lock předpokládají důvěryhodný proces aplikace; neřeší kompromitovaný OS ani atomické openat proti cizímu procesu měnícímu předky mezi kontrolami.

**HNED:** dokončit a doložit regresi na posledním SHA, bezpečně publikovat existující PR #107 a #42 a předat teprve po autorské bráně. **POZDĚJI:** fyzická akceptace a výkon, samostatné řešení #88; případné GC až po novém schválení. **NEMĚNIT:** původní média, přesné hodnoty, ostatní PR, sync/release/runner workflow. Cílená kvalita návrhu 8/10: ověřitelná nedestruktivní persistence, ale dosud bez fyzické platformní a výkonové akceptace.
