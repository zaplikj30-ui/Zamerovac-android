# Regresní brána před společnou APK – 7. 11. 2026

Větev `qa/professional-regressions-20261107` vychází z ověřeného main
`f543af718c343ea4ef1dc9d178bae16d604f0521`. Před prací: čistý checkout,
otevřeny jen draft PR #49 (`a408d4b`, poslední CI SUCCESS) a #51 (`5684cff`,
poslední CI FAILURE). Jejich větve ani renderer nebyly přepsány.
Poslední vydaná APK zůstává 1.3.0. Bez merge, migrace, nového frameworku či APK.

## Malé opravy a důkaz před/po

- `rich-notes.js`: checkpoint před změnou existující poznámky; Undo vrátí
  původní objekt/text, Redo obnoví změnu. Ověřeny Uložit i Back callback,
  zavření a nové načtení dat.
- Dialog ruší automatický textový focus timer a zaměří Uložit. Text se zaměří
  až výslovným klepnutím. Test používá skutečný lokální WAV a ověří stav
  playing/paused, nikoli jen existenci audio elementu.
- `laser-autofill.js`: kontrola duplicity porovnává také existující přesný údaj
  `laserMeasuredMm`; další odečet se stejným popiskem dostane vlastní checkpoint.
  Nemění se formát dat, jednotky ani geometrie.

Testovací commit `9edf363` předcházel opravám `998467a`. Příprava dvou poznámek
byla následně opravena tak, aby vznikly na různých místech (původní gesto
vybralo již existující poznámku); z chyby testu se nevyvozuje chyba aplikace.
Finální nezměněné testy znovu běžely i proti oddělenému checkoutu main.
Zdroje aplikace při finálních lokálních bězích odpovídají `998467a`.

Pole `sha` v surovém reportu zaznamenává HEAD procesu testovacího runneru.
První běh proti serveru odděleného #51 měl runner na `9edf363`, ale server
obsluhoval zdroje `5684cff`. Pro odstranění této nejasnosti byl stejný test
znovu spuštěn přímo z checkoutu #51: runner i server mají
`5684cfffc273baea61f575643bda950472f7edee`, znovu **3 PASS / 0 FAIL**.

