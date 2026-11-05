# Společná aktualizace #39 – pracovní evidence

Práce pokračuje na `codex/velka-aktualizace-39`, draft PR #41. Bez merge, APK a skutečných zákaznických dat. Zachované opravy `85ed7ec`, `f4d6282` a izolované revizní vektory.

## Etapa 1 – ukládání a chybové cesty #33

- JS posune potvrzený snapshot až po úspěšném nativním zápisu. Nativní compare-and-save pod lokálním zámkem odmítá zastaralý základ; třícestné sloučení uchovává obě souběžné změny. Opožděný callback čte aktuální diskový stav. Selhání zápisu vrací chybu a nehlásí potvrzení.
- ZIP před prvním bajtem kontroluje přítomnost všech odkazovaných příloh včetně vnořených detailů; chybějící/prázdný soubor export zastaví. Úspěch se oznamuje po uzavření výstupu poskytovatele. Nedokončený výstup se aplikace pokusí odstranit; poskytovatel může odstranění odmítnout.
- Nahrávání při chybě uvolní mikrofon a neplatný záznam se nepřipojí k poznámce.
- Nápověda vysvětluje skutečné chybové chování. `release-history.js.pendingChanges` jsou nevydané pracovní podklady, nikoliv nová smyšlená verze; před vydáním je nutno připravit jednu položku se skutečným číslem workflow.

Testy: `tests/save_acknowledgement.js` (selhání zápisu, potvrzení, přesné konfliktní hodnoty, opakování, opožděný callback), `StorageLifecycleTest` (neúplný ZIP, chyba výstupu, stale compare-and-save, odmítnutý disk, cleanup audia). Místně všechny Node testy prošly, Python 47 se dvěma skipy bez javac. Nové nativní testy musí potvrdit Actions. Testy s mockem disku/mikrofonu nejsou fyzickým ověřením plného telefonu.

## Zbývající schválený rozsah

Úplná #33 ještě není dokončena: síť pod globálním zámkem, druhý postup zápisu sync, integrita a idempotence přenosů, cleanup vzdálených médií, další nedůvěryhodné vstupy. Skutečná přímá/offline synchronizace, párování, přenosová fronta a Google Drive API/OAuth #38 a neměnné historie/obnova #40 nejsou hotové. Dále galerie #35/#36/#37, editor #12/#13, foto #21, landscape lišta #26, navigace nápovědy #29, texty Bluetooth #34 a odpovídající testy #28.

## Prostředí

Git klon jednou selhal: `Failed to connect to proxy port 8080`. `gh auth status` neprošel. Následoval úplný textový snapshot 122 souborů přes GitHub konektor; každý soubor byl ověřen proti Git blob SHA `f4d6282`. Místně je Java runtime 21, chybí javac/Gradle/Android SDK. Prohlížeč Chromium/Playwright je dostupný; lokální server vyžaduje síťové oprávnění sandboxu. Zápisy na větev provádět přes GitHub tree/commit a kontrolovaný očekávaný HEAD, nikdy nepřepisovat jiný chat.

## Etapa 2 – galerie, editor a ovládání

- #35/#36: společná transformace celého galerijního plátna, hranice posunu, zoom kolem prstů, vycentrování při 1× a zrušení gesta; po otočení se hranice přepočítají.
- #37: galerie měří skutečnou geometrii vloženého snímku i výchozího textu pod ním, včetně přesahů a otočení. Při renderu se společně transformují i texty. Spodní pokyn i jeho pruh odstraněny.
- #12/#13: výchozí výběr, lupa při úpravě rohů obdélníku/lichoběžníku i os kruhu/elipsy; zvětšení respektuje rozsah nastavení 2–6. Bez změny výpočtů měření, magnetu a Undo/Redo.
- #26: přídavné nástroje jen na šířku podle dostupného místa; výběr a pořadí v nabídce nástrojů. Původní výšková lišta a nabídka dalších nástrojů zachovány.
- #29: zvýraznění, předchozí/další výskyt, cyklická navigace, samostatné počty témat/výskytů a bezpečné hledání bez diakritiky. Plovoucí tlačítko hlášení nepřekrývá nápovědu.
- #34: neutrální název a stav Bluetooth; dosavadní Bosch cesta zůstává. Nepřidává to nové měřicí protokoly.
- #21 částečně: paměťová LRU mezipaměť do 3 dekódovaných snímků / 24 milionů pixelů zrychluje opakované otevření. Po úplném restartu je první dekódování stále nutné; zrychlení studeného startu na telefonu nebylo měřeno.
- Uložení: trvalé chybové upozornění s opakováním; obal v upgrade.js nyní předává výsledek zápisu a neoznačuje chybu za úspěch v diagnostice.

Ověření: všechny Node skripty, Python 47/2 skipy, Chromium všech 15 kreslicích nástrojů, 6 workflow, interakce, zoom/grid, nápověda a changelog prošly. Cílený `tools/e2e/update39.cjs` prošel (4 případy): extrémní posun na telefon/tablet rozměrech, skutečné žluté pixely popisku pod detailním snímkem, beze změny uložených dat, roh/lupa a přesný text hodnoty, nastavení lišty a rotace, skutečné odmítnutí localStorage zápisu a opakování, chybějící foto, navigace výskytů a Bluetooth stavy. Samostatně prošel původní test 11 viewportů. Nativní CI první etapy selhalo na chybějícím kvalifikovaném názvu DocumentsContract; opraveno v této etapě, nový výsledek ještě ověřit. Žádná APK.

### Mapa regresí #28 pro nové etapy

| Funkce / issue | Pozitivní kontrola | Selhání / ochrana | Důkaz a limit |
| --- | --- | --- | --- |
| Ukládání #33 | potvrzený zápis, opakování | odmítnutý disk, quota, stale callback, dvě přesné hodnoty | Node + skutečné UI; nativní CI čeká |
| ZIP #33 | původní roundtrip a 50 exportů | vnořené chybějící/prázdné médium, selhání výstupu | StorageLifecycleTest; nativní CI čeká |
| Galerie #35–37 | plátno + výchozí popisek za okrajem | extrémní posuny, otočení, neměnnost záznamů | Chromium pixely/gesta; fyzicky neověřeno |
| Editor #12/#13 | roh s lupou, výchozí výběr | ukončení, přesná hodnota, původní 15 nástrojů a Undo/Redo | Chromium; prst/S Pen čeká |
| Lišta #26 | více ikon na šířku, volba | návrat na výšku, neměnnost anotací | 11 viewportů + cílený test |
| Nápověda #29 | 0/N, předchozí/další, konec | diakritika, nevyskytující se slovo, nulová změna dat | Node + Chromium offline; fyzicky čeká |
| Bluetooth #34 | neutrální dialog, název zařízení | nezměněný přenosový kód Bosch | modelové stavy, fyzický laser čeká |
| Foto #21 | stejný dekódovaný obraz z cache | chybějící foto, žádné předčasné kóty | Chromium; studený start Samsung neměřen |

Další krok: sjednotit atomické ukládání synchronizace a hlavní aplikace, odstranit držení globálního datového zámku po dobu práce se vzdáleným poskytovatelem. Celé #38/#40 stále zbývá.
