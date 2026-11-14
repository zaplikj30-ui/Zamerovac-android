# HOME Windows QA – neaktivní diagnostika nejvýše tří pokusů

**DRAFT / PREP / HOME HOLD – 14. 11. 2026.** Rozhodnutí Koordinátora 30: [technické podmínky](https://github.com/zaplikj30-ui/Zamerovac-android/issues/42#issuecomment-6871084083) a [přidělení Programátorovi 39](https://github.com/zaplikj30-ui/Zamerovac-android/issues/42#issuecomment-6871120590). Výchozí schválená QA PR129 SHA 43bd2fbc86605399df3fae22489ba713097d660e; produkt PR121 SHA ae3b4df53c25557f28b4a25ccb65adc2abdff639. PR128 a staré RUN jsou neaktivní.

## Nejmenší změna

Jeden nový sekvenční řadič tools/qa-fixture-attempts.cjs volá stávající tools/qa-fixture-gate.cjs:main(60000) maximálně 3×. Existující Python supervisor/Windows private JobObject/kill-on-close, 15 TAP fixture případů, tokeny, kontroly potomků a privátní TEMP se nemění. Jediná malá zpětně kompatibilní změna původní brány: volitelný callback pro výstup a vrácení již vypočtených, redigovaných výsledků. Původní samostatné CLI a CMD zachovávají chování.

**STOP:** neověřený cleanup, remainingProcesses jiný než 0, neodstraněný dočasný adresář, rozporné/invalidní evidence, timeout nebo cancel (i s úklidem). Opakuje se výhradně časný BLOCKED s již doloženou nulou vlastních procesů a odstraněným TEMP. Pozdější PASS po jakémkoli předchozím BLOCKED zůstane finálně RECOVERED_WITH_PRIOR_BLOCKED a **exit1** bez zeleného markeru. Teprve plný první PASS znamená exit0. Tři BLOCKED znamenají exit1.

**Důkazy:** pro každý pokus samostatný QA_ATTEMPT (index, PASS/BLOCKED/INVALID, pouze existující booleany, whitelistovaná stage/win32Error, cleanup) a QA_ATTEMPT_FIXED_CASES znovu sestavené stávajícím bezpečným formatReport. První chybové výsledky se při dalších pokusech nepřepisují. QA_FINAL shrne pokusy a exit. Nikdy raw TAP, stderr, PID, soukromé cesty, identifikátory účtů ani token.

**Limity:** jediný budoucí Windows job max 5 minut, nejvýš 3 sekvenční pokusy × 60 s, společná soft deadline 240 s, bez paralelismu/Chromia/instalace/APK. Skutečné Windows JobObject a doba úklidu NOT RUN; příčina staršího run43542503124 nadále neprokázána. Žádné nové procesní rozhraní.

## Inertní workflow

Samostatné .github/workflows/windows-3try-20261114.yml reaguje pouze na budoucí **novou dosud nevytvořenou přesnou RUN větev a marker**. PREP větev infra/* ani main nemají odpovídající trigger. Nový RUN/marker zde nevytváříme. Podmínky: owner/original+triggering actor, run_number=1/run_attempt=1, push, přesný ref, commit message a event.created=false; self-hosted Windows/X64/zamerovac-qa, contents:read, pinned actions checkout, přesné QA i produktové SHA, clean Git, existující účet ZamerovacQA, Node26.13 a Python3.13. Žádný workflow_dispatch, PR/fork nebo placený hosted job.

**Před budoucím HOME:** nejprve nezávislá SOURCE kontrola Kontrolora40, testy, ověřený idle runner a zůstatek Actions pod 12 USD, nové rozhodnutí vlastníka. Neaktivovat staré RUN.

## Testy

tests/qa_fixture_attempts.js: PASS prvního pokusu; bezpečně uklizený BLOCKED a další pokus; chybné cleanup/ownedRemaining/TEMP okamžitý STOP; timeout, cancel, invalidní či falešný PASS, 3 pokusy, zachování chybových důkazů, sanitizace a deadline/serialita. Izolované Linux testy neprokazují skutečné Windows úklidy. Přesné runtime výsledky, prostředí a SHA jsou závazně v komentáři PR a issue #42.

NEMĚNIT: PR128/129/121, jejich větve, produkční synchronizaci a data, práva domácího PC, původní JobObject, běžné CI/workflows ani release.