[Strojové výsledky, SHA-256 testů a prostředí](../qa/evidence/professional-20261107/results.json).
[Galerie main](../qa/evidence/professional-20261107/gallery-main.png) a
[galerie PR #51](../qa/evidence/professional-20261107/gallery-pr51.png) byly
skutečně prohlédnuty: na main je hodnota prakticky nečitelná, na head #51
čitelná. Nejde o potvrzení všech scénářů #51.

| Kontrola | Main f543af7 | Po opravách | Omezení |
| --- | --- | --- | --- |
| Existující poznámka, Undo/Redo, Uložit i Back | **FAIL 2/2** | **PASS 2/2** | Session historie; ne kompletní transakce příloh |
| 1000.1 → 1000.4 mm při stejném textu `1000` | **FAIL 10/10** | **PASS 10/10** | Software callback, bez rádia |
| Audio poznámka: otevřít, Play/Pause bez textového fokusu, explicitní text s fokusem | **FAIL** | **PASS** | Chromium; Android IME NESPUŠTĚNO |
| Dvě poznámky, výslovný picker, dvojklik, Zrušit/Back, starý callback/completion | **PASS** | **PASS** | Model bridge; příčina fyzického #46 nepotvrzena |
| Zrušený import bez nechráněného osiřelého souboru | **FAIL** | **FAIL** | N4; bezpečná retence potřebuje samostatnou opravu |
| Dosažitelnost, velikost a nepřekryté středy tlačítek, 412/1100 px | **PASS 2/2** | **PASS 2/2** | Bez S Pen a font scale |
| Zakázka → foto → přesná kóta → editace poznámky → uložit → reload → otevřít → editovat → PNG | **PASS** | **PASS** | Pixely PNG + přesný JSON + SHA-256 originálů |
| Galerie, 1200×800, 6000×4000, 1600×4800; telefon/tablet | **FAIL 3/3** | **FAIL 3/3 na této větvi** | **Stejné testy PASS 3/3 na head #51 5684cff**, fit/zoom a nezměněná data |

Laser: dimension, line, arrow, circle, ellipse, target, chain, cumulative,
polyline, angle. Test hlídá původní segment, body, checkpoint a idempotenci.
**Strany rect/area nejsou tímto testem ověřené**; přesné hodnoty těchto stran
potřebují vlastní kontrakt, nikoli spekulativní nové datové pole v QA balíku.

Galerijní test vyžaduje skutečně žluté glyfy v cílovém canvasu, výšku jejich
inkoustu alespoň 8 CSS px a font alespoň 12 CSS px. Bílé úchopy nestačí.
Existující `drawing.cjs` nadále testuje obrysy nezávislými body a záměrně
potlačenými tahy; není nahrazen testem existence objektu. Nejde o OCR,
kompletní kontrastní audit ani všechny typy anotací v galerii.

## Známé červené brány

1. **#50 / PR #51:** tento PR galerii nepřepisuje. Před začleněním #51 vyřešit
   i dřívější neúspěšné CI, popisek detailu, gesta a export. Nové 3/3 PASS nejsou
   souhlas s jeho merge.
2. **#42 N4:** po importu fotografie a Zrušit zůstane publikovaný soubor
   v IndexedDB bez reference i bez trvalého vlastníka retence. Test jej neuklízí
   a zůstává FAIL. Samostatná etapa B musí vymezit vlastníka importu/staging,
   potvrzení převzetí a opakovatelný úklid po kontrole historie/Undo/sync.
   **Neřešit prostým unlink po Zrušit.**

Nový JVM scénář `TrashPurgerTest.restartedCleanupKeepsExactBytesReusedByNoteHistory`
ověřuje retry po neúspěšném unlink a nové historické reference: musí přežít
přesné bajty fotografie/hlasu i MIME. Není to test síťové outbox fronty.
Dosavadní nativní safety/storage/sync testy zůstávají zachované.
Vizuální ikona hlasu #47 přes popisek se zde neopravuje ani nově neověřuje.

## Android: připraveno, nikoli vykázáno jako spuštěné

`tools/e2e/android-system.cjs` používá stávající Playwright přes CDP skutečné
preview WebView a `adb dumpsys input_method` / resumed Activity: Play/Pause bez
IME, klávesnice po výslovném textovém tapu, Back, skutečný DocumentsUI picker
po tlačítku, dvojklik, zrušení a opětovné otevření. Jen WAV fixture je vložena
přes skutečný checked Native ingest, bez mocku.
Chybějící CDP, nerozpoznaná IME evidence či neprovedená akce končí FAIL.
Vyžaduje debuggable preview a WebView >=113.

Ruční `emulator-smoke.yml` kontrolu spustí po dosavadním smoke; přidává jen
již používaný Playwright, nestahuje další Chromium. Smoke používá aktuální
Nový náčrt a nedokončené kroky již neskrývá jako INFO. **Workflow nebyl spuštěn
a jeho runtime funkčnost není potvrzena**: místně chybí adb, emulátor, SDK,
Gradle a javac. Ověřena syntaxe JS/shellu. Workflow zůstává výhradně ruční;
APK build request ani release workflow nebyly měněny.

Samsung IME/picker, mikrofon/kamera, S Pen, tablet, Bosch rádio, živý Drive,
aktualizace APK a OS process-kill: **NESPUŠTĚNO / FYZICKÉ ZAŘÍZENÍ**.

## Skutečně spuštěné lokální kontroly

- **PASS:** syntax 24 aplikačních/sync JS, 27 Node skriptů (včetně nové laserové
  regrese), registr 40 oblastí; 7 samostatných browser kontrol; dosavadních
  16 praktických E2E sad / 58 scénářů. Žádný starý test nebyl odstraněn.
- **Python:** 45 PASS, 2 SKIP (`javac` není dostupný), celkem 47.
- **Nové browser regrese:** 7 PASS / 1 FAIL (N4); galerie 0 PASS / 3 FAIL na main
  i této větvi. Odděleně na přesném head #51 galerie 3 PASS / 0 FAIL.
- **NESPUŠTĚNO místně:** JVM/Robolectric/Gradle, nový nativní test a emulátor.
  Výsledek nativního CI evidovat odděleně v issue #28.

Server pro browser testy vázat na loopback:

```sh
python3 -m http.server 8765 --bind 127.0.0.1 --directory app/src/main/assets
node tests/laser_precision_regression.js
node tools/e2e/quality-regressions.cjs
node tools/e2e/gallery-readability.cjs
```

`quick-check.yml` nově spustí obě browser sady i při selhání jedné; vrátí
nenulový exit. Stávající upload uloží reporty/screenshoty/DOM/stav/trace.
Žádné expected-fail ani continue-on-error. Laser běží v `tests/*.js`.
Nový JVM test používá existující `verify-native.yml` bez APK.

## Ověřené CI a předání

[Draft PR #52](https://github.com/zaplikj30-ui/Zamerovac-android/pull/52),
testovaný head `c3a41064db8bf10d9631ea1c8e8585170c93ccdb`:

- [Nativní CI](https://github.com/zaplikj30-ui/Zamerovac-android/actions/runs/42324761865)
  **SUCCESS**: kompilace bez APK, **257 JVM testů / 43 sad, 0 FAIL, 0 SKIP**.
  XML artefakt ověřuje i nový `restartedCleanupKeepsExactBytesReusedByNoteHistory`.
  Nezávislé parsování/rasterizace tří PDF fixture ZIP rovněž prošlo.
- [Rychlé CI](https://github.com/zaplikj30-ui/Zamerovac-android/actions/runs/42324761877)
  **FAILURE**: starých 58 E2E PASS, nová sada 7 PASS / 1 FAIL (N4),
  galerie 3 FAIL. Zdrojový/Node job a samostatný browser job **SUCCESS**;
  v CI Python **47 PASS / 0 SKIP** (lokální dva SKIP se týkají jen chybějícího JDK).
- [CI diagnostika](https://github.com/zaplikj30-ui/Zamerovac-android/actions/runs/42324761877/artifacts/13555260652)
  a [nativní XML/PDF artefakt](https://github.com/zaplikj30-ui/Zamerovac-android/actions/runs/42324761865/artifacts/13554996344)
  jsou uložené. Retence CI artefaktů je 14 dní; základní syntetické snímky a
  lokální report před/po zůstávají v repozitáři.

Toto závěrečné doplnění mění jen dokumentaci, nikoli otestované zdroje/testy.
Finální přehled a návazná etapa: [issue #28](https://github.com/zaplikj30-ui/Zamerovac-android/issues/28#issuecomment-6700313256).

## Etapa B1 – pokračování galerie v PR #51 (7. 11. 2026)

Tato část navazuje na původní QA #52 výše. **Implementace je nyní v existujícím draft [PR #51](https://github.com/zaplikj30-ui/Zamerovac-android/pull/51)**; #52 byl převzat merge commitem `2505529`, jeho větev nebyla přepsána. #49 zůstává samostatný. Výchozí main `00478e6`, následné upřesnění testovacího provozu `3de1d53` přečteno a zachováno. Uživatel nemá v aplikaci ostré zakázky; ochrana dat zde znamená požadavek na kvalitu a regresní invarianty.

**Aplikační změna:** `343c172`, stejný strom assets `ba7837998e8bc154cc406c040f218b3a4daefc22` také po dalších testovacích/dokumentačních commitech. Doplňující testy `287bab1`, oprava doručení velké fixture do Playwrightu `361e15c`.

- `drawItem` a jeho texty, kótovací řetězce a poznámky přijímají vlastní kontext (canvas, transformace, rozměry fotografie/výstupu, preference a režim prohlížení). Galerie, vnořené detaily, PNG a zákaznický raster už kvůli kreslení nepřepisují `current`, `ctx`, `view`, výběr ani preference editoru. Editor používá stejný renderer přes výchozí adaptér. Přesné souřadnice/hodnoty se nemění; čáry a písmo zůstávají ve výstupních pixelech.
- Vložený popisek používá šířku skutečného výstupu místo skrytého editoru s nulovou šířkou. PNG zahrne skutečné hranice natočeného detailu **i jeho textu**. Zachována nápověda; nevydané změny jsou oddělené v katalogu historie, bez přiřazení ke staré APK či vymyšlenému budoucímu číslu.
- Načítání dalšího snímku zneplatní starou kreslicí funkci. Generační kontrola chrání zavřenou/přepnutou galerii. Návrat přes **Upravit ke stejné fotografii** ponechá živý výběr, pohled a Undo/Redo; úmyslné otevření jiné fotografie zachovává dosavadní postup.
- Bez změny schématu, přesných měření, ukládání, sync protokolů, oprávnění, přihlašování, podpisu, package nebo verzování APK. Žádný merge do main ani uživatelská APK/release. Dodatečný emulátorový běh používá pouze interní testovací sestavení.

### Provedené kontroly a jejich hranice

| Kontrola | Skutečný výsledek |
| --- | --- |
| Nový test živých referencí **během** vnořeného vykreslení | FAIL na výchozí integraci `2505529` → PASS po oddělení kontextu; také řízená výjimka a zachování historie/dat |
| Čitelnost galerie #52 | Původní tři scénáře PASS již na #51; po etapě **4 PASS**, nově DPR 2. Reálné glyfy, tahy, fit/zoom, 1200×800 / 6000×4000 / 1600×4800 |
| Širší Chromium E2E | **72 PASS / 1 FAIL N4** ve 20 sadách; z toho všech původních **58 PASS**, nové stavové/gestové scénáře **2 PASS**, původní galerijní test #51 **1 PASS**, #52 pozitivní regrese **7 PASS** |
| Samostatné browser kontroly | **7/7 PASS**, včetně 11 viewportů/orientací, dialogů a neměnných hodnot |
| Node / syntax / registr | **27/27 skriptů PASS**, JS syntax PASS, registr 40 oblastí PASS; registr sám není důkaz všech funkcí |
| Python místně | **45 PASS / 2 SKIP** (47 celkem; chybí `javac`) |
| Výkonnostní průchody | **5/5 PASS před i po**, vždy 3 opakování; skutečný readback a reload. Nejde o plnění časového SLA |
| Negativní pixelová kontrola | Na izolované kopii `343c172` ponechán `fillText` i žlutý rámeček, ale text průhledný → test **FAIL právě na glyfových pixelech** |
| #49 kompatibilita | Dočasná kombinace `287bab1` + `a408d4b`: čisté sloučení, Node inset PASS, **5 Python inset PASS**. Do #51 není #49 začleněn; jeho větev beze změny |
| Nativní CI bez APK | [`83fca00` / 42329076426 SUCCESS](https://github.com/zaplikj30-ui/Zamerovac-android/actions/runs/42329076426): ověřeno XML artefaktu, **257 testů / 43 sad, 0 FAIL/ERROR/SKIP**, kompilace, Drive konfigurace a tři nezávislé PDF parser/raster fixtures PASS |
| První rychlé CI etapy | [42329076418 FAILURE](https://github.com/zaplikj30-ui/Zamerovac-android/actions/runs/42329076418): source a browser jobs PASS, dosavadní workflow + nové stavové testy PASS; velký Buffer pro `fileChooser.setFiles` překročil timeout testovacího přenosu. Následná kvalita byla SKIP, **nikoli PASS**. `361e15c` vybírá soubor z disku a vynucuje povinnou kvalitu i po předchozím selhání. Finální CI viz aktuální PR a komentáře #28 |
| Android systémový test | Skutečný pokus `node tools/e2e/android-system.cjs` skončil `spawnSync adb ENOENT`; chybí místní SDK/adb/emulátor. **NOT RUN**, nikoli fyzický FAIL/PASS aplikace |

Syntetické screenshoty galerie a PNG byly také prohlédnuty. [Strojové výsledky, přesné SHA testů a časy](../qa/evidence/professional-20261107/stage-b-results.json) uchovávají původ testovacího runneru **i serveru**; první širší běh přešel přes docs-only merge main, aplikační strom zůstal identický. [Popisek před](../qa/evidence/professional-20261107/stage-b-caption-before.png) / [po](../qa/evidence/professional-20261107/stage-b-caption-after.png) mají různý viewport, nejsou golden pixel-diff. [Skutečný PNG export natočeného detailu](../qa/evidence/professional-20261107/stage-b-rotated-export.png).

### Mapa skutečně procházených akcí této etapy

| Uživatelská cesta | Automatická evidence |
| --- | --- |
| Import fotografie → + → kóta → změna přesné hodnoty | gallery-readability, gallery-visual, quality-regressions; skutečný file input, tahy a dialog |
| Galerie z otevřeného editoru → pinch → posun → listování → zavření/Upravit | gallery-state: kotevní pixely, reference relace, historie, SHA-256 originálu, pomalý callback po zavření |
| Otočení/velikost displeje s dialogem, rozepsaným textem a galerií | check-orientation-browser; dataset zaznamenává skutečnou renderovací transformaci místo již nepoužívané CSS transformace |
| Vložený detail mimo fotku → text → galerie → export PNG | update39 + gallery-state; pixely glyfů podle jejich výsledné polohy, nikoli starý pevný spodní pás bitmapy |
| Zakázka → fotografie → poznámka → Undo/Redo → uložení → reload → editace → PNG | quality-regressions a dosavadní workflows/drawing; celé JSON a originální hashe |
| Moje připomínky → existující záznam → rozbalit popis → Vyřešeno → dvakrát Uložit → reload | latency; skutečný formulář a kód ukládání, **model Native bridge**, nikoli Android disk |
| Další menu, koš, import/export, sync, zálohy, nastavení | Původní sady a [existující registr](../qa/coverage-v1.json); pokrytí zůstává částečné. Skutečné IME/DocumentsUI, hardware, živý účet a OS lifecycle NOT RUN |

### Odezva #53 a zakázek – skutečná baseline, bez optimalizace ukládání

Linux Chromium, syntetický deterministický PNG, localStorage/IndexedDB; Native připomínek je model s potvrzením begin/append/finish. Fotografie používají stejnou cestu přes **soubor na disku** před/po; čas od automatizované volby souboru k použitelnému editoru zahrnuje režii UI automatiky. Galerie od tlačítka k hotovému canvasu. Ukládání zakázky měří potvrzený zápis **i načtení zpět**, nikoli jen stisk. Celé sekvence i jejich 3 opakování jsou v JSON.

| Operace | Před – 3 výsledky (ms) | Po – 3 výsledky (ms) |
| --- | --- | --- |
| Fotografie 1200×800, import→editor | 218,8 / 138,3 / 189,5 | 217,7 / 147,5 / 149,8 |
| Fotografie 6000×4000, import→editor | 1649,3 / 2218,7 / 1803,4 | 1503,4 / 1438,6 / 1542,0 |
| Galerie u 6000×4000 | 42,8 / 27,9 / 20,9 | 25,8 / 20,9 / 22,1 |
| Existující připomínka 320×240 | 24,6 / 18,3 / 24,4 | 17,2 / 21,2 / 19,7 |
| Existující připomínka 1440×2800 | 259,7 / 213,6 / 237,3 | 254,8 / 207,4 / 239,5 |
| Zakázka 50 dokumentů × 20 přesných kót, 323 518 B JSON, zápis+readback | 6,3 / 6,2 / 4,4 | 7,6 / 5,4 / 5,0 |

Také 1/10 dokumentů (7 608 / 65 478 B JSON) a malé/velké fotografie po reloadu PASS. Z těchto několika běhů **nevyhlašujeme zrychlení ani hardwarový limit**. Starší měření s Buffer transportem měla výrazný rozptyl včetně ~6,9 s při prvním kódování a zůstávají v JSON odděleně; neopírat o ně závěr o výkonu aplikace.

**Prokázaná trasa #53:** i pouhé opakované Vyřešeno znovu volá PNG `toBlob` a modelový `beginMediaChecked` + **129 append bloků / 6 322 507 B** + `finishMedia` (u malého 3 bloky / 123 545 B). Dvojklik publikuje jednou, seznam/readback/reload zachová stav. Je to podklad pro diagnózu, **ne prokázaná příčina ~12 s na Samsungu**. Při této etapě se kód ukládání připomínek neměnil a nezkrátilo se čekání na potvrzení zápisu. Navazující #53 má oddělit skutečný Android Bitmap/PNG, bridge, filesystem a metadata, pak teprve bezpečně zvážit opětovné použití již potvrzeného nezměněného rasteru.

### Samostatná následující etapa N4 – připravené bezpečné podmínky

N4 po Zrušit zůstává **FAIL**, bez cleanupu v testu i aplikaci. Nejprve navrhnout vlastníka každého importu (token dialogu/záznamu), staging a obnovitelný stav publish→potvrzení metadat. Cancel uzavře vlastníka; žádný okamžitý unlink finálního média. Před úklidem zkontrolovat odkazy živých i smazaných záznamů, `detailItems`, historie, Undo/Redo, rozpracovaných dialogů, peer outboxu a aktivních přenosů; immutable zálohy nečistit. Přerušení mezi publish a DB potvrzením musí po restartu skončit dokončením nebo bezpečně evidovanou retencí. Při nejistotě médium ponechat, failed cleanup opakovat. Přesný vnitřní journal/retenci posoudit samostatně bez neodsouhlasené změny schématu/sync.

Akceptace další etapy: cancel/import/recording/pozdní callback a process restart, sdílené historické médium, Undo/Redo, failed metadata/failed unlink a retry; přesné hashe a reference musí přežít. Teprve bezpečné převzetí/retence dovolí změnit N4 na PASS. #46 fyzický picker, #47 překryv mikrofonu a přesné strany rect/area zůstávají otevřené.

Nejbližší krok: cílené review rendereru a finálního CI v #51, pak uvedená samostatná mediální etapa a diagnostika #53. Podle nového upřesnění #42 lze při dalším architektonickém rozhodnutí férově porovnat pokračování B s čistším izolovaným jádrem při znovupoužití testů/komponent; **tato první etapa takový další přepis nezahajuje**. Jedna společná testovací APK až po celém schváleném balíku a kontrolách, žádný automatický merge.


### Dodatečné CI na `acf0005` a pokus o skutečný Android

[Native 42329739840 SUCCESS](https://github.com/zaplikj30-ui/Zamerovac-android/actions/runs/42329739840), [quick 42329739834 FAILURE](https://github.com/zaplikj30-ui/Zamerovac-android/actions/runs/42329739834) **pouze na N4**: source/browser jobs PASS, workflow+stav/PNG PASS, latency 5/5 PASS, galerie 4/4 PASS, kvalita 7 PASS/1 FAIL N4. Timeout Buffer přenosu se neopakoval.

Po ověření CLI mimo místní sandbox byl spuštěn existující [Android 13 workflow 42330025246](https://github.com/zaplikj30-ui/Zamerovac-android/actions/runs/42330025246). Interní sestavení a stažení systémového obrazu PASS, avšak **emulátor nenabootoval**: `FATAL Not enough space to create userdata partition`, dostupných 2866,88 MB, profil požadoval 7372,80 MB. Po výchozím boot timeoutu FAILURE; aplikace a IME/picker scénáře **NOT RUN**, žádné emulator-results artefakty. Nejde o prokázaný pád aplikace. Stávající action podporuje `disk-size`; navazující malá oprava nastavuje syntetický oddíl na 2048M a obnovuje `-no-snapshot`. Praktická kontrola vyžaduje nový dokončený běh. Uživatelská APK/release nevznikly, poslední vydání stále 1.3.0.

Opakování [42331223641](https://github.com/zaplikj30-ui/Zamerovac-android/actions/runs/42331223641) na `bcf0647` znovu skončilo před bootem: action zapsala 2048M do AVD, ale emulátor dál požadoval 7372,80 MB při 2866,93 MB volných. Tento parametr tedy pro tuto systémovou image problém neřeší. Další oprava pouze na jednorázovém CI runneru odstraňuje nepoužívané .NET/NDK nástroje a po instalaci image kontroluje skutečné místo; SDK/Java/Gradle a aplikační data zachovává. Žádný další testovací framework. Nový main `195124f` s povinnou technologickou rozhodovací bránou je načten a zachován: současné #51 dokončit, před další významnou přestavbou porovnat Java/WebView, Kotlin/WebView, nativní a případnou přenositelnou variantu.
