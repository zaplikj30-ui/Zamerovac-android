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
