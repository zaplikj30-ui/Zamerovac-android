# HOME QA: bezpečnostní sondy před produktovými testy

Stav: **všechny nové runtime testy NOT RUN / dosud bez ověřeného logu, včetně Linux selftestu i HOME Windows/WSL/Chromium**. Jde o neškodné zkoušky, nikoli testy aplikace. Neobsahují žádné nové workflow ani automatický trigger.

## WSL (tools/home_qa_process_probe.py)

- Pouze existující Python, WSL distro Zamerovac-Ubuntu-QA, existující neprivilegovaný výchozí účet.
- Před HOME vynucuje Windows účet ZamerovacQA a identitu vlastníkova GitHub Actions běhu: qa/* push, pokus 1.
- Čtyři scénáře: normální konec, EOF (ztráta vstupu), neplatný heartbeat a časový limit.
- Pro každý scénář vytváří jedinečnou vlastní procesovou skupinu s neškodným sleep (max 7 s), ověřuje skutečné PID/PGID a ukončuje signály jen vlastní skupinu. Testuje, že potomci nezůstali aktivní a že sentinel mimo vlastní pracovní adresář zůstal nezměněn.
- Jen vlastní jedinečné soubory v /tmp. Nepoužívá root, instalace, změny Windows práv, globální WSL kill, Gradle, Java, Android ani produktová data.
- Linux selftest: python tools/home_qa_process_probe.py --selftest-linux (jen v izolovaném Linuxu pod neprivilegovaným účtem). HOME test: python tools/home_qa_process_probe.py --run-home výhradně ve schváleném odděleném trusted owner-only one-shot jobu. **Žádný takový job tento návrh neobsahuje ani automaticky neaktivuje.**
- Simulované odpojení vstupu není test fyzického výpadku napájení nebo zabití služby Windows. Při watchdog selhání se neškodný sleep nejpozději samovolně ukončí do 7 sekund.

## Chromium (tools/home_qa_browser_probe.cjs)

- Vyžaduje existující Playwright, přesně připnutý lokální CHROMIUM_PATH s SHA256 ce4635cd0e5dc0e21494542a701f347e91c1f1d821970578d97ed8df4ced50ef a stejné owner-only prostředí.
- Spouští jen syntetickou data: stránku s výslovným chromiumSandbox:true a bez --no-sandbox. Neinstaluje balíčky a neotevírá externí URL.
- V budoucím zrevidovaném one-shot jobu: node tools/home_qa_browser_probe.cjs. Chybějící offline závislost nebo hash = BLOCKED.
- **Samotný úspěšný start není důkazem Windows kernelové izolace rendereru.** Pro úplné potvrzení se musí zvlášť ověřit omezené procesové tokeny či jiná důvěryhodná izolace. Sonda nemění současný produktový harness PR #116.

## Před spuštěním

1. Nezávisle zkontrolovat přesný SHA, oba skripty a bezpečný owner-only způsob provedení na existujícím runneru.
2. Zajistit, že PC/runner je idle, žádné souběžné práce ani osobní data v testovací pracovní oblasti. Nepoužít nedůvěryhodný PR/fork checkout.
3. Žádné PowerShell, nové instalace, změna ACL, root fallback, nákup/cloudu, merge ani APK.
4. Zapsat skutečné PASS/FAIL/SKIP/NOT RUN, SHA a prostředí do issue #42. Bez skutečného logu neoznačovat Linux selftest ani HOME jako PASS.

Zdrojové podklady: PR #117 QA-only SOURCE PASS na 2997cd46000a038497e14497a0fba6b8d2d29a2b; produkt PR #116 na 1527e3377609633c554195b0641e02e3cfb5fb5e; historické HOME Chromium PASS na jiném SHA v běhu #43195207268. Dvě původní produktové diagnostiky #88 nezměněny.
