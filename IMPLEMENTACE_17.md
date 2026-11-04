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
- **Vydána jediná společná APK [1.2.148](https://github.com/zaplikj30-ui/Zamerovac-android/releases/download/test-v1.2.148/Zamerovac-v1.2.148.apk)**: [release](https://github.com/zaplikj30-ui/Zamerovac-android/releases/tag/test-v1.2.148), [úspěšný běh #148](https://github.com/zaplikj30-ui/Zamerovac-android/actions/runs/41870681150), zdroj `35e84f3`, sloučení PR #18 `5de95df`.
- Před vydáním prošel i poslední commit `56b1ceb`: [nativní kompilace + 6 testů](https://github.com/zaplikj30-ui/Zamerovac-android/actions/runs/41870166922) a [JS/Python](https://github.com/zaplikj30-ui/Zamerovac-android/actions/runs/41870166951).
- Ověřen balíček `cz.zamerovac.app.preview`, `versionName 1.2.148-test`, `versionCode 1148`, stejný certifikát SHA-256 `c828c96739e554e8da4f5851913356134f1359a98d5013772ad5587e74a2d229`.
- Vydaná APK stažena a zkontrolována: **SHA-256 `5bb12f7f58404d89d490574afe0d9d896c744fc71b379b539c66b0ed702271b9`**, upravené JS/HTML/CSS v APK odpovídají zdrojům main. Velikost 190 212 bajtů. Žádné další vydávací sestavení nebylo vyvoláno.

## Fyzické kontroly po vydání

Neoznačovat jako provedené: instalace nad 1.2.147 se zachováním skutečných dat, lichoběžník při původní situaci, krátké úchopy prstem a S Penem s magnetem i bez něj, čitelnost exportních PDF, skutečný přenos Bosch do konkrétního úseku s vlastní jednotkou a do šířky/výšky, **offline test 29**. Testy se uživateli zadávají jednotlivě podle AGENTS.md.

## Následná společná aktualizace po 1.2.148 (E + F + G)

Rozpracováno z `f646a87` ve `feature/post148-trash-menus`. Původní body A–C zůstávají.
- E: nativní mazání výhradně potvrzených smazaných ID. Aktivní potomci se nemažou.
  Sdílená média chrání i reference v historii a neznámých vnořených polích.
  Nejdřív trvalý zápis databáze a konzistentní recovery kopie, pak soubory a miniatury.
  Seznam nedokončeného úklidu přežije restart; Koš nabízí opakování a hlásí chyby.
  Souběžné změny se ověřují proti poslednímu známému uloženému snímku, zápis/sync/import
  sdílí zámek. Volitelné `trashPurgedIds` obsahuje jen ID a brání návratu starých smazaných
  záznamů ze synchronizace; aktivní vzdálená obnova se zachovává. Schéma zůstává 1.
  Externí záložní ZIP a původní soubory mimo privátní média/cache aplikace se nemažou.
- F: zachycení celého vnějšího pointer/touch/click gesta před obsluhou plátna.
  Obvyklá menu a rozšířená lišta se zavírají, formuláře a potvrzení mají dosavadní pravidla.
  Pouze výběrový dialog akcí položky (⋮) má výslovně označené zavírání mimo.
- G: přesný text na fotografii, složce, v editoru a hromadném výběru; exportní algoritmy nezměněny.
- Dodatečný pokyn uživatele: značka pravítka vlevo nahoře a dále menší (15×15, SVG 11×11), kontrast zachován.

Dosavadní regrese: 13 JS, Python 41 (1 skip bez SDK), původní celý Chromium průchod úspěšné.
Nové nativní/browser testy zatím probíhají. Žádná nová APK ani fyzické ověření se tímto netvrdí.
