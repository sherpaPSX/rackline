export interface SelectOption<T extends string | number> {
  value: T;
  label: string;
}

export interface SelectProps<T extends string | number> {
  label: string;
  options: readonly SelectOption<T>[];
  value: T;
  onChange: (value: T) => void;
  touch?: boolean | undefined;
  disabled?: boolean | undefined;
}

/** Pick one of many options (filter type, crossover slope) where a segmented row would not fit. */
export function Select<T extends string | number>({ label, options, value, onChange, touch, disabled }: SelectProps<T>) {
  return (
    <select
      className="rl-select"
      aria-label={label}
      title={label}
      data-touch={touch || undefined}
      disabled={disabled}
      value={String(value)}
      onChange={(e) => {
        const picked = options.find((o) => String(o.value) === e.currentTarget.value);
        if (picked) onChange(picked.value);
      }}
    >
      {options.map((o) => (
        <option key={String(o.value)} value={String(o.value)}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
