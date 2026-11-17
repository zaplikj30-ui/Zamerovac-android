# Rejstřík automatických testů Zaměřovače – inventura k 17. 11. 2026

> **Snímková inventura zdrojů, nikoli důkaz, že všechny testy právě proběhly.** Zdroj: [produktový PR #179](https://github.com/zaplikj30-ui/Zamerovac-android/pull/179), přesný HEAD `9757df251ca60008e6dc1d69209cbe58213f794f` na základě main `9104de8c98bc92ccc28a703abd590db3d0c8985a`. Na main tento produkt ještě nebyl sloučen. Git strom byl úplný (nekrácený); skripty jsou zařazeny podle skutečných cest a [dostupného runner workflow](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/.github/workflows/chromium-simple.yml). **Žádné testy ani GitHub Actions nebyly kvůli tomuto rejstříku spuštěny.**

**Kde je co:** toto je **seznam testovacích souborů a jejich způsobu spouštění**. [`qa/coverage-v1.json`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/qa/coverage-v1.json) je dosavadní **mapa 44 oblastí funkcí → soubory testů** (nemá sloužit jako soupis všech QA infrastrukturních scriptů). [Issue #28](https://github.com/zaplikj30-ui/Zamerovac-android/issues/28) řídí automatické ověřování, [issue #13](https://github.com/zaplikj30-ui/Zamerovac-android/issues/13) fyzické nálezy. Kód, workflow a skutečné logy mají přednost před tímto snímkem. U jednotlivých položek **[F]** znamená již přiřazeno některé funkční oblasti v mapě; bez [F] znamená jen *není v této mapě*, nikoli že test neexistuje nebo neběží.

## 1. Rozsah podle aktuálního testovacího stromu

| Vrstva | Testovací soubory / sady | Jak se používají |
|---|---:|---|
| Java/JVM | 64 | 64 `*Test.java` tříd; číslo tříd není počet JUnit metod |
| Node/JavaScript – QUICK | 71 | `tests/*.js` spouští `QUICK` postupně |
| Python – QUICK | 25 | `tests/test_*.py` spouští `unittest discover` |
| Chromium – krátké kontroly | 7 | `tools/check-*-browser.cjs` – 7 skutečných skriptů |
| Chromium E2E v `available` | 23 / 96 scénářů | Každá sada má počet a vlastní report; seznam níže |
| Chromium další / emulátor | 2 | 2 další scénáře/sady mimo aktuální `available`, neprohlašovat PASS |
| Ručně zapínané Python skripty | 2 | Mimo běžné `unittest discover`; spouštět zvlášť jen se schválením |
| Test QA runneru | 1 | Samostatný `node --test`, není aplikační E2E |
| Pomocné Java/E2E zdroje | 5 | Fixture/harness, ne samostatné automaticky spouštěné testy |

**Skutečný ověřený běh pro testovaný produkt:** [GitHub Actions #44175265292](https://github.com/zaplikj30-ui/Zamerovac-android/actions/runs/44175265292), QA runner `016417a746abe3344f0fd38bd71cd0897a0269e4`, produkt `9757df251ca60008e6dc1d69209cbe58213f794f`, `completed/success`. **PASS** QUICK, Chromium 7/7 a 23 sad/96 scénářů, Android Java/Drive konfigurace a PDF/ZIP. **RAW JVM:** **511 PASS / 2 skutečné FAIL (#88) / 0 ERROR / 0 SKIP**; samostatná **PRODUCT ACCEPTANCE PASS**, nikoli opravené dvě raw vady. Fyzický Android, Bosch, S Pen, živé Drive/SAF **NOT RUN**. Nevyvozovat z PASS obecnou bezchybnost funkcí nebo fyzického zařízení.

## 2. Přesný seznam 23 aktivních Chromium sad (96 scénářů)

| Sada | Scénářů | Zdroj |
|---|---:|---|
| `drawing` | 17 | [`tools/e2e/drawing.cjs`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tools/e2e/drawing.cjs) [F] |
| `gallery-visual` | 1 | [`tools/e2e/gallery-visual.cjs`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tools/e2e/gallery-visual.cjs) [F] |
| `workflows` | 6 | [`tools/e2e/workflows.cjs`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tools/e2e/workflows.cjs) [F] |
| `interactions` | 3 | [`tools/e2e/interactions.cjs`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tools/e2e/interactions.cjs) [F] |
| `zoom-grid` | 2 | [`tools/e2e/zoom-grid.cjs`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tools/e2e/zoom-grid.cjs) [F] |
| `update39` | 4 | [`tools/e2e/update39.cjs`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tools/e2e/update39.cjs) [F] |
| `gallery-state` | 5 | [`tools/e2e/gallery-state.cjs`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tools/e2e/gallery-state.cjs) [F] |
| `peer-sync` | 4 | [`tools/e2e/peer-sync.cjs`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tools/e2e/peer-sync.cjs) [F] |
| `drive-accounts` | 5 | [`tools/e2e/drive-accounts.cjs`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tools/e2e/drive-accounts.cjs) [F] |
| `sync-cadence` | 2 | [`tools/e2e/sync-cadence.cjs`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tools/e2e/sync-cadence.cjs) [F] |
| `backup-history` | 1 | [`tools/e2e/backup-history.cjs`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tools/e2e/backup-history.cjs) [F] |
| `read-only-sync` | 1 | [`tools/e2e/read-only-sync.cjs`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tools/e2e/read-only-sync.cjs) [F] |
| `sync-edit-guard` | 3 | [`tools/e2e/sync-edit-guard.cjs`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tools/e2e/sync-edit-guard.cjs) [F] |
| `note-sync` | 6 | [`tools/e2e/note-sync.cjs`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tools/e2e/note-sync.cjs) [F] |
| `web-content-policy` | 1 | [`tools/e2e/web-content-policy.cjs`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tools/e2e/web-content-policy.cjs) [F] |
| `media-import` | 4 | [`tools/e2e/media-import.cjs`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tools/e2e/media-import.cjs) [F] |
| `help` | 2 | [`tools/e2e/help.cjs`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tools/e2e/help.cjs) [F] |
| `release-history` | 2 | [`tools/e2e/release-history.cjs`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tools/e2e/release-history.cjs) [F] |
| `latency` | 6 | [`tools/e2e/latency.cjs`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tools/e2e/latency.cjs) [F] |
| `quality-regressions` | 8 | [`tools/e2e/quality-regressions.cjs`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tools/e2e/quality-regressions.cjs) [F] |
| `gallery-readability` | 4 | [`tools/e2e/gallery-readability.cjs`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tools/e2e/gallery-readability.cjs) [F] |
| `pending-audio` | 8 | [`tools/e2e/pending-audio.cjs`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tools/e2e/pending-audio.cjs) [F] |
| `legacy-conflict-persistence` | 1 | [`tools/e2e/legacy-conflict-persistence.cjs`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tools/e2e/legacy-conflict-persistence.cjs) |

**Samostatné / jiným spouštěčem:** [`tools/e2e/android-system.cjs`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tools/e2e/android-system.cjs); [`tools/e2e/protected-data.cjs`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tools/e2e/protected-data.cjs). `android-system.cjs` patří do emulátorového průchodu; `protected-data.cjs` není uvedená mezi 23 sadami `available`. Jejich PASS v posledním hosted `available` běhu **NEPROKÁZÁN**.

**Podpůrné soubory E2E (nepočítat jako samostatné sady):** [`tools/e2e/android-window.cjs`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tools/e2e/android-window.cjs); [`tools/e2e/harness.cjs`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tools/e2e/harness.cjs); [`tools/e2e/native-storage-fixture.cjs`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tools/e2e/native-storage-fixture.cjs); [`tools/e2e/sandbox.cjs`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tools/e2e/sandbox.cjs).

## 3. Java/JVM testovací třídy (64)

<details><summary>Otevřít úplný seznam 64 tříd</summary>

- [`app/src/test/java/cz/zamerovac/app/AudioCaptureTest.java`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/app/src/test/java/cz/zamerovac/app/AudioCaptureTest.java) [F]
- [`app/src/test/java/cz/zamerovac/app/AudioCompletedKeepTest.java`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/app/src/test/java/cz/zamerovac/app/AudioCompletedKeepTest.java) [F]
- [`app/src/test/java/cz/zamerovac/app/AudioRecoveryIsolationTest.java`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/app/src/test/java/cz/zamerovac/app/AudioRecoveryIsolationTest.java) [F]
- [`app/src/test/java/cz/zamerovac/app/Audit39FindingsTest.java`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/app/src/test/java/cz/zamerovac/app/Audit39FindingsTest.java) [F]
- [`app/src/test/java/cz/zamerovac/app/Audit39HandshakeTest.java`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/app/src/test/java/cz/zamerovac/app/Audit39HandshakeTest.java) [F]
- [`app/src/test/java/cz/zamerovac/app/Audit39SafetyTest.java`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/app/src/test/java/cz/zamerovac/app/Audit39SafetyTest.java) [F]
- [`app/src/test/java/cz/zamerovac/app/BackupHistoryTest.java`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/app/src/test/java/cz/zamerovac/app/BackupHistoryTest.java) [F]
- [`app/src/test/java/cz/zamerovac/app/CloudFilesReadTest.java`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/app/src/test/java/cz/zamerovac/app/CloudFilesReadTest.java) [F]
- [`app/src/test/java/cz/zamerovac/app/CloudInboxTest.java`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/app/src/test/java/cz/zamerovac/app/CloudInboxTest.java) [F]
- [`app/src/test/java/cz/zamerovac/app/CloudPublicationsTest.java`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/app/src/test/java/cz/zamerovac/app/CloudPublicationsTest.java) [F]
- [`app/src/test/java/cz/zamerovac/app/CloudScanTest.java`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/app/src/test/java/cz/zamerovac/app/CloudScanTest.java) [F]
- [`app/src/test/java/cz/zamerovac/app/CloudStorageTest.java`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/app/src/test/java/cz/zamerovac/app/CloudStorageTest.java) [F]
- [`app/src/test/java/cz/zamerovac/app/DatabaseInstallEvidenceTest.java`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/app/src/test/java/cz/zamerovac/app/DatabaseInstallEvidenceTest.java)
- [`app/src/test/java/cz/zamerovac/app/DatabaseRecoveryTest.java`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/app/src/test/java/cz/zamerovac/app/DatabaseRecoveryTest.java) [F]
- [`app/src/test/java/cz/zamerovac/app/DirectSyncServiceTest.java`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/app/src/test/java/cz/zamerovac/app/DirectSyncServiceTest.java) [F]
- [`app/src/test/java/cz/zamerovac/app/DocumentBackupStoreTest.java`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/app/src/test/java/cz/zamerovac/app/DocumentBackupStoreTest.java) [F]
- [`app/src/test/java/cz/zamerovac/app/DriveAccountFlowTest.java`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/app/src/test/java/cz/zamerovac/app/DriveAccountFlowTest.java) [F]
- [`app/src/test/java/cz/zamerovac/app/DriveAccountsTest.java`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/app/src/test/java/cz/zamerovac/app/DriveAccountsTest.java) [F]
- [`app/src/test/java/cz/zamerovac/app/DriveApiTest.java`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/app/src/test/java/cz/zamerovac/app/DriveApiTest.java) [F]
- [`app/src/test/java/cz/zamerovac/app/DriveAuthorizationTest.java`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/app/src/test/java/cz/zamerovac/app/DriveAuthorizationTest.java) [F]
- [`app/src/test/java/cz/zamerovac/app/DriveHttpTest.java`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/app/src/test/java/cz/zamerovac/app/DriveHttpTest.java) [F]
- [`app/src/test/java/cz/zamerovac/app/DriveRegistrationTest.java`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/app/src/test/java/cz/zamerovac/app/DriveRegistrationTest.java) [F]
- [`app/src/test/java/cz/zamerovac/app/DriveResumableUploadTest.java`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/app/src/test/java/cz/zamerovac/app/DriveResumableUploadTest.java) [F]
- [`app/src/test/java/cz/zamerovac/app/DriveStoresTest.java`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/app/src/test/java/cz/zamerovac/app/DriveStoresTest.java) [F]
- [`app/src/test/java/cz/zamerovac/app/GuardedSyncStoreTest.java`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/app/src/test/java/cz/zamerovac/app/GuardedSyncStoreTest.java) [F]
- [`app/src/test/java/cz/zamerovac/app/ImmutableMediaProofTest.java`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/app/src/test/java/cz/zamerovac/app/ImmutableMediaProofTest.java) [F]
- [`app/src/test/java/cz/zamerovac/app/MainCloudSelectionTest.java`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/app/src/test/java/cz/zamerovac/app/MainCloudSelectionTest.java) [F]
- [`app/src/test/java/cz/zamerovac/app/MediaImportOwnershipTest.java`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/app/src/test/java/cz/zamerovac/app/MediaImportOwnershipTest.java)
- [`app/src/test/java/cz/zamerovac/app/MediaIngestTest.java`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/app/src/test/java/cz/zamerovac/app/MediaIngestTest.java) [F]
- [`app/src/test/java/cz/zamerovac/app/PeerDiscoveryTest.java`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/app/src/test/java/cz/zamerovac/app/PeerDiscoveryTest.java) [F]
- [`app/src/test/java/cz/zamerovac/app/PeerLargeTlsTest.java`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/app/src/test/java/cz/zamerovac/app/PeerLargeTlsTest.java) [F]
- [`app/src/test/java/cz/zamerovac/app/PeerLegacyCompatibilityTest.java`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/app/src/test/java/cz/zamerovac/app/PeerLegacyCompatibilityTest.java) [F]
- [`app/src/test/java/cz/zamerovac/app/PeerMediaCheckpointTest.java`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/app/src/test/java/cz/zamerovac/app/PeerMediaCheckpointTest.java) [F]
- [`app/src/test/java/cz/zamerovac/app/PeerMediaLargeTest.java`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/app/src/test/java/cz/zamerovac/app/PeerMediaLargeTest.java) [F]
- [`app/src/test/java/cz/zamerovac/app/PeerSessionsTest.java`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/app/src/test/java/cz/zamerovac/app/PeerSessionsTest.java) [F]
- [`app/src/test/java/cz/zamerovac/app/PeerTlsTest.java`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/app/src/test/java/cz/zamerovac/app/PeerTlsTest.java) [F]
- [`app/src/test/java/cz/zamerovac/app/PeerTransferTest.java`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/app/src/test/java/cz/zamerovac/app/PeerTransferTest.java) [F]
- [`app/src/test/java/cz/zamerovac/app/PeerWifiDirectTest.java`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/app/src/test/java/cz/zamerovac/app/PeerWifiDirectTest.java) [F]
- [`app/src/test/java/cz/zamerovac/app/PendingAudioTest.java`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/app/src/test/java/cz/zamerovac/app/PendingAudioTest.java) [F]
- [`app/src/test/java/cz/zamerovac/app/PhotoThumbnailsTest.java`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/app/src/test/java/cz/zamerovac/app/PhotoThumbnailsTest.java) [F]
- [`app/src/test/java/cz/zamerovac/app/Post147DataTest.java`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/app/src/test/java/cz/zamerovac/app/Post147DataTest.java) [F]
- [`app/src/test/java/cz/zamerovac/app/Post149NativeTest.java`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/app/src/test/java/cz/zamerovac/app/Post149NativeTest.java)
- [`app/src/test/java/cz/zamerovac/app/ProtectedArchiveCoverageTest.java`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/app/src/test/java/cz/zamerovac/app/ProtectedArchiveCoverageTest.java)
- [`app/src/test/java/cz/zamerovac/app/ProtectedRevisionsTest.java`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/app/src/test/java/cz/zamerovac/app/ProtectedRevisionsTest.java) [F]
- [`app/src/test/java/cz/zamerovac/app/ProviderIoTest.java`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/app/src/test/java/cz/zamerovac/app/ProviderIoTest.java) [F]
- [`app/src/test/java/cz/zamerovac/app/RecoveryCandidateReviewTest.java`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/app/src/test/java/cz/zamerovac/app/RecoveryCandidateReviewTest.java)
- [`app/src/test/java/cz/zamerovac/app/RecoveryInventoryTest.java`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/app/src/test/java/cz/zamerovac/app/RecoveryInventoryTest.java)
- [`app/src/test/java/cz/zamerovac/app/RecoveryProtectionArchiveTest.java`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/app/src/test/java/cz/zamerovac/app/RecoveryProtectionArchiveTest.java)
- [`app/src/test/java/cz/zamerovac/app/SafSyncV2Test.java`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/app/src/test/java/cz/zamerovac/app/SafSyncV2Test.java) [F]
- [`app/src/test/java/cz/zamerovac/app/StorageLifecycleTest.java`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/app/src/test/java/cz/zamerovac/app/StorageLifecycleTest.java) [F]
- [`app/src/test/java/cz/zamerovac/app/SyncAckReconciliationTest.java`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/app/src/test/java/cz/zamerovac/app/SyncAckReconciliationTest.java) [F]
- [`app/src/test/java/cz/zamerovac/app/SyncAdapterFaultTest.java`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/app/src/test/java/cz/zamerovac/app/SyncAdapterFaultTest.java) [F]
- [`app/src/test/java/cz/zamerovac/app/SyncCadenceTest.java`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/app/src/test/java/cz/zamerovac/app/SyncCadenceTest.java) [F]
- [`app/src/test/java/cz/zamerovac/app/SyncCanonicalTest.java`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/app/src/test/java/cz/zamerovac/app/SyncCanonicalTest.java) [F]
- [`app/src/test/java/cz/zamerovac/app/SyncConsistencyTest.java`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/app/src/test/java/cz/zamerovac/app/SyncConsistencyTest.java) [F]
- [`app/src/test/java/cz/zamerovac/app/SyncContentTest.java`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/app/src/test/java/cz/zamerovac/app/SyncContentTest.java) [F]
- [`app/src/test/java/cz/zamerovac/app/SyncJobTest.java`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/app/src/test/java/cz/zamerovac/app/SyncJobTest.java) [F]
- [`app/src/test/java/cz/zamerovac/app/SyncLedgerTest.java`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/app/src/test/java/cz/zamerovac/app/SyncLedgerTest.java) [F]
- [`app/src/test/java/cz/zamerovac/app/SyncReceiptSafetyTest.java`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/app/src/test/java/cz/zamerovac/app/SyncReceiptSafetyTest.java) [F]
- [`app/src/test/java/cz/zamerovac/app/SyncSafetyTest.java`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/app/src/test/java/cz/zamerovac/app/SyncSafetyTest.java) [F]
- [`app/src/test/java/cz/zamerovac/app/SyncTlsIdentityTest.java`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/app/src/test/java/cz/zamerovac/app/SyncTlsIdentityTest.java) [F]
- [`app/src/test/java/cz/zamerovac/app/TrashPurgerTest.java`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/app/src/test/java/cz/zamerovac/app/TrashPurgerTest.java) [F]
- [`app/src/test/java/cz/zamerovac/app/VideoReviewTest.java`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/app/src/test/java/cz/zamerovac/app/VideoReviewTest.java) [F]
- [`app/src/test/java/cz/zamerovac/app/WebContentPolicyTest.java`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/app/src/test/java/cz/zamerovac/app/WebContentPolicyTest.java) [F]

</details>

**Samostatná testovací podpora:** [`app/src/test/java/cz/zamerovac/app/LedgerTestFault.java`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/app/src/test/java/cz/zamerovac/app/LedgerTestFault.java) – nepočítat jako další testovací třídu.

## 4. Node/JavaScript QUICK (71)

<details><summary>Otevřít úplný seznam 71 skriptů</summary>

- [`tests/annotation_geometry_contract.js`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tests/annotation_geometry_contract.js)
- [`tests/annotation_grip_geometry.js`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tests/annotation_grip_geometry.js)
- [`tests/annotation_history_contract.js`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tests/annotation_history_contract.js)
- [`tests/annotation_history_save_failure.js`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tests/annotation_history_save_failure.js)
- [`tests/annotation_hit_geometry.js`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tests/annotation_hit_geometry.js)
- [`tests/annotation_pinch_contract.js`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tests/annotation_pinch_contract.js)
- [`tests/annotation_resize_contract.js`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tests/annotation_resize_contract.js)
- [`tests/annotation_selection_contract.js`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tests/annotation_selection_contract.js)
- [`tests/annotation_snap_contract.js`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tests/annotation_snap_contract.js)
- [`tests/annotation_translation_contract.js`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tests/annotation_translation_contract.js)
- [`tests/annotation_viewport_contract.js`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tests/annotation_viewport_contract.js)
- [`tests/audit39_hierarchy.js`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tests/audit39_hierarchy.js) [F]
- [`tests/bosch_history_devices.js`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tests/bosch_history_devices.js) [F]
- [`tests/causal_app_clock.js`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tests/causal_app_clock.js)
- [`tests/dimension_drag_interaction.js`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tests/dimension_drag_interaction.js) [F]
- [`tests/e2e_harness_git_preflight.js`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tests/e2e_harness_git_preflight.js)
- [`tests/editor_full_tools.js`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tests/editor_full_tools.js) [F]
- [`tests/experimental_and_precision.js`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tests/experimental_and_precision.js) [F]
- [`tests/extra_toolbar_interaction.js`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tests/extra_toolbar_interaction.js) [F]
- [`tests/feedback_inflight_save.js`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tests/feedback_inflight_save.js)
- [`tests/feedback_raster_reuse.js`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tests/feedback_raster_reuse.js)
- [`tests/feedback_report_structure.js`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tests/feedback_report_structure.js) [F]
- [`tests/geometry_drag_28.js`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tests/geometry_drag_28.js) [F]
- [`tests/gesture_history_undo_redo.js`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tests/gesture_history_undo_redo.js)
- [`tests/help_guide.js`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tests/help_guide.js) [F]
- [`tests/home_qa_integrity.js`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tests/home_qa_integrity.js)
- [`tests/home_sandbox_security.js`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tests/home_sandbox_security.js)
- [`tests/inset_audio_customer_export.js`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tests/inset_audio_customer_export.js)
- [`tests/inset_audio_marker_geometry.js`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tests/inset_audio_marker_geometry.js)
- [`tests/inset_workspace_interaction.js`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tests/inset_workspace_interaction.js) [F]
- [`tests/laser_auto_interaction.js`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tests/laser_auto_interaction.js) [F]
- [`tests/laser_precision_regression.js`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tests/laser_precision_regression.js) [F]
- [`tests/laser_tap_interaction.js`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tests/laser_tap_interaction.js) [F]
- [`tests/local_browser_qa_contract.js`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tests/local_browser_qa_contract.js)
- [`tests/media_import_ownership.js`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tests/media_import_ownership.js)
- [`tests/media_import_transaction_faults.js`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tests/media_import_transaction_faults.js)
- [`tests/menu_dismiss_interaction.js`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tests/menu_dismiss_interaction.js)
- [`tests/new_28_regressions.js`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tests/new_28_regressions.js) [F]
- [`tests/new_record_save_failure.js`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tests/new_record_save_failure.js)
- [`tests/note_leader_interaction.js`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tests/note_leader_interaction.js)
- [`tests/post17_regressions.js`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tests/post17_regressions.js)
- [`tests/qa34_client_gate_integration.js`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tests/qa34_client_gate_integration.js)
- [`tests/qa36_soft_timeout.js`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tests/qa36_soft_timeout.js)
- [`tests/qa41_diag.js`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tests/qa41_diag.js)
- [`tests/qa_binary_fixture_paths.js`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tests/qa_binary_fixture_paths.js)
- [`tests/qa_fixture_attempts.js`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tests/qa_fixture_attempts.js)
- [`tests/qa_fixture_process_scope.js`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tests/qa_fixture_process_scope.js)
- [`tests/qa_fixture_tap_gate.js`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tests/qa_fixture_tap_gate.js)
- [`tests/qa_gate_3try_integration.js`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tests/qa_gate_3try_integration.js)
- [`tests/qa_integration_boundaries.js`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tests/qa_integration_boundaries.js)
- [`tests/qa_process_client.js`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tests/qa_process_client.js)
- [`tests/qa_process_diagnostics.js`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tests/qa_process_diagnostics.js)
- [`tests/qa_product_mode_compatibility.js`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tests/qa_product_mode_compatibility.js)
- [`tests/qa_reference_bootstrap.js`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tests/qa_reference_bootstrap.js)
- [`tests/refactor_end_to_end_undo.js`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tests/refactor_end_to_end_undo.js)
- [`tests/refactor_shape_resize_undo.js`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tests/refactor_shape_resize_undo.js)
- [`tests/release_history.js`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tests/release_history.js) [F]
- [`tests/revision_vector.js`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tests/revision_vector.js)
- [`tests/rich_note_attachment_state.js`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tests/rich_note_attachment_state.js) [F]
- [`tests/save_acknowledgement.js`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tests/save_acknowledgement.js) [F]
- [`tests/save_blocked_load_regression.js`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tests/save_blocked_load_regression.js)
- [`tests/save_cas_conflict_guard.js`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tests/save_cas_conflict_guard.js)
- [`tests/save_cas_missing_database.js`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tests/save_cas_missing_database.js)
- [`tests/save_cas_recovery_integrity.js`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tests/save_cas_recovery_integrity.js)
- [`tests/symbol_search_interaction.js`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tests/symbol_search_interaction.js)
- [`tests/sync_canonical.js`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tests/sync_canonical.js) [F]
- [`tests/sync_conflict_bridge.js`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tests/sync_conflict_bridge.js) [F]
- [`tests/sync_protocol_v2.js`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tests/sync_protocol_v2.js) [F]
- [`tests/trash_restore_save_confirmation.js`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tests/trash_restore_save_confirmation.js)
- [`tests/trash_ui_interaction.js`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tests/trash_ui_interaction.js) [F]
- [`tests/versioning.js`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tests/versioning.js)

</details>

**Zvlášť mimo `tests/*.js` glob:** [`tests/qa-simple-chromium.test.cjs`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tests/qa-simple-chromium.test.cjs) – nezávislé testy runner/harness spouštěné krokem `Test current runner`.

## 5. Python (25 objevených + 2 opt-in)

<details><summary>Otevřít 25 Python unittest souborů</summary>

- [`tests/test_address_and_icons.py`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tests/test_address_and_icons.py) [F]
- [`tests/test_address_map_link.py`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tests/test_address_map_link.py) [F]
- [`tests/test_bosch_ble.py`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tests/test_bosch_ble.py) [F]
- [`tests/test_chromium_revision.py`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tests/test_chromium_revision.py)
- [`tests/test_ci_cloud_release_gate.py`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tests/test_ci_cloud_release_gate.py)
- [`tests/test_diag41.py`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tests/test_diag41.py)
- [`tests/test_dimension_selection.py`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tests/test_dimension_selection.py)
- [`tests/test_editor_toolbar.py`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tests/test_editor_toolbar.py)
- [`tests/test_gallery_camera_notes.py`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tests/test_gallery_camera_notes.py)
- [`tests/test_home_qa_gate.py`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tests/test_home_qa_gate.py)
- [`tests/test_home_qa_version_preflight.py`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tests/test_home_qa_version_preflight.py)
- [`tests/test_home_release_asset_redirect.py`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tests/test_home_release_asset_redirect.py)
- [`tests/test_home_release_publish_url_security.py`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tests/test_home_release_publish_url_security.py)
- [`tests/test_imagemeter_inset.py`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tests/test_imagemeter_inset.py)
- [`tests/test_project.py`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tests/test_project.py)
- [`tests/test_qa130_startup_cleanup.py`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tests/test_qa130_startup_cleanup.py)
- [`tests/test_qa36_supervisor_model.py`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tests/test_qa36_supervisor_model.py)
- [`tests/test_qa_integration_boundaries.py`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tests/test_qa_integration_boundaries.py)
- [`tests/test_qa_process_diagnostic.py`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tests/test_qa_process_diagnostic.py)
- [`tests/test_qa_process_identity.py`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tests/test_qa_process_identity.py)
- [`tests/test_qa_process_supervisor.py`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tests/test_qa_process_supervisor.py)
- [`tests/test_qa_windows_file_lock.py`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tests/test_qa_windows_file_lock.py)
- [`tests/test_qa_windows_job_contract.py`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tests/test_qa_windows_job_contract.py)
- [`tests/test_sync_ack_acceptance.py`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tests/test_sync_ack_acceptance.py) [F]
- [`tests/test_upgrade.py`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tests/test_upgrade.py)

</details>

**Mimo `test_*.py` standardní discover:** [`tests/manual_audio_completed_keep_regression.py`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tests/manual_audio_completed_keep_regression.py); [`tests/media_import_real_chromium.py`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tests/media_import_real_chromium.py). `manual_audio_completed_keep_regression.py` je vědomě manuální zdrojový RED diagnostický skript; `media_import_real_chromium.py` je volitelná skutečná browser/IndexedDB kontrola. Nezaměňovat jejich existenci s automatickým PASS.

## 6. QUICK Chromium (7) a další kontrolní nástroje

- [`tools/check-address-map-browser.cjs`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tools/check-address-map-browser.cjs)
- [`tools/check-loupe-exit-browser.cjs`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tools/check-loupe-exit-browser.cjs)
- [`tools/check-orientation-browser.cjs`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tools/check-orientation-browser.cjs)
- [`tools/check-post148-browser.cjs`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tools/check-post148-browser.cjs)
- [`tools/check-post149-browser.cjs`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tools/check-post149-browser.cjs)
- [`tools/check-post17-browser.cjs`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tools/check-post17-browser.cjs)
- [`tools/check-untrusted-ids-browser.cjs`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tools/check-untrusted-ids-browser.cjs)

**Další samostatné kontroly a spouštěče, které nejsou E2E sadou:** [`tools/check-android-window.cjs`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tools/check-android-window.cjs); [`tools/check-customer-pdf.py`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tools/check-customer-pdf.py); [`tools/qa/audit.cjs`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tools/qa/audit.cjs); [`tools/emulator-smoke.sh`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tools/emulator-smoke.sh); [`tools/sync-ack-acceptance.py`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tools/sync-ack-acceptance.py); [`tools/drive-config-checks/build.gradle`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tools/drive-config-checks/build.gradle). `tools/check-customer-pdf.py` se volá až po Gradle při kontrole zákaznických ZIP/PDF; `tools/sync-ack-acceptance.py` vyhodnocuje 513 metod a dvě raw FAIL #88; `tools/emulator-smoke.sh` je samostatná Android emulátorová cesta, nebyla součástí posledního hosted `available` běhu.

**Řízení běhů:** [`chromium-simple.yml`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/.github/workflows/chromium-simple.yml) (ověřený `available`), [`quick-check.yml`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/.github/workflows/quick-check.yml), [`verify-native.yml`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/.github/workflows/verify-native.yml), [`emulator-smoke.yml`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/.github/workflows/emulator-smoke.yml). Další historické/ruční workflow v [`.github/workflows/`](https://github.com/zaplikj30-ui/Zamerovac-android/tree/9757df251ca60008e6dc1d69209cbe58213f794f/.github/workflows/) nepovažovat automaticky za proběhlé testy. HOME zůstává vypnuté.

## 7. Kde existující mapa pokrytí není úplným rejstříkem

Zkontrolována [`qa/coverage-v1.json`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/qa/coverage-v1.json): **44 oblastí / 159 přiřazení / 107 unikátních souborů**. Všech 107 uvedených souborů **v přesném stromu produktu existuje** (0 ztracených cest). Tento feature-level přehled ale neobsahuje všechny testovací soubory:

- Java/JVM: **7** ze 64 tříd bez přiřazení k funkci:
  - [`app/src/test/java/cz/zamerovac/app/DatabaseInstallEvidenceTest.java`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/app/src/test/java/cz/zamerovac/app/DatabaseInstallEvidenceTest.java)
  - [`app/src/test/java/cz/zamerovac/app/MediaImportOwnershipTest.java`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/app/src/test/java/cz/zamerovac/app/MediaImportOwnershipTest.java)
  - [`app/src/test/java/cz/zamerovac/app/Post149NativeTest.java`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/app/src/test/java/cz/zamerovac/app/Post149NativeTest.java)
  - [`app/src/test/java/cz/zamerovac/app/ProtectedArchiveCoverageTest.java`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/app/src/test/java/cz/zamerovac/app/ProtectedArchiveCoverageTest.java)
  - [`app/src/test/java/cz/zamerovac/app/RecoveryCandidateReviewTest.java`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/app/src/test/java/cz/zamerovac/app/RecoveryCandidateReviewTest.java)
  - [`app/src/test/java/cz/zamerovac/app/RecoveryInventoryTest.java`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/app/src/test/java/cz/zamerovac/app/RecoveryInventoryTest.java)
  - [`app/src/test/java/cz/zamerovac/app/RecoveryProtectionArchiveTest.java`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/app/src/test/java/cz/zamerovac/app/RecoveryProtectionArchiveTest.java)
- JavaScript QUICK: **50** ze 71 souborů bez přímého přiřazení; zahrnují aplikační regresi **i** QA/runner bezpečnostní testy. Viz označení [F] v §4.
- Python: **21** z 25 bez přiřazení; velká část je QA infrastruktura/CI validace, nikoli samostatná uživatelská funkce.
- Krátké Chromium kontroly: **7/7** bez přiřazení, přestože jsou ve skutečném runneru.
- Z aktivních Chromium sad chybí explicitní funkční přiřazení pro [`tools/e2e/legacy-conflict-persistence.cjs`](https://github.com/zaplikj30-ui/Zamerovac-android/blob/9757df251ca60008e6dc1d69209cbe58213f794f/tools/e2e/legacy-conflict-persistence.cjs), který byl v `available` skutečně spuštěn.
- Dvě další E2E cesty (§2) stojí mimo poslední `available` kontrakt a musejí mít oddělený provozní stav.

**Závěr k evidenci:** funkční mapa je **částečná**, nikoli neexistující; nejde o důkaz chybějících testů nebo o pokyn přidat všechny QA podpůrné soubory mezi produktové funkce. Je potřeba u skutečně aplikačních chybějících souborů doplnit mapování, u infrastrukturních ponechat tento samostatný soupis a kontrolovat, který workflow je spouští. Závazné pravidlo pro nové fyzické vady je zvlášť v [PR #180](https://github.com/zaplikj30-ui/Zamerovac-android/pull/180).

## 8. Zbývající mezery a pravidla aktualizace

- **Mapování:** doplnit relevantní vazby aplikačních testů na existujících 44 oblastí, bez vymýšlení nové funkce a bez přepisu `qa/coverage-v1.json` jen kvůli počtu. U testů pro runner/CI se spojení s produktovou funkcí nevyžaduje.
- **Úplnost na úrovni jednotlivých asercí:** tento soupis je **úplný pro výše definované souborové skupiny na uvedeném SHA**, ale **NEPROVEDL** nové nezávislé sčítání všech vnitřních JUnit/Node/Python metod a všech historických variant. Počet 513 a 96 pochází ze skutečného posledního běhu a aktuálního runner workflow. Není to 513+96 samostatných názvů v tomto dokumentu.
- **Vydání a fyzická validace:** testy neprokazují fyzickou správnost Samsung/Android, S Pen, Bosch BLE, živý Drive/OAuth, SAF, systémové pickery ani skutečný power-cut. [#88](https://github.com/zaplikj30-ui/Zamerovac-android/pull/88) má **dvě raw FAIL**; ty se nesmí schovat zeleným souhrnem.
- **Stará metadata:** hodnoty `manualGates`/`openAutomationGaps` v mapě popisují předchozí etapy a některé staré PR, proto se jejich tvrzení nesmí bez nového důkazu přenést na aktuální HEAD.
- **Při každé následné změně testů** znovu porovnat strom, aktuální workflow a `qa/coverage-v1.json`; nová oprava fyzické vady má podle PR #180 doplnit trvalý regresní test a podle rizika fyzický retest.
- **Stavy této inventury:** **PASS** statické porovnání úplného stromu, globů a existujících funkčních referencí; **NOT RUN** spuštění testů a fyzická zkouška; **SKIP** nevykazováno, žádný běh nebyl požadován. MAIN, HOME, APK i workflow **BEZE ZMĚNY**.
