# QA-107-06 – výběr a ověření skutečného originálu

Rozsah: jediný P1 nález [Chatu 40](https://github.com/zaplikj30-ui/Zamerovac-android/pull/107#pullrequestreview-5874493305), [rozhodnutí Koordinátora 16](https://github.com/zaplikj30-ui/Zamerovac-android/issues/42#issuecomment-6823789817). Před změnou ověřen čistý HEAD `65cc0f0c8733bb706cfeefc33664e09733f17eaa`, main `cf7807905f77f6fd8478c137b1b41aca6ebc3275`, původní PR base `c604860db4fddeefc077e27411bc1941815f7d94` a výhradní autorství této větve. Bez merge, APK/release, Actions, GC, změn #88, HOME QA a větví #110/#114/#115.

## Prokázaný RED

Na nezměněné produkci výchozího SHA byly přidány čtyři cílené negativní testy. Gradle/JDK17/Robolectric sdk35 skutečně vykonal **8 testů: 4 staré kontroly PASS a 4 nové případy FAIL**. Nešlo o obecný audit.

Fixture dokončí ONE `[0,1,2,3,4,5,20,40,80,255]`, ponechá finální soubor a odpojí pouze jméno dočasného hardlinku. Pod týmž dočasným názvem vytvoří regulérní OTHER `[9,8,7,6,5,4,3,2,1,0]`. Oba mají 10 bajtů, různá inode a různý SHA. Journal zůstává platný s původním SHA ONE.

- ONE: `86d5b35cddd2c4be8c0ba478afe72ab809717878b5bce1d8e9865f5cb3f7d50a`.
- OTHER: `1959a09799845921af3fe113de1463718c32f451d9641b8b92c2bfdd687e59ec`.
- Původní `copyOriginal(UUID)` úspěšně vrátil/exportoval **OTHER**. Test zaznamenal skutečný exportní hash OTHER proti očekávanému ONE; Native callback dal rovněž jiné bajty. Další dva nové testy prokázaly chybějící oddělené akce a selhání kombinace unknown evidence / failed Save / CAS / zdravý soused.

## Oprava

1. Inventory rozpozná různé regulérní inode v rezervaci a finálu, i když názvy a velikosti souhlasí. Takový stav pozastaví automatické opravy a potvrzení bound; nic se nepřepisuje ani nemaže.
2. Exportní plán známého dokončeného UUID vybírá **obsah odpovídající potvrzené délce a SHA v journalu**. Nejprve zkusí platný finál, poté platnou rezervaci. Samotná existence, název nebo velikost nestačí. Pokud ani jedna kopie neodpovídá, ověřený export selže před otevřením cíle.
3. Recovery nabízí ověřený originál a fyzicky odlišný podezřelý soubor odděleně. Finál potlačí pouze tehdy, když už jsou skutečně nabízeny jeho bajty/inode, nikoli jen stejně pojmenované ID jiné rezervace. Explicitní `source-`/`legacy-` záchranná akce neznamená potvrzení původního obsahu.
4. Kopírovací stream má očekávaný SHA/velikost připnuté z vybraného journalu a před úspěchem je porovná i se **skutečně přenesenými bajty**. Kontrola identity/mtime zůstává zachována; není náhradou SHA. Write/flush/close failure nepovolí úspěšnou odpověď ani destruktivní rollback.
5. Native předá UI příznak skutečného ověření. Podezřelá kopie má samostatné označení/tlačítko a hlášení o ruční kontrole; nemůže hlásit potvrzený originál nebo bound. Nové texty jsou v i18n a offline nápovědě. Schválené vykreslování/editor a projektový datový formát se nemění.

## Cílené testy a kritická kontrola

Sedm nových nativních scénářů kontroluje přímý export a skutečný MainActivity callback, oddělené UI tokeny, souběh s unknown journalem, failed Save a novějším CAS snapshotem, další zdravou nahrávku, opakovanou obnovu a nedotčenost journalu i obou původních souborů. Native výstup se porovnává bajtově, délkou a explicitně počítaným SHA; kontroluje se i předaný `exported(true/false)`.

Při vlastní kritické kontrole nových větví byly doplněny přímo související varianty:

- Opačný nesoulad: platná rezervace ONE, odlišný finál OTHER – obě kopie zůstávají dostupné, jen ONE lze potvrdit proti journalu.
- Ani jedna kopie neodpovídá SHA – ověřený UUID nesmí otevřít cíl ani potvrdit úspěch, obě raw kopie lze zachránit jako nejisté.
- Změna souboru během čtení se zachovaným inode, délkou i mtime – skutečný exportní SHA musí selhat; samotné atributy by chybu neodhalily. Změnu způsobuje testovací injekce, nikoli aplikace; nelze tím slibovat obnovu fyzicky přepsaných bajtů.

Původní čtrnáctipřípadová sada izolace, AtomicFile/KEEP/prefs/CAS, koš, původní fotografie a přesné hodnoty zůstávají regresní bránou. Chromium kliká na oddělené akce a kontroluje pravdivé hlášení; jeho Native je výslovně model. Robolectric používá skutečné privátní soubory a Native callback s registrovaným výstupním resolver streamem, nikoli fyzický Android/SAF poskytovatel.

Finální výsledky se po posledním commitu ověřují na přesném novém SHA a zaznamenají do PR #107 a #42 včetně RED/GREEN logů a XML. Starý PASS jiného SHA není důkaz této opravy. Další nezávislé review provádí Chat 40. Fyzický Android/MediaRecorder/SAF, platformní hardlink/fsync/fileKey, skutečný ENOSPC/power loss a výkon velkých kolekcí zůstávají NOT RUN; tato etapa nemění zálohy ani synchronizaci nepřipojeného audia.
