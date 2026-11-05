# Drive API: hranice etapy 29 a další zapojení

DriveHttp/DriveApi jsou skutečný samostatný Java kód, zatím bez připojení k produkčnímu SyncStore/BackupStore/OAuth UI. Nativní testy používají řízené HTTPS odpovědi, ne účet Googlu. Před vydáním tento rozdíl zachovat v PR, nápovědě i historii.

Použité oficiální zdroje (ověřeno 5. 11. 2026):

- [Android AuthorizationClient a registrace package + SHA1](https://developer.android.com/identity/authorization).
- [Drive appDataFolder, scope a omezení](https://developers.google.com/workspace/drive/api/guides/appdata).
- [Drive v3 stránkování](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/list).
- [Create-only resumable upload a Range](https://developers.google.com/workspace/drive/api/guides/manage-uploads).

Zvolená izolovaná API vrstva používá `drive.appdata`, flat objekty `name=sync/v2/...` či `backups/v2/...` a parent `appDataFolder`. Virtuální adresáře musí vytvořit adaptér podle cest. Prostor patří Google účtu/aplikaci Google projektu; neumožňuje sdílení mezi cizími účty a není běžnou viditelnou složkou ani systémovou Android zálohou. Uživatel jej může odstranit přes správu dat aplikace v Disku. Synchronizační podpisy/párování budou nadále povinné; existence ve stejném účtu sama neschválí peer.

HTTP třída povoluje pouze HTTPS www.googleapis.com a konkrétní Drive cesty, blokuje automatické přesměrování a vrací token jen v Authorization hlavičce. Resumable Location musí zůstat na upload endpointu stejného hostu. Token se neukládá do DB, URL, logu ani testovacích artefaktů; 401 zavolá invalidaci právě použitého tokenu. Žádné převzetí tokenu připojeného Drive pluginu. API nevystavuje PATCH/DELETE a upload vytváří nový objekt. Finální potvrzení API není finálním potvrzením zakázky příjemcem.

Gate se kontroluje před požadavky i každými 64KiB čtení/zápisu. Účtuje konzervativní rezervu hlaviček a velikost povoleného čtení/payloadu. Nejde o měření TLS/TCP, skrytého OS provozu nebo účtování operátora. Google odpovědi mají omezenou velikost a seznam se vrátí pouze po všech stránkách; odmítnutý rozpočet nesmí vrátit neúplný seznam jako prázdné úložiště. Na dlouhém seznamu může omezený přenos čekat na neměřené spojení; další integrace nesmí tvrdit okamžitou malou synchronizaci v libovolně velké historii.

Konkrétní následující kroky:

1. Implementovat oddělené DriveSyncStore / DriveBackupStore capability nad sdílenou API hranicí; sync nesmí adresovat backup cestu. Ověřit nejednoznačné stejné názvy, souběžné vytvoření stejného backup blobu, metadata cache a účetní namespace. Sdílené stejné názvy v Drive nejsou automaticky unikátní.
2. Proudový `ImmutableStore.create()` nezná velikost předem. Adaptér potřebuje omezený soukromý staging nebo změnu explicitního size kontraktu; close po chybě nesmí spustit zakázaný velký upload. Ověřit disk full, cancel/direct prioritu a cleanup po systémovém kill. Dosavadní API začíná po chybě novou relaci; byte-range resume po restartu zatím nemá.
3. Napojit Android AuthorizationClient při explicitní volbě Disku, respektovat odmítnutí/odhlášení a expiraci; obnovovat token bez jeho uložení v projektu, neměnit účet potichu. Vyžaduje skutečný Google Cloud projekt, Drive API, OAuth branding/consent a registrovaného Android klienta pro přesný package a podpis SHA1. Tyto údaje ani oprávnění spravovat Cloud Console zde nejsou dostupné. Registrace není nahraditelná připojeným Drive konektorem a do APK nepatří OAuth client secret.
4. Zapojit zvlášť sync a backup UI, JobScheduler a povolené mobilní výjimky, zachovat místní funkčnost bez účtu/GMS. Testovat plný signed snapshot/media/ACK a dvě historie/obnovu přes API adapter se syntetickými odpověďmi; potom skutečný účet a obě Android zařízení.

Etapa nemění aktivní UI, vydanou historii ani český návod. Skutečnou podporu Disku, úplné #38/#40 či fyzickou akceptaci zatím nelze označit jako dokončené. Žádná APK ani merge.
