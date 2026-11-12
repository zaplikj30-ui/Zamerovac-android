# Synchronizační jádro B – implementace a předání

Stav: DRAFT, bez merge, HOME Actions, APK a release. Autoritou pracovních dat zůstává `LocalDatabase`/CAS, schema1 a přesné pracovní soubory. Toto není potvrzení provozní bezpečnosti na Androidu.

## Integrační základ

- Aktuální main při zahájení a opakované kontrole: `cf7807905f77f6fd8478c137b1b41aca6ebc3275`.
- Cíleně převzat aplikační/testový řetězec #86/#87/#88/#100/#101/#102, koncový zdroj `144bb5573932be032411c11451aa560a10f623ee`. Zachována novější infrastruktura a dokumentace main; žádné převzetí starých workflow.
- Aplikační a testové návaznosti audia #107 `46cd4afe07af9a7cf731552e658c021d4726103a` jsou spojeny ve vlastní větvi. V kolizích zůstává přísné `readForCas`, potvrzené Save a P1 ochrana všech originálů. Audio rozšiřuje zachování dokončené nahrávky a původní export.
- #115 `3eed2d9ffe4f38b45c6b6c59dc4c6fba918baaef` zůstává samostatné. Žádný zápis do cizí větve. Vlastní větev: `implement/sync-core-b-20261112`.

## Implementované hranice

`SyncLedger` je malá SQLite evidence bez nové knihovní závislosti. Tabulky evidují původní doklady, frontu a její index, revize a mediální reference, jednotlivé cíle, doklady přenosu a rozpracované uploady. Nikdy nepromuje archiv do pracovní databáze a neuvolňuje P1 piny. Výchozí SQLite corruption handler je nahrazen odmítnutím bez smazání databáze. Ztráta aktivní evidence nevyvolá import zastaralého JSON ani reset schématu.

Migrace fronty: trvalý PREPARED doklad → kopie a hash původního JSON včetně `.bak/.new` → kontrola nezměněných zdrojů → jedna SQLite transakce a aktivace → ACTIVE doklad. SQL commit je přesná hranice autority; po pádu mezi commitem a dokladem se ověří již existující evidence. Původní soubory zůstávají na místě jako důkazy. `SyncQueueStore` zachovává potvrzený JSON/CAS kontrakt mostu, ale jediným zapisovatelem fronty je SQL. CloudInbox/CloudScan/CloudPublications přecházejí obdobně přes vlastní existující zámky; staré soubory se nepřepisují. Párování, TLS klíče, CAS a schválený `ProtectedRevisions` zůstávají samostatnými bezpečnostními autoritami.

Cíl zahrnuje poskytovatele, oddělený účet/namespace, peer a identitu párování/obnovy. Staré potvrzení jiné složky, účtu, TLS transportu nebo recovery epochy nezakládá dokončení nového cíle. `transport-ack` je doklad dřívějšího přijetí, nikoli tvrzení o dnešním zdraví druhé DB nebo o záloze. SQLite transakce není společnou transakcí s providerem.

`SyncStorageAdapter` navazuje na `ImmutableStore`/`SyncStore`/`BackupStore`. Schopnosti nejsou univerzální: SAF nemá zaručené atomické zveřejnění ani byte-resume. Produkční trasy zůstávají Drive REST v3, vhodný SAF a autorizovaný TLS peer. Další cloudy ani vlastní server nejsou zavedeny. Provider-neutral evidence přijímá další stabilní identifikátor adapteru bez změny protokolu evidence; endpointy a přihlašování ověřuje konkrétní adaptér.

Drive používá persistentní oficiální resumable relaci. Před dalším content bajtem uloží relaci a identitu celého zdroje, po restartu dotazuje server `Content-Range: bytes */size`, nevěří uloženému offsetu. Ztracená finální odpověď a vypršení relace se rekoncilují s fyzickými objekty a jejich skutečnými SHA/velikostí. Duplicity se nemažou. Metadata odpovědi HTTP 2xx sama nestačí: dokončení vyžaduje read-back skutečných bajtů. Relace zůstávají v no_backup; přenosná evidence je neobsahuje. HTTPS allowlist a zákaz redirectů zůstává v DriveHttp. Síť a oprávnění se kontrolují mezi chunky.

Aktuální zakázky a pomocné obnovitelné podklady mají oddělené zprávy. Velká historie proto nezablokuje malý tombstone/kótu. Druhá fronta je součást téhož outboxu/evidence a téhož P1 kontraktu, nikoli druhá retence. Pomocná zpráva odkazuje na samostatně streamované, hashované soubory přesného historického JSON a na dokončené nepřipojené audio, nepřipojuje je jako vymyšlené záznamy. Přijímač je zachová v P1 bez přepsání novější pracovní DB. Aktivní a neověřené nahrávky se nepředávají jako dokončené. Nejistota dokončeného audia zůstává explicitní chybou pomocného obsahu; zdravá aktuální zpráva může pokračovat.

