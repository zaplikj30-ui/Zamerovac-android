# START ZDE – živý rozcestník Zaměřovače

**Účel:** kde hledat právě platná pravidla, požadavky a důkazy. Tento rozcestník **neobsahuje historická SHA, výsledky minulých běhů ani samostatná technická zadání**. Před prací ověř aktuální [main](https://github.com/zaplikj30-ui/Zamerovac-android/commits/main), [otevřená PR](https://github.com/zaplikj30-ui/Zamerovac-android/pulls), [#42](https://github.com/zaplikj30-ui/Zamerovac-android/issues/42), [Actions](https://github.com/zaplikj30-ui/Zamerovac-android/actions) a [Releases](https://github.com/zaplikj30-ui/Zamerovac-android/releases). Nevěř starému údaji „aktuálně“ bez nového ověření.

## Kdy číst který dokument

| Potřeba | Zdroj pravdy |
|---|---|
| Práce AI, role, souhlasy, testovací důkazy, HOME/rozpočet | [AGENTS.md](AGENTS.md) |
| Cílové funkce, ergonomie, vyloučené funkce, nápady a jejich stav | [VIZE_A_PLAN.md](VIZE_A_PLAN.md) a [rozhodnutí z testů](ROZHODNUTI_A_NAPADY_Z_TESTU.md) |
| Architektura, etapy, technologie a srovnání variant | [PROJEKTOVY_PLAN_ZAMEROVACE.md](PROJEKTOVY_PLAN_ZAMEROVACE.md) |
| Originální média, editovatelné hodnoty, ZIP, platformy, migrace | [DATOVY_FORMAT_A_PC_KOMPATIBILITA.md](DATOVY_FORMAT_A_PC_KOMPATIBILITA.md) |
| Konkrétní Android/laser/stylus a fyzické důkazy | [KOMPATIBILITA_ZARIZENI.md](KOMPATIBILITA_ZARIZENI.md) |
| Jazykové klíče, první další jazyk angličtina | [LOKALIZACE_PLAN.md](LOKALIZACE_PLAN.md), [#14](https://github.com/zaplikj30-ui/Zamerovac-android/issues/14) |
| Testy funkcí a negativní scénáře | [TESTY_A_OPRAVY.md](TESTY_A_OPRAVY.md), [#28](https://github.com/zaplikj30-ui/Zamerovac-android/issues/28), [#13](https://github.com/zaplikj30-ui/Zamerovac-android/issues/13) |
| HOME procesní hranice (jen s novým owner GO) | [docs/HOME_QA_PREFLIGHT.md](docs/HOME_QA_PREFLIGHT.md) |
| Sync / Google Disk | [#88](https://github.com/zaplikj30-ui/Zamerovac-android/issues/88), [cloud-sync-v2](docs/cloud-sync-v2.md), [Drive API](docs/drive-api-integration.md) |
| APK, podpis, versionCode, changelog a offline nápověda | [docs/verzovani.md](docs/verzovani.md) |
| Historie a důkazy předchozího stavu | Git log, původní issues/PR, [archiv rozcestníku](START_ZDE_ARCHIV_DO_2026-11-11.md) |

## Aktuálně platné hranice (před použitím znovu ověř)

**Zaměřovač nyní Android**, projekty Konfigurátor–Nářezák a Převaděč spojitosti jsou oddělené. Repo je dočasně PUBLIC pro schválené GitHub-hosted cloud QA. **HOME RETIRED: vlastník 18. 11. 2026 rozhodl HOME v projektu ukončit; PR #186 vyřazuje obě aktivní HOME workflow (do merge nadále existují na main). Fyzický HOME počítač ani runner nezapínat ani neměnit.** Nespouštěj Actions, nevracej PRIVATE, neslučuj ani nevydávej APK pouze podle historického stavu nebo tohoto textu. Strop placených GitHub Actions **12 USD/měsíc**. Před během ověř oprávnění, rozpočet a podmínky **skutečně používaného workflow**. Staré P/Q/E, vlastní SHA brány, manifesty a handoffy nejsou trvalé požadavky: pro budoucí **jednoduché GitHub-hosted Chromium testy** nevytvářej nové vlastní SHA kontroly; commit již eviduje GitHub. Současné workflow ani jeho platné podmínky tato dokumentace nemění.

**Pracovní tok:** koordinátor → jeden autor s retesty a úplným self-review → jiný nezávislý kontrolor → koordinátor/rozhodnutí vlastníka. Důkazy patří do PR/issue, ne sem. Dokumentační aktualizace **nespouští build**. Schválené funkce a budoucí náměty nejsou totéž; pokud novější důkaz změní směr, aktualizuj živý dokument a v PR dolož proč.
