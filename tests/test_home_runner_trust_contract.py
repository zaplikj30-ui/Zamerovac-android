"""Regrese omezení domácího GitHub runneru.

Toto je CI pojistka proti NEÚMYSLNÉMU rozšíření oprávnění. Bez vynucené
GitHub branch protection NENÍ ochranou proti úmyslné změně main či workflow.
Nespouští CI, nedotýká se GitHub tokenů ani domácího počítače.
"""
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]
QA = ROOT / ".github/workflows/windows-self-hosted-qa.yml"
RELEASE = ROOT / ".github/workflows/windows-home-apk-release.yml"


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
    required = (
        "github.repository == 'zaplikj30-ui/Zamerovac-android'",
        "github.actor == 'zaplikj30-ui'",
        "github.ref == 'refs/heads/main'",
        "github.event_name == 'push'",
        "github.event_name == 'workflow_dispatch'",
    )
    for name, body in j.items():
        gate = re.search(r"(?m)^    if:\s*(.+)$", body)
        if not gate or any(token not in gate.group(1) for token in required):
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
        required = (
            "github.repository == 'zaplikj30-ui/Zamerovac-android'",
            "github.actor == 'zaplikj30-ui'",
            "github.ref == 'refs/heads/main'",
            "github.event_name == 'workflow_dispatch'",
            "inputs.publish_release == true",
            "inputs.qa_run_id != ''",
        )
        if not gate or any(token not in gate.group(1) for token in required):
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
            source.replace("persist-credentials: false", "persist-credentials: true", 1),
        )
        for bad in mutations:
            self.assertNotEqual(source, bad, "Mutace musí skutečně změnit vstup")
            self.assertTrue(release_violations(bad), "Nebezpečná změna nevyvolala FAIL")


if __name__ == "__main__":
    unittest.main()
