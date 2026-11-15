'use client';
import * as Menu from '@radix-ui/react-dropdown-menu';
import { Check, ChevronDown } from 'lucide-react';
export function FileTypeFilter({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string; count: number }[];
  value: string[];
  onChange: (value: string[]) => void;
}) {
  const values = Array.from(new Set(value.filter((type) => type !== 'all')));
  const choices = [
    ...options,
    ...values
      .filter((value) => !options.some((option) => option.value === value))
      .map((value) => ({
        value,
        label:
          value === 'images'
            ? 'All images'
            : value.startsWith('mime:')
              ? value.slice(5)
              : value.toUpperCase(),
        count: undefined,
      })),
  ];
  const label =
    values.length === 0
      ? 'All file types'
      : values.length === 1
        ? (choices.find((option) => option.value === values[0])?.label ??
          values[0].toUpperCase())
        : values.length + ' file types';
  return (
    <Menu.Root>
      <Menu.Trigger
        className="btn file-type-filter"
        type="button"
        aria-label={'File types: ' + label}
      >
        <span>{label}</span>
        <ChevronDown size={15} />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content
          className="menu-content file-type-filter-menu"
          side="bottom"
          align="start"
          sideOffset={6}
          collisionPadding={12}
        >
          <Menu.Label className="type-filter-label">
            Choose one or more types
          </Menu.Label>
          <Menu.CheckboxItem
            className="menu-item type-filter-option"
            checked={values.length === 0}
            onSelect={(event) => event.preventDefault()}
            onCheckedChange={() => onChange([])}
          >
            <span className="type-filter-check">
              {values.length === 0 && <Check size={13} />}
            </span>
            All file types
          </Menu.CheckboxItem>
          <Menu.Separator className="menu-separator" />
          {choices.map((option) => (
            <Menu.CheckboxItem
              key={option.value}
              className="menu-item type-filter-option"
              checked={values.includes(option.value)}
              onSelect={(event) => event.preventDefault()}
              onCheckedChange={(checked) =>
                onChange(
                  checked
                    ? [...values, option.value]
                    : values.filter((type) => type !== option.value),
                )
              }
            >
              <span className="type-filter-check">
                {values.includes(option.value) && <Check size={13} />}
              </span>
              <span>{option.label}</span>
              <span className="muted type-filter-count">{option.count}</span>
            </Menu.CheckboxItem>
          ))}
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}
