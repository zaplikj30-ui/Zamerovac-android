# #195 – postup měření ukládání nové složky na testovacím Androidu

**POUZE DIAGNOSTICKÝ DRAFT.** Nic neinstalovat ani nevydávat bez nezávislého SOURCE/SECURITY review a výslovného GO vlastníka. Naměřená příčina zpomalení není známá.

## Proč je potřeba minimální instrumentace

Android Studio Java/Kotlin Method Trace dokáže ukázat časy jednotlivých metod, ale může mít významnou režii a z prostých metod nedokáže přesně oddělit **čekání na monitor TrashPurger.LOCK** od práce pod ním. Chrome DevTools dokáže měřit WebView JavaScript bez modifikace app.js. V tomto PR jsou proto jen pevné časové značky android.os.Trace uvnitř původního Java saveDataChecked, pod compile-time bránou BuildConfig.DEBUG; nejsou v ostré release sestavě, nepřidávají bridge, oprávnění ani log s daty. Na Android 26+ je Trace.beginSection/endSection podporovaný. Neukládat jména, ID, obsah JSON, cesty, media bytes ani tokeny do trace.

Výchozí app/build.gradle má buildConfig true, debug signing a oddělenou variantu preview s applicationIdSuffix '.preview' a debuggable true. Jen tato oddělená preview verze po budoucím schválení, **nikoli instalovaný ostrý Zaměřovač**. U novější WebView 113+ je remote DevTools u debuggable app automatický, na konkrétním zařízení ověřit; pokud ne, poznačit NOT RUN a neodemykat ostrou aplikaci.

## Měřené časové úseky ve stejném Native vlákně

| Trace značka | Měří | Pozor |
|---|---|---|
| Z195-bridge | vstup do Java saveDataChecked až opuštění metody | jen Java bridge, ne celý JS/IME/paint |
| Z195-lock-wait | před synchronized(TrashPurger.LOCK) až získání LOCK | oddělené čekání na zámek |
| Z195-readDb | readDbForCas() | může skončit neúspěšným CAS ještě před zápisem |
| Z195-writeDb | writeDb(text) | dosavadní pevná hranice durable zápisu |
| Z195-generation | LocalDatabase.generation(...) | po write, před obnovou |
| Z195-recoverPrimary | PendingAudio(...).recoverPrimary().length() | po potvrzeném write; případná chyba nemění ACK |

Každá jednotlivá operace má výjimkově bezpečný try/finally pro Trace.endSection; vnější Z195-bridge také. Sekvence readDb → writeDb → generation → recoverPrimary a původní odpovědi CAS/exception nejsou změněné. Názvy jsou statické a bez metadat. Během trace spouštět jeden pokus najednou a vyhledat všech šest úseků; po chybovém CAS budou některé sekce správně chybět.

## Dočasný JS helper bez zásahu do produktu

Při budoucím povoleném testu v Chrome DevTools na odděleném testovacím WebView vložit obsah tools/diagnostics/issue195-folder-save-devtools.js do konzole. Není importován do app assets. Měří pouze vytvoření složky přes modal "Nová složka"; nečte názvy uložených zakázek ani JSON, jen boolean potvrzení a časové rozdíly.

Výstupní pole: clickToSaveStartMs (klik → JS save start); jsSaveMs (JS save včetně Native call a post-ACK); showFolderMs (synchronní UI DOM práce); clickToShowFolderStartMs (klik → začátek JS renderu); clickToTwoFramesMs (dva requestAnimationFrame, pouze orientační odezva, nikoli potvrzení fyzického pixelu); jsSaveReturnedTrue (pouze výsledná hodnota JS save). Tento boolean **není důkaz Native ACK**: starší save() může po potvrzeném zápisu vrátit false při následné UI výjimce. Skutečnou durable hranici určuje až úspěšné Native writeDb / potvrzení CAS. Při zavření zavolat v DevTools __z195FolderProbe.print() pro čistě číselný přehled, pak vždy __z195FolderProbe.stop() nebo reload WebView. Helper neodesílá síť, nezapisuje trvale, nepřepisuje výsledek původního save.

**Neodečítej absolutní timestampy Android System Trace a JS performance.now od sebe**: není prokázán společný počátek. Srovnávat pouze délky odpovídajících operací a jejich časové pořadí; procenta počítat jen ze stejného prostředí a jedné testovací relace. Profiling sám přidává režii.

## Budoucí schválený fyzický test – připraveno, NOT RUN

1. Vlastník schválí konkrétní diagnostické SHA a použití izolované preview sestavy, podpis a balíček. **Bez schválení žádný build APK, instalace, HOME, Actions ani cloud**. Nikdy netestovat na skutečných zakázkách, nevydávat preview jako ostrou verzi.
2. Android Studio System Trace/Perfetto, pokud možno nízká režie. Na syntetických datech 3 zahřívací a alespoň 5 opakovaných Uložit kliknutí pro každý režim. Získat oddělené nativní úseky a JS časy z DevTools, po restartu readback potvrzených složek. Není-li WebView inspektovatelné, zapsat proč.
3. Matice: prázdná databáze, 50 a 500 syntetických dokumentů s přesnými kótami a původními *syntetickými* media IDs; žádná, pending a needs-review nahrávka; offline a sync zapnuto/vypnuto; selhání před potvrzením, retry, dvojklik, ukončení a znovuotevření. Žádné destruktivní plnění zákaznického disku ani původní média v logu.
4. Pro každý režim uvést n, median, maximum (případně p90), relevantní syntetickou velikost DB a především validaci ACK/RAM/durable JSON/mediálních ID/byte hashů na testovací instanci; zachovat jednotky, laserové hodnoty, historii, koš a pending journal. Rozlišit **durable write** od případně pomalé pozdější recovery a UI.
5. Pokud dojde k ztrátě média/ID, nepravdivému ACK, neúplné recovery, souběžné editaci bez správného CAS nebo k metodickému rozporu, **STOP**. Nepřebírat historický PASS 96/96 z PR #205 jako fyzické ověření.
6. Až s výsledky doporučit cílenou opravu měřeného úseku, jiné prostředí/profiler, nebo samostatný architektonický návrh s owner/design/security GO. Nevypínat PendingAudio.recoverPrimary, neoddalovat CAS ani nepřesouvat IO do pozadí naslepo.

**Současný stav:** SOURCE návrh, statické Java kontrakty a simulovaný DevTools test; skutečná Android/Gradle kompilace, fyzické časy, média a restarty **NOT RUN**. Java trace metadata ani JS měřič nejsou bezpečnostní audit ani výkonový PASS. Uživatelská offline nápověda se nemění, protože se nemění uživatelské chování. Všechny skutečné trace soubory uchovat lokálně, před sdílením ručně prověřit i okolní systémové události a na veřejný GitHub zveřejnit jen anonymní souhrn čísel.
