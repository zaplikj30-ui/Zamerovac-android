# Původní Windows QA blokace — důkaz opravy a návrh uzavření

**Výsledek:** normální cesta je již funkčně opravena v řetězci končícím
PR136 `1d6a786c77aa2a797bf7bd75f9977a3ae6613459`. Má skutečný Windows no-op
a15/15 PASS včetně cleanupu a nezávislé delta review. Nový native kód není
pro doložení této opravy potřeba. Neznamená to HOME4/4 PASS, hotovou C,
zaručený hard-stop ani souhlas s novým během.

## 1. Co logy skutečně dokazují

Znovu přímo načteny metadata běhů a dekódované job logy přes GitHub API,
nikoli pouze převzaty komentáře. Veřejně zde jen pevné markery a agregáty;
raw TAP/stderr, osobní cesty a tokeny se nekopírují.

| Důkaz | Prokázaný výsledek a hranice |
| --- | --- |
| [43511412090 / job132182322602](https://github.com/zaplikj30-ui/Zamerovac-android/actions/runs/43511412090/job/132182322602) |15 testů,13 PASS/2 FAIL/0 SKIP. Windows TEMP portable/native canonical rozdíl doložen diagnostikou; přiřazení druhého FAIL ke konkrétnímu testu zůstalo hypotézou. Po následné opravě fixtures další běh vykázal všech15 jednotlivě ok. |
| [43524071686 / job132225342246](https://github.com/zaplikj30-ui/Zamerovac-android/actions/runs/43524071686/job/132225342246) |15 jednotlivých `ok`,0 `not ok`; `BLOCKED: TAP counts differ from 15/15/0/0.` Chyba souhrnné brány, nikoli prokázaný FAIL jednotlivého testu. Souhrnné bajty nejsou zachovány; LF/CRLF/FINDSTR je hypotéza, ne potvrzený historický trigger. |
| [43542503124 / job132286044053](https://github.com/zaplikj30-ui/Zamerovac-android/actions/runs/43542503124/job/132286044053) | Časné FIXTURE_SCOPE_BLOCKED, cleanupVerified=false, workerPassed=false, ownerSucceeded=false, TEMP removed=true. Žádné výsledky jednotlivých testů. Chybí stage/code; přesný historický root cause **nelze zpětně prokázat**. |
| [43613089387 / job132502207524](https://github.com/zaplikj30-ui/Zamerovac-android/actions/runs/43613089387/job/132502207524) | **Konkrétní reprodukovaný problém:** `token-elevated`, new-scope, workerStarted=false. Odmítnutí tokenu před CreateJobObject/CreateProcessW. Není to CreateProcessW hang nebo důkaz sirotka. |
| [43616290568 / job132511962541](https://github.com/zaplikj30-ui/Zamerovac-android/actions/runs/43616290568/job/132511962541) | Po opravě guardu skutečný token + empty Job PASS; handleClosed=true, cleanupVerified=true, ownedProcessCount=0.13 modelů PASS. Worker v tomto běhu **NOT RUN**. |
| [43629772378 / job132553574575](https://github.com/zaplikj30-ui/Zamerovac-android/actions/runs/43629772378/job/132553574575) | Windows57 modelů PASS: Python10+9+3, Node21+13+1;0 FAIL/0 SKIP. Modely nejsou nativní fault testy. |
| [43630576900 / job132556045727](https://github.com/zaplikj30-ui/Zamerovac-android/actions/runs/43630576900/job/132556045727) | COMPLETED/SUCCESS. Runner-idle PASS; skutečný no-op workerStarted=true, cleanupVerified=true, ownedRemaining=0, temporaryFilesRemoved=true, hardTimeout=false. Potom přesný `WINDOWS_FIXTURE_15_PASS_0_FAIL_0_SKIP` a `QA36_FIXTURE15_FULL=PASS`. Bez retry. |

Odmítání SCM tokenu je silné vysvětlení také staršího časného BLOCKED, protože
stejný guard tehdy existoval. **Není to dodatečně získaná diagnostika starého
runu43542503124.** Pro tento run zůstává přesný trigger neznámý. Neznámý
historický trigger se nesmí zaměnit za dnes přetrvávající reprodukovaný FAIL.

## 2. Co přesně opravu tvoří

- PR124 `65a3e4f1981c1f2a1eb96f39e128a4fcc6190729` opravilo dvě syntetické
  binary fixtures: native canonical zápis nového prázdného TEMP adresáře
  získávají **před** vytvořením souboru/profilu. Portable realpath mohl
  zachovat8.3 alias. Produkční verifier dál odmítá nepovolený alias i téhož
  souboru; SHA/reparse/hardlink/TOCTOU ochrany se neoslabily. Modely opravily
  oba kandidáty; přesný druhý historický FAIL nedoplňujeme domněnkou.
- PR127 nahradilo hledání souhrnů FINDSTR striktním TAP kontraktem
  `tools/qa-fixture-tap.cjs`: LF/CRLF, přesných15 identit/pořadí, jediný plán
  a jedinečné úplné počty15/15/0/0; současně skutečný Node exit0, žádný signál,
  spawn error nebo stderr. Chybějící/duplicitní/rozporné údaje a FAIL/SKIP
  nelze převést na PASS. CMD předává nenulový výsledek jako exit1.
- PR129 a navazující opravy zachovávají bezpečně redigovanou první stage/code
  a odmítají rozporný PASS s diagnostikou, firstFailure či cleanup error.
- **PR134 opravilo prokázaný token mismatch:** `TokenElevation==1` nebylo
  správné kritérium administrátora SCM služby. Současný
  `require_windows_service_token()` vyžaduje ZamerovacQA, unlinked
  TokenElevationTypeDefault a neaktivní Administrators membership na explicitně
  duplikovaném vlastním tokenu. Linked Full/Limited, enabled admin, jiný účet
  a každá API/close chyba blokují. Oprava byla zvlášť schválena vlastníkem;
  nejde o nové oslabení v PR140. Účet/služba/ACL se neměnily.
- PR135 zařazuje worker při vytvoření přes JOB_LIST/HANDLE_LIST, suspendovaný,
  bez breakaway; ověřuje konkrétní Job/image/time před ResumeThread.
- PR136 opravilo RF-135-01/02: odstranilo timeoutový `child.kill()` ownera,
  zachytává IPC write chybu, při chybách startupu provádí nezávislé cleanup
  kroky a uchová první chybu i sekundární cleanup selhání. Soft CANCEL není
  hard-stop. R44-01 odmítá retry po CreateProcessW **ve dvou existujících
  branách**, i při zero-process Job a podvrženém retryEligible=true.

Žádný z těchto bodů neprokazuje rollback nevracejícího se kernel API. Není
přidán nový Job/backend, není odstraněn guard ani změněn originální15-case test.

## 3. Na jaké SHA platí Windows PASS

QA SOURCE57 modelů: `357453e5304b3b4e9a98c19367db4899a445e86e`.
QA SOURCE native no-op+15: `012f3bb129f1b77f9e014bbd0f32ed47820fbb9d`.
Produkt obou fixture důkazů: `ae3b4df53c25557f28b4a25ccb65adc2abdff639`.
Event SHA běhu není QA SOURCE SHA.

Přímo porovnáno Git stromy:

```text
012f3bb129f1b77f9e014bbd0f32ed47820fbb9d → 1d6a786c77aa2a797bf7bd75f9977a3ae6613459
  pouze D .github/workflows/qa36-r44-native-normal-account-20261114.yml
357453e5304b3b4e9a98c19367db4899a445e86e → 1d6a786c77aa2a797bf7bd75f9977a3ae6613459
  pouze D .github/workflows/qa36-review44-r44-01-20261114.yml
```

To je důkaz shody runtime/test bajtů PR136 s Windows-tested zdrojem, nikoli
nový Windows běh na jiném SHA. [Nezávislé delta review Kontrolora44](https://github.com/zaplikj30-ui/Zamerovac-android/pull/136#pullrequestreview-5906675585)
na přesném HEAD1d6a786: DELTA PASS, R44-01 potvrzen. PR140 navíc obsahuje
portable C++/POSIX kontrakty a dvě testové fixture opravy, **ne nový Windows
runtime**. Jeho vlastní Linux výsledky se nevydávají za Windows PASS C.

## 4. Co zůstává neověřené

Trvale nevracející se CreateProcessW, násilná smrt ownera během vytváření,
externí atestace/rollback a bounded shutdown nejsou v uvedených bězích
reprodukovány ani ověřeny. V A–E posouzení jde o krajní architektonické riziko,
pro které vznikla C. **Není doloženo, že způsobilo původní incident.**
Neoznačovat toto riziko PASS; neověřený cleanup/chybějící close/unknown child
znamená BLOCKED, STOP dalších běhů a žádný automatický retry nebo PID-only kill.
GitHub job timeout sám neprokazuje cleanup. Žádné HOME fault/hang experimenty.
Zachován i [dřívější výslovný odklad vlastníka](https://github.com/zaplikj30-ui/Zamerovac-android/issues/42#issuecomment-6882377186).

## 5. Můžeme pokračovat v HOME QA4/4?

**Lze připravit pokračování běžné QA; plné4/4 teď spustit ani označit PASS
nelze.** Důvodem není požadavek na nový Sandbox nebo implementaci hypotetické
ochrany C. Konkrétní zbývající brány jsou:

1. Koordinátor rozhodne o uzavření **původní normální blokace** na PR136 a
   o odděleném odložení C. To je doporučení, nikoli svévolné opuštění
   schválené architektury. PR138/140 ani jejich kód se nemažou/neintegrují.
2. Kontrolor46 dostane hotový důkazní podklad a celý relevantní diff; musí
   rozlišit ověřenou opravu od neimplementované C. Žádost není „schvalte C“.
3. Opravy nejsou na aktuálním main `3e3f4ae4384f39c4599c5b0e43a43877e93b3a9f`:
   chybí tam tools/qa-process-client.cjs, qa_owned_processes.py,
   qa-fixture-gate.cjs, qa-fixture-tap.cjs i tests/home_qa_integrity.js.
   Ověřeno proti Git tree main. Koordinátor musí připravit integraci existující
   PR řady a zkontrolovat výsledný důvěryhodný SHA; zde žádný merge.
4. Současné `.github/workflows/windows-self-hosted-qa.yml` main, blob
   `53e397c9af78342ee79bfba3c5801b4f259c8297`, má local-quick, browser-smoke,
   native-jvm a **preview-build-smoke = technické sestavení APK**. Browser/PDF
   kroky obsahují instalace; nelze předpokládat hotovou cache. Aktuální zadání
   instalace i APK zakazuje. Proto celé4/4 pod tímto souhlasem nespouštět,
   nevynechat job a přesto hlásit4/4. Nový odpovídající souhlas a přesný rozsah
   musí rozhodnout vlastník. Historické15/15 není4/4 ani aktuální produkt PASS.

## 6. Připravený pin a bezpečnostní brána pro případný normální běh

[Pasivní kandidátní manifest](qa136-normal-candidate-20261115.json) pinuje
ověřený QA zdroj, historický produkt a stávající workflow. **Není to nový
spouštěč, není čten runtime a executionAllowed=false.** Aktuální produkt main
je evidován odděleně jako netestovaný kandidát. Finální integrovaný/RUN SHA
ještě neexistuje a nesmí se domyslet; při jeho změně nové posouzení.

Pokud bude vůbec potřeba další ověření normální cesty: jen existující runner,
owner/original+triggering actor/repo/ref/event/run-attempt guard, pinované
checkouty QA i produktu, čistota před a po, kontrola identity nástrojů a
read-only idle preflight pod QA účtem. Pouze57 modelů a normální no-op/15,
žádné záměrné native crash/hang/kill. Cleanup musí doložit vlastní Job,
process exit a TEMP; neznámý stav znamená STOP bez opakování. Neopakovat
zbytečně již prokázaný běh jen kvůli jinému event SHA.

Pro nový owner-only recept platí existující render-workflow/strict lint;
fixture-only odlišný recept musí mít zvláštní předspouštěcí review. Není tím
povolena automatická aktivace generátoru se všemi quick testy na HOME.
Nový aktivní YAML, RUN větev, marker ani workflow_dispatch se zde nevytváří.
Fork/PR/artifact není důvěryhodný zdroj a přihlášení pod owner účtem nenahrazuje
souhlas. Žádná nová infrastruktura, instalace, účet/služba/oprávnění.

## 7. Vlastní kontrola a předání

Zkontrolována související změna PR135→136 (13 souborů), kumulativní PR140 diff,
TAP/Node exit/CMD návrat, owner protokol, token, startup/cleanup/close, STOP,
NO RETRY a log redakce proti skutečným markerům. Nalezená opravitelná chyba
**dokumentace**: starý windows-3try PREP dosud doporučoval retry CreateProcessW
v rozporu s R44-01. Opraven text; produkční kód se kvůli tomu nemění.
Starý laboratorní plán označen historickým; vlastník nyní nechce nové prostředí.

Zachovat57 modelů,15 TAP a související pozitivní/negativní Linux regresi.
Výsledný přesný PR140 SHA, prostředí, PASS/FAIL/SKIP/NOT RUN a hashe důkazů
jsou v aktuálním autorském komentáři PR140 a issue42. Neprovedené Windows
fault testy zůstanou NOT RUN, nejsou podmínkou dokazování historického
bezporuchového PASS a nesmí být prezentovány jako splněné.

**Doporučení koordinátorovi:** přijmout normální QA opravu jako funkčně
doloženou, předložit Kontrolorovi46 tento konkrétní celek k uzavření původní
blokace a rozhodnout o samostatném odložení C. Potom pokračovat ve vývoji
produktu a schválené běžné QA. Nevyžadovat novou laboratoř jako náhradu již
existujícího normal PASS; nedávat bezpodmínečný bezpečnostní PASS hypotetickému
hard hang. Co nyní brání formálnímu uzavření: rozhodnutí o rozsahu/odkladu C
a nezávislý verdikt. Integrace a nová4/4 jsou samostatné dosud nepovolené kroky.
