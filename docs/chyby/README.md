# Evidence chyb Zaměřovače

Tato složka je **rozcestník**, nikoli druhá databáze chyb.

**Hlášení z fialové vlaječky v aplikaci:** [příjmová složka a postup převzetí](z-aplikace/README.md). Exportní ZIP si asistent převezme až na pokyn vlastníka; před uploadem na GitHub přílohy úsporně upraví, ale média v telefonu nemění. **Zdroj pravdy jsou [GitHub Issues](https://github.com/zaplikj30-ui/Zamerovac-android/issues)**. Původní testovací deník je [#13](https://github.com/zaplikj30-ui/Zamerovac-android/issues/13); výsledky automatických testů patří do [#28](https://github.com/zaplikj30-ui/Zamerovac-android/issues/28). Nepřepisovat zde celé záznamy a nevytvářet duplicity.

## Nahlášené problémy z fyzického testování 18. 11. 2026

| Priorita | Hlášení / stav | Detail |
| --- | --- | --- |
| P1 | Opakované varování na uchované hlasové nahrávky: **JS příčina opakovaných toastů reprodukována**; oprava je v [DRAFT PR #198](https://github.com/zaplikj30-ui/Zamerovac-android/pull/198), nikoli vydaná ani fyzicky ověřená. Na posledním SHA opravy čeká nezávislé re-review a cloudový retest. Příčina nejisté evidence nahrávek a související Android latence zůstává **NEOVĚŘENA**. | [#190](https://github.com/zaplikj30-ui/Zamerovac-android/issues/190) |
| P1 | Zasekávání editoru a nespolehlivé uchopení kót. Příčina **NEOVĚŘENA**. | [#191](https://github.com/zaplikj30-ui/Zamerovac-android/issues/191) |
| P2 | Opakované hlášení o spárování/synchronizaci. Příčina **NEOVĚŘENA**. | [#192](https://github.com/zaplikj30-ui/Zamerovac-android/issues/192) |
| P2 | Rychlé tlačítko vlevo dole zůstává na fotografii místo poslední akce. V aktuální cestě kódu **neimplementováno**. | [#194](https://github.com/zaplikj30-ui/Zamerovac-android/issues/194) |
| P2 | Uživatel hlásí prodlevu při vytváření složky; příčina/latence **NEOVĚŘENA**. | [#195](https://github.com/zaplikj30-ui/Zamerovac-android/issues/195) |
| P2 (UX) | Schválené zpřehlednění nastavení do 5 kategorií, **bez Bosch jako hlavní kategorie**. **Neimplementováno.** | [#196](https://github.com/zaplikj30-ui/Zamerovac-android/issues/196) |
| P1 | Nabídka **+ → Hlasová poznámka** tiše nic nevytvoří, protože mimo otevřenou poznámku `recordVoice()` předčasně končí. | [#197](https://github.com/zaplikj30-ui/Zamerovac-android/issues/197) |

**Schválený návrh UX, ne implementace:** stavové ikony synchronizace a omezení rušivých toastů: [#38 – rozhodnutí](https://github.com/zaplikj30-ui/Zamerovac-android/issues/38#issuecomment-6987009110). Stav selhání = zřetelný křížek/vykřičník a slovní popis, ne pouhá tečka.

**Verze při testování:** aplikace na jednom screenshotu uvádí 1.4.1. Při evidenci byl `main` na `c990c03d91ab48a7b10d96fda65b727ec1cacc50`, ale **přesné SHA nainstalované APK nebylo zjištěno**. Záznam není výsledkem testu tohoto SHA.

### Přiložené důkazy a omezení

K 18. 11. 2026 bylo pro původní hlášení #190–#192 v chatu zpracováno **5 zmenšených JPG + 1 přibližně 11,6s MP4** s překrytím viditelné adresy/e-mailu a bez metadat. Balíček má 356 809 B; SHA256:
`789462ca572942b35ed92e879e60d8475717858b36c37fc1b50beac9cc56c5cd`.

**NEOVĚŘENO NA GITHUBU:** samotné binární přílohy nebyly v době zápisu nahrané do repozitáře ani do issue. Jsou předané uživateli jako `Zamerovac-chyby-2026-11-18-dukazy.zip` v původním chatu; nelze na ně z GitHubu trvale odkazovat, dokud není doložen funkční upload. SHA256 jednotlivých souborů jsou uvedeny u #190–#192. Do té doby nesmí být issue uzavřeno na základě nedostupného videa. Nepublikovat původní soubory s GPS, adresou, e-mailem ani neveřejnými zakázkami; použití redigovaného interiéru uživatel odsouhlasil.


**Novější video k #194–#195:** `1000095380.mp4` (23,06 s) je v chatu; pro zkratku byl připraven úsporný výřez spodní lišty `shortcut-evidence-2026-11-18.jpg` (150 511 B, SHA256 `4db62c624b2ede0871b474df59f1aef079f7b37d38a84ebe595ad8e6fcdbd33f`). Ani tyto binární soubory zatím nejsou na GitHubu. Chybné původní tvrzení, že se ikona správně změnila na složku, bylo po kontrolním prohlédnutí videa a současného kódu výslovně opraveno.

**Novější video k #196:** `1000095381.mp4` (~6,35 s, 8,4 MB) bylo v chatu zmenšeno bez metadat na `nastaveni-neprehledne.mp4` (400 250 B, SHA256 `b92f5040b52e9e30022b23a8f3da97be74b5b0ccb92a17e043f4b6de0f8a70e7`), samostatný snímek `nastaveni-snim.jpg` (~58 kB). Úsporné přílohy jsou pouze v chatu; **nejsou nahrané na GitHub**. Jde o schválený směr navigace a ergonomie, nikoli o výsledek testu nebo změnu fungování aplikace.


**Nové schválení k #190/#196:** nouzový seznam „Uchované hlasové nahrávky“ přesunout z hlavního přehledu do **Nastavení → Aplikace a údržba → Obnova nahrávek**. Na hlavní stránce ponechat jen malý stav **při skutečné potřebě zásahu**, zachovat ochranu původních zvukových bajtů a varování na nejistou evidenci. Jde o návrh, nikoliv hotovou implementaci.

**Video k #197:** `1000095382.mp4` (15,31 s) dokládá nefunkční `+ → Hlasová poznámka`. Redigovaná a úsporná kopie `mikrofon-nefunkcni-anonymizovano.mp4` má 74 332 B, SHA256 `3086d16a087b3ae1829e08022d731a233e93bd9f51036571ec0a5dcdfe910bb8`. **Video není nahrané na GitHub**, pouze předané v původním chatu. Testy opravy NOT RUN.

## Jak evidovat nové chyby

1. Nejprve ověř, zda stejná chyba už nemá issue. Pro jedno reprodukovatelné selhání jeden záznam, související nálezy propojit odkazy. Neplést chybu s návrhem vylepšení.
2. Zapiš: **co uživatel přesně udělal; očekávaný a skutečný výsledek; zařízeni/verzi; četnost; dopad na data; prioritu; související funkce; důkazy**. Neznámé výslovně **NEOVĚŘENO**. Soukromé údaje do veřejného GitHubu nepatří.
3. Fotky a video před zveřejněním úsporně převést, odstranit metadata **i viditelnou citlivou informaci přímo v obraze**; ověřit, že zmenšení nezničilo důkaz. Ověřit skutečné umístění přílohy na GitHubu, předat přímé URL a případně SHA256. Pokud nahrání není technicky možné, uvést pravdivě **PŘÍLOHA NENÍ NA GITHUBU**.
4. Při opravě programátor zajistí pozitivní/negativní a související regresní testy, kde vhodné FAIL před → PASS po, vlastní review a konkrétní SHA. Nezávislý kontrolor je jiný chat. Fyzický Android/S Pen/Bosch retest není nahrazen prohlížečem ani Robolectric.
5. Stavy oddělovat: **Nahlášeno → Reprodukováno → Opraveno v kódu → Testováno → Vydáno → Fyzicky potvrzeno**. Neuzavírat chybu pouze podle slibu opravy či nového commitu.

Související pravidla: [AGENTS.md](../../AGENTS.md), [TESTY_A_OPRAVY.md](../../TESTY_A_OPRAVY.md), [START ZDE](../../START_ZDE.md).

**Tento soubor je pouze dokumentace.** Neprovádí změny aplikace, testů, sync, uživatelských dat ani APK. Žádné Actions nejsou povoleny samotným vznikem této evidence.