Aktuální zpráva zachovává manifest v2. Obnovitelný obsah používá malé rozšíření v3, `recoveryOnly` a `contentEncoding: identity-v1`. TLS hello v2 vyjedná schopnost `snapshotVersion`; starší peer dostává aktuální v2 zprávy a nezvládnutá historie zůstává pending. Nový parser stále přijímá původní v2. Starší cloudový klient může v3 odmítnout a po aktualizaci jej zpracovat; nelze jej vydávat za potvrzené přijetí historie. Samotné E2EE není implementováno.

Velikosti médií a ZIP rozpočty jsou long v přesném celočíselném rozsahu JSON. Původní 2GiB strop není produktovým limitem. Jeden pracovní JSON zůstává omezený (20 MiB), manifest má omezený počet položek. Historie se do manifestu nevkládá jako rostoucí vnořený JSON: samostatné revizní bloby se ověřují a obnovují jednotlivě. Přenosy a ZIP používají streamy; nemožná velikost, nedostatek místa a neověřitelný hash končí chybou. `SyncNetworkPolicy` zachovává dosavadní konzervativní 1MiB allowance jako interní rozpočet pokusu na měřené síti, nikoli nově schválený uživatelský limit. Čekající data se nemažou. Měřený hotspot nemá výjimku jen kvůli Wi-Fi typu. Funkční JobScheduler zůstává plánovačem; synchronizační protokol a trvalá fronta na něm nezávisí.

Záchranný archiv zahrnuje konzistentní přenositelný SQL index bez upload session, jednotlivé samostatné soubory dokumentů/revizí/původních dokladů a nové audio doklady. Nevytváří jeden rostoucí JSON všech revizí. Velké SQLite TEXT/BLOB se čtou po 64KiB částech, aby nepřekročily malý Android CursorWindow; dokumenty zůstávají omezené limitem metadat. Po kopírování znovu ověří celé zdroje. Rozpracované audio je explicitně nepotvrzený podklad, nikdy důkaz dokončené zálohy. Projektový ZIP, historie, Undo/Redo, původní fotografie a geometrie zůstávají ve stávajících formátech; sync nic nepřekóduje.

## Průběžné testy a skutečné příčiny oprav

Managed Linux/JDK17/Gradle8.10.2/Android SDK35/Robolectric4.16.1, syntetické soubory, HTTP doubles a loopback TLS. Žádné Actions ani HOME běhy.

- Převzatá ochrana: cílená kompilace a testy P1/koše/archivu PASS.
- Audio: první integrační běh odhalil starou přípravu fixture před prvním DB commitem a vkládání poškozené historie přes nový přísný writer. Scénáře nyní inicializují autoritu jako aplikace; poškozený legacy stav se v negativních testech vkládá přímou fault injekcí. Ochranné aserce bajtů/Save/CAS zůstaly.
- Cílená společná sada před posledním rozšířením: 111 metod, 109 PASS, 2 FAIL, 0 SKIP. Oba FAIL jsou zachované přísné staged/direct diagnostiky #88, ne zelený celý Gradle běh. Nová funkčnost vyžaduje závěrečné testy konkrétního commit SHA; průběžné běhy nad rozpracovaným stromem je nenahrazují.
- ZIP 3 GiB: skutečný stream a zpětné čtení/SHA PASS. Drive resumable: simulovaný restart, server Range, ztracená odpověď, vypršení relace, duplicity, HTTP401/403/429/5xx a odmítnutí neověřených serverových bajtů PASS v cíleném běhu. Nejde o živý Drive.
- AtomicFile write-fault fixtures pro přestěhované indexy nahrazují skutečné SQLite ABORT triggery. Aserce neúspěšného zápisu, nezměněného stavu i opakovaného čtení zůstávají.
- První úplný běh používal debug variantu a odhalil i dva registrační FAIL určené pro preview. Závěrečná regrese používá `testPreviewUnitTest`; registrační aserce se neoslabují.

