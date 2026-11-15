# HOME4: jediná úzká read-only inventární sonda — návrh bez aktivace (15. 11. 2026)

**Stav: DESIGN ONLY / SOURCE NOT REVIEWED / HOME NOT RUN.** Tento soubor není skript, workflow ani svolení k jejich spuštění. Úkol je pouze získat *dosud chybějící aktuální* údaje o HOME Windows/WSL. Žádný QA test, build/APK, instalace, stahování, upgrade ani změna účtu, ACL, služby, WSL či existujících guardů.

## Připnutý výchozí stav a již existující důkazy

- main/base: `a3cc8eb3a14a9a6710664b73ba8a5c70ed1a340a`
- PR #150 OPEN/DRAFT HEAD: `3886fcf80213e4693464d3f30104885c1c58f53e`
- SOURCE: `c7e71327d69bfe87f622ff6293422e2e15332a11`; VALIDATOR: `05494a2a56df25f40ff41e423b289a84a45e2697`. Schválené budoucí MAIN/EVENT SHA **neexistuje**.
- Závazné zadání: [PR150 #6902389182](https://github.com/zaplikj30-ui/Zamerovac-android/pull/150#issuecomment-6902389182); historická cílená inventura: [#6902325794](https://github.com/zaplikj30-ui/Zamerovac-android/pull/150#issuecomment-6902325794).
- **Neopakovat** hash full Chromium 13. 11. ([run 43476705453](https://github.com/zaplikj30-ui/Zamerovac-android/actions/runs/43476705453)); offline Playwright 1.62.1 13. 11. ([run 43497273184](https://github.com/zaplikj30-ui/Zamerovac-android/actions/runs/43497273184), browser FAIL na path identity); WSL/JDK17/Gradle 8.10.2/JVM/PDF z 9. 11. ([run 42719127152](https://github.com/zaplikj30-ui/Zamerovac-android/actions/runs/42719127152), WSL JVM tehdy **root**); Windows MSVC/SDK/Node26/Python3.13 ([run 43665490873](https://github.com/zaplikj30-ui/Zamerovac-android/actions/runs/43665490873)); Windows 57+15 ([run 43722510319](https://github.com/zaplikj30-ui/Zamerovac-android/actions/runs/43722510319)). Jsou to historické důkazy, nikoli aktuální HOME4 PASS.
- Existující `tools/qa/home4-inventory.template.json` má `verified:false`, prázdné soupisy/hash mapy, neznámou nonroot WSL identitu a `diskEvidence.verified:false`. `home4_contract.py:verify_inventory` a `home4_preflight.py` **ověřují vyplněné manifesty**, negenerují inventář. `home4-private.py` čte Windows ACL pod servisním tokenem, ale vyžaduje důvěryhodně dostupný/pinovaný skript. `home4.cjs` **vytváří** run adresáře a spouští vlastníky; nesmí se vydávat za read-only sondu. `home4_wsl.py` vytváří ext4 scope/kopie a spouští testy; rovněž nevhodné.
- Opakované one-shot sondy nejsou potřeba: vzor bez checkoutu existoval v PR #123 (Chromium) a #133 (token), ale jejich push/branch triggery **nepřenášet**, protože dnešní politika je owner/main/**manual-only**.

## Nejmenší bezpečný mechanismus, předložený k nezávislému posouzení

**Jediný nový, oddělený, časově omezený read-only krok, nikoli přestavba HOME4.** Až po nezávislé SOURCE/SECURITY kontrole přesného spustitelného diffu a výslovném rozhodnutí vlastníka připravit samostatné `workflow_dispatch` pouze na schváleném `main`, `permissions: {}`, `self-hosted,Windows,X64,zamerovac-qa`, `timeout-minutes: 5`, `cancel-in-progress:false`. Před jediným krokem i uvnitř něj vyžadovat přesný repository, owner actor, triggering_actor, `refs/heads/main`, `workflow_dispatch`, `run_attempt=1`, schválené EVENT SHA a servisní identitu `ZamerovacQA`; žádný PR/fork/push, checkout, reusable workflow, token/API/download ani externí akce. Nový workflow v této návrhové větvi **NEEXISTUJE**, nelze jej spustit. Žádný zásah do současného `.github/workflows/windows-self-hosted-qa.yml`, jeho čtyř `false &&`, prázdného `HOME4_APPROVED_MAIN_SHA` a `UNVERIFIED` profilu.

Navrhovaný pozdější krok sestává **jen z pasivního dotazu přes předem existující OS nástroje** na předem fixovaný allowlist; nesmí vykonat ani importovat žádný nalezený Node/Python/Git/Gradle/JDK/Chrome modul. Důvěryhodný shell a OS nástroje se nejprve identifikují; bootstrap jejich důvěry zůstává samostatnou podmínkou review, nelze ji odvozovat jen z toho, že si binárka sama spočítá hash.

| Delta | Povolené čtení | Fail-closed hranice |
| --- | --- | --- |
| Windows nástroje | Existence, absolutní kanonická cesta, identity a SHA-256 **souborů** Node, Python, Git, JDK, Chromium, Playwright a potřebných DLL v explicitně povolených instalačních kořenech; verzi odečíst jen z důvěryhodného statického metadata či doložené historie (bez spouštění neověřené binárky). | Neznámý kořen, reparse/symlink, hardlink nebo změna identity během čtení => BLOCKED. Nenačítat jiné disky/uživatelské složky. Pouhý hash EXE není kompletní manifest adresáře. |
| Offline cache | Soupis a SHA-256 každého **povinného** balíku a DLL v předem schválených přesných kořenech pro Playwright/Chromium, Gradle/JDK, Android SDK, Robolectric/Maven, PDF knihovny. Při čtení pouze enumerace/streaming hash, nulové zápisy. | Neexistující schválená mapa povinných souborů, další soubor, redirect, nestálá metadata, překročení pevného časového/počtového/byte limitu nebo nedostupný obsah => NEOVĚŘENO/BLOCKED. Žádný `npm`, `pip`, `gradle`, `curl`, fallback, refresh či cache restore. |
| Windows ACL a disk | Read-only vlastník/DACL/inheritance servisních privátních adresářů a přesné volné bajty dotčených svazků přes existující OS API. Porovnat s účtem běžící služby, nezveřejnit SID ani syrové ACL. | Bez bezpečně připnutého `home4-private.py` nebo rovnocenné nezávisle zkontrolované kontroly neoznačovat ACL jako PASS; čitelný DACL sám neprokazuje efektivní oprávnění. Volné místo není důkaz hard disk quota/cleanup. |
| WSL | Nejprve pouze Windows dotaz na **již běžící** `Zamerovac-Ubuntu-QA`. Až bude doložen přesně určený existující nonroot uživatel/UID a bezpečná metoda, cílené dotazy pod tímto UID: skutečné UID, ext4 mount a soukromý `0700` root, dostupné bajty, skutečný limit 4 GiB / 2 CPU a kořeny/hash cache. | Žádné `root`, `sudo`, nový účet, `wsl --set-default-user`, konfigurace `.wslconfig`, vypínání/startování distribuce, scope `mkdir`, kopírování či `wsl --terminate/shutdown`. Pokud nelze prokázat „already running“, nonroot a read-only procesní izolaci **před příkazem uvnitř WSL**, WSL část = BLOCKED, nic uvnitř nespouštět. |

**Rozsah je pouze delta**; staré hashované Chromium a historické verze se použijí jako referenční piny, aktuální změnu binárky nelze ignorovat. Úplnost všech offline závislostí nelze prohlásit bez recenzovaného seznamu povinných cest/obsahu. Omezený read-only výpis *nemůže* sám vyrobit již požadované normal/timeout/cancel runtime containment či disk `boundedWritesVerified`; tyto položky ponechat BLOCKED.

## Soukromí, STOP a výstup

Žádné nové soubory, profily, lokální logy, artefakty, temp/staged checkout nebo env změny na HOME. Výstup pouze pevně omezený **redigovaný** přehled do již řízených neveřejných job logů (komponenta, PASS/NEOVĚŘENO/BLOCKED, počty, schválený hash a velikost, UTC, SOURCE/VALIDATOR/EVENT/workflow commit). NIKDY raw ACL, SID, uživatelské cesty, seznam procesů, token, obsah cache ani zákaznická data v veřejném komentáři. Pokud je pro plnohodnotný soukromý důkaz nutné vytvořit lokální soubor, **STOP** a zvlášť schválit přesně vymezený zápis — nynější read-only povolení se na něj nevztahuje. Fail jakéhokoli předpokladu = BLOCKED / NO RETRY bez přechodu na HOME QA.

Bezpečné dokončení **není** automatické vyplnění `verified:true`, změna `HOME4_PROFILE_SHA256`, aktivace jobů či merge PR150. Slabší důkaz se do profilu nepovyšuje. Po kontrole a vlastnickém rozhodnutí nejdříve vytvořit a nezávisle zrevidovat **jediné konkrétní vykonatelné** workflow na přesném SHA; teprve pak separátně rozhodnout o jeho umístění do main a jednorázovém ručním dispatchi. V této etapě není k dispozici bezpečný přímý HOME executor a není schválená spustitelná sonda.

## Výsledek této etapy

- **SOURCE:** design dokument, bez nového spustitelného kódu, bez úpravy guardů/QA.
- **PASS:** GitHub metadata výchozích SHA a cílená revize existujícího mechanismu.
- **NOT RUN:** HOME scan, nový Windows/WSL runtime, cache/hash/ACL/disk, QA4/4, Chromium 23/96, JVM, APK.
- **BLOCKED:** skutečné aktuální hodnoty a spuštění (chybí recenzovaný nástroj a bezpečná exekuční cesta); WSL nonroot a privátní evidence zvlášť.
- **TEĎ:** nezávisle prověřit tento úzký návrh a možnost nejprve bezpečně ověřit nonroot WSL bez jeho startu.
- **POZDĚJI:** jediná recenzovaná sonda pouze na nově schváleném MAIN, oddělený souhlas s ručním spuštěním; až dle výsledku rozhodnout o dalších runtime důkazech.
- **NEMĚNIT:** produkt/geometrii/data/média, raw #88 FAIL, PR150 autorovu větev, HOME4 `false &&`, manual/owner/main/attempt1, STOP/NO RETRY.
