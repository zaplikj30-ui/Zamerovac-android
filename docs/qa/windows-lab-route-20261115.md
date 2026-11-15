# PR140 — konkrétní cesta k Windows laboratoři

**Historický návrh, nyní neprovádět:** novější zadání vlastníka zakazuje novou
infrastrukturu a vrací cíl k původní normální QA. Aktuální [důkazy opravy
PR136 a návrh uzavření](qa136-original-blocker-resolution-20261115.md) mají
přednost. Ani níže uvedená čtecí inventura se nyní nevyžaduje.

**Rozhodnutí k 15. 11. 2026: Windows část C zůstává BLOCKED.** Nejmenší další
krok je níže uvedená čtecí inventura PC vlastníkem. Žádná laboratoř nebyla
zpřístupněna, nic na PC ani v Actions se tímto dokumentem nespouští. Nejde
o dokončenou C ani předání k závěrečnému review.

## Ověřená výchozí situace

- PR140 před tímto doplněním: `8c182675567b729ca865bbd2553c85665eca5e03`,
  větev `qa/outer-job-c-20261115`, OPEN/DRAFT. Base PR136:
  `1d6a786c77aa2a797bf7bd75f9977a3ae6613459`.
- Bezpečnostní návrh PR138: `e54a787dfcfebc6a2fc2fad6feee34dd6292a823`.
  Jeho podmínka prvního compile/load v izolované VM dále platí.
