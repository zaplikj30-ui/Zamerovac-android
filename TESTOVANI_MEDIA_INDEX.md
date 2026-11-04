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
