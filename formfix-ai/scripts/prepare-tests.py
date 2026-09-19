import json, sys
from pathlib import Path

root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root / "services/document"))
from processor import process

(root / "work").mkdir(exist_ok=True)
(root / "work/extraction.json").write_text(
    json.dumps(process(root / "fixtures/demo/sample-student-support.pdf")), encoding="utf-8"
)
print("Prepared real native extraction for TypeScript integration tests.")
from pypdf import PdfReader, PdfWriter
from reportlab.pdfgen import canvas

base = root / "work/coordinate-base.pdf"
c = canvas.Canvas(str(base), pagesize=(612, 792))
c.drawString(90, 600, "Rotation target with enough native text for extraction")
c.save()
coordinates = []
for rotation in [0, 90, 180, 270]:
    writer = PdfWriter()
    writer.add_page(PdfReader(base).pages[0])
    writer.pages[0].rotate(rotation)
    dest = root / f"work/coordinate-{rotation}.pdf"
    writer.write(dest)
    coordinates.append(
        {"file": f"work/coordinate-{rotation}.pdf", "page": process(dest)["pages"][0]}
    )
(root / "work/coordinates.json").write_text(json.dumps(coordinates), encoding="utf-8")
