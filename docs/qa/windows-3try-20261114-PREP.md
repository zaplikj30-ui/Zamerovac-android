# HOME Windows QA – neaktivní diagnostika nejvýše tří pokusů

**DRAFT / PREP / HOME HOLD – 14. 11. 2026.** Rozhodnutí Koordinátora 30: [technické podmínky](https://github.com/zaplikj30-ui/Zamerovac-android/issues/42#issuecomment-6871084083) a [přidělení Programátorovi 39](https://github.com/zaplikj30-ui/Zamerovac-android/issues/42#issuecomment-6871120590). Výchozí schválená QA PR129 SHA 43bd2fbc86605399df3fae22489ba713097d660e; produkt PR121 SHA ae3b4df53c25557f28b4a25ccb65adc2abdff639. PR128 a staré RUN jsou neaktivní.

## Nejmenší změna

Jeden nový sekvenční řadič tools/qa-fixture-attempts.cjs volá stávající tools/qa-fixture-gate.cjs:main(60000) maximálně 3×. Původní JobObject/kill-on-close, 15 TAP případů, tokeny a privátní TEMP zůstávají zachované. Stávající Python supervisor pouze při chybě **před spuštěním workeru** znovu použije existující `scope.cleanup()` + `verify_empty()` a vyžaduje ověřenou nulu. Původní brána přidává zpětně kompatibilní návrat redigovaných výsledků a úzce ověřené `retryEligible`, nikoli další procesní vrstvu. Původní samostatné CLI a CMD zachovávají chování.

**STOP:** neověřený cleanup, remainingProcesses jiný než 0, neodstraněný dočasný adresář, rozporné/invalidní evidence, timeout nebo cancel (i s úklidem). Opakuje se výhradně **autentizovaná časná chyba před testem** `verdict-open` nebo `CreateProcessW` (správné Win32 metadata) s `reason=startup-error`, `exitCode=null`, `supervisorExit=77`, potvrzeným `cleanupVerified`, nulou owned procesů, odstraněným TEMP a reportem dokazujícím, že nezačal žádný ze 15 TAP případů. Každé `worker-result`/TAP FAIL, neznámý protokol, chybné identity a nezpůsobilý BLOCKED skončí `STOP_NOT_EARLY_DIAGNOSTIC`, i když je cleanup bezpečný. Pozdější PASS po jakémkoli předchozím BLOCKED zůstane finálně RECOVERED_WITH_PRIOR_BLOCKED a **exit1** bez zeleného markeru. Teprve plný první PASS znamená exit0. Tři BLOCKED znamenají exit1.

**Důkazy:** pro každý pokus samostatný QA_ATTEMPT (index, PASS/BLOCKED/INVALID, pouze existující booleany, whitelistovaná stage/win32Error, cleanup) a QA_ATTEMPT_FIXED_CASES znovu sestavené stávajícím bezpečným formatReport. První chybové výsledky se při dalších pokusech nepřepisují. QA_FINAL shrne pokusy a exit. Nikdy raw TAP, stderr, PID, soukromé cesty, identifikátory účtů ani token.

**Limity:** jediný budoucí Windows job max 5 minut **včetně checkoutu a všech kroků**. Maximálně 3 sekvenční pokusy; `60 s` je **pouze timeout běžícího workeru v Python supervisoru**, NIKOLI tvrdý wall-clock limit celého pokusu včetně startu a cleanupu. Řadič používá monotónní `performance.now()`, po každém návratu kontroluje skutečný elapsed a **STOP při >90 s**, před dalším pokusem vyžaduje rezervu 90 s v celkové **soft** hranici 240 s. Toto není vynucený kill po 90 s; při překročení hranice čeká na dokončení původního cleanupu a **nikdy neretryuje**. 5min workflow timeout může stále přerušit job bez důkazu cleanupu – aktivační riziko, ne PASS. Skutečné Windows JobObject a doba úklidu NOT RUN; příčina staršího run43542503124 nadále neprokázána. Žádné nové procesní rozhraní.

## Inertní workflow

Samostatné .github/workflows/windows-3try-20261114.yml reaguje pouze na budoucí **novou dosud nevytvořenou přesnou RUN větev a marker**. PREP větev infra/* ani main nemají odpovídající trigger. Nový RUN/marker zde nevytváříme. Podmínky: owner/original+triggering actor, run_number=1/run_attempt=1, push, přesný ref, commit message a event.created=false; self-hosted Windows/X64/zamerovac-qa, contents:read, pinned actions checkout, přesné QA i produktové SHA, clean Git, existující účet ZamerovacQA, Node26.13 a Python3.13. Žádný workflow_dispatch, PR/fork nebo placený hosted job.

**Před budoucím HOME:** nejprve nezávislá SOURCE kontrola Kontrolora40, testy, ověřený idle runner a zůstatek Actions pod 12 USD, nové rozhodnutí vlastníka. Neaktivovat staré RUN.

## Testy

`tests/qa_fixture_attempts.js`: PASS prvního pokusu; povolená časná diagnostika a další pokus; chybné cleanup/ownedRemaining/TEMP okamžitý STOP; timeout, cancel, invalidní či falešný PASS, 3 pokusy, zachování chybových důkazů, skutečná produkční `safeDiagnostic`, monotónní deadline/serialita. `tests/qa_gate_3try_integration.js` **skutečně importuje Node produkční moduly** a pod reálným Node test runnerem vytváří skutečný 15-case TAP s jedním FAIL, který nesmí být retryován; jediná modelovaná hranice je owner/JobObject odpověď. `tests/test_qa130_startup_cleanup.py` importuje skutečný Python supervisor s injekcí stávajícího scope API, testuje pozitivní/negativní před-worker úklid a `worker-result`. Izolované Linux testy neprokazují skutečné Windows úklidy. Přesné runtime výsledky, prostředí a SHA jsou závazně v komentáři PR a issue #42.

NEMĚNIT: PR128/129/121, jejich větve, produkční synchronizaci a data, práva domácího PC, původní JobObject, běžné CI/workflows ani release.
