# Zaměřovač – živá vize aplikace a plán do budoucna
*Založeno 4. 11. 2026. Tento dokument je pracovní představa, **nikoli neměnná specifikace**. Může se průběžně měnit po domluvě s uživatelem.*

## 1. Hlavní smysl
Praktická samostatná Android aplikace pro zaměřování zakázkového nábytku: od založení zakázky přes fotografie, kóty a poznámky až po předání podkladů pro návrh a výrobu. Minimalizovat přepínání mezi aplikacemi, neztrácet naměřená data a udržet snadné ovládání přímo na stavbě/montáži.

**Principy:** rychlost, čitelnost i na mobilu, použití na Samsung Galaxy S24 Ultra a Galaxy Tab S11 Ultra, S Pen a laser Bosch přes Bluetooth, funkčnost i bez internetu, bezpečná aktualizace bez smazání zakázek. ImageMeter je inspirace pro ovládání, ne zdroj převzatého kódu či grafiky.

## 2. Představa, jak má aplikace vypadat a ovládat se
- Tmavé fialovo-antracitové prostředí, možnost akcentní barvy, čitelné žluté kóty a přehledné ovládání (dosavadní směr z README).
- Zakázky / složky / podsložky s fotografiemi, přílohami a poznámkami, intuitivní galerie a editor.
- Fotografie zůstávají čitelné i s kótami a symboly; v galerii bezpečné prohlížení bez nechtěných úprav, v editoru přesné uchopování a lupa.
- Přiměřeně velké, poloprůhledné úchopy kolem čar a hrotů, nepřekrývají důležité kóty; přesun celé kóty za střed, konce zvlášť.
- Název případné cílové složky pro export či zálohu nemá být natvrdo „Zaměřovač“; má vycházet z aktuálního názvu aplikace (příklad při přejmenování: „Měřák – Zapletal“). Návrh do budoucna, vyžaduje návrh migrace/potvrzení.
- Funkce mají být vysvětlené srozumitelnými názvy/popisky, ne jen nejasnými ikonami.

## 3. Co má umět – cílový funkční celek
- **Zakázky a data:** vytvořit zakázku a adresu, členit do složek, ukládat původní fotografie/PDF/video a editovatelné anotace, hledat, zálohovat, exportovat/importovat včetně podsložek; přežít restart a aktualizaci.
- **Kótování a kreslení:** běžné kóty, čáry, šipky, nepravidelná plocha, obdélník, kruh/elipsa, lomená čára, volná ruka, úhly, dimenzní i kumulativní řetězce; S Pen, přesné posouvání a přichytávání s možností úplného vypnutí.
- **Poznámky a přílohy:** textové, hlasové a fotografické poznámky přímo u místa ve snímku, včetně příloh a případné vlastní kresby.
- **Bosch:** přímý přenos naměřené hodnoty do vybrané kóty/úseku a historie; chování reálně ověřit s fyzickým měřidlem a příslušným protokolem.
- **Prohlížení a symboly:** galerie kótovaných fotografií, přepínání mezi editací a jen prohlížením; rozšiřitelná knihovna symbolů v kategoriích.
- **Offline a synchronizace:** plně použitelné bez internetu; možnost přenášet zakázky mezi telefonem a tabletem bezpečným způsobem, bez ztráty místních úprav. Google Disk vyžaduje samostatné ověření přenosu.
- **Další aplikace:** S Pen poznámky/skici uvnitř Zaměřovače; uživatel by ideálně chtěl kontinuitu se Samsung Notes, avšak plná obousměrná automatická synchronizace není potvrzena jako technicky dostupná.

