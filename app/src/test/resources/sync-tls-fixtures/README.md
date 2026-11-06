# Syntetické TLS klíče pouze pro automatické testy

Tyto PKCS#12 soubory v Base64 mají záměrně veřejné testovací heslo `synthetic` a nepatří žádnému uživateli. Obsahují tři různé samopodepsané P-256/SHA-256 certifikáty pro pozitivní a útočné JVM TLS testy. Jsou v `src/test/resources`, nikoli v prostředcích APK. Produkční implementace používá soukromý klíč vytvořený Android Keystore; nikdy nenačítá tyto fixture.