- Načtena aktuální pravidla main po merge PR139:
  `3e3f4ae4384f39c4599c5b0e43a43877e93b3a9f`, projektový plán a
  [rozhodnutí Koordinátora42](https://github.com/zaplikj30-ui/Zamerovac-android/issues/42#issuecomment-6888845204).
  PR140 má na výchozím HEAD nula GitHub checks, nikoli CI PASS.
- Dostupný Codex Cloud je Linux/GCC14.2/Node24.22.1/Python3.12.14. Ověřené
  Windows prostředí, Win32 loader, MSVC ani přístup k desktopu vlastníka nemá.
- Vlastník potvrdil Windows11 PC s pevnými 16 GB RAM, nikoli jeho edici,
  zapnutý Sandbox, volnou paměť, virtualizaci či existující obnovitelnou VM.
  Starší inventura doložila hostitelský MSVC19.52/SDK10.0.26100/Node26.13;
  nedoložila tyto nástroje uvnitř VM. Viz [původní checkpoint](variant-c-feasibility-20261115.md).

## Posouzení skutečně použitelných prostředků

| Prostředek | Dostupnost / rozhodnutí |
| --- | --- |
| Existující Linux Cloud | Dostupný pro kontrakty, negativní testy, integritu vstupů a regresi; není Win32 důkaz. |
| Již zapnutý Windows Sandbox | První kandidát pro ověření: bez nové VM instalace, zahazovací stav. Zatím **NEOVĚŘEN**, ne dostupná laboratoř. |
| Již existující Windows VM s checkpointem a toolchainem | Mohla by vyhovět i lépe; žádná taková VM ani oprávněný přístup nebyly doloženy. **NEOVĚŘENO**. |
| Nová VM / zapnutí Sandboxu / instalace MSVC do guestu | Vyžaduje změny či instalaci, proto nyní **ZAKÁZÁNO**. Licence, disk a prostředky nejsou doloženy. |
| Běžný HOME runner | Doložen pro historický normální no-op a 15 TAP, ne pro novou C. Není fault laboratoř. |
| WSL, Wine, procesní Job Object | Nejsou samostatný obnovitelný Windows kernel; nenahrazují VM proof. |
| GitHub-hosted Windows / jiný cloud | Cena, dostupnost a souhlas nejsou doloženy; nyní nepoužít. |

Microsoft uvádí pro Sandbox nejméně4 GB RAM, doporučuje8 GB, požaduje
virtualizaci a podporovanou edici; Home podporovaná není. **16 GB fyzické RAM
splňuje pouze paměťové minimum, ne ostatní podmínky.** Pro první prázdný pokus
navrhujeme4 GB guest a alespoň6 GB právě dostupné hostitelské paměti; druhá
hodnota je konzervativní projektová podmínka, nikoli záruka Microsoftu.
Neexistuje zde ověřený údaj o současném zatížení PC nebo výkonu buildu.
Před případným spuštěním se musí potvrdit také alespoň2 jádra a1 GB volného
disku dle Microsoftu, více prostoru pro konkrétní balík dle manifestu a žádný
souběh s HOME jobem či hostitelským buildem. Splnění minim není výkonový test.

Sandbox má oddělený kernel, ale není zárukou proti všem chybám hypervisoru,
hostitelských ovladačů či vyčerpání zdrojů. Později může sloužit pro schválené
řízené **user-mode** fault scénáře. Skutečné vyvolávání chyb host kernelu,
ovladačů či hypervisoru na tomto PC nenavrhujeme. Guest nemá skutečnou
runner-parent hierarchii automaticky: runner-like nested Job test je nutný
uvnitř laboratoře; pozdější normální HOME důkaz zůstává samostatný.

## Jeden postup pro vlastníka — pouze zjistit stav, zatím neprovádět

Čas přibližně5 minut. **Bez správce, bez terminálových příkazů, bez instalace
a bez startu Sandboxu nebo QA.** Pokud se objeví UAC, požadavek na instalaci,
aktualizaci či restart, zvolit Zrušit a příslušný údaj označit NEZJIŠTĚNO.

1. V **Nastavení → Systém → O systému** přečíst pouze edici Windows, verzi,
   sestavení OS a typ systému (potřebujeme x64). Nekopírovat název PC, ID
   zařízení ani produktový klíč.
2. Otevřít **Správce úloh → Výkon → Procesor**, opsat „Virtualizace:
   Povoleno/Zakázáno“ a počet jader. V **Paměť** opsat „K dispozici“ v GB.
   V **Průzkumník → Tento počítač** opsat jen volné GB systémového disku.
3. Přes hledání Start otevřít **Zapnout nebo vypnout funkce systému Windows**.
   Pouze se podívat, zda položka **Windows Sandbox / Sandbox ve Windows**
   existuje a je plně zaškrtnutá. **Nic nepřepínat; zavřít Zrušit.**
   UAC znamená STOP tohoto kroku, nikoli pokyn spustit jej jako správce.
4. Zapsat do existujícího issue42 jen tento krátký výsledek, bez screenshotů
   a osobních cest:

   ```text
   Windows edice / verze / build / x64:
   Virtualizace / počet jader:
   K dispozici RAM GB / volné GB systémového disku:
   Sandbox položka: ZAŠKRTNUTO / NEZAŠKRTNUTO / CHYBÍ / NEZJIŠTĚNO
   UAC nebo nabídka instalace/aktualizace: ANO / NE
   ```

Tím postup **končí**. Ani nalezená zaškrtnutá funkce ještě nedokazuje funkční
laboratoř. Riziko tohoto čtení je hlavně nechtěné přepnutí funkce či zveřejnění
osobních údajů; proto Zrušit a jen uvedený výpis. Návrat: zavřít okna, žádný
systémový stav se cíleně nemění. Potřebuje-li i pouhé zobrazení vyšší práva,
zůstane údaj neznámý; práva se nemění.

**Proč nyní ani prázdný launch:** Microsoft popisuje od Windows11 24H2 pokus
starého Sandbox klienta o aktualizaci ze Store i na pozadí. Zákaz instalací
nelze obejít tvrzením „jen spustíme Sandbox“. Guestové vypnutí sítě neblokuje
hostitelský Store. Stav klienta/politik a možnost spuštění bez instalace musí
být nejprve doloženy; nikdo nemá kvůli tomuto úkolu vypínat aktualizace.

## Konkrétní následný návrh, pokud inventura vyhoví

Preferovaná cesta je **již dostupný Sandbox,4 GB, offline, bez hostitelských
dat a přihlašovacích údajů**. Nejprve by následoval zvlášť schválený prázdný
smoke a ověření zahození stavu při zavření a novém otevření. Samotný restart
uvnitř guestu není reset. Profil níže je jen návrh pro tento prázdný smoke,
ne soubor k nynějšímu spuštění a ne profil pro native testy:

```xml
<Configuration>
  <vGPU>Disable</vGPU>
  <Networking>Disable</Networking>
  <AudioInput>Disable</AudioInput>
  <VideoInput>Disable</VideoInput>
  <ProtectedClient>Enable</ProtectedClient>
  <PrinterRedirection>Disable</PrinterRedirection>
  <ClipboardRedirection>Disable</ClipboardRedirection>
  <MemoryInMB>4096</MemoryInMB>
</Configuration>
```

Žádné MappedFolders ani LogonCommand. Výchozí Sandbox má síť i clipboard
povoleny, proto prosté spuštění přes Start není tento návrh. Selhání Protected
Client nebo vynucená odlišná politika znamená STOP, nikoli odebrání ochrany.
XML kontrola na Linuxu neprokazuje účinnost nastavení ve Windows.

**Další skutečný blokér je toolchain.** Hostitelské aplikace nejsou v guestu
k dispozici. Neexistuje doložený přenositelný MSVC/SDK bundle; kopírování
Visual Studia nenavrhujeme jako ověřený postup. Nejmenší praktická **změna ke
schválení** oproti PR138 je:

- pouze kompilace a link plně přečteného připnutého zdroje pomocí již
  instalovaného důvěryhodného hostitelského MSVC/SDK; přesný schválený příkaz
  bez npm/node-gyp, hooků, custom build kroků a spouštění výstupu;
- manifest sváže source SHA, úplné vstupní hashe/verze, příkaz a výsledný
  `.node` hash. Kompilátor zpracovává zdroj, proto ani compile-only není
  oprávnění zpracovávat libovolný nezkontrolovaný PR;
- před buildem je nutné doložit také Win32 identitu/cesty vstupů, ochranu
  reparse/hardlink a TOCTOU; nynější POSIX-only hash gate na Windows výslovně
  blokuje a nesmí se obejít. To je další dosud neimplementovaná brána;
- **první load a všechny native fault testy pouze v ověřeném guestu**, s předem
  ověřeným offline Node/Python/runtime balíkem. Jejich přenos, závislosti,
  původ, licence a read-only staging vyžadují konkrétní kontrolu; guest
  nedostane HOME workspace, token, runner účet/službu ani writable mapování.

Toto není povolení hostitelského buildu. PR138 vyžaduje první compile/load ve
VM: bez výslovného schválení této úzké změny se build na hostu neprovede.
Pokud změna nebude přijata, je nutná již vybavená obnovitelná Windows VM;
za nynějšího zákazu instalací její neexistenci nevyřeší další skript.
Pokud inventura Sandbox nepotvrdí, nepřidáváme automaticky Hyper-V/BIOS/Store
ani nenahrazujeme VM domácím runnerem. Přesný výsledek zůstane BLOCKED.

## Běžné testy, fault testy a společná obsluha přes GitHub

| Režim | Kde / nutná brána |
| --- | --- |
| Linux modely, TAP parser, vstupní integrity | Dostupný Cloud; zachovat57 původních modelů a regresi. Žádný Win32 PASS. |
| První Windows build/load nové C | Podmínky výše; současně NOT RUN/BLOCKED. Compile-only výjimka vyžaduje nové rozhodnutí. |
| Běžný no-op,57 modelů a15 TAP na HOME | Až po dokončení C, testech v laboratoři, bezpečnostním review a samostatném owner souhlasu pro přesný SHA. Historický PASS nové C nepatří. |
| Crash, timeout, hang/late-return, kill Node/Python, child/grandchild, pipe overflow, teardown | Jen schválená obnovitelná laboratoř. Řízená injekce != reprodukce skutečného kernel hang. Neprokázaný cleanup = BLOCKED, NO RETRY. |

Koordinátor a Codex mohou používat **stejný GitHub postup a existující HOME
runner**, nikoli dva nové účty/runnery. Oba připraví do #42 stejný podklad:
source SHA, workflow SHA, hashe binárek, přesný režim, příkazy, očekávané
výstupy a odkazy na review. Vlastník schválí konkrétní podklad; přihlášení pod
jeho účtem samo o sobě není souhlas. Po změně SHA či režimu původní schválení
neplatí. Ani tento dokument není souhlasem ke spuštění.

Pro pozdější **běžné** HOME QA platí stávající
`tools/home_qa_gate.py render-workflow` a `lint-workflow --strict`, nová
nespotřebovaná jednorázová RUN větev, doslovný branch/event/owner guard,
připnuté checkouty a SOURCE_SHA. Jiný recept vyžaduje zvláštní kontrolu před
spuštěním. Obecný gate dovolující `qa/*` není autorizace libovolného kódu.
Nevytváříme teď YAML, trigger, workflow_dispatch vstup, label ani komentářový
bot, který by uměl z issue/PR spustit kód. Fork/PR/pull_request_target ani
nedůvěryhodný artifact nesmí být cestou na HOME. Existující oprávnění
k přípravě/pushu se nesmějí domýšlet ani kvůli automatizaci rozšiřovat.

Pro **laboratorní** fault režim je GitHub zatím jen evidence a schvalování.
Offline Sandbox nemá runner ani token a není doložen automatický kanál
host→guest→GitHub nebo možnost desktopového startu ze služby runneru.
Nepřidávat agenta či službu do guestu. Po schválené ruční zkoušce se zveřejní
jen redigovaný manifest/výsledky na hostu, nikdy raw stderr/TAP či osobní
cesty. Plně bezobslužné fault QA přes GitHub proto nyní **není dostupné**.

## Co se mění a co zůstává blokováno

Toto doplnění je dokumentace konkrétního dalšího kroku, ne nový framework,
procesní vrstva ani Windows implementace. Nezapojuje portable OwnerCore do
runtime. D1–D3, skutečné Win32/N-API lifetime, tři pipes, nested Jobs,
binární provenance a native matice PR138 zůstávají otevřené. Žádný další
bezpečně nezávislý native krok tím nebyl prokázán; závislá implementace stojí.

Vlastní kontrola zahrnuje aktuální pravidla, rozdíl compile/load/fault,
nedoložený toolchain v guestu, Store update, sdílené složky a clipboard,
privilegia, limity16 GB PC, GitHub trust boundary a zákaz falešné atestace.
Přesný výsledný SHA a opakovaná dostupná regrese jsou v autorském záznamu
PR140/#42. **DRAFT/HOLD; nevyžadovat závěrečné nezávislé review.**

## Ověřené oficiální zdroje

- [Microsoft: Sandbox, edice, oddělený kernel a hostitelské aplikace](https://learn.microsoft.com/en-us/windows/security/application-security/application-isolation/windows-sandbox/)
- [Microsoft: požadavky a instalace](https://learn.microsoft.com/en-us/windows/security/application-security/application-isolation/windows-sandbox/windows-sandbox-install)
- [Microsoft: .wsb konfigurace a nebezpečná výchozí sdílení](https://learn.microsoft.com/en-us/windows/security/application-security/application-isolation/windows-sandbox/windows-sandbox-configure-using-wsb-file)
- [Microsoft: FAQ, restart a aktualizace klienta od24H2](https://learn.microsoft.com/en-us/windows/security/application-security/application-isolation/windows-sandbox/windows-sandbox-faq)
- [GitHub: bezpečnost Actions a self-hosted runnerů](https://docs.github.com/en/actions/reference/security/secure-use)
