# #221: původ vydání a první reprodukce

Base/main: `c990c03d91ab48a7b10d96fda65b727ec1cacc50`. PR #220 nedotčen.

| Verze | Tag commit | Vydaná APK SHA256 |
|---|---|---|
| 1.3.0 | 2d1e4a45d4e35e8dd7e9c7109c92a8a62344b12e | d9c1c214771732a7dac4ff890eb0df8e48c3f0d3559f01c0d1d106f8b39c75e7 |
| 1.4.0 | 5ecc098d4c9a54d5cf9fb3376834e1e7b238241f | d63ea74d343f94278bba200430e165cff93977c8ad36fcb9415e66ff64535609 |

APK staženy z existujících GitHub Releases. SHA256 souhlasí s API digesty assetů 716384234/761572543. `assets/app.js` a `assets/editor.js` obou APK jsou bajtově shodné s příslušnými tagy. Shoda celého nativního dex se zdroji nebyla nezávisle rekonstruována; APK nebyly nově sestaveny.

## Úzká mapa podezřelých cest

- `editor.js` mezi tagy mění hit-test, geometrii a historii. `stageUp` dokončuje gesto, `finishHandleGesture` vytváří Undo a `commitEditor` volá synchronní `save`. Undo je v paměti a samo nevysvětluje přetrvání po restartu. Vyvrácení: sledovat uloženou velikost a persistující soubory odděleně od editStack.
- `LocalDatabase.write` ve 1.4.0 uchovává starou, záložní a novou revizi pomocí nové `ProtectedRevisions`. Její `inventory` načítá katalog a kontroluje uložené revize. Nový stav zůstává na disku a je společný pro fotografie. Vyvrácení: 100 skutečných zápisů, trend času/počtu souborů a čerstvý proces.
- `ImmutableMediaProof` cache závisí na inode/mtime/subsekundovém unix ctime. Nepodporovaný provider vede k opakovanému hashování originálu. Linux cache PASS není Android provider PASS. Vyvrácení: Android atributy a počet hashovaných bajtů, bez oslabení integrity.
- `MainActivity.saveDataChecked` synchronně drží `TrashPurger.LOCK`, provádí CAS/write a následně `PendingAudio.recoverPrimary`. Změna nastavení sdílí save; renderer během samotného tahu tuto cestu nepoužívá. Vyvrácení: oddělené časy lock/read/write/recover; existující diagnostický PR #209 nekopírovat bez návaznosti.
- `paint`/`drawLoupe` jsou během pohybu nákladné, ale vlastník upřesnil, že zamrznutí začne až po puštění. Renderer zatím neměnit.

## První místní výsledek

`ProtectedRevisionsTest.repeatedDimensionSaveProfile`: Robolectric/Linux, produkční `LocalDatabase.write`, 100 změn souřadnice, existující malá syntetická fotografie/video. 1 test PASS; 100. readback přesně 99.125 a originální bajty zachovány. Checkpointy (zápis: počet revizí / ms):

10:12/35.0; 20:22/36.3; 30:32/31.2; 40:42/32.2; 50:52/36.0; 60:62/35.7; 70:72/44.3; 80:82/40.4; 90:92/44.1; 100:102/48.0.

Čas checkpointu zahrnuje i diagnostické `holds()` po zápisu, není čistým časem CAS. Žádný tvrdý časový limit není tvrzením o telefonu. Fyzické dlouhé zamrznutí **NEREPRODUKOVÁNO**, příčina **UNKNOWN**. Zatím nejde o RED→PASS ani hotovou opravu. Gesture/restart/druhá fotografie/realistická velká média pro tento test **NOT RUN**. Další krok: odstranit diagnostický overhead z měření, zaznamenat všechny vzorky a oddělit cold/warm proces a velikost médií. Teprve při prokázání příčiny produktová oprava a sousední regrese.

Žádná změna funkce/UI; nápověda nerelevantní. Žádný nový cloudový běh, APK, merge, HOME nebo výdaj.

Retest s čistým časem samotného `LocalDatabase.write` (100 vzorků, bez `holds()` v měřeném úseku): první deset medián 27.27 ms, posledních deset 47.64 ms, maximum 84.67 ms. PASS readback a originály. Nejde o fyzický Android ani reprodukci dlouhého záseku.
