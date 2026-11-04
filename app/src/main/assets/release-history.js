/* Zaměřovač – offline historie změn a oprav (#31).
 * Pevné verze odvozené ze skutečných vydání/issues; nové vydání = nová položka.
 * Nikdy nepoužívat appVersionShort pro přeznačení staré historie.
 */
(function(root){
'use strict';
const releases=[
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
const api=Object.freeze({releases,parseVersion,compareVersions,forVersion,hasReleaseNotes});
root.ZamerovacReleaseHistory=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
