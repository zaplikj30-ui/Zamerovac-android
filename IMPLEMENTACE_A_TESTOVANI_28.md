# Zaměřovač – implementace společné aktualizace podle 28 historických testů

**Pracovní záznam k [PR #15](https://github.com/zaplikj30-ui/Zamerovac-android/pull/15), 4. 11. 2026.**
Přesné závazné zadání: [testy 1–10](REKONSTRUKCE_TESTU_01_10.md), [11–20](REKONSTRUKCE_TESTU_11_20.md), [21–28](REKONSTRUKCE_TESTU_21_28.md), [samostatné schválené doplňky](ROZHODNUTI_A_NAPADY_Z_TESTU.md).
Tento dokument **nepřepisuje originální dohody** a nesmí být použit místo jejich podrobných kapitol.

## Význam stavů

**Upravený kód** = potřebný mechanismus byl programově změněn / doplněn, **neznamená ověřeno**.
**Regrese** = historicky fungující funkce, do které se záměrně významně nezasahovalo.
**Automatické testy** = GitHub Actions JS/Python + nativní Java/Android kompilace; průchod dokazují jen pro kontrolovanou oblast.
**Fyzické ověření** = vyžaduje instalovanou APK a výslovnou odpověď uživatele na Samsungu. Předtím není žádný z nových dotykových / BLE / ZIP výsledků definitivně potvrzený.

| Test | Oblast | Co se v PR #15 změnilo / zachovalo | Stav |
|---:|---|---|---|
| 1 | Šipka | Nezávisle tažený popisek, přímé Bosch měření, dosavadní kreslení zachováno | Upravený kód, čeká na zařízení |
| 2 | Čára | Přímé Bosch, nezávislé číslo/text; střed přesouvá celek, konec jeden bod | Upravený kód, čeká na zařízení |
| 3 | Lomená čára | Dvojklepnutí na posledním bodu, úsekové hodnoty/popisky, další editace bodů | Upravený kód, čeká na zařízení |
| 4 | Dimenzní řetězec | Dvojklepnutí na posledním bodu, samostatné hodnoty a přemístitelné popisky | Upravený kód, čeká na zařízení |
| 5 | Kumulativní řetězec | Společná nula, paralelní odstupy místo vějíře, úsekový Bosch, samostatné popisky | Upravený kód, čeká na zařízení |
| 6 | Úhel | Stupně geometricky + dvě nezávislé délky ramen, jejich Bosch/historie a posuvné popisky | Upravený kód, matematická i uživatelská kontrola |
| 7 | Lichoběžník | Přejmenování Plochy, čtyři nezávislé rohy, kóty všech stran + texty, přesun celku, středové m² | Upravený kód; *bez úhlopříčky / dalšího údaje nelze z pouhých čtyř stran spočítat jednoznačně správný obsah* |
| 8 | Obdélník | Oddělený pravoúhlý nástroj, čtyři rohové úchopy, šířka/výška Bosch, texty, plocha | Upravený kód, čeká na zařízení |
| 9 | Kruh **i** elipsa | Úchopy přesně na obvodu, jejich tažení mění rozměry, samostatný popisek, výběr/historie Bosch | Upravený kód, kritický fyzický test prstem/S Pen |
| 10 | Volná ruka | Původní fungující kreslení a posun zachován | Regrese, čeká na zařízení |
| 11 | Poznámka | Zachovány text/hlas/fotky a nezávislý hrot; stoh více fotografií s jemně přehnutými rohy | Vzhled upraven, retest |
| 12 | Symbol | Základ funkční, neměnit kvůli nezávaznému nápadu na rotaci | Regrese |
| 13 | Bosch Bluetooth | Připojení dříve vybraného laseru na klepnutí, jiný laser ručně, bez automatického scanu při startu; historie zachována | Nativní kód, **nutný fyzický BLE test** |
| 14 | Zpět/Znovu | Dosavadní zásobník zachován, nové gesta napojeny na checkpoint | Regrese + test nové geometrie |
| 15 | Spodní lišta | Tři tečky neutrální, přizpůsobené pořadí ikon zachováno | Upravený kód, vizuální test |
| 16 | Magnet a úchopy | Zachována dotyková oblast, koncový úchop má přednost, vizuální kroužky odděleně; magnet lze vypnout | Kód + VM testy, fyzicky neověřeno |
| 17 | Barva/tloušťka | V kontextovém editoru stylu změna **barvy vybraného objektu**, původní paleta/šířka/font zachovány | Upravený kód |
| 18 | **Směřovat** | Správný název, pevný bodový křížek, štítek pohyblivý 360° bez otočení písma, text/rozměr/Bosch | Upravený kód |
| 19 | Fotografie a zoom | Větší výchozí přiblížení, oddělení vizuální mřížky od přichytávání, původní Přizpůsobit v nabídce | Upravený kód, vizuální/gestický test |
| 20 | Galerie | Odstraněny redundantní horní předchozí/další šipky; horní náhled a spodní Zpět/Znovu zachovány | Upravený kód |
| 21 | Zámky | Zabránění zápisu, přejmenování, mazání/přesunu do/ze zamčených složek a hromadné obcházení podstromem | Upravený kód, integrita důležitá |
| 22 | Koš | Opraveno vyhledání smazaného záznamu při obnově; miniatury; hláška o úspěchu jen když obnova proběhne | Upravený kód, **nutný end-to-end test** |
| 23 | Vyhledávání | Původní fulltext zachován; miniatury, výpis odpovídající poznámky, návrat k dotazu a scrollu, dialog nad klávesnicí | Upravený kód, telefonní test |
| 24 | Řazení | Historicky funkční řazení zachováno | Regrese |
| 25 | Přejmenování/přesun + rozšíření | Ochrana zámků, hromadné označení dlouhým stiskem a akce přesun/kopie/smazání/ZIP; stávající značka editované fotografie | Upravený kód; kritické ověřit přesuny a kopie |
| 26 | ZIP export | Celá aplikace, složka, **jediná fotografie**, **hromadný výběr**; čitelný název podle aplikace/zakázky, potvrzení obsahu | Nativní+JS, **nutný ZIP roundtrip** |
| 27 | ZIP import | Android výběr souboru bez příliš úzkého MIME filtru; stávající validace ZIP zachována | Nativní kód, nutný Samsung test |
| 28 | Data po restartu | Původní ukládání do `schema:1` zachováno, bez migračního přepisu | Regrese, nutný test restartu a aktualizace |

## Schválené doplnění mimo testy

- [Lokalizace #14](https://github.com/zaplikj30-ui/Zamerovac-android/issues/14): základní **český** slovník i18n, rozšiřitelný datový registr, Nastavení → Jazyk aplikace → **🇨🇿 Čeština** (zatím jediná), bez restartu a bez změny uživatelských dat. Nativní Android `strings.xml` pouze pro první nově dotčené řetězce. **Žádné další aktivní jazyky.**
- Zachovat starý originální obraz i editovatelná data v JSON; export/obnova nezaměňovat za budoucí synchronizaci s PC.
- Dlouhodobé nápady (Windows/iOS/Google Play/spojený Konfigurátor/kalkulace) nejsou nynějším implementačním úkolem.

## Rizika a brány před potvrzením

1. **Automatické kontroly:** rychlé JS/Python regrese a nezávislá Java kompilace ve vývojové větvi; pokud něco selže, opravit dřív než připravit APK.
2. **Jeden build po sloučení:** jedna společná aktualizace TEST, žádné samostatné APK pro každý bod.
3. **Záloha stávajících dat:** před prvním testem nové APK zachovat export alespoň jedné ukázkové zakázky, nikoli mazat originály.
4. **Prvních cca pět fyzických testů** se zaměřit na obnovu Koše, ZIP import/export, zámky a úchopy, výsledky hned jednotlivě ukládat do [deníku #13](https://github.com/zaplikj30-ui/Zamerovac-android/issues/13).
5. **Nedeklarovat úplnou funkční správnost všech 28**, dokud uživatel na fyzickém zařízení nereprodukuje příslušné úkony. Pokud nový test odhalí chybu, doplnit přesné číslo, screenshot/video, opravu a retest.

