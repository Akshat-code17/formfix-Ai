"""Process untrusted PDFs in a killable child process. No external URLs are fetched."""

import csv, io, json, os, subprocess, sys, tempfile
from pathlib import Path
import pdfplumber
import pypdfium2 as pdfium
from pypdf import PdfReader

MAX_BYTES = 10 * 1024 * 1024


class DocumentError(Exception):
    def __init__(self, code, message, status=422):
        self.code, self.message, self.status = code, message, status


def normalize_box(x0, y0, x1, y1, width, height):
    x0, x1 = sorted((max(0, min(width, x0)), max(0, min(width, x1))))
    y0, y1 = sorted((max(0, min(height, y0)), max(0, min(height, y1))))
    return dict(x=x0 / width, y=y0 / height, width=(x1 - x0) / width, height=(y1 - y0) / height)


def rotation_transform(rotation, w, h):
    # PDF user space (bottom-left) to displayed page space (top-left), before normalization.
    return {
        0: [1, 0, 0, -1, 0, h],
        90: [0, 1, 1, 0, 0, 0],
        180: [-1, 0, 0, 1, w, 0],
        270: [0, -1, -1, 0, h, w],
    }[rotation]


def ocr_page(doc, index):
    page = doc[index]
    w, h = page.get_size()
    if w * h * 4 > 16_000_000:
        raise DocumentError("PIXEL_LIMIT", "Page is too large to render safely.")
    with tempfile.TemporaryDirectory(prefix="formfix-ocr-") as tmp:
        image = page.render(scale=2).to_pil()
        path = Path(tmp) / "page.png"
        image.save(path)
        try:
            result = subprocess.run(
                [
                    os.getenv("TESSERACT_CMD", "tesseract"),
                    str(path),
                    "stdout",
                    "-l",
                    "eng",
                    "--psm",
                    "3",
                    "tsv",
                ],
                capture_output=True,
                text=True,
                timeout=25,
                check=True,
            )
        except subprocess.TimeoutExpired:
            raise DocumentError("OCR_TIMEOUT", "OCR exceeded its time limit.")
        except (FileNotFoundError, subprocess.CalledProcessError):
            raise DocumentError(
                "OCR_UNAVAILABLE", "Tesseract with English data is unavailable.", 503
            )
        groups = {}
        for row in csv.DictReader(io.StringIO(result.stdout), delimiter="\t"):
            if not row.get("text", "").strip() or float(row["conf"]) < 0:
                continue
            key = (row["block_num"], row["par_num"], row["line_num"])
            groups.setdefault(key, []).append(row)
        lines = []
        for rows in groups.values():
            x0 = min(int(r["left"]) for r in rows)
            y0 = min(int(r["top"]) for r in rows)
            x1 = max(int(r["left"]) + int(r["width"]) for r in rows)
            y1 = max(int(r["top"]) + int(r["height"]) for r in rows)
            lines.append(
                dict(
                    quote=" ".join(r["text"] for r in rows),
                    bbox=normalize_box(x0, y0, x1, y1, image.width, image.height),
                    ocrConfidence=sum(float(r["conf"]) for r in rows) / len(rows),
                )
            )
    return lines


def process(path):
    if Path(path).stat().st_size > MAX_BYTES:
        raise DocumentError("FILE_TOO_LARGE", "Maximum PDF size is 10 MB.", 413)
    with open(path, "rb") as f:
        if f.read(5) != b"%PDF-":
            raise DocumentError("INVALID_PDF", "PDF signature is missing.", 415)
    try:
        reader = PdfReader(path, strict=True)
        if reader.is_encrypted:
            raise DocumentError("ENCRYPTED_PDF", "Password-protected PDFs are unsupported.")
        if not 1 <= len(reader.pages) <= 10:
            raise DocumentError("PAGE_LIMIT", "PDF must contain 1 to 10 pages.")
        acro = [
            {"name": str(k)[:200], "type": str(v.get("/FT", ""))[:100]}
            for k, v in (reader.get_fields() or {}).items()
        ]
        if len(acro) > 100:
            raise DocumentError("FIELD_LIMIT", "Too many PDF fields.")
        out = {"pages": [], "blocks": [], "acroFields": acro, "warnings": []}
        with pdfplumber.open(path) as pdf:
            rendered = None
            try:
                for i, page in enumerate(pdf.pages):
                    if page.width * page.height * 4 > 16_000_000:
                        raise DocumentError("PIXEL_LIMIT", "Page dimensions exceed render limits.")
                    lines = page.extract_text_lines(layout=False, strip=True, return_chars=False)
                    usable = sum(len(x["text"].strip()) for x in lines) >= 40
                    origin = "native" if usable else "tesseract"
                    if usable:
                        lines = [
                            {
                                "quote": l["text"],
                                "bbox": normalize_box(
                                    l["x0"], l["top"], l["x1"], l["bottom"], page.width, page.height
                                ),
                                "ocrConfidence": None,
                            }
                            for l in lines
                        ]
                    else:
                        if rendered is None:
                            rendered = pdfium.PdfDocument(path)
                        lines = ocr_page(rendered, i)
                    rotation = int(page.rotation or 0) % 360
                    raw = reader.pages[i].mediabox
                    out["pages"].append(
                        dict(
                            page=i + 1,
                            width=page.width,
                            height=page.height,
                            rotation=rotation,
                            transform=rotation_transform(
                                rotation, float(raw.width), float(raw.height)
                            ),
                            origin=origin,
                        )
                    )
                    for j, line in enumerate(lines):
                        if len(line["quote"]) > 4000:
                            raise DocumentError("TEXT_LIMIT", "Source line exceeds safe limit.")
                        out["blocks"].append(
                            dict(id=f"p{i+1}_b{j+1}", page=i + 1, origin=origin, **line)
                        )
                    if origin == "tesseract" and (
                        not lines or min(l["ocrConfidence"] for l in lines) < 70
                    ):
                        out["warnings"].append(
                            f"Page {i+1}: uncertain OCR text; manual review required."
                        )
            finally:
                if rendered is not None:
                    rendered.close()
        if not out["blocks"]:
            raise DocumentError("NO_TEXT", "No usable text could be extracted.")
        if len(out["blocks"]) > 20000:
            raise DocumentError("TEXT_LIMIT", "Too many source blocks.")
        return out
    except DocumentError:
        raise
    except Exception:
        raise DocumentError("MALFORMED_PDF", "PDF could not be parsed safely.")


if __name__ == "__main__":
    if os.name == "posix":
        import resource

        resource.setrlimit(resource.RLIMIT_AS, (600 * 1024 * 1024, 600 * 1024 * 1024))
        resource.setrlimit(resource.RLIMIT_CPU, (90, 90))
        resource.setrlimit(resource.RLIMIT_NOFILE, (64, 64))
    try:
        print(json.dumps(process(sys.argv[1])))
    except DocumentError as e:
        print(json.dumps({"error": {"code": e.code, "message": e.message, "status": e.status}}))
        sys.exit(2)
