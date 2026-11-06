# Opravy potvrzeného auditu #39 (A39-01 až A39-06)

Rozsah: issue #42, testová evidence #28, draft PR #41, větev `codex/velka-aktualizace-39`.
Při převzetí HEAD `fefb46f`; proti auditovanému `86b0a63` jen pět Markdown dokumentů.
Žádné souběžné změny opravovaného produkčního kódu. Celý audit se neopakoval.

Původní dva reprodukční soubory z #28/6678826456 jsou uložené v `a83c2daf05776c3fce3d214f3c84dc0c2a835ee6`.
[Běh před opravami](https://github.com/zaplikj30-ui/Zamerovac-android/actions/runs/42176445230):
245 testů, přesně šest auditních assertion failures, bez errors; sedm TLS metod je navíc zděděných z původní fixture.
Bezpečnostní aserce původních reprodukcí nebyly oslabeny.

| Nález | Cílená oprava | Ověření |
| --- | --- | --- |
| A39-01 P1 | LocalDatabase používá pro zápis i čtení 20 MiB skutečných UTF-8 bajtů. Odmítnutí proběhne před změnou primary, backup i recovery evidence. | Původní reprodukce; multibajtový JSON limit −1 / přesně / +1, okamžité načtení a porovnání obou potvrzených souborů po odmítnutí. |
| A39-02 P1 | Procesní revize důvěry sdílená všemi instancemi registru instalace. Forget zneplatní rozjednané handshaky; atomická kontrola při uložení a opět před návratem. Známý reconnect nevytváří chybějící vazbu. Revokace má vlastní řídicí executor. | Skutečné JVM mutual TLS: revoke během approval i finálního committed, nové párování po novém výslovném souhlasu, čtyři obsazené přenosové workery. |
| A39-03 P1 | Iterativní invariant po merge/restore i JS CAS reconciliation. Z každého cyklu se do kořene přesune lexikograficky nejmenší ID; původní parent je zachován v hierarchyConflict. UI ukazuje OPRAVENÝ CYKLUS SLOŽEK. Obsah, názvy, přesné hodnoty a hodiny se nemění. Opětovné sloučení původní a opravené revize nevytváří konfliktní kopie. | Společné Java/JS fixtures pro dva/tři uzly a vlastní cyklus, oba směry a opakování; restore, neměnnost vstupů a přesné kóty; browser viditelnost/navigace/reopen. |
| A39-04 P1 | Provider open/read/close, dekomprese, kontroly a kopírování nových médií běží mimo DB lock. ProviderIo omezuje čekání, Activity ruší pracovníka při zániku. Pod lokálním lockem se znovu načte aktuální DB a potvrdí přidání nových kopií. Chyba odstraní pouze média a metadata připravená tímto pokusem. | Původní stalled callback; skutečný validní ZIP se souběžnou přesnou místní editací, failed commit a rollback; timeout provideru ignorujícího interrupt. |
| A39-05 P1 | ArchiveLimits pro import i export: 20 000 položek včetně tří metadat, 20 MiB každý JSON, 2 GiB celkem rozbaleně včetně manifestu. Export počítá skutečné UTF-8 bajty a velikosti před zápisem; průběžný rozpočet odmítá růst souborů. | Původní nadlimitní export; roundtrip přesně 20 000 položek, sparse médium 2 GiB odmítnuté před zápisem, streamový rozpočet přesně/přes celkový i JSON limit. |
| A39-06 P2 | Purge i ZIP export sbírají reference stejným průchodem PeerSnapshot (úklid bezpečně přeskakuje stará neplatná ID, přenos zůstává striktní) jako sync/history: media, audioMedia a historické items uložené v JSON řetězci. Zachované záznamy a jejich historie dál chrání sdílené soubory. | Původní reprodukce, sdílené audio/historické reference a oddělený immutable záložní soubor; původní fault/retry testy koše. |

Stejný invariant dostal také transportně nezávislý JS `sync/protocol-v2.js`; používá stejné fixtures a opakované sloučení opravené/původní revize.

Nové testy: `Audit39FindingsTest`, `Audit39HandshakeTest`, `Audit39SafetyTest`, `tests/audit39_hierarchy.js`, nový scénář `tools/e2e/peer-sync.cjs`.
Rozšířeny `tests/help_guide.js`, `tests/release_history.js` a registr `qa/coverage-v1.json`.
Česká offline nápověda a **nevydané** poznámky #39 jsou aktualizované; žádná vymyšlená verze vydání.

## Skutečné výsledky

První cílený běh: **22 testů PASS / 0 failures / 0 errors / 0 skipped**, z toho 7 zděděných původních TLS metod.
Následující plná nativní regrese zahrnuje ještě přidaný hraniční ZIP roundtrip a streaming budget.
Výsledky plné regrese a browser kontrol se doplní po jejich dokončení; jejich přítomnost v registru není tvrzení PASS.

Příkazy (Gradle 8.10.2, JDK17, SDK35, Robolectric4.16.1; pouze syntetická data):

```sh
gradle --no-daemon :app:verifyDriveRegistration :app:compilePreviewJavaWithJavac :app:testPreviewUnitTest -PdriveRequireConfigured=true
gradle --no-daemon -p tools/drive-config-checks verify
node tests/audit39_hierarchy.js
node tools/qa/audit.cjs
for f in tests/*.js; do node "$f"; done
python3 -m unittest discover -s tests -p 'test_*.py' -v
```

Browser a PDF regrese podle existujících `quick-check.yml` / `verify-native.yml`; žádné assemble/build-apk/emulátor workflow.
Místní cache/toolchainy jsou mimo git. První plný běh odhalil regresi úklidu starých neplatných ID (původní testy koše); opravena bez oslabení původních asercí. Statická Python kontrola byla přizpůsobena přesunutým společným limitům a writeru. Přípravné chyby SDK/JDK/CA a chybějící import či nepodporované Files.readString v novém testu byly opraveny; nejsou vydávány za testové PASS.

## Hranice důkazu a další krok

Neproveden přenos fyzických >2 GiB dat; celkový limit ověřuje sparse soubor, rozpočet a vstupní kontroly.
NOT RUN: živý GMS/OAuth/Drive a dva skutečné přístroje, Android rádio/Keystore/Doze/OS kill/upgrade/power-cut, Samsung/Xiaomi/Lenovo, S Pen/Bosch/mikrofon/kodeky a výkon slabého HW.
Zelené testy nejsou fyzická akceptace ani nový nezávislý audit.

Po úspěšné regresi následuje cílená kontrola těchto šesti oprav před případným jediným sestavením testovací APK.
PR zůstává draft. Žádná APK, merge, změna Google registrace, mazání existujících uživatelských dat nebo širší refaktoring.
