"""Acceptance criterion: no POST/PUT/DELETE call to XO exists anywhere in the codebase."""
import re
from pathlib import Path

SRC = Path(__file__).resolve().parents[1] / "src" / "xo_relay"

WRITE_VERBS = re.compile(r"""(\.(post|put|delete|patch)\s*\(|["'](POST|PUT|DELETE|PATCH)["'])""")


def test_xo_package_has_no_write_verbs():
    offenders = []
    for py in (SRC / "xo").rglob("*.py"):
        for i, line in enumerate(py.read_text(encoding="utf-8").splitlines(), 1):
            if WRITE_VERBS.search(line):
                offenders.append(f"{py.name}:{i}: {line.strip()}")
    assert offenders == [], offenders


def test_no_module_outside_xo_package_talks_to_xologic():
    """Only xo/ may reference the XO host; every other module reaches XO through XOClient."""
    offenders = []
    for py in SRC.rglob("*.py"):
        if py.parent.name == "xo":
            continue
        for i, line in enumerate(py.read_text(encoding="utf-8").splitlines(), 1):
            if "xologic.com" in line and not line.strip().startswith("#") and '"""' not in line:
                offenders.append(f"{py.relative_to(SRC)}:{i}: {line.strip()}")
    assert offenders == [], offenders


def test_client_only_uses_get():
    text = (SRC / "xo" / "client.py").read_text(encoding="utf-8")
    assert 'method = "GET"' in text
    assert "session.request(method," in text
    assert "session.post" not in text and "session.put" not in text and "session.delete" not in text
