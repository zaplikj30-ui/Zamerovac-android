# Otevřený zálohovací ZIP v2

Databáze zůstává `schema: 1`. ZIP obsahuje `projects.json` s `archiveFormatVersion: 2`, `media-meta.json`, `media/<id>` a závěrečný `manifest.json`:

```json
{"format":"cz.zamerovac.archive","version":2,"entries":{"projects.json":{"size":123,"sha256":"64 lowercase hex digits"},"media-meta.json":{"size":2,"sha256":"64 lowercase hex digits"},"media/example-id":{"size":4,"sha256":"64 lowercase hex digits"}}}
```

Hash je SHA-256 skutečných nekomprimovaných bajtů každé položky; `size` je počet bajtů. Manifest neobsahuje vlastní hash. Všechny uvedené položky musí mít shodnou velikost i hash. JSON je UTF-8. Řetězcové měřené hodnoty se nikdy nepřevádějí na float; geometrie zůstává oddělená od měření. Vazby `media`, `audioMedia`, `detailItems` a starší `versionHistory[].items` se při obnově přemapují společně.

Import v2 vyžaduje manifest; jeho odstranění při zachování označení v2 není přijato jako starší ZIP. Starší ZIP bez označení a manifestu se přijímá s dosavadní validací referencí a limitů, nikoli s falešným tvrzením o kryptografické integritě. Změna formátu je určená i budoucím Windows/iOS klientům, neobsahuje Android serializované objekty. Toto není síťový synchronizační protokol ani ověření identity autora. Útočník může změnit obsah a přepočítat hashe; pro přenos je nadále nutné autentizované spojení/párování.

Před importem se ověřují také duplicitní položky, reference a limity všech rozbalovaných položek včetně neznámých. Při chybě kopírování se odstraní jen nově přidávané soubory. Pokud následný commit databáze selže, rollback nové přílohy odstraní a původní databázi zachová. Úplnost lokálního disku při fyzickém výpadku napájení není ověřena pouhým Robolectric testem.
