<!-- Zaměřovač: stručná kontrola před integrací. Checkboxy nejsou v soukromém repozitáři bez ochrany větve automaticky vynucené. -->
## Účel změny
Co přesně opravuje / zlepšuje (odkaz na existující issue):

## Rozsah a riziko
- [ ] Běžná izolovaná změna
- [ ] **Riziková**: ukládání / schéma / přesnost / geometrie / média / Undo-Redo / synchronizace / Bluetooth / nativní Android / bezpečnost / `.github/` / závislosti

Dotčené soubory a možné návaznosti:

## Nezávislá kontrola
Autor změny:
Kontrolor (odlišný od autora, u rizikových změn povinný postup projektu):
Odkaz na konkrétní revizi v GitHubu (ne jen vlastní kontrola):
Nalezená rizika a způsob řešení:

## Skutečné testy (PASS / FAIL / SKIP / NOT RUN)
Testovaný přesný commit SHA:
- Cílené testy + důkaz:
- Chromium / pixely:
- Java / Robolectric / PDF:
- Domácí QA 4/4 na výsledném `main` (před sloučením není možné potvrdit; doplnit po integraci):
- Fyzické Samsung / S Pen / Bosch / synchronizace:

Při změně dat: ověřit **uložit → zavřít → znovu otevřít**, přesné kóty a jednotky, původní média, Undo/Redo, selhání zápisu a starší data podle dostupných skutečných fixtures. Chybějící testy uvést jako NOT RUN, nevydávat za PASS.

## Bezpečnost a vydání
- [ ] Ověřen aktuální `main` / HEAD, nezasahuje do souběžných PR
- [ ] Žádný neodsouhlasený automatický placený cloud (strop 12 USD/měsíc)
- [ ] Žádné nedůvěryhodné PR/forky na domácím runneru
- [ ] Beze změny podpisu, applicationId, versionCode pravidel a výrobních dat, **nebo** konkrétní odůvodnění a odsouhlasení níže
- [ ] **Bez automatického vydání APK** (jedna společná APK až po regresi a souhlasu)

Schválení zásadní změny / integrace (odkaz):
Otevřené chyby a co se nesmělo ověřit:

> Tato šablona usnadňuje lidskou kontrolu, ale **nenahrazuje vynucenou ochranu hlavní větve** ani nezávislou revizi. Neslučovat jen podle odškrtnutých polí.
