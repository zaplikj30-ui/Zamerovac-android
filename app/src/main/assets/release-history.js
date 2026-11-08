/* Zaměřovač – offline historie změn a oprav (#31).
 * Pevné verze odvozené ze skutečných vydání/issues; nové vydání = nová položka.
 * Nikdy nepoužívat appVersionShort pro přeznačení staré historie.
 */
(function(root){
'use strict';
// Recorded with the implementation; assign an actual release only at the joint
// release gate. These notes must never be attributed to an already issued APK.
const unreleasedChanges={title:'Rozpracováno – dosud nevydáno',groups:[{kind:'Opraveno',items:[
 {text:'Galerie překresluje kóty, čáry a hodnoty v rozlišení displeje i při přiblížení. Prohlížení ani export nemění výběr a historii otevřeného editoru; návrat přes Upravit ke stejné fotografii zachová rozpracovanou práci.'},
 {text:'Popisky vložených fotografií používají šířku skutečného výstupu. PNG zahrnuje také natočený detail a jeho text mimo původní fotografii.'},
 {text:'Převzaté opravy poznámek a laseru: Undo obnoví původní text, přehrávání hlasu nevyžaduje textový fokus a druhý přesný odečet se neztratí při shodném zaokrouhlení.'},
 {text:'Klepnutí, nepatrný pohyb prstu, neúspěšné přichycení a přiblížení dvěma prsty již nemažou možnost Znovu ani nevytvářejí prázdné kroky v historii. Skutečný tah se uloží také při přerušení gesta.'},
 {text:'Při přechodu z posouvání obrazu na gesto dvěma prsty už nezůstává starý tah aktivní; po uvolnění prstu obraz neodskočí. Přerušené gesto také nezachová staré posouvání.'},
 {text:'Vysypání koše chrání sdílené originály i při odkazech uložených ve starším JSON objektu jako text a při opakovaném úklidu po restartu.'},
 {text:'Hloubka historických odkazů na přílohy je nyní omezená pro celý průchod, včetně vnořeného JSON uloženého jako text. Neověřitelná historie vysypání koše bezpečně zastaví bez odstranění originálů.'},
 {text:'Uložení a smazání vyřešených připomínek nyní potvrzujeme až po ověřeném zápisu seznamu do zařízení. Při chybě úložiště rozpracovaná připomínka zůstane otevřená a nepotvrzené změny se neoznačí jako uložené.'},
 {text:'Během asynchronního ukládání obrázkové připomínky nelze nechtěně zavřít editor ani přejít do seznamu; pozdní dokončení jiné editační relace neuloží nesprávný záznam.'}
]}]};
// Exact 1.2.153 test-release notes; available only to matching installed versions.
// Automated verification is not physical acceptance of Google, Bosch or the devices.
const releaseChanges={issue:39,version:'1.2.153',groups:[{kind:'Nové funkce',items:[{text:'Volba četnosti vlastních automatických pokusů synchronizace: automaticky, 15, 30, 60 minut nebo ručně. Nastavení potvrzuje Android; příchozí důvěryhodné místní spojení zůstává při zapnuté službě povolené.'},{text:'Oddělený výběr Google účtu pro synchronizaci a zálohy, souhlas k soukromým datům aplikace, API přenos a odpojení bez mazání historie. Potvrzený projekt Google Cloud je propojený s testovací aplikací; sestavení ověřuje balíček a skutečný podpis. Živý účet zatím nebyl fyzicky ověřen.'},{text:'Samostatné historické zálohy po instalaci, sdílené neměnné datové bloky, kontrola úplnosti a obnova jako nové kopie. Systémové úložiště včetně Disku závisí na poskytovateli; skutečný Drive účet dosud neověřen.'},{text:'Obrazovka synchronizace zařízení, oboustranné TLS párování, přímý přenos celých zakázek přes místní Wi-Fi / Wi-Fi Direct a trvalá fronta příloh. Rádio a zařízení zatím čekají na fyzické ověření; Drive a historie záloh se dále dokončují.'}]},{kind:'Opraveno',items:[
 {text:'Opravy auditu A39-01 až A39-06: společný UTF-8 limit čtení a zápisu, odvolání rozjednaného TLS párování i při vytížených přenosech, deterministická oprava cyklu složek při synchronizaci a obnově bez změny přesných kót.'},
 {text:'Příprava ZIP obnovy mimo zámek ukládání, zachování souběžných editací a rollback. Export a import sdílejí limity počtu položek, metadat a celkových bajtů. Koš uklidí výhradní hlasová a historická média; sdílené soubory a neměnné zálohy zachová.'},
 {text:'Opakovaný pokus zálohy po nedokončeném nebo poškozeném bloku vytvoří ověřenou neměnnou kopii z dostupného originálu. Původní soubor a historické manifesty se nepřepisují; chyby přístupu a chybějící všechny kopie se nepovažují za úspěch.'},
 {text:'Současné první spuštění místního a cloudového přenosu nevytváří dvakrát bezpečnostní klíč instalace. Zbytky nepublikovaného dočasného zápisu se nepovažují za potvrzené zakázky.'},
 {text:'Ověřené Wi-Fi Direct dostane při souběhu relací přednost před místní Wi-Fi; cloud uvolní přenos i při místním kontrolním čtení velkých originálů. Nedostupná jednotlivá stará cloudová zpráva neblokuje nové příchozí a vlastní odchozí změny a nedostane falešné potvrzení.'},
 {text:'Nové cloudové úložiště dostane úplnou ověřenou kopii i po dřívějším potvrzení jinou cestou. Novější potvrzený stav může bezpečně vyřadit starší partial přenos bez falešného potvrzení chybějících souborů.'},
 {text:'Starý výsledek výběru účtu nebo složky nepřepíše novější nastavení. Zrušený souhlas zachová účet; změna účtu zastaví starý přenos a zruší pouze jeho zobrazený seznam historie.'},
 {text:'Kontrola záloh odmítá proud bez postupu nebo s překročenou délkou; chybné čtení nesmí uváznout v nekonečné smyčce ani potvrdit neúplný historický bod.'},
 {text:'Návrat ke starší místní databázi zneplatní stará místní potvrzení cloudových zpráv. Přímé spojení oznámí obnovu druhému zařízení, aby znovu nabídlo aktuální data; historický cloudový ACK sám neprokazuje zachování místní databáze.'},
 {text:'Čekající cloudový přenos znovu nestahuje již ověřené originály; chybějící a poškozené bloky opravuje podle podepsané žádosti příjemce. Evidence publikace ani opakovaná žádost nesmějí uzavřít frontu bez potvrzení celé zakázky.'},
 {text:'Cloud mezi bloky uvolní cestu ověřenému přímému spojení a znovu ověří síťová pravidla. Rušení plánované úlohy patří pouze jejímu pokusu a nemůže ukončit nebo potvrdit novou relaci.'},
 {text:'Omezené čtení cloudových řídicích zpráv, pokračování procházení po restartu a rozlišení dávky od potvrzení dat; zakázaný síťový přenos nespouští ani seznam poskytovatele.'},
 {text:'Hlasové a importované přílohy se zveřejní až po úplném souboru a potvrzených metadatech; kolize ID nepoškodí originál. Hlas zůstává u původní poznámky a neúspěšný záznam nebo zápis nezavře její formulář.'},
 {text:'Zavření obrazovky nepřeruší zapnutý místní přenos; koordinátor vlastní služba Androidu s oznámením a vypnutím. Návrat načte potvrzené změny a nepřehraje starý stav obrazovky. Systémová omezení pozadí různých značek dosud fyzicky neověřena.'},
 {text:'Vlastní obsah editoru je oddělen od cizích stránek a spustitelných příloh; webové odkazy se otevírají v systémovém prohlížeči bez přístupu k nativnímu rozhraní zakázek.'},
 {text:'Checklisty a přílohy poznámek mají správné kauzální revize a průběžný zápis; selhání uložení nezavře poznámku. Prohlížení prázdné skici nemění data a zámek chrání i checklist/přílohy.'},
 {text:'Příchozí synchronizace nepřeruší tah, formulář rozměru ani úpravu detailu; konfliktní kopie zachová živé úchopy i vlastní přesné hodnoty.'},
 {text:'Prohlížení fotografie/detailu nevytváří falešné změny; ukládání a synchronizace používají shodné konfliktní kopie a otevřený editor zachová vlastní rozpracovanou verzi.'},
 {text:'Potvrzované uložení, zachování souběžných změn a ochrana proti opožděnému výsledku synchronizace.'},
 {text:'Odmítnutí poškozených znaků Unicode bez tiché změny uloženého textu.'},
 {text:'Odmítnutí neúplné ZIP zálohy, kontrolní součty při obnově, potvrzované přílohy a bezpečné ukončení chybného hlasového záznamu.'},
 {text:'Trvalý index již přijatých cloudových zpráv a pokračování potvrzení po výpadku bez opakování příloh či importu.'},
 {text:'Časově omezené operace systémového poskytovatele při záloze i synchronizaci; opožděné odpovědi a částečné zápisy se nepotvrzují.'},
 {text:'Živá cloudová cesta místo společného projects.json používá neměnné podepsané zprávy, ověřované originály a potvrzení příjemce. Přenos Diskem stále závisí na systémovém poskytovateli a čeká na fyzické ověření.'},
 {text:'Společné atomické ukládání a místní práce během pomalého SAF přenosu; novější změny zůstávají čekající.'},
 {text:'Identita instalace a kauzální revize skutečných záznamů; vysypaný koš zachová nezávislou úpravu jako kopii.'},
 {text:'Omezení posunu galerie a úplný výřez poznámek včetně textu pod detailní fotografií.'},
 {text:'Výchozí výběr v editoru, lupa při přesunu rohů a respektování nastaveného zvětšení.'}
]},{kind:'Vylepšeno',items:[
 {text:'Načítání vybraných souborů a fotografií běží mimo hlavní vlákno s časově omezeným přístupem k poskytovateli. Opožděné výsledky zachovají původní složku a nesmějí se připojit k jinému dialogu.'},
 {text:'V otevřené aplikaci se obnovuje zaniklá skupina Wi-Fi Direct pro dříve ověřené zařízení; uložená cesta vyžaduje stejnou TLS identitu. Změna rádiové adresy může vyžadovat nový výběr.'},
 {text:'Nastavitelná doplňková lišta pouze na šířku, procházení výskytů v nápovědě a neutrální dialog Bluetooth.'},
 {text:'Vytváření náhledů fotografií mimo zámek databáze, bezpečné souběhy cache a správné zrcadlení EXIF bez změny originálu.'},
 {text:'Omezená mezipaměť dekódovaných fotografií pro opakované otevření. První načtení po restartu je stále nutné.'}
]}]};
const releases=[
  {
    "version":"1.3.0",
    "title":"Přehlednější číslování vydání",
    "groups":[{"kind":"Vylepšeno","items":[
      {"text":"Od této verze používáme smysluplná čísla vydání: větší zpětně kompatibilní aktualizace dostanou novou vedlejší řadu a drobné opravy poslední číslo. Číslo sestavení Androidu zůstává samostatné."},
      {"text":"Funkce a opravy z verze 1.2.153 zůstávají zachovány. Toto vydání upravuje především číslování; skutečná instalace přes 1.2.153 na zařízení nás ještě čeká."}
    ]}]
  },
  {version:releaseChanges.version,title:'Bezpečné ukládání, synchronizace a opravy editoru',groups:releaseChanges.groups},
  {
    "version": "1.2.152",
    "title": "Přehledná historie změn a oprav",
    "groups": [
      {
        "kind": "Opraveno",
        "items": [
          {
            "text": "Opravené chybné přiřazování starších novinek k právě nainstalované verzi. Každá položka teď patří ke skutečnému vydání."
          }
        ]
      },
      {
        "kind": "Vylepšeno",
        "items": [
          {
            "text": "Nový přehled Novinky, Opravy a Vylepšení podle verzí. Jednotlivé verze lze rozbalovat."
          },
          {
            "text": "Historii změn otevřeš přímo z hlavního menu i z Nastavení."
          },
          {
            "text": "Starší vydání bez spolehlivých podrobných poznámek už nepředstírají neověřené změny."
          }
        ]
      }
    ]
  },
  {
    "version": "1.2.151",
    "title": "Česká offline nápověda",
    "groups": [
      {
        "kind": "Nové funkce",
        "items": [
          {
            "text": "Nápověda přímo v hlavním menu: 25 českých kapitol, krokové postupy a vysvětlení nástrojů, vše dostupné offline.",
            "feature": "help"
          },
          {
            "text": "Lupa pro vyhledávání uvnitř nápovědy, včetně hledání bez háčků a čárek.",
            "feature": "helpSearch"
          }
        ]
      },
      {
        "kind": "Vylepšeno",
        "items": [
          {
            "text": "Hledání v nápovědě je oddělené od běžného hledání zakázek, fotografií a poznámek.",
            "feature": "search"
          },
          {
            "text": "Ověření zobrazení nápovědy na mobilu a tabletu, použití Zpět a zachování dat při prohlížení."
          }
        ]
      }
    ]
  },
  {
    "version": "1.2.150",
    "title": "Video, PDF, Bosch a stabilita editoru",
    "groups": [
      {
        "kind": "Opraveno",
        "items": [
          {
            "text": "Přehrávání videa přímo v aplikaci: ochrana před nekonečným načítáním, chybové stavy, podpora záznamů bez původních informací o formátu a ovládání celé obrazovky."
          },
          {
            "text": "Miniatury videí: bezpečné vytváření náhledů, omezení souběžného načítání a náhradní ikona při nepodporovaném formátu."
          },
          {
            "text": "Zákaznické PDF: úplné texty a všechny obrazové přílohy poznámek na dalších stranách, s výslovným povolením soukromého obsahu."
          },
          {
            "text": "Bluetooth Bosch: ochrany při prvním připojení, rušení hledání, časových limitech a opožděných odpovědích zařízení.",
            "feature": "readings"
          },
          {
            "text": "Načítání fotografií: ochrana proti zastaralým výsledkům, chybějícím snímkům a nechtěným úpravám během načítání."
          },
          {
            "text": "Otočení telefonu/tabletu: stabilnější velikosti ikon, rozložení nástrojů a zachování rozpracovaného kótování."
          },
          {
            "text": "Lupa v editoru po Zpět a následné opožděné dotyky; ochrana proti návratu starého gesta."
          }
        ]
      },
      {
        "kind": "Vylepšeno",
        "items": [
          {
            "text": "Ještě menší značka upravené fotografie (pravítko, 13 px)."
          },
          {
            "text": "Rozšířené automatické kontroly přesnosti kót, přiblížení dvěma prsty, mřížky, obnov a zachování dat."
          }
        ]
      }
    ]
  },
  {
    "version": "1.2.149",
    "title": "Bezpečný koš a ovládání nabídek",
    "groups": [
      {
        "kind": "Nové funkce",
        "items": [
          {
            "text": "Vysypat koš s jasným potvrzením a možností zrušení; úklid respektuje sdílené soubory i uzamčené záznamy."
          }
        ]
      },
      {
        "kind": "Opraveno",
        "items": [
          {
            "text": "Klepnutí mimo běžnou rozbalenou nabídku ji zavře, aniž by se omylem vytvořila kóta nebo provedla další akce."
          },
          {
            "text": "Sjednocení označení zákaznického exportu na „Export pro zákazníka: ZIP s PDF“."
          }
        ]
      },
      {
        "kind": "Vylepšeno",
        "items": [
          {
            "text": "Menší značka upravené fotografie v miniatuře (15 px), stále v levém horním rohu."
          }
        ]
      }
    ]
  },
  {
    "version": "1.2.148",
    "title": "Starší testovací sestavení",
    "groups": [
      {
        "kind": "Informace",
        "items": [
          {
            "text": "Tato verze byla vydaná jako testovací sestavení. U konkrétního vydání nejsou na GitHubu dostatečně podrobné poznámky pro spolehlivý seznam jednotlivých změn."
          }
        ]
      }
    ]
  },
  {
    "version": "1.2.147",
    "title": "Společné úpravy podle testování nástrojů",
    "groups": [
      {
        "kind": "Vylepšeno",
        "items": [
          {
            "text": "Série změn vycházející z 28 praktických kontrol kreslicích nástrojů a editoru, včetně kót, úchopů, ZIP, koše a poznámek."
          },
          {
            "text": "Doplněné automatické testy a ochrany původních dat. Skutečné ověření každého chování na telefonu probíhalo postupně."
          }
        ]
      }
    ]
  },
  {
    "version": "1.2",
    "title": "Dřívější funkce řady 1.2 – souhrn",
    "groups": [
      {
        "kind": "Nové funkce",
        "items": [
          {
            "text": "Galerie fotografií a procházení náhledů.",
            "feature": "gallery"
          },
          {
            "text": "Video a zvukové soubory v zakázkách."
          },
          {
            "text": "Rozšířené hledání zakázek a poznámek.",
            "feature": "search"
          },
          {
            "text": "Přesné adresní místo pomocí RÚIAN.",
            "feature": "address"
          },
          {
            "text": "Zámek dokončených zakázek a historie úprav fotografií.",
            "feature": "lock"
          },
          {
            "text": "Vrstvy anotací, přehled nástrojů a kontrola součtu kót.",
            "feature": "layers"
          },
          {
            "text": "Textové, hlasové a fotografické poznámky, včetně detailů s vlastními kótami.",
            "feature": "notes"
          },
          {
            "text": "Diagnostika, ZIP zálohování a obnovení zakázek.",
            "feature": "backup"
          },
          {
            "text": "Bluetooth Bosch a historie přijatých měření.",
            "feature": "readings"
          }
        ]
      },
      {
        "kind": "Informace",
        "items": [
          {
            "text": "Jde o souhrn starší části vývoje, nikoli o seznam změn jediné konkrétní APK 1.2.x. Některé funkce se následně dále opravovaly."
          }
        ]
      }
    ]
  },
  {
    "version": "1.1",
    "title": "Základ Zaměřovače – souhrn",
    "groups": [
      {
        "kind": "Nové funkce",
        "items": [
          {
            "text": "Zakázky, složky a fotografie s ručně zadávanými kótami.",
            "feature": "editor"
          },
          {
            "text": "Textové poznámky a přílohy.",
            "feature": "notes"
          },
          {
            "text": "Export obrázku PNG a PDF."
          },
          {
            "text": "Výběr cloudové složky v Nastavení.",
            "feature": "settings"
          }
        ]
      }
    ]
  }
];
function parseVersion(value){
 const match=/^(\d+)\.(\d+)(?:\.(\d+))?(?:-test)?$/.exec(String(value||''));
 return match?[Number(match[1]),Number(match[2]),Number(match[3]||0)]:null;
}
function compareVersions(left,right){
 const a=parseVersion(left),b=parseVersion(right);
 if(!a||!b)return null;
 for(let i=0;i<3;i++)if(a[i]!==b[i])return a[i]<b[i]?-1:1;
 return 0;
}
function forVersion(installedVersion){
 const v=parseVersion(installedVersion);
 if(!v)return releases;
 return releases.filter(release=>compareVersions(release.version,installedVersion)<=0);
}
function hasReleaseNotes(installedVersion){
 return releases.some(r=>compareVersions(r.version,installedVersion)===0);
}
const api=Object.freeze({unreleasedChanges,releaseChanges,releases,parseVersion,compareVersions,forVersion,hasReleaseNotes});
root.ZamerovacReleaseHistory=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
