# QA-107-04/05 – izolace chyb obnovy hlasu

Navazuje na [review Chatu 38](https://github.com/zaplikj30-ui/Zamerovac-android/pull/107#pullrequestreview-5873632414) a [rozhodnutí Koordinátora 16](https://github.com/zaplikj30-ui/Zamerovac-android/issues/42#issuecomment-6822488948). Výchozí a před změnou znovu ověřený HEAD je `b21ac1bee642abe60d14a515707a15be39d097a9`, main `cf7807905f77f6fd8478c137b1b41aca6ebc3275`, historický PR base `c604860db4fddeefc077e27411bc1941815f7d94`. Autor pokračuje jen ve větvi PR #107, bez merge, APK/release, Actions, změn sync #88, HOME QA nebo větví #110/#114/#115.

## Potvrzený RED a rozsah opravy

Nový `AudioRecoveryIsolationTest` na nezměněné produkci výchozího HEAD (skutečný JDK17/Gradle/Robolectric sdk35) měl **4 testy / 4 FAIL**. Před asercemi zaznamenal délku a SHA obou původních souborů. Konkrétně:

1. **QA-107-04:** `unexpected.tmp` ve složce journalu skryje obě zdravé nahrávky za jedinou generickou chybu Native bridge. Pozdější export proto není v UI dostupný.
2. **Vlastní nález:** chybějící dočasný hardlink znemožní `original(token)` i při existujícím validním finálním médiu a správném ledgeru.
3. **Vlastní nález:** strukturálně neplatná serializovaná historie v jinak čitelném projektu vyhodí výjimku na konci skenování referencí a zahodí již nalezené zdravé položky.
4. **Vlastní nález:** stejné UUID ve dvou rezervovaných názvech se sloučí do jedné položky; původní export z nečitelného ledgeru vybírá první soubor místo jednoznačné identity.

Nové Chromium testy na původním JS potvrdily **2 FAIL**: po Stop je toast `Hlas připojen k poznámce` před Save (QA-107-05); chybí specifické varování o neznámé evidenci při zachovaných dvou kopírovacích akcích. Chromium Native je výslovně **model**, nikoli Android mikrofon nebo filesystem.

Po prvním GREEN proběhla oddělená autorská kritická kontrola. Ta doplnila další skutečně selhávající Robolectric scénář: **1/1 RED**, dočasná rezervace nahrazená symlinkem skryje možnost kopie stále validního finálního originálu. Oprava nesmí následovat symlink ani měnit jeho cíl. Test ověřuje bajty finální kopie i nedotčeného vnějšího souboru.

## Jak funguje izolace

- `PendingAudio.inventory()` sbírá známé tokeny a fyzické rezervace bez destruktivní obnovy. Neznámé soubory, nemožnost výpisu, nečitelná položka, `.new`, symlink nebo duplicitní vlastnictví znamenají viditelnou nejistotu. Neznámá evidence se nemaže, nepřejmenovává ani neresetuje. Při této nejistotě se neprovádí automatická publikace/oprava metadat ani nové potvrzení `bound`.
- Každá nezávisle dostupná položka se dál zpracuje. Dvě zdravá média s ověřenými bajty zůstávají viditelná a mají samostatné exportní tokeny. Zobrazení `available` není oprávněním k automatickému připojení; `attachable=false` explicitně pozastaví tuto akci. Již uložený projekt se nevrací zpět.
- Chyba projektu/reference graphu nemůže zrušit seznam médií. Projekt se nesmí přepsat; nejistota rovněž pozastaví automatické potvrzování.
- Duplicitní rezervace dostanou jednotlivé bezpečné adresy zdrojů (`source-` + ověřený privátní basename). Export nevybere náhodnou položku. Chybějící či nebezpečný zdroj může mít ověřený finální protějšek; ten lze exportovat po shodě velikosti a SHA s ledgerem, bez následování nebezpečného odkazu. Není-li ledger k dispozici, zbývající soubor se nabízí jen jako nejistý originál pro kontrolu.
- `confirm()` vyžaduje přesný primární snapshot, jednoznačnou identitu a čitelný graf referencí. Ověří bajty pouze požadované nahrávky, nikoli všech ostatních. Poškozená nebo duplicitní evidence nepovolí falešné potvrzení. Retenční guard koše zůstává fail-closed.

## Export, UI a výkon

`copyOriginal` otevře a ověří zdroj před otevřením cíle pro zápis. Kopíruje omezený počet bajtů, kontroluje velikost, identitu a mtime před/po čtení a vrací délku/SHA přenesených bajtů. Chyba čtení, zápisu, flush nebo close nedovolí úspěšné potvrzení a nemění originál. Zavření výstupu je součást úspěchu. Ověření vzdálené implementace SAF a fyzického uložení poskytovatele zůstává platformní akceptací, nikoli slibem tohoto testu.

Native po skutečném Save vrací již zjištěný počet položek. UI jej používá pro přehled a nespouští ihned další úplný rehash. Potvrzení více ID nemá kvadraticky opakovat hashování ostatních médií. Bezpečnostní SHA pro novou vazbu zůstává povinné, žádná metadata/mtime cache nenahrazuje ověření obsahu.

Po Stop UI výslovně oznamuje dokončení **v návrhu** a požaduje úspěšné Uložit. Nejisté potvrzení vazby není prezentované jako pending nebo bound s jistotou; samostatné varování vysvětluje pozastavení automatických oprav a dostupnost jednotlivých kopií. Nové texty jsou v i18n a offline nápovědě. Přehled se zobrazuje i při samotném varování bez známého počtu skutečných nahrávek.

Test výkonu používá tři soubory po 8 MiB (24 MiB skutečných dat) na místním filesystému: počítá provedené hashovací průchody a měří časy obnovy a vybraného potvrzení. Očekává 3 kontroly pro celou obnovu a pouze 1 pro konkrétní potvrzení. Reálný Native Save stále provádí lineární audit dokončených médií pod společným I/O lockem; výkon mnoha GB nebo odezva telefonu **nejsou** tímto hostitelským měřením prokázané. Android/hardlink/fsync/ENOSPC/power loss/SAF/Drive/Bosch jsou NOT RUN.

## Kombinace a vlastní kontrola

Nativní testy ověřují dvě zdravé položky + neznámou evidenci, opakovanou obnovu i export přes skutečný MainActivity callback a resolver s registrovaným syntetickým výstupním streamem. Dále kombinují poškozenou evidenci, aktivní chybu zápisu, nečitelný journal adresář, duplicitní tokeny, změnu hashe jedné položky, chybějící/unsafe zdroj, chybu cíle/close, koš, skutečný uložený projekt, CAS a opakovaný pokus. Porovnávají originální i exportované bajty, délku a SHA, nikoli jen návratovou hodnotu.

Chromium kliká na samostatné kopírovací akce a kontroluje varování, nepovolené připojení v karanténě, Cancel/failed Save/reload, Save/Back/Undo/Redo a správnost uloženého JSON. Native je ve všech těchto scénářích výslovně model; skutečné soubory a Native callback pokrývá Robolectric.

Autorská kontrola prošla nově přidané větve nezávisle na prvním GREEN: per-file výjimky, záložní AtomicFile metadata v karanténě, nebezpečné cesty a poslední finální kopii, duplicitní zdroje, stav po částečném uložení, serializovanou historii, explicitní potvrzení, stream a uzavření výstupu, frontendové hlášení a opakované rehashování. Opravy nevytvářejí GC, nepřepisují média ani starším JSON nevracejí novější projekt. Fyzicky ztracené nebo cizím zápisem změněné bajty nelze rekonstruovat hardlinkem; žádná taková záruka se netvrdí.

Povinná závěrečná brána po posledním commitu: celý Java/Robolectric soubor testů, ruční ochranný KEEP test, skutečné Node/Python testy a dotčené Chromium suites. Přesné finální SHA, počty, logy a výkonnostní údaje se zapisují do PR #107 a odkazují z #42 až po běhu. Starší PASS jiného SHA nenahrazuje tuto bránu. Další nezávislou kontrolu provádí **Chat 40**; žádný merge/APK není schválený. Známé dokumentační integrační kolize s main/#110 se v cizích větvích neřeší.
