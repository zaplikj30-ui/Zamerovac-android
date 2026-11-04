# Společná aktualizace po 1.2.147 – issue #17

Zadání: [#17](https://github.com/zaplikj30-ui/Zamerovac-android/issues/17), důkazy: #13 a #12. Implementace začala z `474c841` bez otevřených PR; první kód `b346831`, dokončení v PR #18. Žádná změna schématu, applicationId ani podpisu; původní zálohovací ZIP zůstává.

| Body #17 | Skutečná změna | Automatické ověření | Telefon |
|---|---|---|---|
| A1 kruh/elipsa | Střed i poloměry se transformují do obrazovkových souřadnic stejně jako úchopy. | JS záznam kreslení při zoomu a posunu | Čeká |
| A2 lichoběžník | Nezávislé vrcholy zachovány. Výběr nástroje/objektu zapne příslušnou skrytou vrstvu; reprodukován případ úchopů bez obrysu při skryté vrstvě. Přesná příčina původního videa není prokázaná. | JS uzavřený obrys při zoomu, prohlížeč | Čeká zejména na potvrzení této příčiny |
| A3 řetězec | Vypnutí, změna nástroje, opětovná volba i odchod uloží cestu od dvou bodů přes běžný commit. Dvojklep zachován. | JS skutečné setTool/completePolyline, browser reload | Čeká |
| A4 kumulativní | Náhled nepřidává bod shodný s posledním; po puštění pera/prstu se vrací jen zadané body. Hit-test používá vykreslené odsazené úseky od nuly. Stejné naměřené hodnoty se nemažou. | JS náhled, oddělené úseky/identické hodnoty, browser | Čeká |
| A5 text lomené | Každý rozměr i popisek natočen podle úseku s čitelnou orientací. | JS obě šikmé orientace a svislice | Čeká |
| A6 úchopy/magnet | Priorita bodu před textem/celkem; v krátkých úsecích středních 40 % zachováno pro pohyb. Totéž pro vrcholy lomených a řetězců. Viditelné kroužky nezmenšeny. Magnet ukazuje zapnutý stav při kterémkoli režimu a jedním klikem všechny vypne. | Dosavadní drag/geometry testy, nové krátké/dlouhé úseky | Prst/S Pen, snap on/off čekají |
| A7 koš | Po obnově se ihned překreslí seznam aktuální složky, potom koš. | Browser skutečné kliknutí | Čeká |
| A8 import | Kořen obnovené kopie podle původního kořenového názvu + datum; staré záznamy nepřepisuje. | Robolectric starý ZIP, chybějící média/neplatné schéma | Čeká |
| A9 obdélník | Jen redundantní obecné pole odstraněno. Starý údaj zůstává v datech, nevyužívá se jako m². Obsah jen z platné šířky/výšky; historie Bosch míří do aktivní šířky/výšky. | JS legacy measure, stávající geometry/Bosch | Bosch čeká |
| B10 ikona | Vlastní klikatá SVG šipka v menu i malé liště, běžná kóta ↔. | Browser načtení | Čeká |
| B11 nápovědy | Přesná dvě různá znění, malé dole uvnitř pracovní plochy nad lištou. Navazující výzva zůstává po libovolném počtu bodů. | JS 1–5 bodů, browser | Čeká |
| B12 jednotky | **Nová dohoda uživatele:** malé rozbalovací políčko vedle Rozměru, také u každého úseku. Původní přesun dolů nahrazen. Zachována přesnost, per-segment jednotka, historie. | Browser pořadí/šířka/reload, JS simulace Bosch | Bosch čeká |
| B13 menu | + opět zavře stejné menu; Android Back/Escape zavírá nabídku před editorem, návrh kót neodstraňuje. | Browser skutečné kliknutí/Back u + i ⋮ | Čeká |
| B14 pravítko | 17×17 místo 21×21, symbol 12×12, kontrast/pozadí/lem zachovány. | Stávající kontrakty, CSS | Čeká |
| B15 dřívější UX | Ověřen existující stoh fotografií s ohnutými rohy a počtem v inset-workspace.js. Zachována ochrana zamčených cílových složek v app.js a bulk-actions.js. | Dosavadní inset/lock testy | Retest čeká |
| C16 zákaznický ZIP | Samostatná akce fotografie/složky/hromadného výběru/editoru. Jedno rastrové PDF na vybranou fotografii, vlastní poměr stran, do 2400 px delší strana. Volba kót a kreseb, soukromé poznámky výchozí vypnuté. Bez JSON, historie, GPS, originálních příloh. Neukládá změny do projektů. | Browser výběr vrstev/render/nezměněná data, Robolectric skutečné PDF/ZIP 1 i 3 snímky | Android výběr cíle a čitelnost PDF čekají |
| C17 pozadí | Vypnuto / jemné tečky / jemná mřížka, jen přehled/seznamy, výchozí vypnuto. | Browser uložení a reload, CSS cíl jen #browserView | Čeká |

## Kontroly a vydání

- Lokálně: 13 spustitelných JS regresních skriptů; Python 41 testů, 1 přeskočen kvůli chybějícímu lokálnímu Android SDK; syntaxe všech JS; git diff --check.
- Celý web: `tools/check-post17-browser.cjs` s Chromium, syntetická data, žádné zákaznické snímky; bez runtime chyb. Není to Android/S Pen/Bluetooth test.
- Nativní testy `Post147DataTest`: izolovaný import starých dat s přesným řetězcem a neznámými poli, neplatné ZIP, vlastní PDF ZIP s jedním/třemi snímky, neplatný obrázek. Běží v PR #18 před jedinou APK. První kompilace odhalila PdfDocument bez AutoCloseable, opraveno explicitním close.
- Navíc opraveno nebezpečné chování při selhání čtení: nečitelná primární databáze i záloha už nesmí vrátit prázdný editovatelný stav; zápis se zablokuje. Při obnově ze záložní kopie se její obsah nepřepíše vadnou primární databází. Bez migrace databáze, existující neznámá pole zachována. Prohlížeč ověřuje save/reload starého schema:1. Aktualizace skutečné instalace se starými zakázkami musí být ověřena na telefonu a s původní zálohou.
- **Nativní kontrola [41869651694](https://github.com/zaplikj30-ui/Zamerovac-android/actions/runs/41869651694) úspěšná:** kompilace a všech 6 Robolectric testů, včetně ochrany nečitelné databáze a skutečného export/import průchodu původním zálohovacím ZIP. PDF část používá jednoduchý vlastní zápis obrazového PDF; `PdfDocument` nemá v Robolectric funkční implementaci. Testy se neobchází falešným PDF.
- **Nezávislá kontrola skutečných artefaktů tohoto běhu:** `tools/check-customer-pdf.py`, striktní parser pypdf a render PyMuPDF; ZIP s 1 i 3 PDF, každé má právě jednu stránku a rastrový obrázek, správný poměr stran a vykreslenou barvu testovacího obrázku; bez textových objektů, formulářů, příloh a metadat.
- APK se spustí až po poslední kontrole a sloučení. Zatím nevydána; finální odkaz bude v START_ZDE.md a #17.

## Fyzické kontroly po vydání

Neoznačovat jako provedené: instalace nad 1.2.147 se zachováním skutečných dat, lichoběžník při původní situaci, krátké úchopy prstem a S Penem s magnetem i bez něj, čitelnost exportních PDF, skutečný přenos Bosch do konkrétního úseku s vlastní jednotkou a do šířky/výšky, **offline test 29**. Testy se uživateli zadávají jednotlivě podle AGENTS.md.
