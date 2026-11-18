# Číslování vydání Zaměřovače

**Schváleno 6. 11. 2026.** Od nové testovací APK **1.3.0** používáme významové číslování `HLAVNÍ.VEDLEJŠÍ.OPRAVA`.

- **Hlavní (2.0.0):** zásadní změna generace nebo nekompatibilní změna s plánovanou migrací.
- **Vedlejší (1.3.0):** významné nové kompatibilní funkce či větší ucelené aktualizace.
- **Opravné (1.3.1):** menší opravy a kompatibilní údržba.

**Historie:** 1.2.153 je poslední vydání starého číslování a obsahuje velkou aktualizaci #39. Vydání 1.3.0 **nepřináší znovu tyto funkce**, pouze zavádí srozumitelnější verze. Historii, tag a APK 1.2.153 zpětně neměnit.

**Dvě odlišné hodnoty:** `versionName` je pro člověka (např. 1.3.0-test); `versionCode` je pro Android a musí být **vyšší než ve staré nainstalované APK**. Poslední skutečně vydaná APK **1.3.0 má `versionCode=1154`**, takže příští společná APK musí mít **nejméně 1155**. Stávající Gradle výpočet `1000 + GITHUB_RUN_NUMBER` je jen technická kompatibilita: vydávací workflow po ověření podpisu a balíčku skutečně poslední vydané APK nastaví pouze pro svůj sestavovací proces odpovídající offset. **Nesmí se spoléhat na počítadlo nového workflow.** Nouzový cloudový `build-apk.yml` již má kontrolu poslední vydané APK a nastavuje správný offset pro `versionCode`, ale aktuálně umí jen schválené sestavení na `main` spojené se zveřejněním. Samostatný režim sestavení *bez vydání* je zatím jen návrh, není implementován. Živé další vydání NOT RUN. Název balíčku `cz.zamerovac.app.preview` a podpis se nemění.

**Připraveno pouze v draft PR #179:** následující společná testovací verze `1.4.0` (po schválení a testech); poslední **skutečně vydaná** je stále `1.3.0`. Připravený záznam `1.4.0` v kódu není GitHub Release, vydaný APK ani fyzický PASS.

**Jediný zdroj zobrazeného čísla:** `config/app-version.properties`. Před vydáním aktualizovat také `app/src/main/assets/release-history.js` podle skutečných změn; `node tools/release/versioning.js --release` vyžaduje shodu a vyšší číslo. Nepřeznačovat starší historii.

**Brány vydání:** nová APK pouze na výslovné vyžádání, CI úspěšné, správný podpis, balíček, zobrazená verze, `versionCode` větší než v nejnovější skutečně vydané APK, zákaz přepsání stejného tagu. Tag `test-vX.Y.Z`, soubor `Zamerovac-vX.Y.Z.apk`. Žádné mazání dat ani odinstalace stávající verze.

**Zbývá fyzicky ověřit:** instalaci budoucí `1.4.0` přímo přes vydanou `1.3.0` bez odinstalace/mazání dat (samostatný pozdější krok); podle potřeby i 1.2.153, originální fotografie, přesné editovatelné kóty, zálohy a synchronizaci na telefonu/tabletu. Automatické testy ≠ skutečné testy na zařízení.

## Changelog, offline nápověda a rozdíl mezi buildem a vydáním

Při **změně funkce, ovládání/chování, uživatelsky viditelného textu, názvu, ikony, menu, nastavení, importu/exportu, podpory zařízení, kompatibility či relevantního omezení** aktualizuj **v témže PR** českou offline nápovědu `app/src/main/assets/help.js` včetně postupů, chyb, odkazů a vyhledávacích výrazů. Ověř soulad UI a nápovědy v `tests/help_guide.js` a dle potřeby `tools/e2e/help.cjs`. Neplatí pro čistě technickou CI dokumentaci bez dopadu na uživatelské chování — tuto nerelevanci v PR vysvětli. V nápovědě dokumentuj jen skutečně fungující chování, ne budoucí nápad. **Dvě lupy jsou různé:** globální hledá zakázky/soubory/poznámky, lupa nápovědy jen kapitoly; offline nápověda nesmí číst ani odesílat zákaznické údaje ([#29](https://github.com/zaplikj30-ui/Zamerovac-android/issues/29), [PR30](https://github.com/zaplikj30-ui/Zamerovac-android/pull/30)).

**Offline changelog** `app/src/main/assets/release-history.js` je v menu a Nastavení, udržuje neměnnou historii skutečně vydaných verzí; připravovaná 1.4.0 je v draft PR jako nový záznam chystaného testovacího vydání; nesmí obsahovat dočasný příznak `prepared-not-published`, který by po vydání APK zůstal nepravdivý. Samotný záznam v kódu však neznamená, že už GitHub Release existuje. Nezavádět nepodložené budoucí verze, nevymýšlet historické záznamy, nepřejmenovávat starší novinky na aktuální číslo. Před jednou společnou APK ověř shodu čísla s výsledným workflow a testy `tests/release_history.js` a `tools/e2e/release-history.cjs`. Release, technický build, úspěšné CI a fyzické ověření instalace jsou rozdílné stavy. Nikdy nepoužívat staré `.github/apk-build-request.txt` jako trigger; před skutečným vydáním ověř aktuální workflow a explicitní souhlas vlastníka.

**Rozsah:** jen Zaměřovač, nikoli Konfigurátor–Nářezák; nedotýkat se schémat dat, zakázek, fyziky měření ani synchronizačních pravidel.
