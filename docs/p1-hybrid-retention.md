# P1 hybridní ochrana – implementační checkpoint

Schválení: issue #42, comment 6765153051; technický kontrakt 6765061985.
Vlastní větev `fix/b16-p1-hybrid-retention-codex-20261110` vychází z
#99 `662aa1bd1dffd51d9f259fb3bfb4aa57e57d6c99` a obsahuje #93/#98.
Diagnostické testy #88 jsou převzaty beze změny, bez ignorování či změkčení.

## Kontrakt

`ProtectedRevisions` ukládá přesný původní text JSON před nahrazením potvrzené DB,
před purge a přesné wire bajty před publikací/přijetím synchronizační revize.
Manifest obsahuje hash, velikost, ID, MIME a název originálů; média zůstávají jednou
ve files/media. Hash názvu chráněného manifestu ověřuje i metadata. Lokální hold
nepřiděluje recovery/CAS/ACK autoritu. Nemění přenosový protokol ani ID příloh.

Dva monotónní katalogy (files/protected-revisions a nezávislý no_backup witness)
zadržují sjednocení všech holdů. Po přerušeném katalogovém commitu restart doplní
chybějící členy. Chybějící nebo poškozený indexovaný manifest, neznámý soubor či
neověřitelný registr zastaví destruktivní operaci. Neúplný zápis se nemaže jako
odpad. ACK, supersession, zapomenutí peeru, změna namespace ani epochy hold neruší.

Koš, opakovaný pending cleanup, rollback importu/ingestu i publikace originálů
používají společný lokální zámek a stejnou ochranu. Chybějící chráněné ID se nesmí
potichu znovu použít. Dočasné soubory mají jiné názvy a nejsou chráněnými originály.
Import i screenshot publikují přes MediaStaging. Přímý TLS a Drive používají
společný PeerDataStore/PeerOutbox; existující hash/need deduplikace se zachovává.

Žádný automatický release, TTL, limit pro mazání ani tlačítko smazat vše.
Při chybě perzistence nebo nedostatku místa se operace odmítne. Koš ukazuje počet
chráněných revizí, počet originálů a jejich sjednocenou velikost. Bez ochrany před
ztrátou telefonu, odinstalací nebo fyzickým poškozením původního média.

## Návrh správy – NENÍ implementované oprávnění mazat

Budoucí samostatná obrazovka: konkrétní revize, zdrojové zařízení/epocha,
zakázky, přesné hodnoty, ověřenost médií a náhled rozdílu. Zobrazit fyzické bajty
sdílených médií a odhad skutečně uvolnitelných bajtů, aby součet revizí nepočítal
fotografie opakovaně. Nezávisle kontrolovat čitelnost a nabídnout export přesně
vybrané historické revize jako nové kopie bez promotion DB autority.

Zrušení jediného hold může přijít až po další bezpečnostní revizi: ověřit
náhradní trvalou kopii a obnovitelnost konkrétních metadat i všech médií, nebo
explicitní vědomé přijetí trvalé ztráty konkrétní revize vlastníkem. Dvoufázový
commit nesmí vytvořit mezeru v ochraně. Fyzické unlink teprve po kontrole všech
DB/history/fronta/karanténa/ostatní holds referencí. Koš nesmí být tímto souhlasem.
Žádný ACK v2, stáří, kvóta ani novější revize nejsou release tokenem.

## Ověřování

ROZPRACOVÁNO: výsledky a přesné SOURCE SHA budou doplněny po skutečných bězích.
Prostředí: lokální Linux x86_64 v managed cloud workspace, JDK17, Gradle8.10.2,
Android35 SDK, Robolectric (syntetická zařízení a poskytovatelé). Není to
Windows HOME QA, fyzický Android ani reálný Google Disk. Žádné Actions/APK/release.
Node regrese #98/#99 PASS. Java kompilace/testy probíhají.
