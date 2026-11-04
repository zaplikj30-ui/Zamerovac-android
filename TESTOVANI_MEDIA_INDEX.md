# Zaměřovač – evidence videí z testování (duplicitní nahrání)
*Aktualizováno 4. 11. 2026. Tento soubor je jen index médií; neobsahuje samotné video, ani potvrzení výsledku testu.*

## Účel
Uživatel posílá videa po dávkách (limit přibližně 10 souborů), některé soubory se mohou znovu objevit. Při dalším porovnávání se každé **unikátní video** zpracuje jen jednou. Podle videa se smí pouze rekonstruovat historické chování; funkční stav posledního APK vyžaduje odpovídající test na zařízení.

## Dosud přijaté jedinečné soubory (4. 11. 2026)
Kontrolní otisk je prvních 16 znaků SHA-256 aktuálního obsahu dostupného v pracovním prostředí. Doba je délka videozáznamu podle metadat (orientačně). Pokud bude stejný název a jiný otisk, porovnat i obsah.

| Název souboru | Délka | SHA-256 (začátek) | Zařazení |
|---|---:|---|---|
| `1000093687.mp4` | 3:55 | `a563cba0f4210274` | Video posouvání původního chatu; postupně ověřit 28 testů |
| `Screen_Recording_20261103_105724_ImageMeter(1).mp4` | 0:04 | `123367f40608abc9` | Starší referenční video ImageMeter |
| `Screen_Recording_20261103_113446_ImageMeter(2).mp4` | 0:09 | `e91c31115029fb07` | Starší referenční video ImageMeter |
| `Screen_Recording_20261103_114806_ImageMeter(2).mp4` | 0:27 | `7444c6db607cd778` | Starší referenční video ImageMeter |
| `Screen_Recording_20261104_004433.mp4` | 0:13 | `687ec57a9643729b` | Z testovací dávky (znovu zaslané 4. 11.) |
| `Screen_Recording_20261104_005059.mp4` | 0:16 | `6fdd27195ee3c01e` | Z testovací dávky (znovu zaslané 4. 11.) |
| `Screen_Recording_20261104_010328.mp4` | 0:20 | `f1daf6fd014aade1` | Z testovací dávky (znovu zaslané 4. 11.) |
| `Screen_Recording_20261104_010354.mp4` | 0:10 | `9d179536eadd7c2f` | Z testovací dávky (znovu zaslané 4. 11.) |
| `Screen_Recording_20261104_010521.mp4` | 0:54 | `45c6320c4b403ae5` | Z testovací dávky (znovu zaslané 4. 11.) |
| `Screen_Recording_20261104_011043.mp4` | 0:06 | `ec946470df497546` | Z testovací dávky (znovu zaslané 4. 11.) |
| `Screen_Recording_20261104_013507.mp4` | 2:18 | `2d6a536df4acc80d` | Z testovací dávky (znovu zaslané 4. 11.) |
| `Screen_Recording_20261104_014404.mp4` | 0:34 | `d74da2b2bb863d12` | Z testovací dávky (znovu zaslané 4. 11.) |
| `Screen_Recording_20261104_015015.mp4` | 0:31 | `65b6247bc0829a06` | Z testovací dávky (znovu zaslané 4. 11.) |
| `Screen_Recording_20261104_015435.mp4` | 0:08 | `44d9d50326905a53` | V předchozí dávce, poslední video; **v opakované dávce zatím nebylo** |

**Součet:** 14 unikátních názvů a obsahových otisků z dostupných souborů; 9 nově znovu poslaných názvů už bylo v předchozí dávce, proto nepřidávají nové unikátní položky. Z původního obsahu předchozích souborů byly dostupné pouze stejné mount cesty přepsané při opakování, takže úplnou shodu s předchozí dávkou podle hashů nelze zpětně nezávisle prokázat; názvy však odpovídají.

