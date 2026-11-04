# Společná aktualizace po 1.2.149 – implementace Codexu

PR: [#27](https://github.com/zaplikj30-ui/Zamerovac-android/pull/27). Rozsah: [předání #17](https://github.com/zaplikj30-ui/Zamerovac-android/issues/17#issuecomment-6640394013), převzato z `fafcd0f`, větev `codex/post-149-completion`. Poslední vydaná APK zůstává **1.2.149**. Žádná APK nebyla vytvořena ani vydána, `.github/apk-build-request.txt` zůstává beze změny. PR se neslučuje automaticky.

## Nový kód

- **#20 video:** vlastní neveřejná Android `VideoActivity`, play/pause a posun přes systémový MediaController, zavření a volitelný externí přehrávač. Čte původní lokální soubor přes seekovatelný read-only MediaProvider, nikoliv přes načítání celého videa do JS. Chyba kodeku a limit 20 s pro zahájení/zaseknuté bufferování nahradí nekonečné načítání. Při odchodu se přehrávání pozastaví, při zavření uvolní. Původní soubor se nepřevádí ani nepřepisuje.
- Již existující miniatury videí jsou zachovány a dokončeny: vzorkovaný dekódovaný snímek na API 27+, limit paměti na API 26, cache 144 × 144, zástupný symbol při chybě. Nejvýše dva dekodéry a omezená fronta, odpověď na náhled čeká nejvýše 5 s; kodek nedrží zámek databáze/koše. Negativní cache nepodporovaného formátu a bezpečné zveřejnění náhledu s kontrolou existence originálu. Koš uklízí i negativní cache.
- **#22 PDF:** jednotlivé poznámky mají oddělený nadpis, **celý text i všechny fotografické přílohy**, v původním pořadí, ve dvou sloupcích bez deformace. Podle dodatečného upřesnění uživatele se zahrnou také textové poznámky bez fotografie; dlouhý text se zalamuje a pokračuje na dalších stranách. Prázdné poznámky nevytvářejí prázdné oddíly; audio/video se nevkládá do PDF. Hlavní fotografie s kótami se nezmenšuje kvůli přílohám, další stránky patří témuž PDF.
- PDF se zapisuje po jednotlivých rastrových stránkách, neuchovává všechny stránky v paměti. Rozpracované PDF nelze uložit. ZIP dál obsahuje jedno PDF na fotografii. **Soukromé texty ani přílohy se bez výslovného zaškrtnutí nenačítají a nevykreslují.** Žádný projektový JSON, GPS, historie, metadata ani editovatelné objekty v PDF. Zálohovací ZIP a jeho import se nemění.
- **#24 Bluetooth:** GATT callbacky se řadí na hlavním vlákně, až po přiřazení vráceného spojení. Každá relace má generaci; odpojení zneplatní starý scan, výběrový dialog, čekání na oprávnění i Classic callbacky. Odpověď na oprávnění po stornu nemůže obnovit hledání. Zachová se volba „jiný měřák“. Aktivní scan používá low latency, dávkové výsledky i explicitní LE transport. Neúspěšné GATT se ihned zavře a vyčistí, připojování má limit 20 s; doplněna ochrana zavření Classic před otevřením socketu. Na Androidu 26–30 se správně žádá oprávnění polohy potřebné pro scan.
- **#21 fotografie:** existující zákaz kreslení kót před fotografií zachován; navíc generace načítání (včetně znovuotevření stejného záznamu), ošetření selhání a limit, viditelná chyba místo trvalého načítání. Během načítání nelze naslepo upravit hlavní ani vložené objekty. Neaktuální výsledek nesmí nahradit novější fotografii.
- **#17:** schválené další zmenšení značky pravítka z 15 na 13 px (symbol 11 → 9 px), stejný levý horní roh, barvy a kontrast. Žádná změna dotykových cílů.

## Doplnění #26 – otáčení telefonu a tabletu

Uživatel výslovně zařadil [#26](https://github.com/zaplikj30-ui/Zamerovac-android/issues/26) do stejného PR. Konkrétní příčiny: procentní flex sloty rostly se šířkou obrazovky a navazující pravidla pro zaměněné ikony rušila jejich omezení; galerie po otočení nepřepočítávala své pixelové plátno. Tyto cesty nyní mají samostatná pravidla v `responsive.css`, bez změny datového modelu či pořadí ikon.

- Hlavní lišta má políčka 40–64 px, centrovaná na větší ploše; grafika ikon zůstává ve své původní pevné velikosti. Nečtvercová grafika složky se nenutí do čtverce. Spodní lišta prohlížeče se vejde i na 320 px.
- Na nízké obrazovce na šířku jsou nižší hlavičky/lišta a další nástroje v jedné vodorovně posuvné řadě, aby zbyla fotografie; na výšku zachována dvojice řad. Menu se kotví podle skutečných výšek, na tabletu používá tři sloupce, dialogy mají dostupné akce a rolování.
- Resize editoru zachová zoom i světový bod uprostřed obrazovky; nemění výběr, geometrii, hodnoty, undo/redo, rozpracovaný řetězec ani obsah formuláře. Hlavní Android aktivita nadále obsluhuje změny konfigurace bez nového WebView.
- Galerie přepočítává plátno podle nové dostupné plochy a zahodí zastaralé asynchronní vykreslení. Pinch zoom a posun zůstávají; nevykreslí se starší orientace přes novější.
- `tools/check-orientation-browser.cjs` provádí skutečné přepínání mezi **11 viewporty**: 320×568, 568×320, 360×800, 800×360, 412×915, 915×412, 768×1024, 1024×768, 1280×800, 800×1280 a 500×400. Kontroluje rozměry/proporce a překrytí, dostupnost prvního/posledního nástroje, menu, galerii a její zoom, centrum fotografie, neuložené hodnoty/texty, výběr, rozpracovaný řetězec a persistenci po reloadu. Nativní test navíc kontroluje stejnou aktivitu/WebView a přesná uložená data při změně konfigurace oběma směry.
- Jde o automatické testy. Skutečné systémové lišty, výřezy displeje, klávesnice, S Pen a různé Android WebView na telefonu/tabletu zůstávají k fyzickému ověření; nedochází k zamknutí orientace.

## Audit již hotové práce

- **#23:** oprava `2929e306` + regrese `8e942981` se nepřepisuje. Testy úchopů pro čáru i kótu dál hlídají jitter, dvojklepnutí, skutečný tah, ochranu proti nulovému segmentu a přesné hodnoty. Nový skutečný Chromium průchod navíc ukládá a po reloadu kontroluje geometrii a hodnotu `1585,800001 mm`.
- **Bosch UX:** původní malá modelová ikona, krátké klepnutí historie, dlouhé podržení profil, jednoduchý jeden měřák, filtry a selektivní mazání pro více přístrojů, stará nepřiřazená historie a pseudonymizace identity zůstávají zachované. Nejsou přidány nové protokoly ani nedoložená tvrzení o schopnostech.
- **Poznámky:** výraznější stoh více fotografií a úchopy pro posun, hrot, velikost a otočení již existují. Regrese `inset_workspace_interaction.js` a `note_leader_interaction.js` prošly; neprovádí se jejich další přepis.
- **Pomalý systémový výběr:** cesta `pickMedia` → `Native.selectFiles` → `chooseAttachments` přímo spouští ACTION_OPEN_DOCUMENT na hlavním vlákně, bez dekódování nebo kopírování před zobrazením. Zdržení poskytovatele souborů na Samsungu nebylo reprodukováno; neprovádí se odhadovaná změna systémového dialogu. Zbývá fyzicky změřit a určit konkrétního poskytovatele. Název **Importovat zakázky ze ZIP** se nemění.

## Automatická ověření

- Všechny assets prošly `node --check`; **17 JS regresních skriptů** a **46 Python testů** prošlo bez přeskočení s JDK 17.
- **Čtyři skutečné Chromium průchody**: původní post17, post148, post149 a orientace #26. PDF test používá jen generované barevné obrázky, fotografii na šířku/na výšku, více fotografií v jedné poznámce, 15 příloh, neobrazovou přílohu, prázdnou a dlouhou čistě textovou poznámku. Kontroluje skutečné pixely, vykreslené texty, více stran, nezměněný originální záznam a nulové načítání soukromých příloh ve výchozím exportu. Také zpožděné/chybné načtení stejné fotografie, blokování slepých dotyků a perzistenci kóty.
- `gradle --no-daemon testPreviewUnitTest`: **24 nativních testů**, bez chyb a skipů (6 původních dat/exportů, 9 koše, 9 nových). Kompiluje produkční Java kód, **nebalí APK**. Nové regrese: vícestránkové PDF a zákaz uložení nedokončeného dokumentu, callback před návratem connectGatt, storno během spojování/oprávnění, timeout a zavření GATT, limit přehrávače/lifecycle, validace ID, cache náhledu/nepodporovaný a zablokovaný dekodér, nezměněné originály, interní otevření videa a seek v souboru přes 2 GiB.
- `tools/check-customer-pdf.py`: skutečné ZIP artefakty s jedním a třemi PDF i **jedním třístránkovým PDF** z nativních testů ověřeny striktním pypdf parserem a vykreslením přes PyMuPDF: správné rozměry, barvy, všechny stránky, pouze rastrové obrázky, žádná metadata/formuláře/poznámkové objekty/přílohy.
- Průběžný CI na `2ee1ec6`: zdroje/prohlížeče prošly (41905413939), Java a všech 24 nativních testů také, ale nový nezávislý PDF krok v 41905413857 selhal kvůli chybějícímu Pillow v instalaci pypdf. Opraveno instalací extra `pypdf[image]`; výsledek následného běhu ověřit před předáním.
- Původní testy obnovy staršího schématu, přesných hodnot/jednotek a koše zůstávají v běhu. Žádná migrace databáze ani formátu zálohy nebyla zavedena.
- Rychlý PR workflow nově zahrnuje Java změny a nové průchody pro PDF a orientaci; stávající samostatný nativní workflow testuje bez APK a nově nezávisle ověřuje PDF artefakty. Nativní testy se nespouštějí duplicitně v obou workflow. Případné omezení GitHub Actions je třeba uvést podle skutečného výsledku PR, nikoliv předpokládat úspěch.

## Co stále vyžaduje zařízení

Automatické testy neprokazují funkční kodek ani Bluetooth na Samsungu. Po kontrole PR koordinujícím ChatGPT a až po zvlášť schválené společné APK ověřit postupně:

1. Aktualizace přes 1.2.149 a restart bez ztráty zakázek, fotek, poznámek, videí, přesných kót a historie; také otočení oběma směry v otevřeném editoru/dialogu na telefonu i tabletu.
2. Krátké/dlouhé MP4 offline, posun/play/pause, otočení, návrat do zakázky, po restartu; nepodporovaný formát a miniatura s fallbackem. Skutečný kodek, chování MediaControlleru a délka bufferování jsou neověřené.
3. Otevřít zákaznické PDF s vypnutými soukromými údaji a pak výslovně povolenými poznámkami: text bez obrázku, dlouhý text, více poznámek a všechny fotky, další strany, čitelnost hlavních kót. Samostatný zálohovací ZIP.
4. První připojení uloženého laseru i jiný měřák, zrušení během scanu/oprávnění/GATT, bezpečné odpojení, znovupřipojení po vypnutí laseru, přenos do lineární/řetězové kóty, živá a trvalá historie, ikona/gesta a více přístrojů. Původní fyzická příčina prvního neúspěchu není dokázaná.
5. Dvojklepnutí a nepatrný pohyb úchopu čáry/kóty se zapnutým magnetem, vedle vložené fotografie, po uložení a opětovném otevření; souběžně načítání malé/velké fotografie offline.
6. Menší pravítko, stoh/úchopy vložené fotografie a rychlost konkrétního systémového poskytovatele souborů.

Issues se neuzavírají jako fyzicky opravené. Jediný další krok po dokončení PR: **ChatGPT zkontroluje změny a testy; APK teprve následným samostatným rozhodnutím.**
