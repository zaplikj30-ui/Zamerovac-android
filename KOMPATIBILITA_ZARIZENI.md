# Evidence kompatibility a plán testování zařízení

**Založeno 4. 11. 2026.** Pracovní registr pro širokou podporu různých značek telefonů a tabletů Android. **Tento soubor sám o sobě nedokládá provedení nového testu.** 
Podrobná pravidla viz [VIZE_A_PLAN.md](VIZE_A_PLAN.md), část *Široká kompatibilita Android telefonů a tabletů*. V budoucnu lze rozšířit testy i na Windows a případně iOS/iPadOS, **ale tyto aplikace teď neexistují jako ověřené platformy**.

## Bosch laser a obecné ovládání – ověření není předpoklad

Implementace `app/src/main/java/cz/zamerovac/app/BoschClassicReader.java` je podle dokumentovaného stavu **experimentální**. Úspěšný build, mock Bluetooth ani obecná kompatibilita Androidu **nepotvrzuje** konkrétní laser. Pro skutečné PASS vždy zaznamenej **model Bosch, firmware, model/Android telefonu, povolená oprávnění, přerušení/odpojení** a ověř skutečnou uloženou hodnotu a jednotku; ruční zadávání musí fungovat i bez BT. Prst je základní způsob ovládání bez závislosti na S Pen; kompatibilitu pera jiné značky, dotyku nebo myši uváděj až po příslušném testu. Tyto body jsou testovací kontrakt, nikoli nová podpora zařízení.

## Význam stavů

- **Ověřeno – konkrétní scénář:** existuje důkaz o testu s modelem, verzí Androidu, verzí APK a výsledkem; **neplatí automaticky pro celou aplikaci**.
- **Částečně historicky otestováno:** z uživatelského záznamu je potvrzená část funkcí, ale metadata nebo úplný rozsah chybí.
- **Pravděpodobně kompatibilní – neověřeno:** technická možnost podle systémových API; **nikdy nezaměňovat s potvrzenou podporou**.
- **Potvrzená nekompatibilita:** doložený a reprodukovatelný problém konkrétní kombinace zařízení/Android/APK.
- **Netestováno:** žádný důvěryhodný důkaz pro uvedenou kombinaci.

## Počáteční registr

| Zařízení / výrobce | Verze Androidu | APK / build | Rozsah a zdroj | Stav a omezení |
|---|---|---|---|---|
| **Samsung Galaxy S24 Ultra** | Neuvádět bez dokladu konkrétního testu | Historické testování kolem 1.2.146, konkrétní sestavení při každém kroku ověřit | [Historický deník #13](https://github.com/zaplikj30-ui/Zamerovac-android/issues/13), [rekonstrukce 1–28](REKONSTRUKCE_TESTU_01_10.md) | **Částečně historicky otestováno.** Nalezené chyby a úspěchy jen podle konkrétního testu; nevydávat za plnou kompatibilitu. |
| **Samsung Galaxy Tab S11 Ultra** | Nutno doložit přesně | Nutno doplnit | Zařízení uvedeno v historickém testovacím zadání | **Rozsah individuálních výsledků není bezpečně přiřazen.** Není potvrzené kompletní otestování na tabletu. |

| **Xiaomi, Google Pixel, Motorola, OnePlus, Honor a další** | Různé | Zatím bez doloženého zařízení / APK | Žádný reálný test v tomto registru | **Netestováno.** Cílové značky, nikoli seznam potvrzené podpory. |

## Povinná karta při každém novém testu

```text
Datum:
Výrobce a přesný model:
Verze Androidu a případně API:
Verze aplikace, versionCode / SHA APK:
Telefon / tablet, rozlišení, orientace, rozdělená obrazovka, měřítko písma:
Hardware a oprávnění (Bluetooth model, stylus, fotoaparát, soubory):
Přesný scénář a postup:
Očekávaný a skutečný výsledek:
Stav: Ověřeno / Částečně / Nekompatibilita / Netestováno
Video/screenshot/CI odkaz nebo číslo GitHub issue:
Známé omezení a potřebná oprava:
```

## Navržený postupný testovací plán – zatím **neproveden**

1. **Automatické testy a emulátory:** postupně volit různé API od podporovaného minima, obrazovky menších telefonů i tabletů, portrét/krajinu, vyšší systémové písmo, změnu velikosti okna či split-screen, pokud to zařízení umí.
2. **Základní pracovní řetězec:** vytvořit zakázku → upravit údaje/fotografii nebo model → uložit → ukončit aplikaci → znovu otevřít → ověřit, že se žádná data, geometrie ani přílohy neztratily.
3. **Datová regresní kontrola:** bezpečný ZIP export/import a aktualizace přes předchozí instalovanou verzi bez smazání uživatelských dat, pokud má aplikace příslušnou funkci.
4. **Oprávnění a chybějící hardware:** zamítnutý fotoaparát/mikrofon, Bluetooth vypnuté nebo nepřítomné, nepřítomný stylus, alternativní správce souborů. Základní aplikace nesmí spadnout; chyby hlásit srozumitelně.
5. **Reálná zařízení:** doplnit podle možností alespoň dalšího výrobce mimo Samsung, případně Firebase Test Lab; u laserů a stylusů potvrdit funkčnost **pouze na fyzickém modelu, kde se test skutečně provedl**.

**Rozsah příští aktualizace:** nejprve schválené opravy a bezpečnost dat; na právě změněných funkcích cílené regresní testy různých velikostí a verzí Androidu. **Žádný samostatný APK build ani hromadný redesign pouze kvůli registru.**
