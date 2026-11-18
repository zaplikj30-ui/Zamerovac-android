# Chyby nahlášené přímo v aplikaci

Toto je **příjmová složka pro hlášení vytvořená fialovou vlaječkou Zaměřovače**. Slouží k dohledání, odkud chyba přišla, **nikoli jako druhá evidence**. Jednotlivé prokazatelné chyby zůstávají v [GitHub Issues](https://github.com/zaplikj30-ui/Zamerovac-android/issues), ostatní testovací poznámky v [deníku #13](https://github.com/zaplikj30-ui/Zamerovac-android/issues/13). [Hlavní přehled](../README.md).

## Převzetí až na pokyn vlastníka

1. **Vlastník** v aplikaci dlouze podrží vlaječku → **Moje připomínky** → vybere hlášení → **Uložit ZIP** nebo **Sdílet vybrané**. ZIP nejprve předá asistentovi v chatu; **žádné automatické odesílání** na GitHub.
2. **Asistent** ZIP otevře v pracovním prostředí, rozliší chybu a návrh změny, porovná s existujícími Issues, **nezakládá duplicity**. Případné stejné chyby připojí jako nový důkaz k původnímu Issue.
3. **Před veřejným uploadem** kontroluje citlivé údaje **ve snímcích samotných i v metadatech/JSON/hlavičkách**. Odstraní GPS, adresy, e-maily, neveřejné zakázky nebo identifikátory, které nejsou pro reprodukci potřeba. Vlastník dovolil zveřejnit redigovaný interiér, ne automaticky všechny další soukromé údaje.
4. **Komprese jen pro GitHub**: lokální původní snímek/video a zákaznická média v aplikaci **nijak neměnit**. Obrazový důkaz podle potřeby zmenšit, zachovat čitelnost textu a úchopů (např. JPEG 1200–1800 px delší strana (PNG pro tenké čáry; WebP není v oficiálním seznamu podporovaných příloh Issues); ostřejší PNG jen pro tenké čáry). Videa oříznout na důležitý interval a kódovat úsporně H.264 MP4 (typicky 720p, 15–24 fps; závisí na rychlosti pohybu a čitelnosti). Není závazné pevné rozlišení pro všechno; důkaz má zůstat průkazný.
5. Na GitHub ukládat **samostatné redigované obrázky a videa přímo k příslušným Issues**, pokud uploadní nástroj opravdu vrátí a dovolí ověřit URL. **Nikdy netvrdit, že soubory byly nahrány, pokud v Issues existuje pouze jejich název nebo SHA256.** Při technickém blokéru ponechat přílohy v chatu / stáhnutelném balíčku a v Issue výslovně uvést „PŘÍLOHA NENÍ NA GITHUBU“.
6. Po zápisu poslat vlastníkovi skutečné URL, stav a co nebylo ověřeno. Originální chybu ani přiložený důkaz nemažeme bez výslovného požadavku; nová chyba čeká na opravu a fyzický retest.

## Prostor na GitHubu – ověřeno podle oficiální dokumentace 18. 11. 2026

- [Přílohy Issues](https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/attaching-files): jednotlivé obrázky/GIF nejvýše **10 MB**, videa při GitHub Free nejvýše **10 MB**, u podporovaných placených plánů až 100 MB. Naše pravidlo: cílit výrazně níže a uchovat čitelnost.
- [Limity Git repozitáře](https://docs.github.com/en/repositories/creating-and-managing-repositories/repository-limits): doporučený rozměr interního Git úložiště nejvýše **10 GB**, doporučený jednotlivý Git objekt nejvýše **1 MB**, vynucený limit objektu **100 MB**. Běžné screenshoty/videa raději **nevkládat do git historie**, ale jako přímé přílohy Issue.
- **GitHub Actions artefakty** mají jiné kvóty než přílohy Issues nebo Git repozitář. Nevyvozovat z jejich 500 MB (pro GitHub Free) limit na všechny fotografie chyb. Nezavádět LFS/placené úložiště bez samostatného schválení.
- GitHub API u repozitáře `zaplikj30-ui/Zamerovac-android` při kontrole hlásilo **7 998 kB** orientační velikosti Gitu. Toto **nezahrnuje spolehlivě všechny externě hostované přílohy Issues** a není to účetní vyúčtování.

**Stav:** organizační pravidlo / předávací složka, bez načteného nového ZIP a bez importu jakéhokoli hlášení z telefonu. **Testy NOT RUN**, změna pouze textové dokumentace v návrhu PR; nic v aplikaci, synchronizaci, zákaznických datech ani účtech se nemění.
