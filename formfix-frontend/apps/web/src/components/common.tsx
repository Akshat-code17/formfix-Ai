import {
  LANGUAGE_LABELS,
  LANGUAGES,
  type Language,
  type RequiredStatus,
  type SourceRef,
} from '@formfix/contracts';
import { FileText, HelpCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../lib/cn';
import { Badge } from './ui/primitives';

/** Tags translated text with its language so the right font and line box apply. */
export function Translated({
  language,
  className,
  children,
  as: Tag = 'p',
}: {
  language: Language;
  className?: string;
  children: ReactNode;
  as?: 'p' | 'span' | 'div' | 'h2' | 'h3' | 'li';
}) {
  return (
    <Tag lang={language} className={className}>
      {children}
    </Tag>
  );
}

const STATUS_COPY: Record<RequiredStatus, { label: string; tone: 'teal' | 'neutral' | 'amber' }> = {
  required: { label: 'Required', tone: 'teal' },
  optional: { label: 'Optional', tone: 'neutral' },
  conditional: { label: 'Only in some cases', tone: 'amber' },
  unknown: { label: 'Form does not say', tone: 'amber' },
};

export function RequiredBadge({ status, hint }: { status: RequiredStatus; hint?: string }) {
  const copy = STATUS_COPY[status];
  return (
    <Badge tone={copy.tone} title={hint}>
      {status === 'unknown' ? <HelpCircle aria-hidden className="size-3" /> : null}
      {copy.label}
    </Badge>
  );
}

/**
 * A citation the user can click to open the page it came from. When the
 * extractor could not measure a region the chip still works — it opens the
 * page and shows the quote, and says so, instead of drawing a guessed box.
 */
export function SourceChip({
  source,
  onOpen,
  active,
}: {
  source: SourceRef;
  onOpen: (source: SourceRef) => void;
  active?: boolean;
}) {
  const label = source.label ?? 'source';
  return (
    <button
      type="button"
      onClick={() => onOpen(source)}
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
        active
          ? 'border-teal bg-teal-soft text-teal-ink'
          : 'border-line-strong bg-panel text-teal-ink hover:border-teal hover:bg-teal-soft',
      )}
    >
      <FileText aria-hidden className="size-3 shrink-0" />
      <span className="truncate">
        Page {source.page} · {label}
      </span>
      {!source.bbox ? <span className="text-muted">(page only)</span> : null}
    </button>
  );
}

export function LanguageSelect({
  value,
  onChange,
  available,
  pending,
  id = 'language-select',
  compact,
}: {
  value: Language;
  onChange: (language: Language) => void;
  available: Language[];
  pending?: boolean;
  id?: string;
  compact?: boolean;
}) {
  return (
    <div className={cn('flex items-center gap-2', compact ? '' : 'flex-col items-start gap-1.5')}>
      <label htmlFor={id} className={cn('font-medium', compact ? 'sr-only' : 'text-sm')}>
        Explanation language
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value as Language)}
        className="min-h-11 rounded-lg border border-line-strong bg-panel px-3 py-2 text-base text-ink"
      >
        {LANGUAGES.filter((l) => available.includes(l)).map((l) => (
          <option key={l} value={l}>
            {LANGUAGE_LABELS[l].native}
            {l === 'en' ? '' : ` — ${LANGUAGE_LABELS[l].english}`}
          </option>
        ))}
      </select>
      {pending ? <span className="text-xs text-muted">Updating…</span> : null}
    </div>
  );
}

/**
 * Renders a small, fixed subset of Markdown — bold, italics, inline code,
 * bullet lists and paragraphs. Raw HTML is never interpreted: the input is
 * split on known patterns and emitted as React elements, so a model reply
 * cannot inject markup.
 */
export function MarkdownLite({ text, language }: { text: string; language: Language }) {
  const blocks = text.split(/\n{2,}/);
  return (
    <div lang={language} className="space-y-2 text-base leading-relaxed">
      {blocks.map((block, blockIndex) => {
        const lines = block.split('\n');
        const isList = lines.every((l) => /^\s*[-*]\s+/.test(l));
        if (isList) {
          return (
            <ul key={blockIndex} className="list-disc space-y-1 pl-5">
              {lines.map((line, i) => (
                <li key={i}>{inline(line.replace(/^\s*[-*]\s+/, ''))}</li>
              ))}
            </ul>
          );
        }
        return <p key={blockIndex}>{inline(block)}</p>;
      })}
    </div>
  );
}

function inline(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|_[^_]+_|`[^`]+`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    const token = match[0];
    if (token.startsWith('**')) {
      parts.push(<strong key={key++}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith('`')) {
      parts.push(
        <code key={key++} className="rounded bg-paper px-1 py-0.5 text-sm">
          {token.slice(1, -1)}
        </code>,
      );
    } else {
      parts.push(<em key={key++}>{token.slice(1, -1)}</em>);
    }
    lastIndex = match.index + token.length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}
