# Lokální QA bez GitHub Actions

Stav: malá infrastruktura pro Windows 11, **nikoli** náhrada úplného CI a testů na telefonu. Nenahrazuje PR ani APK.

## Jak spustit

Ze správné místní větve Zaměřovače:
- Dvojklikem na tools/local-qa.cmd: syntax JS, registr QA, model focus/ANR, existující Node testy a Python unittest.
- Nebo příkazem tools\local-qa.cmd --native: navíc současná Gradle kontrola veřejné Drive konfigurace, Java kompilace a JVM/Robolectric testy (bez APK).

Potřebné je Node.js 20+ a Python 3, pro --native také JDK 17, Gradle 8.10.2 a Android SDK ve Windows PATH / standardní konfiguraci. Skript neinstaluje závislosti, nemaže testovací ani zákaznická data a nijak se nepřipojuje k telefonu. Záznamy PASS/FAIL/NOT RUN a úplné logy jsou výhradně v místní složce %LOCALAPPDATA%\Zamerovac-QA\results. Bez připojení k GitHub Actions se neodečítají jejich hostované minuty.

## Zbývá

- Chromium/Playwright a test skutečné vizuální odezvy: NOT RUN.
- Připojení Samsungu nebo tabletu, USB/Wi-Fi debug, instalace a ovládání fyzické aplikace: NOT RUN.
- APK, instalace a vydání: NOT RUN. Jedna společná testovací APK až po dokončení schváleného balíku.
- Zelený lokální výsledek není nezávislý CI status a nemůže sám potvrdit chování S Pen, Bosch, Android IME nebo pickeru.

Následující samostatná etapa po schválení přístupu k zařízení: Windows sestaví preview, přes Android SDK/ADB a instrumentované UI Automator testy jej přímo otestuje na Samsungu. Ovládání vyžaduje připojení telefonu a vědomé povolení ladění. ChatGPT nemá přímé vzdálené ovládání uživatelova zařízení.


## Místní vizuální testy Chromium (od B7)

Zvolte pracovní kopii větve obsahující \`tools/local-browser-qa.cjs\` a ve Windows 11 spusťte:

1. \`npm install --no-save --package-lock=false playwright@1.62.1\` (jen jednou / při chybějících balíčcích).
2. \`npx playwright install chromium\` (jen jednou / při chybějícím prohlížeči).
3. Dvojklikem \`tools\local-browser-qa.cmd\`: krátká sada **drawing / quality-regressions / gallery-readability** se skutečnými pixely.
4. Pro kompletní Chromium sadu \`tools\local-browser-qa.cmd --all\`. Pro kontrolu serveru bez Chromium \`node tools/local-browser-qa.cjs --self-test\`.

Používá pouze \`127.0.0.1\` na dočasném náhodném portu. Server vydává soubory pouze z \`app/src/main/assets\` a kontroluje i symlinky; nepřipojuje se k GitHub Actions, telefonu, cloudu ani nespouští Android APK. Testy v prohlížeči používají syntetická data. Spouštěč **nestahuje** Playwright ani nic neinstaluje; případná instalace je samostatný explicitní krok 1–2.

Každý skript má vlastní log, snímky, trace, \`results.json\` a stav PASS/FAIL. Výsledky se ukládají lokálně do \`%LOCALAPPDATA%\Zamerovac-QA\browser\` (mimo Windows fallback \`~/.local/share/Zamerovac-QA/browser\`). **FAIL se nezamlčuje**, ani při známé chybě. Není zaručeno, že všechny Chromium testy projdou; na konkrétní větvi je nutné je skutečně spustit. Tato vrstva nenahrazuje Android WebView, klávesnici, picker, S Pen, laser, fyzické pixely zařízení ani samostatné kontrolní CI před vydáním.

Pomocný skript pro místní browser byl skutečně testován pomocí \`node tests/local_browser_qa_contract.js\` (HTTP 200/404/403/405, odmítnutí symlinku, výstupní PASS/FAIL/NOT RUN) a \`node tools/local-browser-qa.cjs --self-test\`. V izolovaném testovacím prostředí neměl autor nainstalovaný Playwright; přísný preflight správně vrátil FAIL s instrukcí, nikoli falešný PASS. Plné browser E2E na zdrojích Zaměřovače **NOT RUN**.
