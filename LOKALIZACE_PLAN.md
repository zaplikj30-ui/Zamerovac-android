# Zaměřovač – technický plán přípravy vícejazyčnosti

**Rozhodnutí ze 4. listopadu 2026. Stav: SCHVÁLENO PRO POSTUPNOU PŘÍPRAVU, NEIMPLEMENTOVÁNO.**

[Samostatný GitHub úkol #14](https://github.com/zaplikj30-ui/Zamerovac-android/issues/14). Příprava se má provádět **jen současně s nadcházejícími schválenými opravami**. Není zadán překlad dalších jazyků ani plošný refactoring. **NOVÉ UPŘESNĚNÍ:** v nejbližší společné aktualizaci přibude do Nastavení výběr jazyka, zatím pouze 🇨🇿 Čeština.

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
5. **Formáty:** používat pro *zobrazení* lokalizované formáty (čísla, datum, čas, názvy jednotek), zatím vše v `cs-CZ`. Rozlišit **kanonická data** od **formátované hodnoty**: neměnit `measurementMm`, uložené `unit`, souřadnice, přesnost ani serializaci. Další překlady a skutečné přepínání mezi různými jazyky až v samostatné etapě; základní obrazovka výběru pouze češtiny již v nejbližší aktualizaci.
6. **A11y:** včetně HTML `aria-label`/`title`/`placeholder` a Android `contentDescription`/TalkBack – žádný text neponechat skrytě mimo plán.
7. **Offline:** katalog je součástí aplikace, žádný síťový request kvůli zobrazení českého tlačítka nebo hlášky.

## Potvrzená změna zadání: vstup do výběru jazyka (4. 11. 2026)

Oproti původnímu plánu bez viditelného přepínače je **nově schválená obrazovka „Jazyk aplikace“** v Nastavení už v nejbližší společné aktualizaci, ale stále **jediná dostupná volba: 🇨🇿 Čeština**. **Žádný další jazyk a žádná samostatná APK.** Podrobná akceptační kritéria a historie dohody viz [Issue #14](https://github.com/zaplikj30-ui/Zamerovac-android/issues/14).

**Vzhled a ovládání:** přehledná řádka s jazykovou ikonou, hlavním textem **Jazyk aplikace** a sekundární hodnotou **🇨🇿 Čeština**; klepnutím otevřít výběr s jedinou položkou **🇨🇿 Čeština – vybrána**. Vybrání aktuální češtiny smí potvrdit stav a zavřít dialog, ale **nesmí restartovat aplikaci ani měnit data**. Respektovat běžnou navigaci Zpět, různé šířky displeje a přístupnost.

**Budoucí rozšíření:** jediné datové pole `availableLanguages` / odpovídající registr dostupných locale, zatím jen `cs`; nové podporované jazyky se později objeví až po dodání jejich **skutečných** překladů. Preference jazykového kódu se ukládá odděleně od zákaznických dat, stávající instalace nemají povinnou migraci a při chybě se použije `cs`.

**Povinné testy první etapy:** otevření nastavení, jediná položka, správně vybraný stav, výběr aktuální češtiny bez reloadu/restartu, návrat, uložení a přežití restartu, offline provoz, S24 Ultra i Tab S11 Ultra, TalkBack/větší písmo, zachování ostatních nastavení, kót, poznámek, fotek a ZIP kompatibility. Automatické jednotkové testy klíčů, jediné dostupné volby, fallbacku a ukládání. Neoznačovat za hotové bez testů.

**Stav:** dohodnuto a popsáno, zatím **NENAPROGRAMOVÁNO, NESestaveno ani NETESTOVÁNO**.

## Škálování na desítky jazyků – závazné rozšíření architektury

**4. 11. 2026 – pozdější schválené upřesnění:** cs/en/de/sk jsou **pouze příklady**. Schéma, API a obrazovka výběru nesmí být pevně omezené na čtyři jazyky. Příští vydání ale zobrazí výhradně **🇨🇿 Čeština** a prioritu mají opravy Zaměřovače. Podrobné akceptační podmínky v [Issue #14](https://github.com/zaplikj30-ui/Zamerovac-android/issues/14).

### Datový a prezentační model
- **Katalog**: každý jazyk má BCP 47 tag, vlastní název v daném jazyce/autonym, příp. název v aktuálním UI jazyce, informaci o směru písma `ltr|rtl`, locale pro formáty a stav *překlad opravdu dostupný*. Jazykové katalogy jsou oddělené od funkcí a neměnné formáty uložených dat.
- **Jedna obecná komponenta jazykového výběru** čte seznam z registru, zobrazuje aktuální hodnotu, zvládá desítky položek, posun, návrat, vybraný stav, přístupnost, dlouhé vlastní názvy a budoucí textové vyhledávání. Názvy nabídky jsou ve **vlastním jazyce/písmu**. Výběr se nevyrábí větvením `if (language === 'en')` v jednotlivých obrazovkách.
- **Budoucí vyhledávání** nad autonymem, českým/lokalizovaným názvem a případnými aliasy, s rozumnou Unicode/diakritickou normalizací a deterministickým tříděním. Pro jedinou češtinu může být vyhledávací pole skryté, ale logika seznamu musí být připravená k rozšíření.
- **Vizuální odolnost**: variabilní délka řetězce, různá písma, zalamování, systémová velikost písma, čtečky obrazovky; nefixovat šířku každého názvu. Preferovat pružný layout a CSS logical properties.
- **RTL**: data obsahují směr, textové bloky a položky používají vhodný `dir`, bidi izolaci a logické začátky/konce. Při reálném zavedení RTL ověřit navigaci i screenshoty. *Zrcadlení ovládání nesmí nikdy překroutit fyzické rozměry, polohy anotací, souřadnice fotky nebo názvy souborů.*
- **Formátování + gramatika**: oddělit prezentační `Intl` / Android locale od perzistentních čísel a jednotek. Počítat s plurálovými zprávami a proměnnými, zachovat JSON schéma, historii Bosch a kompatibilitu ZIP.
- **Publikace nového jazyka**: do výběru jej pustit až po dodání lokalizačních řetězců a odpovídajících testů; **žádné prázdné ani nefunkční jazyky**. Vše offline.

### Rozdělení prací
**Teď v příští společné aktualizaci:** malý český katalog + jazykové klíče v upravovaných částech, univerzální registr s jedinou dostupnou položkou `cs`, funkční obrazovka Nastavení s „Jazyk aplikace / 🇨🇿 Čeština“, případná preference, bez restartu a bez zásahu do projektových dat. Navrhnout rozhraní seznamu a filtrů bez vazby na počet položek, ale **nepřidávat nyní rozsáhlou implementaci vícejazyčnosti jen kvůli daleké budoucnosti**.

**Později při skutečném rozšíření:** zapnout viditelné vyhledávání, přidávat pouze hotové jazyky, lokalizovat širší oblast aplikace, otestovat různé skripty, RTL, delší texty a místní formáty.

**Testovací scénáře teď:** jediná dostupná čeština, předvybraná možnost, žádný restart při opakované volbě, persistence, offline a data beze změny. **Komponentové testy na syntetickém registru například 60 jazyků** mohou prokázat rozšiřitelnost, přesto v produkčním UI smí být pouze `cs`. Testy RTL a dalších jazyků **neoznačovat za provedené, pokud nebyly skutečně spuštěny**.

**Stav:** zadání schváleno, implementace nezahájena, APK nevytvořena, testy nespouštěny.

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
| Rozsah desítky+ jazyků a regionálních variant (cs/en/de/sk jsou pouze příklady) | **Schválený dlouhodobý požadavek**, dostupná zatím jen cs |
| Konkrétní jména klíčů a technický způsob sdílení | **Návrh**, bude doladěn při vývoji |
| Katalog překladů a JS/Android rozhraní | **Neimplementováno** |
| Výběr jazyka v Nastavení – pouze 🇨🇿 Čeština | **Schváleno pro nadcházející aktualizaci; neimplementováno** |
| Skutečné přepínání mezi jazyky, en/de/sk překlady | **Záměrně mimo současnou aktualizaci** |
| Automatické regresní testy lokalizace | **Neprovedeny** |
| Test na Samsungu s novým APK | **Neproveden** |

Tento plán se aktualizuje po každé skutečné změně kódu. **Uložená dokumentace sama o sobě neznamená implementaci.**

[START ZDE](START_ZDE.md) · [VIZE_A_PLAN.md](VIZE_A_PLAN.md) · [Issue #14](https://github.com/zaplikj30-ui/Zamerovac-android/issues/14)
