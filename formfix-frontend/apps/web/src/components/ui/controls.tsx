import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import * as RadioGroupPrimitive from '@radix-ui/react-radio-group';
import { Check } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '../../lib/cn';

const fieldBase =
  'w-full rounded-lg border bg-panel px-3 py-2.5 text-base text-ink placeholder:text-muted/70 ' +
  'border-line-strong focus:border-teal aria-[invalid=true]:border-danger';

export function TextInput({ className, ...props }: ComponentProps<'input'>) {
  return <input className={cn(fieldBase, 'min-h-11', className)} {...props} />;
}

export function TextArea({ className, ...props }: ComponentProps<'textarea'>) {
  return (
    <textarea
      // Translated content is taller: grow rather than clip.
      className={cn(fieldBase, 'min-h-28 resize-y leading-relaxed', className)}
      {...props}
    />
  );
}

export function SelectInput({
  className,
  children,
  ...props
}: ComponentProps<'select'> & { children: ReactNode }) {
  return (
    <select className={cn(fieldBase, 'min-h-11 pr-8', className)} {...props}>
      {children}
    </select>
  );
}

export function RadioGroup({
  options,
  value,
  onValueChange,
  name,
  describedBy,
  invalid,
}: {
  options: { value: string; label: string }[];
  value: string | null;
  onValueChange: (value: string) => void;
  name: string;
  describedBy?: string;
  invalid?: boolean;
}) {
  return (
    <RadioGroupPrimitive.Root
      value={value ?? ''}
      onValueChange={onValueChange}
      name={name}
      aria-describedby={describedBy}
      aria-invalid={invalid || undefined}
      className="grid gap-2"
    >
      {options.map((option) => (
        <label
          key={option.value}
          className={cn(
            'flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5',
            value === option.value
              ? 'border-teal bg-teal-soft'
              : 'border-line-strong bg-panel hover:bg-paper',
          )}
        >
          <RadioGroupPrimitive.Item
            value={option.value}
            className="grid size-5 shrink-0 place-items-center rounded-full border-2 border-line-strong data-[state=checked]:border-teal"
          >
            <RadioGroupPrimitive.Indicator className="size-2.5 rounded-full bg-teal" />
          </RadioGroupPrimitive.Item>
          <span>{option.label}</span>
        </label>
      ))}
    </RadioGroupPrimitive.Root>
  );
}

export function CheckboxControl({
  checked,
  onCheckedChange,
  label,
  describedBy,
  invalid,
  id,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: ReactNode;
  describedBy?: string;
  invalid?: boolean;
  id: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <CheckboxPrimitive.Root
        id={id}
        checked={checked}
        onCheckedChange={(next) => onCheckedChange(next === true)}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        className={cn(
          'mt-0.5 grid size-6 shrink-0 place-items-center rounded-md border-2 bg-panel',
          checked ? 'border-teal bg-teal' : 'border-line-strong',
          invalid && !checked ? 'border-danger' : '',
        )}
      >
        <CheckboxPrimitive.Indicator>
          <Check aria-hidden className="size-4 text-white" strokeWidth={3} />
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
      <label htmlFor={id} className="cursor-pointer text-base leading-relaxed">
        {label}
      </label>
    </div>
  );
}
