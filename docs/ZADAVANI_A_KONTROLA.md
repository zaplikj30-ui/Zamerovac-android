# Zadávání práce a autorská kontrolní brána

Závazný postup k [AGENTS.md](../AGENTS.md). Platí pro všechny autory včetně ChatGPT, Codexu a dalších AI; **nenahrazuje** nezávislé review. Koordinátor tento krok požaduje v **každém** zadání; rozsah testů a souvisejících funkcí se řídí rizikem, nikoli počtem souborů.

## Předání programátorovi – kopírovatelná šablona

```text
KOMU: Programátor [číslo/role]
AI: [přesná dostupná verze] – [úroveň uvažování] – [prostředí] – proč: [důvod].
CO: [schválený konkrétní cíl]. GitHub: [issue/PR + odkaz na celé zadání].
PŘED PRACÍ: ověř aktuální HEAD/base a souběžnou práci; AGENTS.md, START_ZDE.md, #42,
relevantní kontrakty, produkční kód, testy a důkazy. Nepřepisuj cizí změny.
IMPLEMENTUJ a SÁM OTESTUJ: pozitivní, negativní, chybové, hraniční a relevantní
regresní scénáře včetně reálných produkčních vazeb. Fyzický test netvrď bez telefonu.
POVINNÁ AUTORSKÁ KONTROLA (jako při review cizího PR): na aktuálním SHA
zkontroluj CELÝ kumulativní diff proti base, zadání, sousední funkce,
správnost dat/bezpečnost, UI/gesta, výkon a testovací důkazy.
AKTIVNĚ HLEDEJ chyby. Všechny své opravitelné nálezy oprav, retestuj
a proveď znovu celý relevantní diff review na novém SHA, až bez známých FAIL.
HOTOVO pro kontrolora: v PR je protokol autora se SHA/base, prostředím,
PASS/FAIL/SKIP/NOT RUN/BLOCKED, konkrétními důkazy, riziky, hodnocením 1–10
a odkazy na testy; žádné známé opravitelné FAIL. Pak teprve předej
jinému nezávislému kontrolorovi. Vlastní review ≠ nezávislé review.
STOP: [hranice úkolu; merge/APK/HOME/Actions/výdaje bez příslušného GO].
VÝSTUP: krátký český výsledek + přímý GitHub URL, úplné logy patří do PR.
```

## Povinná kontrola autora před předáním

1. **Rozsah a aktuálnost:** HEAD/base, souběžné větve, kumulativní diff a všechny změněné soubory v kontextu, zadání, skutečná produkční cesta a volající. Starší PASS nebo review jiného SHA neplatí.
2. **Záměrná oponentura:** představ si, že kontroluješ cizí PR. Zkus nalézt chybné předpoklady, nezapojený kód, regrese, okrajové stavy, špatnou ergonomii, ztrátu a přepsání dat, souběh, oprávnění, selhání ukládání/obnovy a security rizika. Nehledej jen důkazy, že implementace „prošla“.
3. **Ověření:** podle rizika funkční i negativní/chybové testy, skutečné UI vazby a navazující scénáře, přesnost kót a jednotek, originální bajty médií, Undo/Redo, offline/sync, případně Android/Chromium. U nové fyzické vady průkazný RED→PASS, je-li proveditelný.
4. **Nálezy:** každý opravitelný FAIL odstraň; přidej či oprav relevantní test; znovu spust testy a proveď **celé relevantní autorské review nového SHA**. Neuzavírej úkol po prvním zeleném běhu.
5. **Předání:** do PR zapiš soupis kontrolovaných oblastí, testy a jejich přesné prostředí, výsledky PASS/FAIL/SKIP/NOT RUN/BLOCKED, limity, rizika a vysvětlení případných NOT RUN. Jsou-li známé opravitelné FAIL nebo zásadní blokér, předej **BLOCKED / NOT READY**, ne HOTOVO.

## Nezávislý kontrolor – až po autorské bráně

```text
KOMU: Nezávislý kontrolor [role]
AI: [přesná verze] – [uvažování] – [prostředí] – proč: nezávislé SOURCE/SECURITY review.
CO: kontroluj [PR] na skutečném aktuálním HEAD [SHA] proti base; ověř AGENTS,
úplné zadání, kumulativní diff, produkční vazby, regresní/security rizika
a vlastní protokol autora i důkazy testů. Nejen potvrď jeho PASS – hledej vady.
VÝSTUP: APPROVE SOURCE / CHANGES REQUIRED / STOP; přesné SHA,
PASS/FAIL/SKIP/NOT RUN, rizika, hodnocení 1–10, GitHub URL.
Pokud je nález: vrať autorovi; po opravě musí autor znovu sám otestovat
a provést celé review, následně kontrolor reviduje NOVÉ SHA.
STOP: neopravuj kód, nespouštěj cloud/HOME, nemerguj ani nevydávej APK bez GO.
```

**Definice:** „Review ve stejné hloubce jako nezávislé“ znamená **stejné otázky a rozsah oponentury**, ne tvrzení nezávislosti. Kontrolor zůstává jiným chatem/osobou. Source review, build, simulace, emulátor a skutečné fyzické testování jsou různé důkazy. **Jedno důkladné autorské review na finálním SHA + závěrečné nezávislé review**, ne zbytečné opakované audity beze změny.
