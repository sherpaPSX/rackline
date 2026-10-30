import type { InputHTMLAttributes } from 'react';

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  label: string;
  value: string;
  onChange: (value: string) => void;
  touch?: boolean | undefined;
}

/** Single-line text entry (an IP address, a name). Numbers use ValueBox instead. */
export function TextField({ label, value, onChange, touch, className, ...rest }: TextFieldProps) {
  return (
    <input
      className={className ? `rl-text ${className}` : 'rl-text'}
      aria-label={label}
      data-touch={touch || undefined}
      value={value}
      onChange={(e) => onChange(e.currentTarget.value)}
      {...rest}
    />
  );
}
