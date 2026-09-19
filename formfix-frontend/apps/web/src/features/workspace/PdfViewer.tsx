import type { BBox, SourceRef } from '@formfix/contracts';
import {
  ChevronLeft,
  ChevronRight,
  RotateCw,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import * as pdfjs from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Button, Spinner } from '../../components/ui/primitives';

pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

const MIN_ZOOM = 0.4;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.25;

/**
 * Rotates a box that was normalised against the un-rotated page into the
 * frame the user is currently looking at. Without this the highlight drifts
 * off the text as soon as the page is turned.
 */
export function rotateBox(box: BBox, rotation: 0 | 90 | 180 | 270): BBox {
  switch (rotation) {
    case 90:
      return { x: 1 - box.y - box.height, y: box.x, width: box.height, height: box.width };
    case 180:
      return { x: 1 - box.x - box.width, y: 1 - box.y - box.height, width: box.width, height: box.height };
    case 270:
      return { x: box.y, y: 1 - box.x - box.width, width: box.height, height: box.width };
    default:
      return box;
  }
}

type LoadError = { title: string; detail: string; retryable: boolean };

function describeLoadError(error: unknown): LoadError {
  const name = (error as { name?: string })?.name ?? '';
  if (name === 'PasswordException') {
    return {
      title: 'This PDF is password-protected',
      detail:
        'We cannot open a document that needs a password. Save an unlocked copy and upload that instead.',
      retryable: false,
    };
  }
  if (name === 'InvalidPDFException') {
    return {
      title: 'This file could not be read as a PDF',
      detail: 'The file may be damaged or may not be a PDF. Try uploading it again.',
      retryable: true,
    };
  }
  return {
    title: 'The original document could not be loaded',
    detail: 'The document did not arrive. Check your connection and try again.',
    retryable: true,
  };
}

