import asyncio, hmac, json, os, subprocess, sys, tempfile, signal, re, time
from pathlib import Path
from fastapi import FastAPI, File, UploadFile, Header, HTTPException
from fastapi.responses import JSONResponse
from processor import MAX_BYTES

app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
slots = asyncio.Semaphore(1)
TOKEN = os.environ.get("DOCUMENT_SERVICE_TOKEN", "")
active = {}
cancelled = {}


def authorize(authorization):
    if len(TOKEN) < 32 or not hmac.compare_digest(authorization, "Bearer " + TOKEN):
        raise HTTPException(401, "Unauthorized internal request")


async def kill_tree(proc):
    if proc.returncode is not None:
        return
    if os.name == "posix":
        try:
            os.killpg(proc.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
    else:
        killer = await asyncio.create_subprocess_exec(
            "taskkill",
            "/PID",
            str(proc.pid),
            "/T",
            "/F",
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        try:
            await asyncio.wait_for(killer.wait(), timeout=2)
        except asyncio.TimeoutError:
            killer.kill()
            await killer.wait()
        if proc.returncode is None:
            try:
                proc.kill()
            except ProcessLookupError:
                pass
    await asyncio.wait_for(proc.wait(), timeout=3)


@app.post("/cancel/{processing_id}")
async def cancel(processing_id: str, authorization: str = Header(default="")):
    authorize(authorization)
    if not re.fullmatch(r"[a-f0-9-]{36}", processing_id):
        raise HTTPException(422, "Invalid processing ID")
    for key, until in list(cancelled.items()):
        if until < time.monotonic():
            cancelled.pop(key, None)
    if len(cancelled) >= 10000:
        raise HTTPException(503, "Cancellation capacity exhausted; retry later")
    cancelled[processing_id] = time.monotonic() + 600
    entry = active.get(processing_id)
    if entry:
        if entry["proc"]:
            await kill_tree(entry["proc"])
        try:
            await asyncio.wait_for(entry["done"].wait(), timeout=10)
        except asyncio.TimeoutError:
            raise HTTPException(503, "Cleanup still in progress")
    return {"deleted": True}


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/process")
async def process(
    file: UploadFile = File(...),
    authorization: str = Header(default=""),
    x_processing_id: str = Header(default=""),
):
    authorize(authorization)
    if not re.fullmatch(r"[a-f0-9-]{36}", x_processing_id):
        raise HTTPException(422, "Processing ID required")
    for key, until in list(cancelled.items()):
        if until < time.monotonic():
            cancelled.pop(key, None)
    if x_processing_id in cancelled:
        raise HTTPException(410, "Processing cancelled")
    if x_processing_id in active:
        raise HTTPException(503, "Processing already active")
    if file.content_type != "application/pdf" or not (file.filename or "").lower().endswith(".pdf"):
        raise HTTPException(415, "PDF required")
    try:
        await asyncio.wait_for(slots.acquire(), timeout=1)
    except asyncio.TimeoutError:
        return JSONResponse(
            {
                "error": {
                    "code": "DOCUMENT_BUSY",
                    "message": "Document processor is busy.",
                    "status": 503,
                }
            },
            status_code=503,
        )
    entry = {"proc": None, "done": asyncio.Event()}
    active[x_processing_id] = entry
    try:
        with tempfile.TemporaryDirectory(prefix="formfix-ingest-") as tmp:
            path = Path(tmp) / "input.pdf"
            size = 0
            with path.open("wb") as dst:
                while chunk := await file.read(65536):
                    size += len(chunk)
                    if size > MAX_BYTES:
                        raise HTTPException(413, "Maximum PDF size is 10 MB")
                    dst.write(chunk)
            if x_processing_id in cancelled:
                raise HTTPException(410, "Processing cancelled")
            proc = await asyncio.create_subprocess_exec(
                sys.executable,
                str(Path(__file__).with_name("processor.py")),
                str(path),
                stdout=subprocess.PIPE,
                stderr=subprocess.DEVNULL,
                start_new_session=os.name == "posix",
            )
            entry["proc"] = proc
            try:
                stdout, _ = await asyncio.wait_for(
                    proc.communicate(), timeout=float(os.getenv("PARSER_TIMEOUT_SECONDS", "90"))
                )
            except asyncio.TimeoutError:
                await kill_tree(proc)
                return JSONResponse(
                    {
                        "error": {
                            "code": "PARSER_TIMEOUT",
                            "message": "PDF parsing exceeded its time limit.",
                            "status": 422,
                        }
                    },
                    status_code=422,
                )
            if len(stdout) > 8_000_000:
                raise HTTPException(422, "Extraction output too large")
            try:
                result = json.loads(stdout)
            except ValueError:
                raise HTTPException(422, "PDF parser failed")
            return JSONResponse(result, status_code=result.get("error", {}).get("status", 200))
    finally:
        if entry["proc"] and entry["proc"].returncode is None:
            await kill_tree(entry["proc"])
        slots.release()
        await file.close()
        active.pop(x_processing_id, None)
        entry["done"].set()
