# Synchronizace B po REQUEST FIX: #88 BLOCKED

Navazuje na [review Kontrolora 40](https://github.com/zaplikj30-ui/Zamerovac-android/pull/116#pullrequestreview-5880046227) a [rozhodnutí koordinace](https://github.com/zaplikj30-ui/Zamerovac-android/issues/42#issuecomment-6833084810). Výchozí HEAD je `e4e17bca28a31651cb05e4625cb7eb36ecc5685b`, base main `cf7807905f77f6fd8478c137b1b41aca6ebc3275`. Pokračování probíhá pouze ve větvi draft PR #116. Finální přesný HEAD a běhy jsou v PR a připojených důkazech. Žádný merge, APK, Actions ani HOME.

## Výsledek rozhodovací brány

**#88 zůstává BLOCKED.** Nulové zveřejnění platně podepsaného ACK při ztrátě lokální autority uvnitř nespolupracujícího `OutputStream.write` nebo `PendingOutput.publish` nelze zaručit dnešním rozhraním Drive/SAF. Navíc je prokázané nepravdivé vyřazení aktivního přenosového záměru. Ani skutečnost, že P1 zachovává přesné podklady, tento kontrakt neopravuje. Nezávislé REQUEST FIX trvá; práce není způsobilá k integraci nebo vydání.

Původní `SafSyncV2Test`, včetně obou #88 metod, jejich providerové injekce a helperu, zůstává celý beze změny proti výchozímu HEAD. Nepřidávají se Ignore/Assume/SKIP, další předstíraný CAS fence, mazání ACK po zveřejnění ani přejmenování/verzování ACK jen proto, aby jej původní test přestal počítat.

## Ověřená příčina a celý tok

1. `PeerDataStore.apply` ověří média, ochrání přesný původní snímek v P1 a přes CAS zapíše sloučená pracovní data. `CloudInbox.committed` uloží místní příjem; jeho recovery epocha je pouze lokální.
2. `SafSyncV2.receive` vytvoří podpis a `GuardedSyncStore` kontroluje lokální CAS před providerovým `write`/`publish`. V tom okamžiku má poskytovatel již všechny bajty platného podpisu.
3. Uvnitř tohoto volání může poskytovatel nejprve poškodit primární DB a potom dokončit publikaci. Právě to dělá nezměněná staged/direct injekce #88. SQLite transakce, DB mutex ani nový lokální CAS poskytovateli neodeberou už předané bajty. Lokální aplikační mutex také nezabraňuje chybě disku nebo pádu procesu.
4. Kontrola po návratu může zjistit ztrátu autority, ale nezabrání dřívějšímu přečtení ACK druhým zařízením. Dodatečné delete/revocation může selhat a při zastaralém seznamu nezaručuje odvolání již přečteného podpisu. Rozdělení podpisu na části pouze přesune závod do posledního providerového volání.
5. `CloudProof.ACK` v2 obsahuje author/recipient/hash/size/committed, nikoli výzvu odesílatele nebo epochu a checkpoint příjemce. `SafSyncV2.send` přijme historický podpis, pokud dosud nepozoroval recovery protistrany. `PeerOutbox.completed` odebere aktivní metadata i blob jobs, nastaví `lastAck` a SQL `transport-ack`. P1 a SQL revize přetrvají, avšak aktivní záměr byl vyřazen bez znalosti současné zdravé DB příjemce.
6. `SyncPeerRegistry.recovered` správně blokuje staré cloud ACK po autentizovaném pozorování recovery; bariéra přežije restart a přepárování. Bez spojení s poškozeným/offline příjemcem ale odesílatel nemá jak zjistit jeho nepozorovanou ztrátu autority. Současné TLS má potvrzení v autentizované relaci a oznamuje recovery epochu v batch; ani živá relace nezaručí budoucí zdraví disku po potvrzení.

Formální protipříklad: při stejné pozorované historii do poslední lokální kontroly `L` existují dvě providerové operace `P`. První zveřejní přijatý platný podpis; druhá uvnitř `P` nejprve zničí lokální autoritu `F`, pak zveřejní stejné bajty. Volající do návratu nerozliší jejich průběh. Žádná lokální kontrola před `P` tedy nezaručí zákaz publikace v druhém průběhu. Ani nový nonce nebo recovery epoch v podpisu tento fyzikální limit neodstraní; pomohou pouze s opakováním a významem důkazu.

## Bezpečný navržený end-to-end kontrakt

Toto je konkrétní návrh k posouzení Kontrolorem 40 a koordinací, **nikoli implementovaná nebo ověřená funkce**. Nepřidává nový server ani jiný cloud. Zachovává pracovní schema1, P1, identity a streamovaný obsah.

| Stav cíle/revize | Doklad a povolený účinek |
|---|---|
| waiting / transferring | Trvalý záměr a původní sourceRef; lokální data zůstávají nezávislá. |
| transport-receipt | Platný starý nebo nový transportní ACK. Smí potlačit zbytečné opakování stejného uploadu, ale nesmí znamenat zdravou současnou DB nebo definitivně odstranit obnovitelný záměr. |
| awaiting-reconciliation | Trvalá unikátní výzva pro konkrétní target/namespace/account, peer fingerprint a párování, zdrojovou epochu, hash/velikost revize a manifest médií. Výzva vzniká před publikací a přežije restart. |
| verified-at-checkpoint | Odpověď spárovaného příjemce na přesně tuto výzvu, s jeho recovery epochou, monotónním checkpointem, hashem skutečné durable DB a ověřením příloh. Jde o historické pozorování v uvedeném checkpointu, nikoli trvalé „zdravý nyní“. |
| unknown / recovery / conflict / error | Neaktuální nebo neověřitelný důkaz. Původní záměr, preimages a média zůstávají, bez automatického rollbacku či obnovy DB. |

Příjemce před odpovědí ověří primární autoritu, přesné bajty potřebného obsahu a kauzální pokrytí požadované revize. Novější data nesmí být nahrazena staršími; konfliktní revize zůstávají v dosavadním modelu. Svůj checkpoint/výzvu zapisuje do durable inboxu před odesláním podpisu. Ani tento podpis ale není atomický s cloudem: může uniknout při pozdější ztrátě DB a stále znamená pouze dřívější ověření.

Odesílatel uchová samostatný obnovitelný záměr v SQL po jednotlivých cílech i po utichnutí aktivního uploadu. Přechod na transportní doklad a útlum aktivní práce musí být jednou SQL transakcí; žádné uvolnění P1 pinů. Restart, nové připojení, jiná epocha, změna cíle nebo nesoulad obsahu zahájí novou výzvu a podle potřeby znovu připraví přenos z ověřeného sourceRef. Duplikát se stejnou identitou je idempotentní; cizí, starý nebo nevyžádaný doklad nesmí změnit nový stav. Žádná odpověď nebo odpojené zařízení znamená neznámý stav, nikoli dokončenou druhou pracovní kopii.

Staré v2 ACK se přijímají pouze jako historické transportní doklady. Starý klient bez podpory reconciliation nemůže dodat nový checkpoint; stav zůstane explicitně neověřený bez nekonečného opakování velkých bajtů. Stejné rozlišení platí pro TLS, cloud i UI. Ověřený blob na Drivu je důkaz cloudových bajtů, nikoli lokální DB druhého zařízení; záloha má nadále vlastní úplné ověření a možnost obnovy.

**Nutné rozhodnutí:** nahradit nemožný univerzální požadavek „žádný podepsaný ACK při libovolném faultu uvnitř externího volání“ tímto měřitelným stavovým kontraktem a jeho novými akceptačními testy, nebo požadovat jinou, spolupracující důvěryhodnou infrastrukturu. Samotný nonce/2PC název není záruka zdraví disku. Původní RED diagnostiky musejí zůstat jako důkaz limitu. Do takového rozhodnutí se ACK protokol nepřepisuje naslepo a bezpečnostní brána zůstává BLOCKED.

## Další nalezené a opravené chyby v rozsahu B

**Konzistence migrace:** `SyncLedger` porovnával pouze soubory nalezené při kopírování. Fronta nebo `.bak/.new` vzniklá během kopírování mohla být ignorována a SQL převzalo prázdný či jiný stav. Kontrola nyní porovnává úplnou sadu včetně absence; změna zruší transakci, všechny původní bajty zůstávají a restart zopakuje import. Stejný postup používá lazy migrace inbox/scan/publications. Zjištění, zda byl dokument již migrován, je uvnitř writer transakce, takže další SQL connection nepřekryje aktivní dokument starým souborem.

**Konzistence recovery snímku:** `PeerSnapshot.capture` četl JSON před skenováním a recovery epochu až po něm. Souběžný Save nebo obnova mohl starému JSON přiřadit novou epochu. Na začátku se společně čtou přesný JSON, generace a epocha; po přípravě se všechny tři ověří pod místním DB zámkem. Změna vyvolá pravdivou chybu a nový pokus; nepromuje se stará revize. Porovnání bajtů zachytí také validní vnější výměnu primárního souboru, kterou procesní čítač nezaznamenal. Žádný DB zámek se nedrží při síťovém přenosu.

**Pravdivost inventáře:** `SyncLedger.status` četl malé `content:*` přímo bez hashe, ačkoli ostatní dokumenty hash kontrolují. Semantické poškození `error → none` mohlo skrýt povinnost přenést obsah i při SQLite `quick_check=ok`. Stav teď prochází stejným hashovaným čtením a validací; poškození vede k chybě místo `not-required`.

`SyncConsistencyTest` tyto chyby a restart ověřuje skutečnými soubory/SQLite. Prvních pět nových scénářů bylo před opravou skutečně RED; finální testy doplňují lazy cutover a validní vnější změnu primárního JSON. Produkční změna je pouze v `SyncLedger` a `PeerSnapshot`; nemění CAS, P1 retenční kontrakt, audio, editor, média, workflow ani wire formát.

## Negativní kombinované důkazy

Nové `SyncAckReconciliationTest` pro staged i direct provider:

- Přenesou foto/video/audio bajty, přesnou textovou kótu, jednotku, laserovou hodnotu, editovatelné body a historii; zachovají také dokončené nepřipojené audio.
- Injektují ztrátu primární autority uvnitř providerového volání, duplikují skutečně podepsaný pozdní ACK a znovu vytvoří oba aplikační kontexty, registry, outboxy a klíčové fixture objekty nad stejnými soubory. Nejde o fyzický restart telefonů ani o zabití OS procesu; procesní cache v Robolectric zůstávají.
- Projdou skutečnou cloudovou retire cestu a zachytí chybné vyřazení pracovního záměru. Ověří odmítnutí opakovaného `completed` bez jobu a trvalou bariéru po autentizovaném recovery signálu.
- **Pouze testově simulují hranici výslovné obnovy**, stejně jako dosavadní testy; neexistuje zde implementované produkční povolení automatické obnovy. Pak provedou skutečný TLS retry do novější receiver revize. Původní přesné bajty/P1 i novější revize se zachovají; cloud bariéra se potichu neuvolní.
- Až po všech těchto kontrolách selžou na bezpečnostní aserci, že historický ACK nesměl vyřadit pracovní záměr při ztracené autoritě příjemce. Dva nové RED scénáře se nezaměňují za dvě původní chyby; dokládají jejich end-to-end dopad.

PASS jednotlivých retenčních/obnovovacích kroků není PASS těchto kombinovaných testů. Původní dva #88 a oba nové end-to-end scénáře jsou provozní blokéry.

## Vlastní kontrola a zbývající ověření

Prověřeny návaznosti `SafSyncV2`, `GuardedSyncStore`, `CloudFiles`, `CloudProof`, `CloudInbox`, `CloudPublications`, `PeerOutbox`, `SyncLedger`, `SyncPeerRegistry`, `PeerTransfer`, `PeerDataStore`, `PeerSnapshot`, `SyncRecoveryContent`, `PeerMedia`, Drive resumable a P1/audio. Podpis, providerový read-back, aktuální autorita DB, aktivní upload a obnovitelný záměr mají různé hranice; SQLite nedává atomickou DB/cloud transakci. Další prověřované části se nemění bez prokázaného důvodu. Vlastní kontrola nenahrazuje Kontrolora 40.

Finální úplná Preview JVM/Robolectric, quick a Chromium regrese se zapisuje s konkrétním SHA a úplnými logy do PR #116. HOME Windows, fyzický Android/SAF/OEM/Doze/MediaRecorder a rádio dvou zařízení, živý Drive/OAuth/kvóty, skutečný power-cut/disk-full a produkční schválená obnova jsou NOT RUN. Žádná kompilace nebo model není vydáván za jejich náhradu.

Úplná regrese zdrojového commitu `3326995e934ba7e088e47a35e26cdc40cb2a5dfd`: JVM **485 PASS / 4 FAIL / 0 ERROR / 0 SKIP** z 489 metod a 63 tříd (celý Gradle FAIL), quick **87 PASS / 0 FAIL / 0 SKIP / 4 režimové NOT RUN**, Chromium **23 sad / 91 scénářů PASS**. Sedm nových konzistenčních scénářů PASS; původní dva #88 a dva nové end-to-end ACK scénáře FAIL. Ostatní metody včetně 3GiB TLS/ZIP, konfliktů, dat/P1/audio/Drive/SAF/SQLite jsou PASS. Žádné další selhání v tomto běhu nebylo nalezeno.

[Strojové výsledky a všechny metody](qa/sync-p1-88/results.json), [úplný JUnit XML](qa/sync-p1-88/native-junit.xml), [JVM log](qa/sync-p1-88/native.log), [úplné quick logy](qa/sync-p1-88/quick-full.log), [úplné browser logy](qa/sync-p1-88/browser-full.log), [provenience a limity](qa/sync-p1-88/README.md). Po commitu důkazů se ověřuje znovu skutečný finální HEAD; jeho vlastní logy a výsledek jsou přímo v PR #116 bez dalšího měnění SHA.
