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


- **Příprava na vícejazyčnost (schválená, zatím bez změny kódu):** [Plán lokalizace](LOKALIZACE_PLAN.md) · [Úkol #14](https://github.com/zaplikj30-ui/Zamerovac-android/issues/14). Nyní zůstává vše v češtině; jazykové klíče se budou bezpečně přidávat jen k nově opravovaným funkcím. **Nově schválená položka Nastavení „Jazyk aplikace“** nabídne pouze „🇨🇿 Čeština“, ale architektura bude připravena na desítky jazyků v jejich vlastních názvech a písmech, vyhledávání, různá locale a případné RTL. Další jazyky nyní nejsou dostupné.

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

### Možný dlouhodobý cíl: veřejné vydání na Google Play (nezávazné)

**Zapsáno 4. 11. 2026. Stav: MOŽNOST DO BUDOUCNA – NENÍ SCHVÁLENÉ VYDÁNÍ, TERMÍN, PRIORITA ANI ZÁVAZEK.** Smyslem projektu je především **profesionální, stabilní, přesný a spolehlivý Zaměřovač pro zaměřování nábytku**, vhodný i pro každodenní vlastní práci. Veřejné vydání na **Google Play** je pouze jedna z možností, o které se může uživatel rozhodnout až později. Neusilovat o vydání za každou cenu ani pod časovým tlakem.

**Pořadí priorit (závazné pro současná vývojová rozhodnutí):**

**Spolehlivost → bezpečnost zákaznických dat → přesnost a funkčnost → jednoduché ovládání → kompatibilita → případné veřejné vydání.**

**Pravidla kompatibilního, ale přiměřeného vývoje:**

1. **Bez zbytečného přepisování:** nové funkce navrhovat s ohledem na možnost veřejné distribuce, ale neměnit stabilní části aplikace jen kvůli hypotetickému Google Play. Současné domluvené opravy, ověřování a každodenní použitelnost mají přednost.
2. **Lokalizace a rozměry displeje:** pokračovat v architektuře [LOKALIZACE_PLAN.md](LOKALIZACE_PLAN.md) pro desítky jazyků, různá písma, délky textů, místní formáty a případně RTL; dnes jen čeština. Přizpůsobivé rozložení pro telefony i tablety, různé úhlopříčky a hustoty pixelů, včetně S Pen tam, kde je dostupný.
3. **Android ekosystém:** vyhýbat se neodůvodněným závislostem na jednom výrobci, verzi Androidu nebo specifické nadstavbě. Testovat na dostupných zařízeních; kompatibilitu s jinými značkami a verzemi Androidu označit za ověřenou **až po skutečném testu**, nikoli jen proto, že aplikace používá standardní Android API.
4. **Rozšiřitelné měřicí přístroje:** oddělit obecné rozhraní měření (připojit, odpojit, naměřená hodnota, jednotka, stav, historie/chyby) od adaptérů jednotlivých výrobců a modelů. **Nepředpokládat jediný univerzální Bluetooth protokol.** Každý podporovaný laser může mít jiné BLE služby, charakteristiky, způsob párování, oprávnění, příkazy a chování při výpadku. **Ověřeno pro konkrétní model** uvést jen po reálném testování s tímto modelem; nevytvářet nepravdivý seznam kompatibility.
5. **Zákaznická data jsou přednější než nové funkce:** zachovávat bezpečné lokální ukládání, konzistentní transakční operace, obnovu z koše, bezpečné zámky, ZIP export/import, úplnost příloh, zpětnou kompatibilitu a aktualizace bez ztráty fotografií, kót, zakázek, poznámek či měření. Změny datového formátu vyžadují otestovaný migrační a návratový postup.
6. **Automatické a regresní testy:** postupně doplňovat jednotkové, integrační a uživatelské scénáře včetně bezpečnosti dat, kreslení, úchopů, laseru, offline režimu, obnovy, aktualizace a rozličných obrazovek/Android API. Jasně oddělovat *kód existuje*, *test běžel*, *test prošel* a *ověřeno na fyzickém zařízení*.
7. **Rozumná připravenost na Play:** u nového kódu preferovat standardní Android API a obecně správné oprávnění, zásady přístupu k souborům, zabezpečení a ochranu soukromí. Konkrétní aktuální požadavky Google Play (např. cílová API úroveň, formuláře, pravidla publikování) **ověřit až při případném rozhodování o vydání**; mohou se měnit. Nepřizpůsobovat dnešní vývoj neověřeným budoucím pravidlům.
8. **Budoucí produkční distribuce:** neplést interní testovací/debug sestavení a jeho podpis s produkčním vydáním. Pokud se rozhodneme pro zveřejnění, samostatně připravit produkční sestavení a bezpečnou správu podpisových klíčů, minimální potřebná oprávnění, přístupnost, informace o ochraně soukromí a distribuci; teď tím nezatěžovat každodenní vývoj. Testovací podpisové údaje z repozitáře **nikdy nepoužívat jako produkční tajemství**.
9. **Bez komerčních/právních kroků předem:** **nyní nezakládat vývojářský účet** jen kvůli této možnosti, nezavádět reklamy, předplatné, platby, povinnou registraci, analytiku ani jiné funkce, které aplikace nepotřebuje. Případný obchodní model a pravidla ochrany soukromí se budou řešit až po samostatném rozhodnutí.
10. **Neomezovat současného uživatele:** nevypínat funkce, nepřidávat omezení ani neměnit způsob používání jen kvůli hypotetickému veřejnému vydání. Jednoduché offline používání a kontinuita stávajících zakázek musí zůstat zachované.

**Pravidlo upozornění na budoucí problém:** Jestliže se při další opravě nebo architektonické volbě ukáže řešení, které by **významně ztížilo případné zveřejnění** (např. nevratný datový formát, nepřenosná vazba na jediný hardware, zbytečně široká oprávnění, nebezpečné podepisování či pevné české texty v nové logice), upozornit uživatele **konkrétně na riziko**, nabídnout přiměřenou alternativu a vyčíslit kompromis v rozsahu práce. **Nepoužívat hypotetické Play jako záminku k rozsáhlému refaktoringu bez domluvy.**

**K případnému přechodu do plánu vydání** dojde teprve po výslovném rozhodnutí uživatele a samostatné kontrole stability, kompatibility, právních/obchodních požadavků, zásad obchodu a skutečných testů. Do té doby je toto **nezávazný dlouhodobý směr, nikoli úkol „vydat APK na Google Play“.**

## 5. Aktuálně zaznamenané otevřené body a testování
- Podrobný kontrolní seznam 49 úprav: [Issue #12](https://github.com/zaplikj30-ui/Zamerovac-android/issues/12).
- Průběžný testovací deník: [Issue #13](https://github.com/zaplikj30-ui/Zamerovac-android/issues/13).
- Rekonstrukce 28 historických testů je dokončena ve třech souborech; implementaci a funkčnost aktuální APK je potřeba ověřit samostatným auditem a retestem.
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
| 2026-11-04 | Schválena bezpečná příprava vícejazyčnosti, řádek „Jazyk aplikace“ s jedinou volbou 🇨🇿 Čeština; bez samostatné APK. [Issue #14](https://github.com/zaplikj30-ui/Zamerovac-android/issues/14). |
| 2026-11-04 | Nové upřesnění: škálovat na desítky jazyků, vyhledávání, autonyma, různé skripty/formáty a RTL; v příští aktualizaci pouze česká volba, ostatní opravy mají přednost. |

| 2026-11-04 | Možné budoucí vydání na Google Play pouze jako nezávazný směr. Vývoj má přednostně zajistit spolehlivost, bezpečnost dat, přesnost, jednoduché ovládání a kompatibilitu; bez termínu, reklamy, registrace nebo zbytečných změn kvůli publikování. |

## 8. Další dohledané drobné náměty a ověřované detaily z testování
Tyto body jsou rozdělené podle původního kontextu; **nesmí se automaticky vydávat za hotové**.
- **Návrh na vylepšení:** barevná ikona výběru fotografie v poznámce; při více fotografiích ukázat první a části dalších náhledů pod ní (test 16).
- **Dohodnuté očekávané ovládání:** samostatně přesouvat text/rozměr při práci se šipkou, nezávisle přesouvat rám poznámky a hrot, mít jemné průhledné označení kóty.
- **K opravě/ověření:** pohyb volné kresby, úchopy kruhu a elipsy, lupa s vycentrovaným bodem, černá plocha při hlášení chyby, import ZIP.
- **Plánovaný test:** obousměrná synchronizace Google Disk, reálný offline provoz a navazující test 29.
- Podrobné výsledky podle čísel jsou v [rekonstrukci 1–28](START_ZDE.md) a statická kontrola současného kódu je v [auditu](AUDIT_KODU_PROTI_28_TESTUM.md); ani jedno nenahrazuje test nové APK.
