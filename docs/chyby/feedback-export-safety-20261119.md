# Hlášení z fialové vlaječky – hranice opravy 19. 11. 2026

## Ověřená cesta v hlavní větvi
1. Krátké klepnutí na vlaječku zavolá `Native.captureReportScreenshot` → Android `PixelCopy` → vlastní PNG v privátních médiích.
2. Editor do PNG vypaluje značky (S Pen, šipky, text) a uloží připomínku do `localStorage`; nezměněný obrázek znovu nepřekóduje.
3. `Připojit video` používá existující `pickMedia`; systémově importované originální video zůstává v médiích zařízení.
4. Dlouhé podržení → `Moje připomínky` → výběr → `Uložit ZIP` nebo `Sdílet vybrané`.
5. JS předává manifest přes současné `Native.saveIssueBundle/shareIssueBundle`. Android sestaví ZIP a nabídne systémový dokumentový dialog nebo nabídku sdílení. **Neexistuje přímý upload na GitHub.**

## Nálezy před opravou (main c990c03d)
- Sdílení pokračovalo přímo do Android chooseru bez výslovného přehledu a potvrzení soukromí; reprodukční V8 test: RED.
- Native sestavení ZIP přeskočilo některé chybějící/neplatné obrázky a videa bez selhání; uživatel mohl předat neúplný důkaz.
- `pripominky.json` obsahoval celý stav reportů včetně interních ID médií a původních názvů videí.
- Dočasné ZIPy po uložení/zrušení nebyly bezpečně uklízeny a pro sdílení nebyl vymezen retenční interval.
- ZIP jen kopíroval originální MP4/WebM/MOV. Zkomprimovaný video stream se běžným ZIPem podstatně nezmenší. **Velikost ani kvalita reálných médií nebyla v tomto prostředí změřena.**

## Oprava v tomto izolovaném DRAFT PR
- Uživatel před externím sdílením vidí výběr a výslovné upozornění: musí kontrolovat viditelný obsah, text i video; odmítnutí přenos zastaví.
- Native ZIP selže jako celek při chybějící, prázdné, neplatné nebo v průběhu změněné příloze; vstupní limit: 50 hlášení, nejvýše 12 videí na hlášení, nejvýše 256 MiB v jednom balíčku, nejvýše 512 KiB předaného JSON.
- Exportní JSON používá whitelist polí bez interních ID, vektorových anotací a původních názvů souborů. Obrázky se jmenují podle čísla připomínky, nikoli zákazníka. **Obsah pixelů ani vložená metadata originálního videa nejsou automaticky redigována.**
- Dočasný ZIP je ve vlastním namespace `issuezip-`, bez automatického uploadu. Po uloženém či zrušeném dokumentovém exportu je smazán, po externím sdílení zůstane pro příjemce dostupný do následného úklidu (stáří >24 hodin; úklid při spuštění nebo dalším exportu).
- Původní média ani připomínky v telefonu se nemažou a nepřekódují; zákaznický ZIP, sync a datový model se nemění.

## Video a velikost: rozhodnutí STOP pro rozšíření
Neprovádět automatickou transcoding kompresi bez design/security rozhodnutí a vlastníka. Efektivní konverze videa by vyžadovala novou nativní transkódovací cestu, případně novou knihovnu nebo změnu výstupního formátu. Je třeba ověřit audio, orientaci, časovou synchronizaci, možné ztráty snímků, barev, přesných kót, kodeky a kompatibilitu včetně odmítnutí a disk-full.

- **A – minimální vratná oprava (tento PR):** kontrola soukromí, úplnost, limity a úklid. Nejmenší zásah; velikost videí se **nezlepší**. Doporučeno okamžitě pro ochranu dat, nikoli jako dokončení optimalizace.
- **B – izolovaný Android transcoder:** lokální kopie přes Android `MediaCodec/MediaMuxer` nebo po schválení Media3 Transformer; originály neměnné. Vyšší náklady, rozsáhlé skutečné Android testy a nezávislé DESIGN/SECURITY review před implementací. Kandidát, pokud fyzická měření potvrdí častý problém.
- **C – ruční úprava před GitHub Issues:** export původního ZIP a oddělené redigované a zmenšené přílohy mimo aplikaci, s fyzickou kontrolou čitelnosti. Nulová změna nativního video stacku, ale více ručních kroků. Vhodné do schválení B.

## Skutečné testovací důkazy a zbývající rizika
- RED: původní produkční `sendBatch(false)` volal `Native.shareIssueBundle` bez potvrzení.
- PASS: na opraveném JS ve V8 – odmítnutí, potvrzení, místní uložení, chybějící bridge, prázdný výběr; syntaxe JS/help; strukturální přítomnost nativních ochranných podmínek. **Strukturální Java test není Android runtime test.**
- NOT RUN: Android build, skutečný telefon, PixelCopy, S Pen, reálný systémový výběr médií, SAF, MediaProvider, komprese/velikost/kvalita videí, disk-full a přerušení procesu na telefonu. Bez toho nejde poctivě uvést hodnoty MB, kvalitu ani fyzické HOTOVO.
- Riziko: Android proces může skončit při zápisu dokumentu; částečný výsledek u cizího SAF poskytovatele nemusí být možné smazat. Přijímající aplikace může potřebovat ZIP i po zvolení sdílení, proto se ZIP nesmí smazat hned po otevření chooseru.
- Riziko: veřejný GitHub a neanonymizované snímky/videa; kontrola musí zůstat vědomá, EXIF neřeší viditelný obsah. Samotný ZIP neznamená podporovanou GitHub Issues přílohu.

**Předání:** další fyzické Android QA a nezávislé SOURCE/SECURITY review změněného HEAD. Bez cloud/HOME/merge/APK. Podklad: [samostatné PR #193](https://github.com/zaplikj30-ui/Zamerovac-android/pull/193), beze změny jeho větve.
