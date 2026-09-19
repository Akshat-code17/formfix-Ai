import type { AnswerValue, Field } from '@formfix/contracts';
import {
  CheckboxControl,
  RadioGroup,
  SelectInput,
  TextArea,
  TextInput,
} from '../../components/ui/controls';

const asString = (value: AnswerValue): string =>
  typeof value === 'string' ? value : value === null ? '' : String(value);

/**
 * One control per field type.
 *
 * Identifiers are held as strings throughout, so a leading zero is never
 * lost to a number cast, and nothing here rewrites or "tidies" what the
 * user typed.
 */
export function FieldControl({
  field,
  value,
  onChange,
  describedBy,
  invalid,
}: {
  field: Field;
  value: AnswerValue;
  onChange: (value: AnswerValue) => void;
  describedBy?: string;
  invalid?: boolean;
}) {
  const shared = {
    id: `field-${field.id}`,
    'aria-describedby': describedBy,
    'aria-invalid': invalid || undefined,
  } as const;

  switch (field.type) {
    case 'textarea':
      return (
        <TextArea
          {...shared}
          value={asString(value)}
          onChange={(event) => onChange(event.target.value)}
          rows={4}
        />
      );

    case 'date':
      return (
        <TextInput
          {...shared}
          type="date"
          value={asString(value)}
          onChange={(event) => onChange(event.target.value)}
        />
      );

    case 'numeric_string':
      return (
        <TextInput
          {...shared}
          // `text` with a digit hint, not `number`: a number input would
          // strip leading zeros and offer a spinner that makes no sense for
          // an enrolment number or a PIN code.
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={asString(value)}
          onChange={(event) => onChange(event.target.value)}
        />
      );

    case 'select':
      return (
        <SelectInput
          {...shared}
          value={asString(value)}
          onChange={(event) => onChange(event.target.value || null)}
        >
          <option value="">Choose one…</option>
          {field.options?.map((option) => (
            <option key={option.value} value={option.value}>
              {option.labelOriginal}
            </option>
          ))}
        </SelectInput>
      );

    case 'radio':
      return (
        <RadioGroup
          name={field.id}
          value={typeof value === 'string' ? value : null}
          onValueChange={onChange}
          describedBy={describedBy}
          invalid={invalid}
          options={(field.options ?? []).map((o) => ({ value: o.value, label: o.labelOriginal }))}
        />
      );

    case 'checkbox':
      return (
        <CheckboxControl
          id={shared.id}
          // `false` is a real answer here (the box was seen and left unticked)
          // and is kept apart from `null`, which means untouched.
          checked={value === true}
          onCheckedChange={(checked) => onChange(checked)}
          describedBy={describedBy}
          invalid={invalid}
          label={field.labelOriginal}
        />
      );

    default:
      return (
        <TextInput
          {...shared}
          type="text"
          value={asString(value)}
          onChange={(event) => onChange(event.target.value)}
        />
      );
  }
}