## Pravidla pokračování
1. Při každé nové dávce porovnat primárně názvy, délku a SHA-256; u rozdílů také náhledy/obsah.
2. Zapsat nové soubory do této tabulky, staré neduplikovat a u každého zjistit vazbu na test jen když je z obsahu průkazná.
3. Věci z historických videí porovnat s [testovacím deníkem #13](https://github.com/zaplikj30-ui/Zamerovac-android/issues/13), [49 úpravami #12](https://github.com/zaplikj30-ui/Zamerovac-android/issues/12) a relevantními commity. Rozlišit historickou chybu od právě otevřené chyby.
4. Tato evidence není automatické úložiště originálních videí: ty existují jen jako přílohy uživatelských konverzací, pokud jsou dostupné. Pro trvalé uchování originálů je třeba jiné úložiště.


## Nové samostatné nahrávky a snímky doplněné 4. 11. 2026

Přibylo **6 různě pojmenovaných videí** a **10 JPG snímků** z původního testování. Součet nyní evidovaných **20 jedinečných videonázvů a 10 obrázků** (nejde o originální trvalé uložení médií do GitHubu; zde jsou jen metainformace a odkazy na příslušné textové testy). Otisk prvních 16 znaků SHA-256 nyní dostupných souborů; při opětovném poslání jej lze použít pro deduplikaci.

| Video | Délka | SHA-256 (začátek) | Přiřazení podle obsahu |
|---|---:|---|---|
| `Screen_Recording_20261104_020258.mp4` | 0:44 | `a64f3223d943d915` | Fotografie a editace, testy 19–20 |
| `Screen_Recording_20261104_021857.mp4` | 0:17 | `59752b1da843c767` | Koš, test 22 |
| `Screen_Recording_20261104_022456.mp4` | 0:31 | `d3a7e2a9413007a3` | Vyhledávání, test 23 |
| `Screen_Recording_20261104_023025.mp4` | 0:09 | `6316ef6c55a1e613` | Soubory/přesun, test 25 |
| `Screen_Recording_20261104_024728_My Files.mp4` | 2:08 | `1ff09965edf395ce` | Export ZIP, test 26 |
| `Screen_Recording_20261104_030119_My Files.mp4` | 1:16 | `e1540b8fd2b12d1b` | Výběr ZIP při importu, test 27 |

| Fotografie/screenshot | SHA-256 (začátek) | Test / význam |
|---|---|---|
| `1000093519.jpg` | `795d4343686faf06` | 7 – plocha a rohové úchopy |
| `1000093546.jpg` | `3d54b171cd2bc943` | 19 – referenční fotografie |
| `1000093548.jpg` | `4c273efc1c9be04e` | 20 – horní šipky |
| `1000093549.jpg` | `db5253f3d10be16b` | 22 – Koš |
| `1000093552.jpg` | `1530f1ddbd389012` | 23 – hledání „Bla“ |
| `1000093557.jpg` | `bc84feae589b604e` | 26 – ZIP struktura |
| `1000093570.jpg` | `922b0e9e18bbee0e` | 26 – media/ a JSON |
| `1000093572.jpg` | `70aca14c12d919b8` | 26 – obsah media |
| `1000093574.jpg` | `a3571540d15ead1d` | 21/25 – zámky |
| `1000093683.jpg` | `a5da6d358ae7fd0b` | Zdrojový záběr místnosti, nedokazuje fungování app |

**Přesná důkazní mapa podle čísel 1–28:** [ROZHODNUTI_A_NAPADY_Z_TESTU.md](ROZHODNUTI_A_NAPADY_Z_TESTU.md). **Úplné výsledky:** [1–10](REKONSTRUKCE_TESTU_01_10.md), [11–20](REKONSTRUKCE_TESTU_11_20.md), [21–28](REKONSTRUKCE_TESTU_21_28.md).

**Poznámka:** U historických příloh označených `100009xxxx.mp4` v chatu nebyla ještě prokázána totožnost s jinak pojmenovanou nahrávkou `Screen_Recording_*.mp4`. Přiřazení podle obsahu je užitečné, ale **není rovnocenné shodě SHA-256 originálů**. Případné nevysvětlené odchylky neřešit domněnkou.
