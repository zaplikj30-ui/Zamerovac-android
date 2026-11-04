# Praktická automatická kontrola #28 – průběžný stav

Schválené zadání a rozšíření jsou v [issue #28](https://github.com/zaplikj30-ui/Zamerovac-android/issues/28), pokračování ve stejném PR #27 z `50414b5`. Bez APK, změny requestu a merge. Pouze syntetické soubory.

## Skupina 1 – hotovo lokálně, CI ověřit na příslušném commitu

`tools/e2e/drawing.cjs` prakticky vytváří všech 15 kreslicích/kótovacích nástrojů přes nabídku a skutečné pointer tahy/klepnutí: rozměr, čára, šipka, kruh, elipsa, obdélník, plocha, lomená čára, dimenzní a kumulativní řetězec, úhel, volná ruka, směřovat, bodová poznámka a symbol. Nevkládá hotové objekty do JSON.

Každý případ provádí dialogové zadání hodnot/textů, skutečný posun, Undo/Redo, příslušnou úpravu konce/rohu, uložení, zavření, otevření a reload. Kontrolují se přesné desetinné řetězce a jednotky. U plochy také nezávislé vrcholy a výpočet obsahu. U volné ruky/bodové poznámky/symbolu nejsou vymyšlené neexistující délkové vstupy.

Obrysový oracle počítá očekávané body z uložených souřadnic a dokumentované geometrie nezávisle na render/hit-test helperech aplikace. Vyžaduje skutečné žluté pixely s tolerancí antialiasingu; bílé úchopy se nepočítají. Negativní kontrola dočasně potlačí barevné tahy, zachová bílé úchopy a musí odhalit chybějící obrys. Prochází 13 takových negativních kontrol; poznámka a symbol jsou textové, jejich pixely se ověřují samostatně.

První běhy odhalily opožděný autofocus dialogu, který při rychlém přepnutí vstupu mohl přemístit kurzor a spojit úsekové hodnoty v nesprávném poli. `modal` nyní neruší fokus, který už uživatel umístil do dialogu, a ruší starý focus timer. Nemění se uživatelské preference ani význam jednotek. Pomocný `activeSegmentIndex` je stav výběru, nikoliv naměřená geometrie; testy ho odlišují od datových změn.

Sdílený `tools/e2e/harness.cjs` ukládá report s konkrétním krokem/evidencí a screenshot každého úspěšného případu. Při chybě navíc screenshot, konzoli, JS chyby, syntetický model, DOM a Playwright trace. CI vše archivuje jako `practical-e2e-diagnostics`. Lokální diagnostika je v ignorovaném `test-artifacts/`, nesmí se zaměnit za zákaznické podklady.

## Následující skupiny

Praktická workflow a chyby, rychlá gesta, integrita souborů a mapování úplné matice #28 jsou rozpracované. Konkrétní stavy a mezery budou doplněny, nikoliv souhrnně označeny jako kompletně ověřená aplikace. Starší zelené JS/Python/browser/nativní testy se znovu využijí. Skutečný update instalace a Android emulator WebView se pouze připraví bez spuštění, dokud platí zákaz APK. Samsung, S Pen, Bosch, živý cloud a skutečný HW kodek zůstávají samostatné fyzické/integrace kontroly.
