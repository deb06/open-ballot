#!/usr/bin/env python3
"""
Regenerate the Open Ballot project report (DOCX + PDF) from a pristine template.

The template keeps the original academic formatting, tables and screenshots.
Only stale paragraphs are replaced and new "current state" paragraphs are
inserted, using the rules in docs/report/updates.json.

Usage:
    python scripts/generate_report.py
"""

from __future__ import annotations

import copy
import json
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

try:
    from docx import Document
except ImportError:
    sys.exit("python-docx is required: pip install python-docx")

ROOT = Path(__file__).resolve().parent.parent
TEMPLATE = ROOT / "docs" / "report" / "Report_Template.docx"
UPDATES = ROOT / "docs" / "report" / "updates.json"
OUT_DOCX = ROOT / "docs" / "Open_Ballot_Project_Report.docx"
OUT_PDF = ROOT / "docs" / "Open_Ballot_Project_Report.pdf"


def set_paragraph_text(paragraph, text: str) -> None:
    """Replace a paragraph's text while preserving the first run's formatting."""
    if paragraph.runs:
        paragraph.runs[0].text = text
        for run in paragraph.runs[1:]:
            run.text = ""
    else:
        paragraph.add_run(text)


def build_substitutions(rules: list[dict]) -> dict[str, str]:
    return {r["find"]: r["with"] for r in rules}


def visit_paragraphs(document):
    """Yield every paragraph in body, tables, headers and footers."""
    for p in document.paragraphs:
        yield p
    for table in document.tables:
        for row in table.rows:
            for cell in row.cells:
                for p in cell.paragraphs:
                    yield p
    for section in document.sections:
        for p in section.header.paragraphs:
            yield p
        for p in section.footer.paragraphs:
            yield p


def apply_replacements(document, subs: dict[str, str]) -> dict[str, int]:
    hits = {key: 0 for key in subs}
    for paragraph in visit_paragraphs(document):
        text = paragraph.text.strip()
        if text in subs:
            set_paragraph_text(paragraph, subs[text])
            hits[text] += 1
        else:
            # Also handle partial matches for table cells / longer prose.
            for old, new in subs.items():
                if len(old) < 120 and old in text:
                    set_paragraph_text(paragraph, text.replace(old, new))
                    hits[old] += 1
                    break
    return hits


def apply_insertions(document, insertions: list[dict]) -> dict[str, int]:
    hits = {r["after"]: 0 for r in insertions}
    for rule in insertions:
        anchor_text = rule["after"]
        for paragraph in list(document.paragraphs):
            if paragraph.text.strip() != anchor_text:
                continue
            new_lines = rule["lines"]
            prev = paragraph._p
            for line in new_lines:
                new_p = copy.deepcopy(paragraph._p)
                # strip all runs from the copy, then add one text run
                for child in list(new_p):
                    if child.tag.endswith("}r"):
                        new_p.remove(child)
                from docx.oxml.ns import qn
                run = new_p.makeelement(qn("w:r"), {})
                t = new_p.makeelement(qn("w:t"), {})
                t.text = line
                t.set(qn("xml:space"), "preserve")
                run.append(t)
                new_p.append(run)
                prev.addnext(new_p)
                prev = new_p
            hits[anchor_text] += 1
            break
    return hits


def convert_to_pdf(docx_path: Path, pdf_path: Path) -> str:
    """Convert DOCX to PDF using Word (Windows) or LibreOffice (CI/Linux)."""
    # 1) Word COM on Windows — best fidelity with the original template.
    if sys.platform.startswith("win"):
        try:
            import win32com.client  # type: ignore

            word = win32com.client.Dispatch("Word.Application")
            word.Visible = False
            try:
                doc = word.Documents.Open(str(docx_path))
                doc.SaveAs(str(pdf_path), FileFormat=17)
                doc.Close(False)
            finally:
                word.Quit()
            return "word"
        except Exception:
            pass

    # 2) LibreOffice (available in GitHub Actions after apt install).
    for exe in ("libreoffice", "soffice"):
        found = shutil.which(exe)
        if found:
            result = subprocess.run(
                [found, "--headless", "--convert-to", "pdf", "--outdir",
                 str(pdf_path.parent), str(docx_path)],
                capture_output=True, text=True, timeout=300,
            )
            generated = pdf_path.parent / (docx_path.stem + ".pdf")
            if generated.exists():
                if generated != pdf_path:
                    shutil.move(str(generated), str(pdf_path))
                return "libreoffice"
            raise RuntimeError(f"LibreOffice failed: {result.stdout} {result.stderr}")
    raise RuntimeError("No DOCX->PDF converter available (Word or LibreOffice required).")


def main() -> None:
    if not TEMPLATE.exists():
        sys.exit(f"Missing template: {TEMPLATE}")
    config = json.loads(UPDATES.read_text(encoding="utf-8"))

    document = Document(str(TEMPLATE))
    rep_hits = apply_replacements(document, build_substitutions(config.get("replace", [])))
    ins_hits = apply_insertions(document, config.get("insert", []))

    props = document.core_properties
    props.title = "Open Ballot — A Secure Online Voting System"
    props.subject = "B.Tech 2nd Year Software Project Report"
    props.author = "Debmalya Bandyopadhyay"
    props.keywords = "Open Ballot, voting, PHP, PostgreSQL, WebAuthn, Merkle, Render"
    props.comments = "Automatically regenerated from docs/report/updates.json"
    props.modified = datetime.now(timezone.utc).replace(tzinfo=None)

    OUT_DOCX.parent.mkdir(parents=True, exist_ok=True)
    document.save(str(OUT_DOCX))

    engine = convert_to_pdf(OUT_DOCX, OUT_PDF)

    print(f"DOCX: {OUT_DOCX.relative_to(ROOT)}")
    print(f"PDF:  {OUT_PDF.relative_to(ROOT)} (via {engine})")
    missed = [k for k, v in rep_hits.items() if v == 0]
    missed += [k for k, v in ins_hits.items() if v == 0]
    if missed:
        print("WARNING: rules with no match (template may already be updated):")
        for m in missed:
            print("  -", m[:110])


if __name__ == "__main__":
    main()
