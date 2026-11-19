# Hlášení z fialové vlaječky – hranice opravy 19. 11. 2026

## Ověřená cesta v hlavní větvi
1. Krátké klepnutí na vlaječku zavolá `Native.captureReportScreenshot` → Android `PixelCopy` → vlastní PNG v privátních médiích.
2. Editor do PNG vypaluje značky (S Pen, šipky, text) a uloží připomínku do `localStorage`; nezměněný obrázek znovu nepřekóduje.
3. `Připojit video` používá existující `pickMedia`; systémově importované originální video zůstává v médiích zařízení.
4. Dlouhé podržení → `Moje připomínky` → výběr → `Uložit ZIP` nebo `Sdílet vybrané`.
5. JS předává manifest přes současné `Native.saveIssueBundle/shareIssueBundle`. Android sestaví ZIP a nabídne systémový dokumentový dialog nebo nabídku sdílení. **Neexistuje přímý upload na GitHub.**

## Nálezy před opravou (main c990c03d)
- Sdílení pokračovalo přímo do Android chooseru bez výslovného přehledu a potvrzení soukromí; reprodukční V8 test: RED.
- Native sestavení ZIP přeskočilo některé chybějící/neplatné obrázky a videa bez selhání; uživatel mohl předat neúplný důkaz.
- `pripominky.json` obsahoval celý stav reportů včetně interních ID médií a původních názvů videí.
- Dočasné ZIPy po uložení/zrušení nebyly bezpečně uklízeny a pro sdílení nebyl vymezen retenční interval.
- ZIP jen kopíroval originální MP4/WebM/MOV. Zkomprimovaný video stream se běžným ZIPem podstatně nezmenší. **Velikost ani kvalita reálných médií nebyla v tomto prostředí změřena.**

## Oprava v tomto izolovaném DRAFT PR
- Uživatel před externím sdílením vidí výběr a výslovné upozornění: musí kontrolovat viditelný obsah, text i video; odmítnutí přenos zastaví.
- Native ZIP selže jako celek při chybějící, prázdné, neplatné nebo v průběhu změněné příloze; vstupní limit: 50 hlášení, nejvýše 12 videí na hlášení, nejvýše 256 MiB v jednom balíčku, nejvýše 512 KiB předaného JSON.
- Exportní JSON používá whitelist polí bez interních ID, vektorových anotací a původních názvů souborů. Obrázky se jmenují podle čísla připomínky, nikoli zákazníka. **Obsah pixelů ani vložená metadata originálního videa nejsou automaticky redigována.**
- Dočasný ZIP je ve vlastním namespace `issuezip-`, bez automatického uploadu. Po uloženém či zrušeném dokumentovém exportu se odstraní, ale ZIP předaný k externímu sdílení čeká na výslovně potvrzený ruční úklid; žádný časový úklid automaticky neprobíhá.
- Původní média ani připomínky v telefonu se nemažou a nepřekódují; zákaznický ZIP, sync a datový model se nemění.

## Rozhodnutí vlastníka 19. 11. 2026: originální kvalita a výslovné mazání
- **NEMĚNIT:** žádná nová komprese, transkódování, škálování ani zmenšování fotografií, screenshotů nebo videí v exportu. ZIP jen kopíruje originální bajty médií; odstraňuje pouze lokální interní ID z textového manifestu. Snížená velikost není cílem tohoto PR.
- Všechny uložené připomínky je možné jednotlivě odstranit **pouze po výslovném potvrzení uživatele**. Současné hromadné „Smazat vyřešené“ zůstává; nevyřešená hlášení se automaticky nemažou. Původní soubory v `media/` zůstávají nedotčené.
- **Dočasný ZIP předaný do Android ACTION_SEND není doručený jen proto, že se otevřel chooser.** Takové ZIPy proto nesmí automaticky mazat 24hodinová lhůta, restart aplikace ani nové sdílení. Tato ochrana platí i pro ZIPy větší než limit přílohy veřejného GitHub Issue.
- Žádný ZIP se nemaže automaticky jen kvůli stáří. Dokumentový export odstraní dočasný ZIP po zrušení či po úplném dokončení zápisu/uzavření streamu. Sdílené, opuštěné i nejisté ZIPy zůstávají, dokud uživatel v Moje připomínky nevyvolá **Vyčistit dočasné ZIPy** a v nativním potvrzení neprohlásí, že všechny přenosy skončily. Neexistuje automatické potvrzení převzetí externí aplikací.
- **P1 opravené při vlastním review:** `onActivityResult(REQUEST_ISSUE_EXPORT)` nesmí při úspěšném výběru dokumentu odstranit `pendingIssueZipId` před spuštěním kopírovacího vlákna. Nově drží ID a blokaci `issueBundleBusy` až do `finally` po zavření výstupního streamu; tím se zablokuje paralelní export a ruční úklid během kopírování. Trvalý negativní test `tests/feedback_manual_retention.js` nejprve selhal na původním předčasném uvolnění a po opravě prošel strukturální kontrolou. Nativní souběh na Androidu **NOT RUN**.
- Ochranná kontrola formátu/úplnosti a horní limit celkové vstupní velikosti 256 MiB zůstávají. Limit není slib, že GitHub soubor přijme.