Konečný HEAD, součty, PASS/FAIL/SKIP/NOT RUN a odkazy na uložené důkazy jsou v [draft PR #116](https://github.com/zaplikj30-ui/Zamerovac-android/pull/116). Historické podklady #100 v `docs/qa/p1-*` jsou důkazy jejich tehdejších SHA, ne nového integračního HEAD.

## Omezení a povinné brány

- Nezávislý Kontrolor 40 musí zkontrolovat celý integrační diff, migrační hranici, dodatečný obsah v3, stale ACK/epoch, endpointy a finální testy. Vlastní revize autora nenahrazuje jeho kontrolu.
- HOME Windows, fyzický Android/OEM/SAF/mikrofon/TLS dvou zařízení, živý Drive/OAuth/kvóty a skutečný power-cut/disk-full: NOT RUN. ENOSPC a crash testy jsou injekce v Linux/JVM.
- Výkon velkých kolekcí a růst P1 historie vyžadují měření. Metadata-only Save může znovu použít již hashované immutable médium pouze se shodnou inode identitou a jemným unix ctime, nikoli jen size/mtime. Bez podpory silného změnového dokladu se celý soubor znovu hashuje. Cache je procesní/omezená; ingest a skutečný přenos stále ověřují celé bajty. Android výkon a podpora konkrétního FS zůstávají NOT RUN. P1 registry nejsou nahrazeny druhou retenční autoritou. Manifest nad bezpečný počet položek zůstane explicitně pending/error. Automatické GC, migrace cloudů v UI, multi-cloud, další provider, server a E2EE nejsou implementované.
- Obě diagnostiky #88 nelze označit za společný atomický DB/cloud commit. Zelený bezpečnostní výsledek musí prokázat zachování a načtení přesných podkladů i při takovém pozdním ACK. Bez nezávislé revize a následné povolené QA nelze systém prohlásit za bezpečně hotový nebo integrovat/vydat.


## Závěrečný ověřený checkpoint

Úplná Preview JVM regrese na `cd0e57aa694b5e09dbb3048e75a2e5b5fca7ed5b`: **478 metod / 476 PASS / 2 FAIL / 0 ERROR / 0 SKIP**, 59 JUnit XML. Oba FAIL jsou nezměněné přísné diagnostiky #88 (Drive staged a SAF direct), každý dokládá jeden uniklý podepsaný ACK. Celý Gradle běh je **FAIL**, nikoli zelená akceptace celého systému. Pozitivní testy zachování původních dat, migrace, SQLite chyb, nezávislých cílů, médií, historie a audia jsou PASS.

Dodatečný skutečný **3GiB loopback TLS s přerušením v polovině a opakováním PASS** na `37fdc6bbb98d9dc62b46b4e81ebaaa513c3875fd`: SHA-256 `3474c4187dcbba2df7538da8a9377a0272da698a0048328a54451b80734742d5`, opakovaný přijímač přečetl 3 221 227 886 aplikačních bajtů včetně řídicích rámců, celý soubor 3 221 225 472 bajtů; JVM heap 536 870 912 bajtů. Kontrolovány původní kóta, jednotka, editovatelné body geometrie a sousední soubor. Jde o syntetický binární podklad, nikoli test přehrávání kamery nebo rádia.

Simulovaná vyjednaná legacy schopnost přes skutečné TLS **1 PASS** na `5cfcff94ffe4ac96d47c5e186f49de8f15e6b9f8`: aktuální v2 revize se po rekonciliaci přenesou, nepodporovaná v3 historie zůstává trvale pending. Nejde o fyzicky instalovanou starou APK.

Rychlý runner na `cd0e57aa694b5e09dbb3048e75a2e5b5fca7ed5b`: **87 PASS / 0 FAIL / 0 SKIP**. Jeho čtyři režimové NOT RUN jsou v důkazu rozlišeny; nativní a browserové běhy mají samostatné skutečné výsledky, fyzický Samsung a APK zůstávají NOT RUN.

Chromium: **23 sad / 90 scénářů PASS**, bez FAIL, na `949ca510cf8f79bdc7fd41d49f6b6a9422a5f377`; testované webové assets jsou bitově identické s finálním zdrojem. Doplňková sada Drive/UI má **4 PASS** na `362fc0dc730e1e1cea5182e12d1a89d4304f3b60`, včetně nového oddělení lokálního Save, čekajícího TLS cíle, cloudového ACK a chybějícího/poškozeného historického obsahu. Native v browseru je výslovný model; skutečný most a soubory se ověřují Robolectric testy.

Produkční strom `app/src/main` všech uvedených finálních nativních a dodatečných TLS běhů je shodný: `eb49c58ae57712b3528b47709e0eb7ca8db12ccd`. Po úplné regresi přibyly dvě samostatně spuštěné testovací třídy a důkazy/dokumentace, ne změna aplikace. Původní diagnostický helper a obě #88 metody byly porovnány s #102 beze změny.

**Důkazy:** [strojový report se SHA, součty a třídami](qa/sync-core-b/results.json), [celý finální JVM log](qa/sync-core-b/native.log), [3GiB TLS XML](qa/sync-core-b/large-tls.xml), [legacy XML](qa/sync-core-b/legacy.xml), [rychlý log](qa/sync-core-b/quick.log), [browser log](qa/sync-core-b/browser.log), [cílený browser log](qa/sync-core-b/targeted-browser.log).

**Předání Kontrolorovi 40: připravené ke SOURCE review, INTEGRATION/RELEASE HOLD.** Nezávislá revize, HOME Windows a fyzický Android/živý Drive jsou NOT RUN. Automatická obnova autority po poškození DB, další cloudy, server, E2EE a uvolnění P1 pinů nebyly přidány. Práce není prohlášena za bezpečně vydaný produkt.
