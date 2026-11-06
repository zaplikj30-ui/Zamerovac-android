# Jádro protokolu a záloh v2 – izolovaný checkpoint #38/#40

`sync/protocol-v2.js` je skutečný testovatelný kód pro další integraci, **není načtený aplikací a nenahrazuje dosavadní SyncEngine**. Žádné rádiové spojení, TLS párování, Google Drive API/OAuth ani historie záloh v UI tím nevznikají. Používá a zachovává dřívější `revision-vector.js`.

## Implementované rozhraní

- Kanonický UTF-8 JSON, revizní vektory a kauzální porovnání záznamů. Souběžné změny i stejné revize s jiným obsahem uchovají obě přesné hodnoty; konflikt má stabilní hashové ID. Žádné rozhodování podle hodin telefonu nebo převádění textových rozměrů na float.
- `PersistentQueue(storage, sha256)` má trvalé operace s unikátním ID odvozeným od peer/kind/hash. Úložiště musí poskytovat **atomický durable compare-and-swap** `readQueue`/`compareAndSwapQueue`; není dovoleno použít obyčejný nechráněný read+write. Testovací souborový adaptér simuluje jediného zapisovatele, není hotovým Android adaptérem ani ověřením více OS procesů.
- `flush(routes, policy)`: přímé nearby/LAN před Drive; velká média na měřeném či neznámém připojení čekají, pokud není explicitní jednorázové povolení. Při výpadku zkouší další dostupnou cestu, potvrzené operace neopakuje. Nepotvrzené mají backoff a zůstávají po restartu. Odstranění z fronty vyžaduje odpovídající ID/hash/velikost a `committed`.
- `createBackup` používá oddělený namespace `backups/v2/blobs/<sha256>` a `backups/v2/devices/<device UUID>/<backup UUID>.json`. Stejné bajty sdílejí neměnný blob i mezi zařízeními. Nový historický bod se publikuje až po zpětném ověření všech bloků. Žádné mazání/GC ani vazba na živý sync namespace.
- `restoreBackup` znovu ověří všechny hashe, velikosti, identitu manifestu a úplnost odkazů. Vrací ověřený obsah; **nepřepisuje aktivní databázi**. Napojení na bezpečnou kopii přes import/rollback a finální CAS teprve zbývá.

Transportní atributy `authenticated/encrypted/peers` jsou požadavkem na adaptér, **ne provedené kryptografické ověření**. Test s `encrypted:false` dokazuje pouze politiku fronty. Nativní adaptér musí autentizaci skutečně doložit ověřenou TLS relací a schválenou identitou; hodnoty nesmí převzít z cizího JSON. Hash sám neověřuje autora. Žádné vlastní šifrovací algoritmy ani tajné klíče nejsou v tomto modulu.

## Skutečné testy

`tests/sync_protocol_v2.js` pracuje jen se syntetickými soubory v dočasném adresáři:

- 30 souborů, 18 potvrzených modelovým direct adaptérem, výpadek v půlce 19., zbývajících 12 přes modelový Drive adaptér. Kontrola všech výsledných bajtů/hashů a odstranění částečné podoby. **Bez síťového přenosu a skutečného Drive.**
- Znovuotevření fronty z disku, ztracené potvrzení, idempotentní příjem, odmítnuté/nesprávné potvrzení, měřená síť, nepovolený transport a chyba zápisu fronty.
- Dva heterogenní modeloví klienti se souběžnými přesnými hodnotami, obrácené pořadí merge, opakování, souběžné smazání.
- Dvě samostatné historie / 100 společných originálů: 101 bloků včetně datového JSON, změna jednoho média přidá jediný blok, stará i nová obnova mají správné bajty. Chyba úložiště a poškozený nový blok nepoškodí starý bod.

## Konkrétní nutná návaznost

1. Doplnit nativní identitu instalace, atomické trvalé úložiště fronty a **kauzální tombstones pro vysypaný koš**. Současný v2 model řeší `deleted` záznamy, ještě ne plné vysypání koše.
2. Napojit revizní vektory na každou skutečnou editaci, detail, hlasovou přílohu, import, mazání a obnovu, ne pouze volání modulu v testu.
3. Implementovat a testovat obecný Android LAN a bezrouterový Wi-Fi Direct/Nearby transport, autentizované párování, odebrání důvěry, oprávnění a fallback při nepodpoře. Přímá cesta nesmí vyžadovat Google účet ani internet.
4. Google Drive adaptér musí používat oficiální oprávnění/OAuth s minimálními scopes (pokud SAF nestačí). V tomto prostředí není ověřená OAuth klientská konfigurace ani přístup k účtu aplikace; neslibovat hotovou integraci. Nahradit sdílený mutable `projects.json` neměnnými ověřenými revizemi.
5. Samostatný backup adaptér/UI s výběrem složky odděleným od sync, přehledem historií/prostoru a bezpečnou obnovou jako nové kopie. Automatická frekvence nebyla schválena, nezapínat ji potají.
6. Doplnit pravdivé počty čekajících médií a konfliktů, plánování Android/Doze, všechny přechody cest. Ověřit na fyzickém telefonu/tabletu a následně dalších značkách. Windows/iOS aplikace nevytvářet.

Nejedná se o ukončení celého #39. Tato hranice záměrně zabraňuje předčasnému zapnutí nehotového transportu či záloh v aplikaci.

## Navazující nativní checkpoint

Identita je v `Context.getNoBackupFilesDir()` a nepřenáší se systémovou zálohou do jiného zařízení. Aplikace už má `DeviceIdentity`, `CausalClock`, `SyncQueueStore` a příslušné Native metody. Skutečné změny vedou volitelná `syncClock` a `syncProtocol:2`; koš vede `syncTombstones` s vektory bez smazaného obsahu. Tato pole mají stejný význam v otevřeném JSON pro budoucí klienty. Nativní starší SAF merge využívá vektory, ale sdílený mutable vzdálený soubor ani celý transportní protokol tím vyřešený není. Samostatný `protocol-v2.js` stále není načtený Androidem; je třeba sjednotit jeho koordinátor, kanonické zprávy/ID konfliktů a nativní provoz, včetně importu všech médií. Nativní queue store je dostupný a testovaný odděleně, zatím není frontou používanou skutečným síťovým přenosem. Platné nové kroky jsou napojení koordinátoru/transportů/UI a fyzické testy, ne opakování vytvoření již existujících tříd.
