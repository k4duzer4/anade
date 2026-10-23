'use client';
import { Search, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
export function PagePulse({
  items,
}: {
  items: { label: string; value: number | string; Icon: LucideIcon }[];
}) {
  return (
    <div className="page-pulse">
      {items.map(({ label, value, Icon }) => (
        <div key={label}>
          <span className="pulse-icon">
            <Icon size={21} />
          </span>
          <span>
            <strong>{value}</strong>
            <small>{label}</small>
          </span>
        </div>
      ))}
    </div>
  );
}
export function SearchBox({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  return (
    <div className="refresh-search">
      <Search size={17} />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={label}
        placeholder={label}
      />
      {value && (
        <button type="button" aria-label="Limpar busca" onClick={() => onChange('')}>
          <X size={15} />
        </button>
      )}
    </div>
  );
}
export function ViewFilters({
  value,
  onChange,
  label,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  options: { value: string; label: string; count: number }[];
}) {
  return (
    <div className="refresh-filters" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          type="button"
          key={option.value}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
          <span>{option.count}</span>
        </button>
      ))}
    </div>
  );
}