## 4. Možná do budoucna – dobrý nápad, rozhodneme později
Tento seznam obsahuje dříve zmíněné nebo odložené směry. O přesném provedení a prioritě rozhodneme zvlášť.
**Význam této kategorie:** „Možná dobrý nápad“, „uvidíme“, „necháme na později“, „zatím se nerozhodnu“. Tyto položky **nejsou ani zamítnuté, ani schválené pro vývoj**. Žádný termín ani automatické programování. U každé větší možnosti uvést varianty, klady/zápory a poslední doslovně podloženou dohodu. Až uživatel rozhodne, přesunout do schváleného plánu.

- Propojení fotografií s půdorysem místnosti.
- Porovnávání dvou fotografií vedle sebe.
- Šablony zakázek, karta zákazníka.
- Další pokročilé chování magnetického přichytávání.
- Výměna podkladové fotografie se zachováním editovatelných kót.
- Lepší práce s poznámkami/S Pen a hledání možností propojení se Samsung Notes, pouze pokud to dostupná rozhraní umožní.
- Vylepšené srozumitelné popisky/editor a změna názvu aplikace/složek, pokud se na tom dohodneme.

## 5. Aktuálně zaznamenané otevřené body a testování
- Podrobný kontrolní seznam 49 úprav: [Issue #12](https://github.com/zaplikj30-ui/Zamerovac-android/issues/12).
- Průběžný testovací deník: [Issue #13](https://github.com/zaplikj30-ui/Zamerovac-android/issues/13).
- Převod výsledků přibližně 28 starších praktických testů z chatu dosud **není kompletní**; výsledky nevymýšlet.
- K dalšímu praktickému testu byl domluven **test 29 – offline**.
- Při dosavadním zkoušení bylo hlášeno, že ZIP není vidět ve výběru importu; zapsat jako otevřený problém k ověření/opravě, nikoliv jako hotovou opravu.

## 6. Jak budeme tento dokument udržovat
- Při novém nápadu zapsat do „Nápady / možnost do budoucna“; nápad **není automaticky závazek**.
- Po společném rozhodnutí přesunout do „Dohodnuto / plán“ a napsat přesně očekávané chování, prioritu, návaznosti a rozhodnutí.
- Implementace a testování se sledují samostatně v issues: **Nápad → Probráno → Dohodnuto → V plánu → Implementováno → Ověřeno na zařízení**; také „Odloženo“ nebo „Zrušeno“.
- Vše podstatné včetně toho, **proč jsme se rozhodli**, zapisovat při aktivní práci na GitHub a poslat odkaz. Po cca 5–8 kontrolách nebo před změnou chatu aktualizovat stav.
- Když se vize změní, **aktualizovat současnou podobu** a přidat krátkou změnu do historie. Historické dohody nezaměňovat za platný plán.
- Tento soubor popisuje **cílový směr, ne potvrzení, že všechny vyjmenované funkce již fungují**.

## 7. Historie rozhodnutí o směru
| Datum | Co bylo dohodnuto |
|---|---|
| 2026-11-04 | Udržovat také dlouhodobou podobu aplikace, budoucí nápady, plánované změny a rozhodnutí. Vize se může měnit. |

## 8. Další dohledané drobné náměty a ověřované detaily z testování
Tyto body jsou rozdělené podle původního kontextu; **nesmí se automaticky vydávat za hotové**.
- **Návrh na vylepšení:** barevná ikona výběru fotografie v poznámce; při více fotografiích ukázat první a části dalších náhledů pod ní (test 16).
- **Dohodnuté očekávané ovládání:** samostatně přesouvat text/rozměr při práci se šipkou, nezávisle přesouvat rám poznámky a hrot, mít jemné průhledné označení kóty.
- **K opravě/ověření:** pohyb volné kresby, úchopy kruhu a elipsy, lupa s vycentrovaným bodem, černá plocha při hlášení chyby, import ZIP.
- **Plánovaný test:** obousměrná synchronizace Google Disk, reálný offline provoz a navazující test 29.
- Podrobné výsledky podle čísel jsou pouze v [deníku #13](https://github.com/zaplikj30-ui/Zamerovac-android/issues/13), který bude aktualizován po porovnání s videem.
