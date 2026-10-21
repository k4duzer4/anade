'use client';

import { useContext } from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';
import { FloatingLayerContext } from './floating-ui';

export type SelectOption = { value: string; label: string; disabled?: boolean };
type Props = {
  name?: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  'aria-label': string;
  className?: string;
};

export function Select({
  options,
  placeholder = 'Selecione uma opção',
  className = '',
  ...props
}: Props) {
  const container = useContext(FloatingLayerContext);
  const { 'aria-label': label, ...rootProps } = props;
  return (
    <span className={`anade-select ${className}`} data-form-control="">
      <SelectPrimitive.Root {...rootProps}>
        <SelectPrimitive.Trigger
          className="anade-control anade-select-trigger"
          aria-label={label}
          data-control-trigger=""
        >
          <SelectPrimitive.Value placeholder={placeholder} />
          <SelectPrimitive.Icon className="anade-select-chevron">
            <ChevronDown size={16} />
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
        <SelectPrimitive.Portal container={container}>
          <SelectPrimitive.Content
            className="anade-select-content"
            data-anade-select-popup=""
            position="popper"
            sideOffset={7}
            collisionPadding={12}
          >
            <SelectPrimitive.ScrollUpButton className="anade-select-scroll">
              <ChevronUp size={15} />
            </SelectPrimitive.ScrollUpButton>
            <SelectPrimitive.Viewport className="anade-select-viewport">
              {options.map((option) => (
                <SelectPrimitive.Item
                  key={option.value}
                  value={option.value}
                  disabled={option.disabled}
                  className="anade-select-option"
                >
                  <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                  <SelectPrimitive.ItemIndicator>
                    <Check size={15} />
                  </SelectPrimitive.ItemIndicator>
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.Viewport>
            <SelectPrimitive.ScrollDownButton className="anade-select-scroll">
              <ChevronDown size={15} />
            </SelectPrimitive.ScrollDownButton>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>
    </span>
  );
}
