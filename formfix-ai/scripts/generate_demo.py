"""Author-owned fictional gold template. No institutional or personal data."""

import json
from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "fixtures/demo"
OUT.mkdir(parents=True, exist_ok=True)
TITLE = "Sample Student Support Application - Demo Only"
FIELDS = [
    (
        "full_name",
        "personal",
        "Full name",
        "text",
        "required",
        1,
        "Enter a fictional full name, 1 to 100 characters.",
        {"kind": "length", "min": 1, "max": 100},
    ),
    (
        "birth_date",
        "personal",
        "Date of birth",
        "date",
        "required",
        1,
        "Use YYYY-MM-DD, a real date from 1990-01-01 to 2010-12-31 inclusive.",
        {"kind": "date", "from": "1990-01-01", "to": "2010-12-31"},
    ),
    (
        "student_id",
        "personal",
        "Student ID",
        "text",
        "required",
        1,
        "Enter 1 to 20 characters. Keep any leading zeros.",
        {"kind": "length", "min": 1, "max": 20},
    ),
    (
        "address",
        "personal",
        "Postal address",
        "text",
        "required",
        2,
        "Enter 1 to 200 characters. No name or address matching is required.",
        {"kind": "length", "min": 1, "max": 200},
    ),
    (
        "pin",
        "personal",
        "PIN",
        "text",
        "required",
        2,
        "Enter exactly six ASCII digits. Leading zeros are allowed.",
        {"kind": "pattern", "pattern": "six_digits"},
    ),
    (
        "contact",
        "personal",
        "Contact note",
        "text",
        "optional",
        2,
        "Optional: up to 100 characters; no specific phone or email format is required.",
        {"kind": "length", "max": 100},
    ),
    (
        "course",
        "study",
        "Course",
        "select",
        "required",
        3,
        "Choose exactly Arts, Science, or Commerce.",
        {"kind": "options", "options": ["Arts", "Science", "Commerce"]},
    ),
    (
        "study_year",
        "study",
        "Study year",
        "select",
        "required",
        3,
        "Choose exactly 1, 2, or 3.",
        {"kind": "options", "options": ["1", "2", "3"]},
    ),
    (
        "start_date",
        "study",
        "Course start date",
        "date",
        "required",
        3,
        "Use YYYY-MM-DD, a real date from 2026-06-01 to 2026-09-30 inclusive.",
        {"kind": "date", "from": "2026-06-01", "to": "2026-09-30"},
    ),
    (
        "support_type",
        "support",
        "Support type",
        "select",
        "required",
        4,
        "Choose exactly standard or travel. Travel requires Travel reason and a Travel plan.",
        {"kind": "options", "options": ["standard", "travel"]},
    ),
    (
        "travel_reason",
        "support",
        "Travel reason",
        "text",
        "conditional",
        4,
        "Required only when Support type is travel; enter 1 to 200 characters.",
        {
            "kind": "conditional",
            "condition": {"fieldId": "support_type", "op": "equals", "value": "travel"},
        },
    ),
    (
        "support_number",
        "support",
        "Supporting-document number",
        "text",
        "required",
        4,
        "Enter SD- followed by exactly six ASCII digits, for example SD-000123 (fictional).",
        {"kind": "pattern", "pattern": "support_number"},
    ),
    (
        "confirm_student_id",
        "support",
        "Confirm Student ID",
        "text",
        "required",
        5,
        "Repeat Student ID exactly, including leading zeros.",
        {"kind": "equals", "otherField": "student_id"},
    ),
    (
        "declaration_date",
        "support",
        "Declaration date",
        "date",
        "required",
        5,
        "Use YYYY-MM-DD, a real date from 2026-09-01 to 2026-09-30 inclusive.",
        {"kind": "date", "from": "2026-09-01", "to": "2026-09-30"},
    ),
]
docs = [
    (
        "enrollment",
        "Enrollment note",
        "Required for every demo application. Mark ready only if you have this fictional note.",
    ),
    (
        "support_record",
        "Support record",
        "Required for every demo application. Supporting-document number does not establish readiness.",
    ),
    (
        "travel_plan",
        "Travel plan",
        "Required only when Support type is travel. Otherwise mark not_applicable.",
    ),
]
c = canvas.Canvas(str(OUT / "sample-student-support.pdf"), pagesize=(612, 792), invariant=1)
c.setTitle(TITLE)
fields = []
rules = []
evidence = []


def line(text, y, size=10):
    c.setFont("Helvetica", size)
    c.setFillColor(HexColor("#183047"))
    c.drawString(42, y, text)


def rule(fid, kind, params, sid):
    rid = f"{fid}_{kind}"
    rules.append(
        dict(
            id=rid,
            version=1,
            kind=kind,
            fieldId=fid,
            params=params,
            sourceIds=[sid],
            provenance="template_verified",
        )
    )
    return rid