## A/B/C po novém rozhodnutí vlastníka
- **A – pokračovat s omezenou vratnou opravou:** soukromí, potvrzení, úplnost a retenční bezpečnost. Bez komprese. **Doporučeno a implementováno v tomto PR.**
- **B – samostatná kompresní/transkódovací funkce:** **NEMĚNIT / bez schválení**; vlastníkem výslovně zamítnuté pro tento celek. Nepokračovat v jejím návrhu nebo implementaci.
- **C – bezpečné předání nadlimitních důkazů:** vybrat menší počet důkazů, nebo předat ZIP soukromou schválenou cestou; neuploadovat neověřená citlivá média na veřejný GitHub. Neměnit původní kvalitu.

## Následné nálezy Kontrolora 5 a cílené vlastní opravy
- **301+ záznamů / duplicitní ID:** seznam při startu neodřezává starší hlášení. Při smazání 1 položky se vyžaduje jednoznačné ID, jinak se odmítne bez zápisu. Nezavádí se žádná automatická retence.
- **P2-A – nejistý readback po již provedeném zápisu:** samotný \`setItem\` není potvrzení. Selže-li následný \`getItem\` nebo nelze spolehlivě načíst startup baseline, \`feedbackWriteUncertain\` v aktuální relaci blokuje další zápisy, nový screenshot i místní/externí ZIP. Stará RAM tím nemůže pozdějším uložením obnovit smazaný záznam. Není prováděna tichá oprava ani smazání původních dat; bezpečné pokračování vyžaduje znovunačtení aplikace a ověření uloženého stavu.
- **P3-B – neúplný nejstarší záznam:** \`summary\` používá bezpečné fallbacky pro chybějící či neřetězcové titulky, popisy, obrazovku a datum, aniž mění uložený objekt. Pokud by startup pole obsahovalo opravdu neplatné neobjektové prvky, aplikace zobrazí ostatní platné záznamy, ale zablokuje mutaci a export, aby nevymazala původní položky při přepsání filtrovaného seznamu.
- **Navazující soukromí a média:** duplicitní/neplatná ID se před ZIP odmítnou, neplatný popis nebo seznam videí vyvolá vysvětlené odmítnutí, chybný volitelný název videa dostane bezpečný zobrazovací fallback. Po nejistém zápisu se další pokus o uložení nebo novou fotografickou připomínku odmítne *před* vytvářením dalších originálních či anotovaných kopií.
- **Trvalé testy:** \`tests/feedback_delete_integrity.js\` přímo z produkčních úseků JS ověřuje přesně potvrzené mazání při 301 hlášeních, duplicitní ID, stornování, neúspěšný zápis a nejisté čtení, další operaci ve stejné relaci, restart, neúplná legacy data, metadata pro sdílení i ochranu ZIP. \`tests/feedback_raster_reuse.js\` navíc pokrývá opakovaný pokus o uložení po nejistém ACK bez nové mediální kopie. Všechny tyto testy jsou **syntetické** (V8/Node VM), nikoliv důkaz fyzického Android runtime.
- **Omezení:** do nativního \`MainActivity.java\`, SAF, MediaProvider, formátu ZIP v2, zákaznických souborů, synchronizace ani komprese se v tomto dalším opravném cyklu nezasahovalo.

## Skutečné testovací důkazy a zbývající rizika
- RED: původní produkční `sendBatch(false)` volal `Native.shareIssueBundle` bez potvrzení.
- PASS: na opraveném JS ve V8 – odmítnutí, potvrzení, místní uložení, chybějící bridge, prázdný výběr; syntaxe JS/help; strukturální přítomnost nativních ochranných podmínek. **Strukturální Java test není Android runtime test.**
- NOT RUN: Android build, skutečný telefon, PixelCopy, S Pen, reálný systémový výběr médií, SAF, MediaProvider, komprese/velikost/kvalita videí, disk-full a přerušení procesu na telefonu. Bez toho nejde poctivě uvést hodnoty MB, kvalitu ani fyzické HOTOVO.
- Riziko: Android proces může skončit při zápisu dokumentu; částečný výsledek u cizího SAF poskytovatele nemusí být možné smazat. Přijímající aplikace může potřebovat ZIP i po zvolení sdílení, proto se ZIP nesmí smazat hned po otevření chooseru.
- Riziko: veřejný GitHub a neanonymizované snímky/videa; kontrola musí zůstat vědomá, EXIF neřeší viditelný obsah. Samotný ZIP neznamená podporovanou GitHub Issues přílohu.

**Předání:** po autorském review další fyzické Android QA a nezávislé SOURCE/SECURITY review změněného HEAD. Bez cloud/HOME/merge/APK. Podklad: [samostatné PR #193](https://github.com/zaplikj30-ui/Zamerovac-android/pull/193), beze změny jeho větve.
