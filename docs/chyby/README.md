# Evidence chyb Zaměřovače

Tato složka je **rozcestník**, nikoli druhá databáze chyb. **Zdroj pravdy jsou [GitHub Issues](https://github.com/zaplikj30-ui/Zamerovac-android/issues)**. Původní testovací deník je [#13](https://github.com/zaplikj30-ui/Zamerovac-android/issues/13); výsledky automatických testů patří do [#28](https://github.com/zaplikj30-ui/Zamerovac-android/issues/28). Nepřepisovat zde celé záznamy a nevytvářet duplicity.

## Nahlášené problémy z fyzického testování 18. 11. 2026

| Priorita | Hlášení / stav | Detail |
| --- | --- | --- |
| P1 | Opakované varování na uchované hlasové nahrávky. Příčina **NEOVĚŘENA**. | [#190](https://github.com/zaplikj30-ui/Zamerovac-android/issues/190) |
| P1 | Zasekávání editoru a nespolehlivé uchopení kót. Příčina **NEOVĚŘENA**. | [#191](https://github.com/zaplikj30-ui/Zamerovac-android/issues/191) |
| P2 | Opakované hlášení o spárování/synchronizaci. Příčina **NEOVĚŘENA**. | [#192](https://github.com/zaplikj30-ui/Zamerovac-android/issues/192) |

**Schválený návrh UX, ne implementace:** stavové ikony synchronizace a omezení rušivých toastů: [#38 – rozhodnutí](https://github.com/zaplikj30-ui/Zamerovac-android/issues/38#issuecomment-6987009110). Stav selhání = zřetelný křížek/vykřičník a slovní popis, ne pouhá tečka.

**Verze při testování:** aplikace na jednom screenshotu uvádí 1.4.1. Při evidenci byl `main` na `c990c03d91ab48a7b10d96fda65b727ec1cacc50`, ale **přesné SHA nainstalované APK nebylo zjištěno**. Záznam není výsledkem testu tohoto SHA.

### Přiložené důkazy a omezení

K 18. 11. 2026 bylo v chatu zpracováno **5 zmenšených JPG + 1 přibližně 11,6s MP4** s překrytím viditelné adresy/e-mailu a bez metadat. Balíček má 356 809 B; SHA256:
`789462ca572942b35ed92e879e60d8475717858b36c37fc1b50beac9cc56c5cd`.

**NEOVĚŘENO NA GITHUBU:** samotné binární přílohy nebyly v době zápisu nahrané do repozitáře ani do issue. Jsou předané uživateli jako `Zamerovac-chyby-2026-11-18-dukazy.zip` v původním chatu; nelze na ně z GitHubu trvale odkazovat, dokud není doložen funkční upload. SHA256 jednotlivých souborů jsou uvedeny u #190–#192. Do té doby nesmí být issue uzavřeno na základě nedostupného videa. Nepublikovat původní soubory s GPS, adresou, e-mailem ani neveřejnými zakázkami; použití redigovaného interiéru uživatel odsouhlasil.

## Jak evidovat nové chyby

1. Nejprve ověř, zda stejná chyba už nemá issue. Pro jedno reprodukovatelné selhání jeden záznam, související nálezy propojit odkazy. Neplést chybu s návrhem vylepšení.
2. Zapiš: **co uživatel přesně udělal; očekávaný a skutečný výsledek; zařízeni/verzi; četnost; dopad na data; prioritu; související funkce; důkazy**. Neznámé výslovně **NEOVĚŘENO**. Soukromé údaje do veřejného GitHubu nepatří.
3. Fotky a video před zveřejněním úsporně převést, odstranit metadata **i viditelnou citlivou informaci přímo v obraze**; ověřit, že zmenšení nezničilo důkaz. Ověřit skutečné umístění přílohy na GitHubu, předat přímé URL a případně SHA256. Pokud nahrání není technicky možné, uvést pravdivě **PŘÍLOHA NENÍ NA GITHUBU**.
4. Při opravě programátor zajistí pozitivní/negativní a související regresní testy, kde vhodné FAIL před → PASS po, vlastní review a konkrétní SHA. Nezávislý kontrolor je jiný chat. Fyzický Android/S Pen/Bosch retest není nahrazen prohlížečem ani Robolectric.
5. Stavy oddělovat: **Nahlášeno → Reprodukováno → Opraveno v kódu → Testováno → Vydáno → Fyzicky potvrzeno**. Neuzavírat chybu pouze podle slibu opravy či nového commitu.

Související pravidla: [AGENTS.md](../../AGENTS.md), [TESTY_A_OPRAVY.md](../../TESTY_A_OPRAVY.md), [START ZDE](../../START_ZDE.md).

**Tento soubor je pouze dokumentace.** Neprovádí změny aplikace, testů, sync, uživatelských dat ani APK. Žádné Actions nejsou povoleny samotným vznikem této evidence.
