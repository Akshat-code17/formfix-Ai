import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '../../lib/cn';

const buttonStyles = cva(
  'inline-flex items-center justify-center gap-2 rounded-lg font-medium no-underline transition-colors disabled:cursor-not-allowed disabled:opacity-55',
  {
    variants: {
      variant: {
        // White on #087F8C measures 4.8:1 — fine for button text.
        primary: 'bg-teal text-white hover:bg-teal-ink',
        secondary: 'border border-line-strong bg-panel text-ink hover:bg-paper',
        ghost: 'text-teal-ink hover:bg-teal-soft',
        danger: 'border border-danger-edge bg-danger-soft text-danger hover:bg-danger hover:text-white',
        link: 'text-teal-ink underline underline-offset-2 hover:text-teal',
      },
      size: {
        // 44px tall: comfortable for touch as well as pointer.
        md: 'min-h-11 px-4 py-2 text-base',
        sm: 'min-h-9 px-3 py-1.5 text-sm',
        lg: 'min-h-12 px-5 py-2.5 text-base',
        icon: 'size-10',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'md' },
  },
);

export type ButtonProps = ComponentProps<'button'> &
  VariantProps<typeof buttonStyles> & { asChild?: boolean; loading?: boolean };

export function Button({
  className,
  variant,
  size,
  asChild,
  loading,
  children,
  disabled,
  ...props
}: ButtonProps) {
  // Slot accepts exactly one child, so the loading spinner is only added on
  // a real <button>. Link-style buttons pass their child straight through.
  if (asChild) {
    return (
      <Slot className={cn(buttonStyles({ variant, size }), className)} {...props}>
        {children}
      </Slot>
    );
  }

  return (
    <button
      className={cn(buttonStyles({ variant, size }), className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
      {children}
    </button>
  );
}

const badgeStyles = cva(
  'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap',
  {
    variants: {
      tone: {
        neutral: 'border-line-strong bg-paper text-muted',
        teal: 'border-teal-edge bg-teal-soft text-teal-ink',
        amber: 'border-amber-edge bg-amber-soft text-amber',
        danger: 'border-danger-edge bg-danger-soft text-danger',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

export function Badge({
  className,
  tone,
  ...props
}: ComponentProps<'span'> & VariantProps<typeof badgeStyles>) {
  return <span className={cn(badgeStyles({ tone }), className)} {...props} />;
}

export function Panel({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('panel', className)} {...props} />;
}

const alertStyles = cva('rounded-xl border p-4 text-sm', {
  variants: {
    tone: {
      info: 'border-teal-edge bg-teal-soft text-ink',
      warning: 'border-amber-edge bg-amber-soft text-ink',
      danger: 'border-danger-edge bg-danger-soft text-ink',
      neutral: 'border-line bg-paper text-ink',
    },
  },
  defaultVariants: { tone: 'neutral' },
});

export function Alert({
  className,
  tone,
  title,
  children,
  icon,
  ...props
}: ComponentProps<'div'> & VariantProps<typeof alertStyles> & { title?: ReactNode; icon?: ReactNode }) {
  return (
    <div className={cn(alertStyles({ tone }), className)} {...props}>
      <div className="flex gap-3">
        {icon ? <span className="mt-0.5 shrink-0">{icon}</span> : null}
        <div className="min-w-0 space-y-1">
          {title ? <p className="font-semibold">{title}</p> : null}
          {children ? <div className="text-muted [&_a]:text-teal-ink [&_a]:underline">{children}</div> : null}
        </div>
      </div>
    </div>
  );
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-muted">
      <Loader2 aria-hidden className="size-4 animate-spin" />
      <span>{label}</span>
    </span>
  );
}

export function VisuallyHidden({ children }: { children: ReactNode }) {
  return <span className="sr-only">{children}</span>;
}

/** A labelled meter. Never used to imply that answers have passed checks. */
export function Meter({
  value,
  max,
  label,
  tone = 'teal',
}: {
  value: number;
  max: number;
  label: string;
  tone?: 'teal' | 'amber';
}) {
  const pct = max === 0 ? 0 : Math.round((value / max) * 100);
  return (
    <div>
      <div
        role="meter"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label}
        className="h-2 w-full overflow-hidden rounded-full bg-line"
      >
        <div
          className={cn(
            'h-full rounded-full transition-[width] duration-300',
            tone === 'teal' ? 'bg-teal' : 'bg-amber',
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
