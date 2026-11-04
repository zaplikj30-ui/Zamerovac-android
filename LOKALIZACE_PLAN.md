# Zaměřovač – technický plán přípravy vícejazyčnosti

**Rozhodnutí ze 4. listopadu 2026. Stav: SCHVÁLENO PRO POSTUPNOU PŘÍPRAVU, NEIMPLEMENTOVÁNO.**

[Samostatný GitHub úkol #14](https://github.com/zaplikj30-ui/Zamerovac-android/issues/14). Příprava se má provádět **jen současně s nadcházejícími schválenými opravami**. Není zadán překlad, jazykový přepínač ani plošný refactoring.

## Tvrdé podmínky
- **Aplikace zůstane výhradně česky.** Nezáleží na systémovém jazyku telefonu, který se může lišit.
- Nedotýkat se neměnných částí a stabilních funkcí pouze kvůli internacionalizaci.
- Zachovat přesné české texty, pokud nebyla konkrétně dohodnuta změna (např. „Směrovat“ → „Směřovat“ je samostatná schválená oprava).
- Lokalizace **nikdy neprovádí překlad zákaznických názvů, textů poznámek, souborů, médií**.
- Schéma a datové soubory `projects.json`, `media-meta.json`, importované/exportované ZIP zůstanou zpětně kompatibilní. Identifikátory `type`, `kind`, `unit`, klíče JSON, cesty a názvy příloh jsou interní technické hodnoty, **nikoli jazykové texty rozhraní**.
- Měření (Bosch, ruční zápis) nesmí po změně zobrazovacího formátu jinak interpretovat uložené hodnoty.

## Návrh minimalizované architektury – detaily budou rozhodnuty při implementaci
1. **Registr klíčů** s jednoznačnými názvy funkčních oblastí: `editor.tool.direction`, `editor.style.fontSize`, `backup.error.invalidZip`, `trash.message.restored`, `common.close`. Jeden klíč znamená jednu významově stabilní hlášku. Název klíče se nesmí používat jako text pro koncového uživatele.
2. **Česká lokalizace** jako jediná dodávaná lokalizace v první etapě. Možný zdroj `i18n/cs.json`; název a formát vybrat tak, aby se bezpečně dostal do WebView `assets` i do nativních Android resources. Dva nezávislé ručně synchronizované seznamy nejsou cílové řešení; pokud je potřeba rozdílný formát, zajistit kontrolu konzistence.
3. **JavaScript/HTML:** funkce `t(key, variables)` (nebo adekvátní lehké API) vrací text na základě českého katalogu. Při chybějícím klíči je chyba viditelná vývojáři; nesmí se na uživatele zobrazit samotný technický klíč či tichý nesmyslný překlad. Při interpolaci nepoužívat nezabezpečený `innerHTML` pro uživatelské hodnoty. Přednostně `textContent` a `setAttribute`.
4. **Nativní Android:** `res/values/strings.xml` a `getString(R.string...) ` pro názvy aplikace, dialogy, chyby, statusy Bluetooth, ZIP a popisky přístupnosti. Zvážit malý deterministický postup pro generování z téhož českého registru bez rozbíjení sestavení.
5. **Formáty:** používat pro *zobrazení* lokalizované formáty (čísla, datum, čas, názvy jednotek), zatím vše v `cs-CZ`. Rozlišit **kanonická data** od **formátované hodnoty**: neměnit `measurementMm`, uložené `unit`, souřadnice, přesnost ani serializaci. Budoucí překlady a přepínač až v samostatné etapě.
6. **A11y:** včetně HTML `aria-label`/`title`/`placeholder` a Android `contentDescription`/TalkBack – žádný text neponechat skrytě mimo plán.
7. **Offline:** katalog je součástí aplikace, žádný síťový request kvůli zobrazení českého tlačítka nebo hlášky.

## Bezpečná první etapa v příští aktualizaci
- Vybrat první **malou logickou sadu právě upravovaných funkcí** z opravných testů 1–28.
- Přidat malý český katalog + malé rozhraní pro JS a Android, soubory lokality jen v rozsahu skutečně dotčených textů.
- Ověřit, že **před a po** změně mají české texty stejný obsah; případnou schválenou opravu řetězce evidovat výslovně.
- Doplnit **regresní test**: výběr textů, interpolace s diakritikou, selhání při chybějícím klíči, přístupnost, CZ desetinná čárka, záporné hodnoty, datum/čas, převod jednotek, kompatibilní JSON a ZIP.
- Sledovat, které soubory/komponenty už používají klíče, a u ostatních uvést „dosud nepřevedeno“. Žádné umělé „100 % hotovo“.

## Oddělené stavy pro sledování
| Prvek | Stav k 4. 11. 2026 |
|---|---|
| Požadavek a zákaz plošné změny | **Schváleno** |
| Rozsah jazyků cs/en/de/sk do budoucna | **Schválené směřování**, zatím jen cs |
| Konkrétní jména klíčů a technický způsob sdílení | **Návrh**, bude doladěn při vývoji |
| Katalog překladů a JS/Android rozhraní | **Neimplementováno** |
| Přepínání jazyků, en/de/sk překlady | **Záměrně mimo současnou aktualizaci** |
| Automatické regresní testy lokalizace | **Neprovedeny** |
| Test na Samsungu s novým APK | **Neproveden** |

Tento plán se aktualizuje po každé skutečné změně kódu. **Uložená dokumentace sama o sobě neznamená implementaci.**

[START ZDE](START_ZDE.md) · [VIZE_A_PLAN.md](VIZE_A_PLAN.md) · [Issue #14](https://github.com/zaplikj30-ui/Zamerovac-android/issues/14)