for page in range(1, 7):
    c.setFillColor(HexColor("#e9f2f7"))
    c.rect(0, 690, 612, 102, fill=1, stroke=0)
    line("FORMFIX / FICTIONAL PRACTICE FORM", 752, 11)
    line(TITLE, 727, 16)
    line(f"FF-DEMO-2026-V1 | Page {page} of 6", 704, 10)
    line("No official affiliation. Use synthetic answers only. Do not submit this form.", 670, 10)
    if page <= 5:
        section_heading = (
            "Section 1 / Personal details" if page <= 2
            else "Section 2 / Study details" if page == 3
            else "Section 3 / Support request"
        )
        line(section_heading, 645, 11)
    y = 620
    for fid, section, label, typ, req, p, instruction, params in FIELDS:
        if p != page:
            continue
        sid = f"rule_{fid}"
        line(f"{label} [{req}]", y, 12)
        # Instructions deliberately remain one line for deterministic source-line alignment.
        line(instruction, y - 22, 9)
        c.setStrokeColor(HexColor("#93aabc"))
        c.rect(42, y - 65, 528, 28, stroke=1, fill=0)
        rids = []
        if req == "required":
            rids.append(rule(fid, "required", {}, sid))
        spec = dict(params)
        kind = spec.pop("kind")
        rids.append(rule(fid, kind, spec, sid))
        if fid == "travel_reason":
            rids.append(rule(fid, "length", {"max": 200}, sid))
        fields.append(
            dict(
                id=fid,
                sectionId=section,
                labelOriginal=label,
                type=typ,
                requiredStatus=req,
                sources=[],
                inputRegion={
                    "page": page,
                    "bbox": {
                        "x": 42 / 612,
                        "y": (792 - y + 37) / 792,
                        "width": 528 / 612,
                        "height": 28 / 792,
                    },
                },
                ruleIds=rids,
                **({"options": params["options"]} if kind == "options" else {}),
            )
        )
        evidence.append(
            dict(
                id=sid,
                page=page,
                quote=instruction,
                label=f"{label} [{req}]",
                expectedY=(792 - y + 22) / 792,
            )
        )
        y -= 145
    if page == 6:
        line("Document-readiness checklist", y, 15)
        y -= 45
        for did, label, instruction in docs:
            line(label, y, 12)
            line(instruction, y - 22, 9)
            evidence.append(
                dict(
                    id=f"doc_{did}",
                    page=6,
                    quote=instruction,
                    label=label,
                    expectedY=(792 - y + 22) / 792,
                )
            )
            y -= 100
        line(
            "Readiness is self-reported. No attachments, signatures or identities are verified.",
            y - 5,
            9,
        )
    line(
        "DEMO ONLY / Verified fictional instructions v1 / Review summary is not a submission", 28, 9
    )
    c.showPage()
c.save()
model = dict(
    schemaVersion="1.0",
    formId="fixture",
    templateId="ff-demo-2026-v1",
    title=TITLE,
    pageCount=6,
    sections=[
        {"id": i, "title": t}
        for i, t in [
            ("personal", "Personal details"),
            ("study", "Study details"),
            ("support", "Support request"),
        ]
    ],
    fields=fields,
    documentRequirements=[
        dict(
            id=i,
            label=l,
            requiredStatus="conditional" if i == "travel_plan" else "required",
            sources=[],
            **(
                {"condition": {"fieldId": "support_type", "op": "equals", "value": "travel"}}
                if i == "travel_plan"
                else {}
            ),
        )
        for i, l, _ in docs
    ],
    extractionWarnings=[],
)
gold = {
    "model": model,
    "evidence": evidence,
    "rules": rules,
    "review": {
        "method": "Author cross-check of generated fictional instructions and registered rules",
        "independentInstitutionalReview": False,
        "version": "1",
    },
}
(OUT / "verified-template.json").write_text(json.dumps(gold, indent=2), encoding="utf-8")
clean = dict(
    full_name="Fictional Student",
    birth_date="2004-02-29",
    student_id="000042",
    address="7 Imaginary Lane, Demo Town",
    pin="012345",
    contact="",
    course="Science",
    study_year="2",
    start_date="2026-06-01",
    support_type="standard",
    travel_reason="",
    support_number="SD-000123",
    confirm_student_id="000042",
    declaration_date="2026-09-18",
)
ready = {"enrollment": "ready", "support_record": "ready", "travel_plan": "not_applicable"}
for name, answers, readiness in [
    ("clean", clean, ready),
    (
        "seeded-errors",
        {**clean, "pin": "12345", "support_number": ""},
        {**ready, "support_record": "not_ready"},
    ),
]:
    (OUT / f"{name}.json").write_text(
        json.dumps({"answers": answers, "documentReadiness": readiness}, indent=2), encoding="utf-8"
    )
(OUT / "expected-validation.json").write_text(
    json.dumps(
        {
            "clean": [],
            "seeded-errors": ["pin_pattern", "support_number_required", "document_support_record"],
        },
        indent=2,
    ),
    encoding="utf-8",
)
print("Generated six-page PDF, 14 fields, 3 requirements, gold model and synthetic answers.")
