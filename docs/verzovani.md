# Číslování vydání Zaměřovače

**Schváleno 6. 11. 2026.** Od nové testovací APK **1.3.0** používáme významové číslování `HLAVNÍ.VEDLEJŠÍ.OPRAVA`.

- **Hlavní (2.0.0):** zásadní změna generace nebo nekompatibilní změna s plánovanou migrací.
- **Vedlejší (1.3.0):** významné nové kompatibilní funkce či větší ucelené aktualizace.
- **Opravné (1.3.1):** menší opravy a kompatibilní údržba.

**Historie:** 1.2.153 je poslední vydání starého číslování a obsahuje velkou aktualizaci #39. Vydání 1.3.0 **nepřináší znovu tyto funkce**, pouze zavádí srozumitelnější verze. Historii, tag a APK 1.2.153 zpětně neměnit.

**Dvě odlišné hodnoty:** `versionName` je pro člověka (např. 1.3.0-test); `versionCode` je pro Android a musí být **vyšší než ve staré nainstalované APK**. Poslední skutečně vydaná APK **1.3.0 má `versionCode=1154`**, takže příští společná APK musí mít **nejméně 1155**. Stávající Gradle výpočet `1000 + GITHUB_RUN_NUMBER` je jen technická kompatibilita: vydávací workflow po ověření podpisu a balíčku skutečně poslední vydané APK nastaví pouze pro svůj sestavovací proces odpovídající offset. **Nesmí se spoléhat na počítadlo nového workflow.** Tuto ochranu má připravený domácí workflow v draft PR #61 a nouzový cloudový fallback v [draft PR #66](https://github.com/zaplikj30-ui/Zamerovac-android/pull/66); nejsou nasazené na `main`, živé vydání NOT RUN. Název balíčku `cz.zamerovac.app.preview` a podpis se nemění.

**Jediný zdroj zobrazeného čísla:** `config/app-version.properties`. Před vydáním aktualizovat také `app/src/main/assets/release-history.js` podle skutečných změn; `node tools/release/versioning.js --release` vyžaduje shodu a vyšší číslo. Nepřeznačovat starší historii.

**Brány vydání:** nová APK pouze na výslovné vyžádání, CI úspěšné, správný podpis, balíček, zobrazená verze, `versionCode` větší než v nejnovější skutečně vydané APK, zákaz přepsání stejného tagu. Tag `test-vX.Y.Z`, soubor `Zamerovac-vX.Y.Z.apk`. Žádné mazání dat ani odinstalace stávající verze.

**Zbývá fyzicky ověřit:** instalaci přes 1.2.153, originální fotografie, přesné editovatelné kóty, zálohy a synchronizaci na telefonu/tabletu. Automatické testy ≠ skutečné testy na zařízení.

**Rozsah:** jen Zaměřovač, nikoli Konfigurátor–Nářezák; nedotýkat se schémat dat, zakázek, fyziky měření ani synchronizačních pravidel.
