'use client';

import { useRef, useState } from 'react';
import { Minus, Plus } from 'lucide-react';

export function NumberInput({
  name,
  label,
  min,
  max,
  defaultValue,
  required,
  disabled,
  placeholder,
}: {
  name: string;
  label: string;
  min: number;
  max: number;
  defaultValue?: number;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [value, setValue] = useState(defaultValue === undefined ? '' : String(defaultValue));
  const input = useRef<HTMLInputElement>(null);
  function step(direction: number) {
    const current = value === '' ? min - direction : Number(value);
    setValue(String(Math.max(min, Math.min(max, current + direction))));
    requestAnimationFrame(() =>
      input.current?.dispatchEvent(new Event('input', { bubbles: true })),
    );
  }
  return (
    <span className="anade-number-field">
      <input
        ref={input}
        type="number"
        inputMode="numeric"
        name={name}
        aria-label={label}
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        required={required}
        disabled={disabled}
        placeholder={placeholder}
      />
      <span className="number-stepper">
        <button
          type="button"
          aria-label={`Diminuir ${label.toLocaleLowerCase('pt-BR')}`}
          disabled={disabled || (value !== '' && Number(value) <= min)}
          onClick={() => step(-1)}
        >
          <Minus size={14} />
        </button>
        <button
          type="button"
          aria-label={`Aumentar ${label.toLocaleLowerCase('pt-BR')}`}
          disabled={disabled || (value !== '' && Number(value) >= max)}
          onClick={() => step(1)}
        >
          <Plus size={14} />
        </button>
      </span>
    </span>
  );
}
