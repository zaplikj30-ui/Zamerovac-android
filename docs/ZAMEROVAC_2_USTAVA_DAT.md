# Zaměřovač 2 – M0: jednostránková ústava dat a ukládání (návrh)

**21. 11. 2026 · STAV: návrh k schválení vlastníkem, nikoli implementovaný či otestovaný kontrakt.** Záměr: dostatečná ochrana dat bez přehnané historie. Platí nejprve pro malý **offline** základ v2; synchronizace/účty až v pozdější samostatné etapě.

## Co musí platit

1. **Jednotka práce:** zakázka obsahuje stabilní ID, originální média, složky a editovatelné anotace. Přesná naměřená hodnota a jednotka nejsou odvozené z pixelů ani z formátovaného popisku. Zoom, přesun a změna telefonu uložené hodnoty nemění.
2. **Rozpracovaná změna:** při právě probíhajícím tahu nebo před potvrzením uložení může po pádu zmizet poslední nedokončený úkon. Běžný tah kóty nevytváří trvalou kopii celé historie. Jeden dokončený tah je nejvýše jeden krok Undo; počet tahů nesmí sám zvyšovat cenu dalšího uložení.
3. **Potvrzené uložení:** aplikace nesmí oznámit „uloženo“, dokud bezpečný zápis skutečně neskončil. Již úspěšně uložená práce se nesmí tiše ztratit či vrátit do staršího stavu. Po restartu se musí otevřít poslední platný potvrzený stav, případně ověřená předchozí kopie s jasnou informací.
4. **Originály médií:** původní bajty fotografie/zvuku/videa se nepřepisují kresbou; anotace jsou oddělené a dále editovatelné. Odkazy a ID musí zůstat platné. Při chybě importu, uložení či obnovy nezničit jediný platný originál.
5. **Přiměřená pojistka:** běžná trvalá historie každého pohybu není požadavek. Kandidát je „1 aktuální + 1 předchozí platný stav“ pro jednotku ukládání, **nikoli dnes zvolená technologie**. Porovnat jednoduché soubory proti SQLite/Room a vybrat nejmenší řešení, které obstojí ve stejných testech. Undo/Redo, koš a export mají jiný účel než crash recovery.
6. **Bezpečná chyba:** plný disk, zamítnuté oprávnění, přerušení zápisu, poškozený soubor nebo chybějící příloha nesmějí vyvolat falešné potvrzení uložení. Přiznat problém; zachovat poslední ověřený stav.
7. **Pozdější rozšíření:** nyní žádné přihlašování, sync fronty, cloud ani konfliktní protokol. Data mají zůstat srozumitelná, verzovaná a s ID, aby pozdější online funkce nevyžadovaly nevratný přepis.

## Minimální zkouška před schválením řešení

- Přidat fotografii a přesnou kótu → 100/1 000 opakovaných přesunů → uložit → ukončit → otevřít; změřit plynulost, latenci uložení a paměť, bez rostoucí ceny kvůli počtu tahů.
- Ověřit přesné číslo a jednotku, geometrii, Undo/Redo a **byte-for-byte originál média**.
- Simulovat přerušení zápisu, zaplnění disku, vadný soubor a chybějící médium; žádný tichý přepis posledních platných dat a žádné falešné „uloženo“.
- Stejný scénář provést na emulátoru a alespoň jednom skutečném Androidu; později zahrnout odlišnou značku a slabší zařízení podle [plánu testování](ZAMEROVAC_2_ZIVY_NAVRH.md). Výsledky oddělit: SOURCE / automat / emulátor / fyzický telefon.

**NEROZHODNUTO:** přesný datový formát, počet trvalých záložních stavů pro v2, konkrétní databáze a limity výkonu. Vlastník je musí schválit až po srovnání. Tento krátký kontrakt je **brána M0**, ne další mechanika ochrany.
