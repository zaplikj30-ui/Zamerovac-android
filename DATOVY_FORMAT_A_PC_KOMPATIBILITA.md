# Zaměřovač – datový formát, editovatelnost a budoucí kompatibilita s PC

**Založeno:** 4. 11. 2026 · **Účel:** přenositelnost existujících Android zakázek a budoucí plnohodnotná PC aplikace pro Windows 11.  
**Stav dokumentu:** **orientační technická inventura skutečně dostupného kódu + závazné principy dlouhodobé vize + návrhy k pozdějšímu rozhodnutí.** Nejde o schválené nové schéma, implementovanou PC synchronizaci ani ověřený export/import mezi PC a Androidem.

Navazuje na [VIZE_A_PLAN.md](VIZE_A_PLAN.md) a [audit 28 historických kontrol](AUDIT_KODU_PROTI_28_TESTUM.md). Aktuální opravy Androidu mají prioritu. **Nyní neprovádět velkou migraci dat ani vývoj PC aplikace.**

## 1. Co je skutečně v současném kódu

### 1.1 Lokální datový model (schéma 1)
Zdroj: [app.js](app/src/main/assets/app.js#L7-L17), [konstruktor záznamu](app/src/main/assets/app.js#L35-L37).

- Kořenový objekt obsahuje **`schema: 1`**, **`records`** (pole záznamů), **`prefs`** (předvolby rozhraní/laserů) a **`created`**. Aktuální JavaScript čte a zapisuje JSON jako celek.
- Záznamy vznikají s poli **`id`** (náhodně generovaný identifikátor), **`kind`** (typ), **`title`**, **`parentId`** (odkaz na nadřazenou složku či `null`), **`createdAt`**, **`updatedAt`**, **`rev`**, **`media`** (seznam ID médií), **`items`** (editovatelné grafické/poznámkové prvky), **`text`**, **`checks`**, **`width`**, **`height`**, **`deleted`**. Jde o současný výchozí tvar; jednotlivé typy mají také další volitelná pole.
- `kind` je interní typ záznamu, v kódu se vyskytují například `folder`, `photo`, `canvas`, `note`, `audio`, `video` a `file`. **Názvy typů jsou datové identifikátory, ne řetězce k překladu.**
- Struktura složek je zatím vytvořena pomocí **`id`/`parentId`** a kořenových záznamů. Samostatný přenositelný „projektový soubor“ pro každý projekt současný kód nedefinuje.
- Anotace fotografie jsou samostatné objekty v `items`, nikoli nutně součást obrázku. [editor.js](app/src/main/assets/editor.js#L433-L439) pro některé typy vytváří `item.id`, `type`, `a`, `b`, `points`, `segmentData`, `color`, `width`, `fontSize`, `unit`, `measure`, `text`. **Přesná sada polí se liší podle typu** (poznámky, kruhy, řetězce, texty, fotografie v poznámkách aj.).
- Běžné souřadnice v editoru jsou vyjádřené vůči pracovnímu prostoru podkladové fotografie; zobrazení se počítá pomocí `view.zoom` a posunu `view.dx/dy`, ale **uložená geometrie se při zoomu nemá měnit** ([editor.js](app/src/main/assets/editor.js#L6-L18)). Před budoucí výměnou mezi zařízeními je potřeba **formálně popsat souřadnicové systémy a jejich výjimky** pro všechny typy.
- Měření jsou v současných záznamech často uložena do `measure` jako text a jednotka do `unit`; `segmentData` může nést údaje jednotlivých úseků. **Neoznačovat tento současný stav automaticky za standardizované numerické měření pro PC.** Přesný význam a konverze jednotek se musí zdokumentovat pro každý typ.
- `rev` se při změně vytváří pomocí náhodného ID a `updatedAt` je časový údaj ([app.js](app/src/main/assets/app.js#L15-L17)). **To není hotový protokol slučování změn** mezi nezávislými kopiemi zakázky.

### 1.2 Soubor zálohy ZIP
Zdroj: [exportArchive v MainActivity.java](app/src/main/java/cz/zamerovac/app/MainActivity.java#L495-L555), [sběr vložených médií](app/src/main/java/cz/zamerovac/app/MainActivity.java#L629-L642).

Současný ZIP obsahuje zejména:
- **`projects.json`** – serializovaný stav databáze (při exportu složky omezený na její podstrom záznamů; hlavička schématu a předvolby zůstávají podle aktuální implementace);
- **`media-meta.json`** – metadata mediálních příloh podle jejich ID, například MIME typ a původní název;
- **`media/<id>`** – původní soubory fotografií a příloh, jejichž ID se vyskytují v záznamech a vnořených položkách včetně `detailItems`.

Média se fyzicky ukládají zvlášť a editor je zobrazuje podle jejich ID. **Záloha JPG/PDF s „vypálenými“ kótami by nebyla plnohodnotnou náhradou** za tento editovatelný datový model.

### 1.3 Současný import ZIP ≠ synchronizace
Zdroj: [BackupImporter.java](app/src/main/java/cz/zamerovac/app/BackupImporter.java#L69-L145).

- Povoluje **`schema == 1`** jak u importované zálohy, tak u existujícího stavu. **Budoucí verze potřebují jasně definované čtení/migraci, ne tiché přejmenování hodnoty.**
- Při importu vytvoří **novou kořenovou složku** „Obnovená záloha…“, nová ID záznamů a nová ID mediálních příloh a přepíše jejich odkazy; stávající data ponechá. Import je tedy dnes primárně **vložení kopie zálohy**, nikoliv aktualizace téže identity zakázky na jiném zařízení.
- Ověřuje základní strukturu, chybějící odkazy na média a některé bezpečnostní limity. To je užitečný základ, **nikoliv důkaz**, že je již otestované plné obnovení či atomické přerušení bez jakýchkoli vedlejších souborů. Viz [testy 26–27](REKONSTRUKCE_TESTU_21_28.md).
- Z dnešního exportu nelze bez dalších pravidel bezpečně odvodit, které objekty v jiných kopiích jsou totožné, co se změnilo od minula a co má být při konfliktu zachováno.

## 2. Požadované nezávislé zásady pro budoucí Android ↔ Windows

**Schválený směr, zatím bez schválené implementace:**

1. **Plná editovatelnost:** originální podkladové médium oddělené od popisu každého objektu. Na PC měnit jednotlivé body, hodnoty, texty, šipky, elipsy, poznámky i jejich vzhled a přesně tentýž objekt pak znovu upravit na Androidu.
2. **Jednoznačná semantika:** pro každý typ prvku definovat povinná/volitelná pole, výchozí hodnoty, geometrii, počátek a jednotky souřadnic, jednotky délky, význam popisků, případná rozšíření a způsob vykreslování bez vazby na platformu.
3. **Identita a vztahy:** stabilní ID zakázky/záznamu/objektu/média pro výměnu změn, odlišit *obnovit jako kopii* a *synchronizovat existující projekt*. Udržet platné odkazy i po přenosu, bezpečně řešit odstraňování.
4. **Verze a migrace:** explicitní verze datového schématu, kompatibilita se staršími záznamy, definované chování při novější/neznámé verzi a testovaný postup migrace s možností návratu. Zachovávat neznámé rozšiřující vlastnosti, pokud je aplikace neumí zobrazit, místo jejich tichého smazání.
5. **Souřadnice a přesnost:** zohlednit EXIF orientaci, původní rozlišení, transformace fotografie a zobrazení myší/dotykem; zaručit stabilní podkladové koordináty a rozměrové údaje, nevázat je na fyzickou velikost displeje, DPI ani jazyk rozhraní.
6. **Offline + obousměrná výměna:** bezpečně editovat na každém zařízení samostatně a později přenést změny; konkrétní přenos (lokální soubor, LAN, cloud či jiný) a případné přihlášení zatím **nejsou rozhodnuty**.
7. **Souběh a konflikty:** detekovat změny obou kopií a neprovést tiché přepsání. Zvážit revize, historii změn, identitu zařízení a časové značky, s bezpečným postupem pro konflikt (porovnání/ruční rozhodnutí/uchování verzí), nikoli jen neověřené „poslední zápis vyhrává“. **Nejde o schválení konkrétního algoritmu.**
8. **Integrita a ochrana:** detekovat chybějící/poškozené přílohy, kontrolovat obsah archivu, nepřepsat či nesmazat již platný projekt při chybě, bezpečně zapisovat a zálohovat, zachovat soukromí zákazníků. Podle zvoleného přenosu později rozhodnout šifrování a oprávnění.
9. **Oddělené UI:** Windows může nabídnout klávesové zkratky a panely, Android dotyk a S Pen. Oba editory musí měnit stejné datové vlastnosti, nikoli vytvářet nekompatibilní exporty.
10. **Oddělené nastavení aplikace:** výchozí barvy, poloha ovládacích prvků, velikost dialogu, jazyk a další `prefs` nemusí být totožné na Windows a Androidu. Při budoucí výměně projektu **nesmí import automaticky přepsat preference cílového zařízení**, pokud to není výslovně zamýšlené.

## 3. Otázky k rozhodnutí až při skutečném zahájení PC fáze

| Otázka | Nynější postavení |
|---|---|
| PC framework (nativní Windows, web technologie s desktop obalem apod.) | **Nerozhodnuto.** Nezamykat datový formát na konkrétní UI. |
| „Projekt/zakázka“ jako samostatný soubor versus centrální databáze | **Nerozhodnuto.** Dnes existují `records` a `parentId` v jedné databázi. |
| Způsob přenosu a synchronizace | **Nerozhodnuto.** ZIP je dnes záloha/obnova kopie, ne obousměrný synchronizační protokol. |
| Slučování souběžných editací | **Nerozhodnuto.** Požadováno bezpečné chování bez tiché ztráty dat. |
| Způsob uložení numerických hodnot, přesnost, formátování a měřítko | **K dopracování podle jednotlivých typů.** Dosavadní textové `measure` se nesmí ztratit. |
| Konkrétní datum vydání a první rozsah PC aplikace | **Nestanoveno**, není to priorita současné aktualizace. |

## 4. Co má smysl dělat nyní – a co nikoliv

**Při aktuálních opravách Androidu** podle [auditu 28 testů](AUDIT_KODU_PROTI_28_TESTUM.md) postupovat bezpečně: zachovat původní snímky i každou editovatelnou položku, nepoškozovat vazby `id`/`parentId`/`media`, neopravovat ZIP bez round-trip testů, nezavádět nové typy objektů bez přesně popsaného formátu; změny schema či serializace vždy dokumentovat.

**Nyní neprovádět**: vývoj Windows verze, migraci databáze pouze kvůli PC, zavedení cloudu či konfliktového engine, vlastní síťový protokol, změny ID již uložených zakázek ani kompletní přepis editoru. Tyto věci počkají na konkrétní rozhodnutí a testovací scénáře.

### Doporučená minimální kontrolní sada při budoucí datové změně
- Starší zakázka se otevře a uloží **bez ztráty** složek, názvů, obrázků, kót, rozměrů, stylů, poznámek, hlasových nahrávek a detailních příloh.
- Export ZIP → import do odděleného zkušebního prostoru → porovnání počtu záznamů, objektů, vazeb a médií; test chybných ZIP, chybějících médií a přerušeného zápisu.
- Rozměry a souřadnice stejných anotací se při opakovaném uložení **nezmění**; ověřit různá rozlišení fotografií, orientaci a jednotky.
- Editace prvku a **undo/redo** nezmění původní fotografii.
- Při přidání nového pole a jeho načtení starším softwarem **neztratit cizí data**; budoucí způsob kompatibility navrhnout výslovně.
- Pozdější obousměrný test bude vyžadovat **Android A → Windows → Android B → znovu Windows**, offline změny na obou stranách a bezpečný konflikt. **Tento test nyní není proveden ani realizovatelný bez PC aplikace.**

## 5. Stav plnění a hranice tohoto dokumentu

| Oblast | Stav ke 4. 11. 2026 |
|---|---|
| Dlouhodobá vize společných zakázek Android / PC | **Zaznamenána a odsouhlasena jako směr** |
| JSON `schema: 1`, identifikátory, hierarchie a editovatelné `items` | **Existují v kódu Androidu**, neověřeny jako univerzální standard |
| ZIP `projects.json`, `media-meta.json`, `media/` | **Existuje v kódu**, end-to-end obnova a kompatibilita na PC dosud neověřeny |
| Formální stabilní multiplatformní formát a migrace | **Není vytvořen jako závazná specifikace** |
| Identita stejného projektu a bezpečné slučování změn | **Není implementováno** |
| Synchronizace Windows ↔ Android, konfliktové dialogy | **Není implementováno** |
| Windows 11 editor a jeho testy | **Nezahájené** |
| Příští aktualizace Androidu | **Dále podle dohodnutých oprav**, bez odbočky na vývoj PC |

**Závěr:** Dostupné JSON + oddělená média dávají dobrý základ pro editovatelnost, ale **současná ZIP obnova kopie není synchronizace**, `schema: 1` zatím nemá migrační kontrakt a budoucí PC verze vyžaduje přesnou specifikaci objektů a konfliktů. Tuto hranici zachovávat ve všech dalších rozhodnutích, aby později nevznikly tiché ztráty zakázek.

[**Vize a plán**](VIZE_A_PLAN.md) · [**START ZDE**](START_ZDE.md) · [**Audit kódu**](AUDIT_KODU_PROTI_28_TESTUM.md)
