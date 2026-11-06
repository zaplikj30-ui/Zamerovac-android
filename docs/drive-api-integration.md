# Drive API: aktuální zapojení a veřejná registrace preview

Aktuální stav6.11.: [#39/6672377880](https://github.com/zaplikj30-ui/Zamerovac-android/issues/39#issuecomment-6672377880) potvrzuje podle uživatelských obrazovek vytvořený projekt Zamerovac-Android, Drive API Enabled, External/Testing, správný Android preview package/SHA1, jeden testovací účet a uložený jediný scope drive.appdata. Registrace se znovu neprovádí. Výsledné Project ID není v zápisu doložené: zamerovac-android je označené jen jako původně předvyplněný návrh. Přesné veřejné ID bylo vyžádáno, žádná potřeba hesla, e-mailu, JSON credentials nebo secretu. Živá autorizace/sync/history/restore jsou NOT RUN.

## Aktuální sestavovací cesta

- `config/drive-preview.properties` obsahuje pouze veřejné projectId/applicationId/certificateSha1. Prázdné ID bezpečně ponechává Disk disabled; není nahrazeno návrhem ani vymyšleným identifikátorem.
- `gradle/drive-registration.gradle` ověří přesný applicationId a skutečný certifikát použitého preview PKCS12 proti uloženému SHA1. Odmítá neznámá pole a nesouhlasící `-PdriveCloudProject`/`ZAMEROVAC_DRIVE_PROJECT`. Žádné credentials se do konfigurace nepřidávají.
- Pouze registrovaný `preview` přebírá ID do `BuildConfig.DRIVE_CLOUD_PROJECT`; výchozí neregistrovaný balíček `cz.zamerovac.app` má prázdné pole. Budoucí produkční klient/signer se nyní nevytváří.
- Compile/test workflow provede skutečný Gradle validátor se19 negativními případy a native kontrolu generovaného BuildConfig/UI/factory. Vytvoří pouze veřejný `app/build/reports/drive-registration.json` s configured=true/false, nikoli OAuth token nebo APK.
- Budoucí `build-apk.yml` před assemble vyžaduje `-PdriveRequireConfigured=true`; neúplná konfigurace jej odmítne. Jeho triggers ani `.github/apk-build-request.txt` se nemění a během této práce nebyl spuštěný.
- Project ID je veřejná build/namespace konfigurace, nikoli OAuth client ID nebo přihlašovací tajemství. Skutečného Android klienta ověřuje Google podle package+SHA1; statický řetězec ani certifikátový test nedokazuje živý consent. SDK žádá pouze drive.appdata pro vybraný účet, bez backend serveru/refresh token exportu/webového client secretu.
- Jeden povolený testovací Google účet se použije na telefonu i tabletu. Google Testing, nedostupný GMS, zrušení/denied/revoked/expired a skutečné Drive oprávnění musí projít fyzickou akceptací na syntetických datech po potřebných kontrolách. Nepublikovat osobní e-mail ani screenshots.

Samostatná kontrola bez APK: `gradle --no-daemon -p tools/drive-config-checks verify`. Native cesta: `gradle --no-daemon :app:verifyDriveRegistration :app:compilePreviewJavaWithJavac :app:testPreviewUnitTest`. Připravené zadání nezávislé revize: [audit-39-handoff.md](audit-39-handoff.md).

Použité oficiální zdroje (ověřeno 5. 11. 2026):

- [Android AuthorizationClient a registrace package + SHA1](https://developer.android.com/identity/authorization).
- [Drive appDataFolder, scope a omezení](https://developers.google.com/workspace/drive/api/guides/appdata).
- [Drive v3 stránkování](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/list).
- [Create-only resumable upload a Range](https://developers.google.com/workspace/drive/api/guides/manage-uploads).

Zvolená izolovaná API vrstva používá `drive.appdata`, flat objekty `name=sync/v2/...` či `backups/v2/...` a parent `appDataFolder`. Virtuální adresáře musí vytvořit adaptér podle cest. Prostor patří Google účtu/aplikaci Google projektu; neumožňuje sdílení mezi cizími účty a není běžnou viditelnou složkou ani systémovou Android zálohou. Uživatel jej může odstranit přes správu dat aplikace v Disku. Synchronizační podpisy/párování budou nadále povinné; existence ve stejném účtu sama neschválí peer.

HTTP třída povoluje pouze HTTPS www.googleapis.com a konkrétní Drive cesty, blokuje automatické přesměrování a vrací token jen v Authorization hlavičce. Resumable Location musí zůstat na upload endpointu stejného hostu. Token se neukládá do DB, URL, logu ani testovacích artefaktů; 401 zavolá invalidaci právě použitého tokenu. Žádné převzetí tokenu připojeného Drive pluginu. API nevystavuje PATCH/DELETE a upload vytváří nový objekt. Finální potvrzení API není finálním potvrzením zakázky příjemcem.

Gate se kontroluje před požadavky i každými 64KiB čtení/zápisu. Účtuje konzervativní rezervu hlaviček a velikost povoleného čtení/payloadu. Nejde o měření TLS/TCP, skrytého OS provozu nebo účtování operátora. Google odpovědi mají omezenou velikost a seznam se vrátí pouze po všech stránkách; odmítnutý rozpočet nesmí vrátit neúplný seznam jako prázdné úložiště. Na dlouhém seznamu může omezený přenos čekat na neměřené spojení; další integrace nesmí tvrdit okamžitou malou synchronizaci v libovolně velké historii.

## Historické rozdělení etap29–32 (není aktuální seznam chybějících funkcí)

Původní implementační pořadí:

1. Implementovat oddělené DriveSyncStore / DriveBackupStore capability nad sdílenou API hranicí; sync nesmí adresovat backup cestu. Ověřit nejednoznačné stejné názvy, souběžné vytvoření stejného backup blobu, metadata cache a účetní namespace. Sdílené stejné názvy v Drive nejsou automaticky unikátní.
2. Proudový `ImmutableStore.create()` nezná velikost předem. Adaptér potřebuje omezený soukromý staging nebo změnu explicitního size kontraktu; close po chybě nesmí spustit zakázaný velký upload. Ověřit disk full, cancel/direct prioritu a cleanup po systémovém kill. Dosavadní API začíná po chybě novou relaci; byte-range resume po restartu zatím nemá.
3. Napojit Android AuthorizationClient při explicitní volbě Disku, respektovat odmítnutí/odhlášení a expiraci; obnovovat token bez jeho uložení v projektu, neměnit účet potichu. Vyžaduje skutečný Google Cloud projekt, Drive API, OAuth branding/consent a registrovaného Android klienta pro přesný package a podpis SHA1. Tyto údaje ani oprávnění spravovat Cloud Console zde nejsou dostupné. Registrace není nahraditelná připojeným Drive konektorem a do APK nepatří OAuth client secret.
4. Zapojit zvlášť sync a backup UI, JobScheduler a povolené mobilní výjimky, zachovat místní funkčnost bez účtu/GMS. Testovat plný signed snapshot/media/ACK a dvě historie/obnovu přes API adapter se syntetickými odpověďmi; potom skutečný účet a obě Android zařízení.

Etapa nemění aktivní UI, vydanou historii ani český návod. Skutečnou podporu Disku, úplné #38/#40 či fyzickou akceptaci zatím nelze označit jako dokončené. Žádná APK ani merge.

## Doplnění etapy 30

DriveObjectStore/DriveSyncStore/DriveBackupStore a explicitní PendingOutput jsou implementované a zapojené do CloudFiles/BackupHistory publikačního kontraktu. Jejich celek testuje DriveStoresTest přes REST odpovědi: signed synchronizace, chyba/retry a 2 historie/100 originálů/restore. Close není publish; po vadném zdroji nedojde k HTTP uploadu. Opuštěný vlastní staging se odklízí, aktivní/cizí ne. Duplicity content-addressed názvů se ověřují skutečnými bajty (max16 kandidátů); kontrolní zprávy s duplicitním jménem se odmítnou. Při závodu může existovat fyzicky více stejných bloků, aplikace je kvůli historii nemaže a obsazení uvádí přibližně. Dočasný staging potřebuje volné místo až do velikosti souboru (max2GiB).

Body 1–2 výše jsou tím částečně realizované; chybí fyzický kill/disk/OEM scénář. Body 3–4 (AuthorizationClient a produkční UI/Job/účet) zůstávají hlavní práce. Aktivní app zatím nové Drive adaptéry nevytváří. Stage29 native CI SUCCESS v 63d5d16, nová stage30 CI musí potvrdit testy adaptéru; živý účet není ověřen.

## Doplnění etapy 31

DriveAuthorization a DriveAccounts implementují SDK autorizaci a oddělenou no-backup vazbu pro obě funkce, zatím bez picker/UI/Job. Play services auth 22.0.0 vychází z aktuálního oficiálního Android návodu výše. Auth request připíná konkrétní Account a jediný drive.appdata scope. Background token await nikdy neotevírá souhlas, neblokuje UI, krátce drží token pouze v paměti a na 401 zneplatní právě použitý. Odpojení jedné funkce nepředstavuje revokeAccess celé Google aplikace; to by podle Google rušilo všechny granty a poškodilo i druhou funkci.

BuildConfig.DRIVE_CLOUD_PROJECT je veřejný Google project ID z Gradle property driveCloudProject nebo env ZAMEROVAC_DRIVE_PROJECT, nyní prázdný. Bez legitimního projektu/registrace se defaultní auth cesta odmítne; testy používají explicitně injektovaný klient. Registrace vyžaduje Drive API, consent/branding a přesný package+SHA1. Pro testovací variantu je package cz.zamerovac.app.preview, pro budoucí produkční cz.zamerovac.app s vlastním neveřejným produkčním podpisem; veřejný vývojový podpis repozitáře není produkční identita. Token/secret se do properties ani repo nevkládá.

Další krok: Drive account picker/consent lifecycle, samostatná továrna sync/backup s připnutým účtem a route/policy bindingem, MainActivity/SyncJob zapojení a reálné UI/negative testy. Nedostupný Cloud Console přístup/projekt nelze nahradit účtem konektoru; žádný Google účet zatím nebyl fyzicky ověřen.

Konkrétní testovací registrace, ověřeno místním keytool nad veřejným tools/debug-signing.p12.b64: package **cz.zamerovac.app.preview**, SHA1 **7D:00:35:7F:D9:50:B0:95:62:30:5C:92:86:EB:18:05:A7:F7:FB:42**, SHA256 **C8:28:C9:67:39:E5:54:E8:DA:4F:58:51:91:33:56:13:4F:13:59:A9:8D:50:13:77:2A:D5:58:7E:74:A2:D2:29**. Jsou to veřejné fingerprinty známého vývojového podpisu; neobsahují token. Samotná znalost těchto údajů nevytvořila Google Cloud projekt ani OAuth registraci a není podkladem pro budoucí produkční podpis.

## Etapa 32: produkční zapojení

DriveAccountFlow a CloudStorage řeší výběr/consent, lifecycle a factory/policy. MainActivity/SyncJob skutečně volí Drive nebo SAF podle potvrzeného stavu. Účet i namespace jsou připnuté pro celou operaci; disconnect nepřepne sám na starou složku. Monotónní per-feature revision odmítne i starý callback po změně tam a zpět. Aktivní kód je v UI, ale Google připojení stále vyžaduje skutečný project ID/registraci; default je poctivě nedostupný, ne falešná integrace.

Další kritická kontrola: source global lastAck ze starého cloudu/direct nesmí vynechat publikaci plné kopie v novém account/store namespace. Po ní schválená frekvence a Android nearby/LAN/cloud priority. Native etapy32 CI ověřit; místní3 browser account scénáře a4 předchozí sync/backup scénáře prošly, stejně Node/Python. Reálný účet, GMS consent, OEM a rádia nejsou tímto prokázané.
