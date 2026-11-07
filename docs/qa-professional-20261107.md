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
