# Důkazy schválené opravy ACK

`baseline-8244026` je **první skutečný úplný běh čistého zdrojového SHA `82440269b2fcf72bd88ebced6872d8c65aea3bc7`**, nikoli finální úspěch:

- Raw Gradle: **511 metod / 508 PASS / 3 FAIL / 0 ERROR / 0 SKIP**, celý Gradle FAIL.
- Dvě původní providerové diagnostiky: viditelné **EXPECTED FAIL (actual FAIL)** se stejnými asercemi/helpery.
- Oddělená produktová brána: **FAIL**, 508 PASS / 1 FAIL. Zachytila skutečnou regresi `DatabaseInstallEvidenceTest.r10TemporaryQueuedSnapshotReadErrorRecoversAfterRestartWithoutFalseAck` — fallback z SQL zpřístupnil aktivní dočasně nečitelný sourceRef.
- Brána toto třetí selhání **nepřeklasifikovala**. Následná oprava omezila SQL fallback na předchozí legacy `transport-ack`, bez jakéhokoli aktivního nebo quarantined odkazu a bez nejasné `.bak/.new` evidence. Nové receipts a aktivní zdroje vždy zůstávají fail-closed. **Celý původní DatabaseInstallEvidenceTest včetně R10 je beze změny.**

Úplné JSON výsledky, všechny JUnit metody a raw Gradle/gate logy jsou zachované v tomto adresáři. Nové finální výsledky na opraveném finálním HEAD a úplné logy/reporty se ukládají přímo do PR #116, aby jejich připojení dalším commitem opět nezměnilo testovaný HEAD.

Průběžné logy v `worktree` jsou reprodukce a cílená ověření **necommitnutého pracovního stromu**, nikoli finální test čistého SHA. Přiznávají původní RED cache/FK/epoch a následné opravy; nejsou přejmenovány na finální PASS.

Managed Linux/JDK17/Gradle8.10.2/SDK35/Robolectric4.16.1. HOME/fyzický Android/živý Drive/power-cut nebyly provedeny. Nová produktová brána nenahrazuje nezávislé review a povolenou fyzickou QA.