export function PdfViewer({
  url,
  activeSource,
  onPageCount,
}: {
  url: string;
  activeSource: SourceRef | null;
  onPageCount?: (count: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const highlightRef = useRef<HTMLDivElement | null>(null);
  const lastFitWidth = useRef(0);
  const docRef = useRef<PDFDocumentProxy | null>(null);
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null);

  const [pageCount, setPageCount] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  // 'fit' keeps the page at the width of its pane until the user zooms.
  const [zoom, setZoom] = useState<number | 'fit'>('fit');
  const [appliedZoom, setAppliedZoom] = useState(1);
  const [rotation, setRotation] = useState<0 | 90 | 180 | 270>(0);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<LoadError | null>(null);
  const [surface, setSurface] = useState({ width: 0, height: 0 });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setError(null);

    const task = pdfjs.getDocument({ url, withCredentials: true });
    task.promise.then(
      (doc) => {
        // The loading task is destroyed in the cleanup below, which tears
        // the document down with it.
        if (cancelled) return;
        docRef.current = doc;
        setPageCount(doc.numPages);
        onPageCount?.(doc.numPages);
        setStatus('ready');
      },
      (cause) => {
        if (cancelled) return;
        setError(describeLoadError(cause));
        setStatus('error');
      },
    );

    return () => {
      cancelled = true;
      void task.destroy();
      docRef.current = null;
    };
    // onPageCount is intentionally not a dependency: callers pass inline fns.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, reloadKey]);

  const renderPage = useCallback(async () => {
    const doc = docRef.current;
    const canvas = canvasRef.current;
    if (!doc || !canvas) return;

    renderTaskRef.current?.cancel();

    const page = await doc.getPage(Math.min(Math.max(pageNumber, 1), doc.numPages));
    const pageRotation = (page.rotate + rotation) % 360;

    let scale = typeof zoom === 'number' ? zoom : 1;
    if (zoom === 'fit') {
      const base = page.getViewport({ scale: 1, rotation: pageRotation });
      const available = (scrollRef.current?.clientWidth ?? base.width) - 32;
      scale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, available / base.width));
    }
    setAppliedZoom(scale);

    // The stored boxes are measured against the page with its own rotation
    // already applied, so user rotation is added on top of page.rotate.
    const viewport = page.getViewport({ scale, rotation: pageRotation });
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = Math.floor(viewport.width * dpr);
    canvas.height = Math.floor(viewport.height * dpr);
    canvas.style.width = `${Math.floor(viewport.width)}px`;
    canvas.style.height = `${Math.floor(viewport.height)}px`;
    setSurface({ width: Math.floor(viewport.width), height: Math.floor(viewport.height) });

    const context = canvas.getContext('2d');
    if (!context) return;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);

    const task = page.render({ canvas, canvasContext: context, viewport });
    renderTaskRef.current = task;
    try {
      await task.promise;
    } catch (cause) {
      if ((cause as { name?: string })?.name !== 'RenderingCancelledException') throw cause;
    }
  }, [pageNumber, zoom, rotation]);

  // Re-fit when the pane is resized (the source panel opening, a window
  // resize, or a phone turning round). Re-rendering changes the canvas, which
  // can add or remove a scrollbar and resize the pane again, so a re-fit only
  // happens on a real width change — otherwise the two feed each other.
  useEffect(() => {
    const node = scrollRef.current;
    if (!node || zoom !== 'fit') return;

    let frame = 0;
    const observer = new ResizeObserver(() => {
      const width = node.clientWidth;
      if (Math.abs(width - lastFitWidth.current) < 24) return;
      lastFitWidth.current = width;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => void renderPage());
    });
    observer.observe(node);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [renderPage, zoom]);

  useEffect(() => {
    if (status !== 'ready') return;
    void renderPage();
  }, [status, renderPage]);

  // Opening a citation turns to its page; the highlight is drawn over it.
  useEffect(() => {
    if (activeSource) setPageNumber(activeSource.page);
  }, [activeSource]);

  // …and the cited region is brought into view, so a citation low on the
  // page does not land off-screen inside the pane.
  useEffect(() => {
    if (!activeSource?.bbox) return;
    const frame = requestAnimationFrame(() => {
      highlightRef.current?.scrollIntoView({ block: 'center', inline: 'nearest' });
    });
    return () => cancelAnimationFrame(frame);
  }, [activeSource, surface.height]);

  const highlight =
    activeSource?.bbox && activeSource.page === pageNumber
      ? rotateBox(activeSource.bbox, rotation)
      : null;

  if (status === 'error' && error) {
    return (
      <div className="p-4">
        <Alert tone="danger" title={error.title}>
          <p>{error.detail}</p>
          {error.retryable ? (
            <Button
              size="sm"
              variant="secondary"
              className="mt-3"
              onClick={() => setReloadKey((k) => k + 1)}
            >
              Try loading it again
            </Button>
          ) : null}
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2">
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
            disabled={pageNumber <= 1}
            aria-label="Previous page"
          >
            <ChevronLeft aria-hidden className="size-5" />
          </Button>
          <p className="min-w-24 text-center text-sm text-muted" aria-live="polite">
            Page {pageNumber} of {pageCount || '…'}
          </p>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setPageNumber((p) => Math.min(pageCount, p + 1))}
            disabled={pageNumber >= pageCount}
            aria-label="Next page"
          >
            <ChevronRight aria-hidden className="size-5" />
          </Button>
        </div>

        <div className="ml-auto flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setZoom(Math.max(MIN_ZOOM, appliedZoom - ZOOM_STEP))}
            disabled={appliedZoom <= MIN_ZOOM}
            aria-label="Zoom out"
          >
            <ZoomOut aria-hidden className="size-5" />
          </Button>
          <button
            type="button"
            onClick={() => setZoom('fit')}
            className="w-16 rounded px-1 text-center text-sm text-muted hover:text-teal-ink"
            aria-live="polite"
            title="Fit the page to the panel width"
          >
            {Math.round(appliedZoom * 100)}%
          </button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setZoom(Math.min(MAX_ZOOM, appliedZoom + ZOOM_STEP))}
            disabled={appliedZoom >= MAX_ZOOM}
            aria-label="Zoom in"
          >
            <ZoomIn aria-hidden className="size-5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setRotation((r) => ((r + 90) % 360) as 0 | 90 | 180 | 270)}
            aria-label="Rotate page"
          >
            <RotateCw aria-hidden className="size-5" />
          </Button>
        </div>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto bg-paper p-4">
        {status === 'loading' ? (
          <div className="grid h-40 place-items-center">
            <Spinner label="Opening the original document" />
          </div>
        ) : null}

        <div className="relative mx-auto w-fit" data-testid="pdf-surface">
          <canvas ref={canvasRef} className="block rounded-md shadow-sm ring-1 ring-line" />
          {surface.width > 0 ? (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{ width: surface.width, height: surface.height }}
            >
              {highlight ? (
                <div
                  ref={highlightRef}
                  key={`${activeSource?.id}-${pageNumber}-${rotation}-${appliedZoom}`}
                  data-testid="source-highlight"
                  className="source-highlight absolute"
                  style={{
                    left: `${highlight.x * 100}%`,
                    top: `${highlight.y * 100}%`,
                    width: `${highlight.width * 100}%`,
                    height: `${highlight.height * 100}%`,
                  }}
                />
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {activeSource && !activeSource.bbox ? (
        <div className="border-t border-line bg-amber-soft px-4 py-3 text-sm">
          <p className="font-medium">
            Shown on page {activeSource.page}. The exact position on the page is not known, so
            nothing is outlined.
          </p>
          <p className="mt-1 text-muted">“{activeSource.quote}”</p>
        </div>
      ) : null}
    </div>
  );
}
