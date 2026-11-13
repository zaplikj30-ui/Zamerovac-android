# HOME-PROP-01/02 – oddělený QA-only balík Codex 4

**DRAFT / HOME BLOCKED / bez merge a APK.** Tento balík připravuje bezpečnostní
předpoklady; neimplementuje finální HOME 4/4 ani release bránu. Autor testuje,
poté následuje samostatná nezávislá bezpečnostní kontrola. Až pak vlastník
rozhodne o případném neprodukčním běhu na domácím PC.

## Identita a rozsah

- Vlastní větev `qa/home-props-security-20261113`, základ main
  `8d05d2dd77c4a99f8ad64191c97d37ee3c151e3b`.
- [Schválení a přesné hranice](https://github.com/zaplikj30-ui/Zamerovac-android/issues/42#issuecomment-6853678011).
- Produkt [#121](https://github.com/zaplikj30-ui/Zamerovac-android/pull/121)
  `ae3b4df53c25557f28b4a25ccb65adc2abdff639` a
  [nezávislý nález](https://github.com/zaplikj30-ui/Zamerovac-android/pull/121#pullrequestreview-5891220124).
- QA reference [#117](https://github.com/zaplikj30-ui/Zamerovac-android/pull/117)
  `2997cd46000a038497e14497a0fba6b8d2d29a2b`: princip heartbeat/EOF a vlastní
  session/PGID. Jeho větev ani soubory se zde nepřepisují. Nová sonda není
  zapojena do `sync116_home_qa.py` ani do Gradlu.
- Přečten i souběžný [#119](https://github.com/zaplikj30-ui/Zamerovac-android/pull/119)
  `650b9c0b3358f09e4393780a1627dfef49627748`; jeho tři cesty a větev zachovány.
  Tento balík opravuje i skutečný harness/runner a přidává autentickou regresi.
- Finální testovaný SHA, úplné výsledky a potvrzení triggerů jsou v draft PR
  a závěrečném předání v existujícím issue #42. Žádný PASS se nedědí z #121.

## HOME-PROP-01 – Chromium

`tools/e2e/sandbox.cjs` je společná launch politika harnessu i lokálního runneru:

1. Explicitní `chromiumSandbox:true`, headless, prázdné vlastní argumenty,
   explicitní absolutní `CHROMIUM_PATH` a limit startu 15 s. Žádné vlastní `env`, profily,
   `ignoreDefaultArgs` ani neznámé volby. Runner vyžaduje existující Playwright
   1.62.1; nic neinstaluje a nevybírá náhradní browser po selhání.
2. Před první aplikační stránkou ověří skutečné argumenty přes CDP
   `Browser.getBrowserCommandLine`. Chybějící/zakázané argumenty znamenají
   BLOCKED, včetně wrapperem přidaného `--no-sandbox` a vypínačů vrstev sandboxu.
3. V novém odděleném dočasném contextu přečte `chrome://sandbox`. Celé ověření
   má limit 7 s; chyba, timeout či neznámé diagnostické schéma zavřou browser
   a skončí BLOCKED. Žádný druhý pokus s vypnutým sandboxem.
4. Linux vyžaduje kladné celkové hodnocení, SUID/Namespace vrstvu, PID/network
   namespaces, Seccomp-BPF a TSYNC. Windows vyžaduje rendererové řádky s PID,
   sandbox `Renderer`, token policy `Lockdown` a integritu
   `S-1-16-0 Untrusted`. Linuxový výsledek nesmí projít jako Windows.
5. Runner provádí preflight před serverem/sadami. Každá sada znovu ověřuje svůj
   vlastní browser; exit 0 bez platné sandbox evidence není PASS. BLOCKED je
   uložen v JSON a vrací nenulový exit. Původní Git preflight zůstává před startem.

Diagnostické hodnoty Windows jsou odvozeny z upstream Chromium
[`sandbox_internals_win.ts`](https://github.com/chromium/chromium/blob/main/chrome/browser/resources/sandbox_internals/sandbox_internals_win.ts)
a [`sandbox_policy_diagnostic.cc`](https://github.com/chromium/chromium/blob/main/sandbox/win/src/sandbox_policy_diagnostic.cc).
Jde o kontrolu nativně hlášené politiky živých rendererů, nikoli o nezávislý audit
Windows kernelových tokenů či přístupů k souborům. Kompatibilita s připnutým
HOME Chromium a účtem služby zatím nebyla spuštěním ověřena. Neznámá/odlišná
diagnostika proto zůstane BLOCKED a vyžádá nové posouzení.

**Skutečný managed Linux pokus:** Chromium 156.0.8078.79 odmítlo start
se zapnutým sandboxem: SUID helper má vlastníka `nobody`, režim 4755, nikoli
požadovaného vlastníka. Zaznamenána také chyba crashpad. Oprávnění, vlastníka,
instalace ani izolaci prostředí jsme neměnili. Runner vytvořil BLOCKED JSON
a žádná aplikační sada nezačala. Pozitivní runtime Chromium zde není PASS.
Windows diagnostické fixture jsou pouze jednotkové testy, nikoli Windows běh.

## HOME-PROP-02 – neprodukční procesový strom

`tools/home_process_tree_probe.py --probe` je samostatný Linux/WSL test-only
supervisor. Sám WSL nespouští a na Windows skončí BLOCKED před startem procesů.
Neumí přijmout libovolný příkaz ani externí PID/PGID; spouští jen pevnou vlastní
Python fixture se třemi úrovněmi. Není náhradou produkčního Gradle runneru.

- Vyžaduje existující neprivilegovaný Linux účet. Odmítá root a nepodporované
  prostředí/kernel. `start_new_session=True` poskytne vlastní SID/PGID.
- Soukromý adresář vzniká přes `TemporaryDirectory` pod `/tmp` s počátečním
  soukromým režimem. Žádné chmod/chown, sudo, instalace, WSL shutdown či cizí kill.
- Před READY a signály kontroluje vlastního nezreapovaného leadera: PID,
  starttime z `/proc`, UID, PGID a SID. Nepřijímá PID z vnějšího vstupu. Leader
  zůstává ukotvený i jako zombie až do dokončení signalizace, aby se PID neuvolnilo.
- Používá TERM a následně KILL; fixture úmyslně ignorují TERM. Linux
  `PR_SET_CHILD_SUBREAPER` se nastaví jen na tomto izolovaném supervisoru,
  bez změny uživatele/oprávnění. Umožní mu reapovat vlastní osiřelé vnuky.
  Zombie stále znamená nedokončený úklid, nikoli PASS.
- Hlídá EOF, neplatnou komunikaci, tichou ztrátu heartbeat, absolutní timeout,
  SIGTERM/INT/HUP zrušení a běžné dokončení. V normálním scénáři leader skutečně
  skončí s exit 0 a potomci ještě žijí; úklid je přesto musí ukončit a reapovat.
- Všechny fixture samy časově expirují (6 s; rodič může krátce čekat na potomka).
  Selhání signálů se nepřeklápí na PASS; oddělená nouzová cesta uklízí pouze
  tutéž ověřenou vlastní skupinu a zachovává výsledek BLOCKED.
- Testy kontrolují skutečnou existenci všech tří PID předem a jejich nepřítomnost
  po návratu, odstranění pouze vlastního tmp, nezměněné sentinel bajty mimo tmp
  a dál živý vlastní kontrolní proces mimo testovací skupinu.

Živá regrese obsahuje i smrt samostatného klientského procesu, která skutečně
uzavře komunikační pipe. Další negativní test zneúčinní primární signály;
procesy skutečně zůstanou živé, ověření vrátí BLOCKED a vlastní nouzový úklid
je ukončí. To je odlišné od původního #117 mocku `kill()`.

**Hranice důkazu:** provedený managed Linux není WSL. Netestovali jsme přenos
Windows služby do WSL, násilné SIGKILL supervisoru, vypnutí PC, cache ani Gradle
daemon, který by změnil SID. Sonda podporuje pevný testovací strom ve vlastní
session. Žádný HOME JVM PASS či aktivace starého watchdogu z ní automaticky neplyne.
Po nezávislém review je nutné samostatné povolení Windows/WSL sondy; před ní ověřit
skutečný nonroot účet, konkrétní PID/PGID izolaci, existující read-only/offline cache
a přesný schválený způsob přenosu EOF/cancel. Chybějící předpoklad = HOME BLOCKED.

## Test-first a výsledky

- [Původní browser RED](evidence/red-browser.log): 6 FAIL před implementací.
  Skutečné původní aserce prokázaly chybějící `chromiumSandbox:true` a chybějící
  BLOCKED report; další FAIL prokázaly dosud neexistující policy modul.
- [Počáteční procesový RED](evidence/red-process.log): nová živá sonda dosud
  neexistovala. **Není to tvrzení, že byl reprodukován únik procesů původního #117.**
- [Původní watchdog #117](evidence/reference117-mock.log): oba původní unit testy
  skutečně PASS z privátního read-only zdrojového snapshotu. Stále pouze mock;
  jejich PASS neprokazuje zabití procesů a nenahrazuje novou živou regresi.
- [Průběžný FAIL](evidence/intermediate-process-fail.log): první živý úklid fungoval,
  ale test při uzavírání pipe po skončení klienta vyvolal `BrokenPipeError`.
  Opraven testovací teardown, původní FAIL zachován.
- Finální dostupná společná regrese: všechny `tests/*.js`, všechny
  `test_*.py`, syntax nových/změněných QA skriptů, skutečný sandboxový pokus a
  statické ověření nedotčených produktových cest/workflow. Úplný SHA a čerstvé
  logy viz konečné předání v draft PR; uložené pracovní logy mají vlastní identitu.
- Dvě původně přeskočené Java smoke kontroly byly znovu provedeny se stávajícím
  Temurin 17 z `/workspace/toolchains/jdk-17.0.17+10`, bez instalace. Testové
  executable fixture HOME gate nyní dostanou režim při výlučném vytvoření;
  následný chmod není potřeba. Původní aserce a runtime gate se nemění.

Pro autorskou regresi v tomto managed Linuxu (nejde o příkaz pro domácí WSL):

```sh
export JAVA_HOME=/workspace/toolchains/jdk-17.0.17+10
export PATH="$JAVA_HOME/bin:$PATH"
for test in tests/*.js; do node "$test" || exit 1; done
python3 -m unittest discover -s tests -p 'test_*.py' -v
```

## Bez automatiky a produktových změn

Žádná nová/změněná `.github/workflows/**`, žádný dispatch, Actions rerun,
merge, release ani APK. Před každým pushem znovu načíst živé main/PR SHA a
workflow: současný jediný automatický push HOME trigger je omezen na `main`,
ostatní workflow jsou ruční. Nová `qa/home-props-security-20261113` žádný
one-shot YAML neobsahuje. Po pushi ověřit skutečné runs/statuses.

`app/**`, přesné hodnoty, původní média, synchronizace a obě původní diagnostiky
#88 jsou beze změny. Nápověda/changelog aplikace se nemění, protože jde výhradně
o QA infrastrukturu bez změny produktu. Původní signing/version/provenance a
vydávací pravidla zůstávají. Linux/JDK autorské testy nelze vydávat za Windows
HOME, fyzický Android či reálný Drive/SAF PASS.
