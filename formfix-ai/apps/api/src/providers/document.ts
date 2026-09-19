import fs from "node:fs/promises";
import nodePath from "node:path";
import { Extraction } from "../../../../packages/contracts/index.js";
import type { Settings } from "../config.js";
import { AppError } from "../security/errors.js";
export async function extract(path: string, c: Settings) {
  const body = new FormData();
  body.set(
    "file",
    new Blob([new Uint8Array(await fs.readFile(path))], {
      type: "application/pdf",
    }),
    "input.pdf",
  );
  let response: Response;
  try {
    response = await fetch(c.DOCUMENT_SERVICE_URL + "/process", {
      method: "POST",
      body,
      headers: {
        Authorization: "Bearer " + c.DOCUMENT_SERVICE_TOKEN,
        "X-Processing-ID": nodePath.basename(path, ".pdf"),
      },
      signal: AbortSignal.timeout(100000),
      redirect: "error",
    });
  } catch {
    throw new AppError(
      503,
      "DOCUMENT_UNAVAILABLE",
      "Internal document service is unavailable.",
      true,
    );
  }
  const text = await response.text();
  if (text.length > 8_000_000)
    throw new AppError(
      422,
      "EXTRACTION_TOO_LARGE",
      "Extraction exceeded safe limits.",
    );
  if (!response.ok) {
    let code = "DOCUMENT_REJECTED",
      message = "Document processing failed.";
    try {
      const e = JSON.parse(text).error;
      if (e && /^[A-Z_]+$/.test(e.code)) {
        code = e.code;
        message = String(e.message).slice(0, 500);
      }
    } catch {}
    throw new AppError(
      [413, 415, 422, 503].includes(response.status) ? response.status : 503,
      code,
      message,
      response.status >= 500,
    );
  }
  try {
    const ex = Extraction.parse(JSON.parse(text));
    if (
      new Set(ex.blocks.map((b) => b.id)).size !== ex.blocks.length ||
      ex.pages.some((p, i) => p.page !== i + 1) ||
      ex.blocks.some(
        (b) =>
          b.page > ex.pages.length ||
          (b.bbox &&
            (b.bbox.x + b.bbox.width > 1.000001 ||
              b.bbox.y + b.bbox.height > 1.000001)),
      )
    )
      throw new Error();
    return ex;
  } catch {
    throw new AppError(
      503,
      "INVALID_EXTRACTION",
      "Document service returned an invalid response.",
      true,
    );
  }
}
export async function cancelDocument(path: string, c: Settings) {
  try {
    const r = await fetch(
      c.DOCUMENT_SERVICE_URL + "/cancel/" + nodePath.basename(path, ".pdf"),
      {
        method: "POST",
        headers: { Authorization: "Bearer " + c.DOCUMENT_SERVICE_TOKEN },
        signal: AbortSignal.timeout(15000),
        redirect: "error",
      },
    );
    if (!r.ok) throw new Error();
  } catch {
    throw new AppError(
      503,
      "CLEANUP_FAILED",
      "Document service cleanup is unavailable. Session access is disabled; retry deletion.",
      true,
    );
  }
}
