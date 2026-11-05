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

## Skupina 2 – praktická workflow a ochrana originálů

Nových šest `tools/e2e/workflows.cjs` případů přes UI: hierarchie/přejmenování/přesun/koš/obnova, long press a kopie s novými ID a zděděným zámkem, textová poznámka/checklist/skica/Undo/příloha, hlavní fotografie + dvě fotografie poznámky + vlastní kóta detailu + galerie + skutečný PNG, zrušení/vysypání koše, fokus/Cancel/vrstvy/hledání. SHA-256 uložených Blobů před/po operacích, kontrola platných vazeb a unikátních ID. Všech šest prošlo lokálně. Posuvnou vlaječku připomínek test skutečně přesune, pokud překrývá kontextové menu; nepoužívá force-click. Browser koš úmyslně odstraňuje pouze záznamy; fyzické mazání a sdílení souborů ověřuje existující `TrashPurgerTest`.

Tři `tools/e2e/interactions.cjs` případy prošly: 1/2/3 klepnutí na oba konce a půlpixelový jitter, skutečný CDP touch start/cancel, pan/wheel/fit a deset reopen cyklů, ukončení řetězce přepnutím nástroje a vložení/odebrání bodu. Při rychlých klepnutích může aplikace správně otevřít editaci; test dialog zavře přes UI a čeká na skutečné pointer události.

`StorageLifecycleTest` navazuje na původní datové testy: opakované izolované obnovy a správné parent/media/detail vazby, přesná dlouhá desetinná hodnota/jednotka/souřadnice, cancel pickerů bez změny dat, 50 paralelních save/export s kontrolou skutečného ZIP a obou originálů, EXIF 90° miniatura včetně barev cache a SHA-256/EXIF/rozměrů originálu. Přidaný sedmý případ kontroluje potvrzená data při pause/stop/resume a nové Activity na API 26; není to OS kill nebo APK update.

**Skutečně nalezené regrese:** duplicitní ID v příchozí záloze vedlo k obnovení dvou položek se stejným ID; neplatné odkazy na média zůstávaly v importovaných datech. Dva testy prokazatelně selhaly před opravou. Import je nyní odmítne před zápisem do media/. Platné starší zálohy a původní importer/exporter zůstávají zachované. Po opravě prošlo 38 nativních testů; sedmý lifecycle případ a finální úplný běh jsou právě ověřované, dosud zde netvrzené jako hotové.

Připravený společný spouštěč, strojový registr, jazykové kontroly a další úrovně jsou rozpracované. Není to tvrzení, že celá aplikace je už automaticky pokrytá. Žádná APK ani emulátor nebyly spuštěny.

## Společná aktualizace #39 – nové praktické a negativní kontroly (5. 11. 2026)

Živý registr nových změn je v [docs/update-39-progress.md](docs/update-39-progress.md) včetně mapy funkcí, chybových cest a omezení; checkpoint přenosového modelu v [docs/sync-v2-checkpoint.md](docs/sync-v2-checkpoint.md). Přidáno `tests/save_acknowledgement.js`, `tools/e2e/update39.cjs`, `SyncSafetyTest` a další skutečné souborové/ZIP testy v `StorageLifecycleTest`. `tests/sync_protocol_v2.js` provádí simulovaný failover s 30 syntetickými soubory, diskovou frontu a dvě modelové historie se 100 společnými originály; nejde o reálnou komunikaci Android/Drive. Rychlé/UI i nativní CI pro `8ac5865` prošly, pozdější SHA musí mít své výsledky. Žádné fyzické ani vydávací ověření se tím nenahrazuje.
