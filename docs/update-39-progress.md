# Společná aktualizace #39 – pracovní evidence

Práce pokračuje na `codex/velka-aktualizace-39`, draft PR #41. Bez merge, APK a skutečných zákaznických dat. Zachované opravy `85ed7ec`, `f4d6282` a izolované revizní vektory.

## Etapa 1 – ukládání a chybové cesty #33

- JS posune potvrzený snapshot až po úspěšném nativním zápisu. Nativní compare-and-save pod lokálním zámkem odmítá zastaralý základ; třícestné sloučení uchovává obě souběžné změny. Opožděný callback čte aktuální diskový stav. Selhání zápisu vrací chybu a nehlásí potvrzení.
- ZIP před prvním bajtem kontroluje přítomnost všech odkazovaných příloh včetně vnořených detailů; chybějící/prázdný soubor export zastaví. Úspěch se oznamuje po uzavření výstupu poskytovatele. Nedokončený výstup se aplikace pokusí odstranit; poskytovatel může odstranění odmítnout.
- Nahrávání při chybě uvolní mikrofon a neplatný záznam se nepřipojí k poznámce.
- Nápověda vysvětluje skutečné chybové chování. `release-history.js.pendingChanges` jsou nevydané pracovní podklady, nikoliv nová smyšlená verze; před vydáním je nutno připravit jednu položku se skutečným číslem workflow.

Testy: `tests/save_acknowledgement.js` (selhání zápisu, potvrzení, přesné konfliktní hodnoty, opakování, opožděný callback), `StorageLifecycleTest` (neúplný ZIP, chyba výstupu, stale compare-and-save, odmítnutý disk, cleanup audia). Místně všechny Node testy prošly, Python 47 se dvěma skipy bez javac. Nové nativní testy musí potvrdit Actions. Testy s mockem disku/mikrofonu nejsou fyzickým ověřením plného telefonu.

## Zbývající schválený rozsah

Úplná #33 ještě není dokončena: síť pod globálním zámkem, druhý postup zápisu sync, integrita a idempotence přenosů, cleanup vzdálených médií, další nedůvěryhodné vstupy. Skutečná přímá/offline synchronizace, párování, přenosová fronta a Google Drive API/OAuth #38 a neměnné historie/obnova #40 nejsou hotové. Dále galerie #35/#36/#37, editor #12/#13, foto #21, landscape lišta #26, navigace nápovědy #29, texty Bluetooth #34 a odpovídající testy #28.

## Prostředí

Git klon jednou selhal: `Failed to connect to proxy port 8080`. `gh auth status` neprošel. Následoval úplný textový snapshot 122 souborů přes GitHub konektor; každý soubor byl ověřen proti Git blob SHA `f4d6282`. Místně je Java runtime 21, chybí javac/Gradle/Android SDK. Prohlížeč Chromium/Playwright je dostupný; lokální server vyžaduje síťové oprávnění sandboxu. Zápisy na větev provádět přes GitHub tree/commit a kontrolovaný očekávaný HEAD, nikdy nepřepisovat jiný chat.
