'use client';
import { Tooltip } from './tooltip';
import * as SelectPrimitive from '@radix-ui/react-select';
import {
  Children,
  isValidElement,
  Fragment,
  type ReactNode,
  type CSSProperties,
} from 'react';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
export type ValueChange = {
  target: { value: string };
  currentTarget: { value: string };
};
type Option = { value: string; label: ReactNode; disabled: boolean };
function collectOptions(children: ReactNode): Option[] {
  return Children.toArray(children).flatMap((child) => {
    if (
      !isValidElement<{
        value?: string | number;
        children?: ReactNode;
        disabled?: boolean;
      }>(child)
    )
      return [];
    if (child.type === Fragment) return collectOptions(child.props.children);
    if (child.type !== 'option') return [];
    return [
      {
        value: String(child.props.value ?? ''),
        label: child.props.children,
        disabled: Boolean(child.props.disabled),
      },
    ];
  });
}
const emptyValue = '__vaultspace_empty_selection__';
const encode = (value: string) => (value === '' ? emptyValue : value);
export function Select({
  children,
  value,
  defaultValue,
  onChange,
  placeholder = 'Choose an option',
  className,
  style,
  id,
  name,
  disabled,
  required,
  ...aria
}: {
  children: ReactNode;
  value?: string | number;
  defaultValue?: string | number;
  onChange?: (event: ValueChange) => void;
  placeholder?: string;
  className?: string;
  style?: CSSProperties;
  id?: string;
  name?: string;
  disabled?: boolean;
  required?: boolean;
  'aria-label'?: string;
  'aria-labelledby'?: string;
}) {
  const options = collectOptions(children);
  return (
    <SelectPrimitive.Root
      value={value === undefined ? undefined : encode(String(value))}
      defaultValue={
        defaultValue === undefined ? undefined : encode(String(defaultValue))
      }
      name={name}
      disabled={disabled}
      required={required}
      onValueChange={(selected) => {
        const value = selected === emptyValue ? '' : selected;
        onChange?.({ target: { value }, currentTarget: { value } });
      }}
    >
      <Tooltip label={aria['aria-label']}>
        <SelectPrimitive.Trigger
          id={id}
          className={cn('vs-select-trigger', className)}
          style={style}
          {...aria}
        >
          <SelectPrimitive.Value placeholder={placeholder} />
          <SelectPrimitive.Icon className="vs-select-chevron">
            <ChevronDown size={16} />
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
      </Tooltip>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={6}
          collisionPadding={12}
          className="vs-select-content"
        >
          <SelectPrimitive.ScrollUpButton className="vs-select-scroll">
            <ChevronUp size={15} />
          </SelectPrimitive.ScrollUpButton>
          <SelectPrimitive.Viewport className="vs-select-viewport">
            {options.map((option) => (
              <SelectPrimitive.Item
                key={encode(option.value)}
                value={encode(option.value)}
                disabled={option.disabled}
                className="vs-select-item"
              >
                <SelectPrimitive.ItemText>
                  {option.label}
                </SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator className="vs-select-check">
                  <Check size={15} />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
          <SelectPrimitive.ScrollDownButton className="vs-select-scroll">
            <ChevronDown size={15} />
          </SelectPrimitive.ScrollDownButton>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
