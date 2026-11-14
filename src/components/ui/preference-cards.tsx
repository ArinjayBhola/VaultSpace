'use client';
import {
  Check,
  Sun,
  Moon,
  Monitor,
  Grid2X2,
  List,
  Rows3,
  LayoutPanelTop,
} from 'lucide-react';
export function PreferenceCards({
  kind,
  value,
  onChange,
}: {
  kind: 'theme' | 'view' | 'density';
  value: string;
  onChange: (value: string) => void;
}) {
  const options =
    kind === 'theme'
      ? [
          {
            value: 'light',
            label: 'Light',
            description: 'Bright and clear',
            icon: Sun,
          },
          {
            value: 'dark',
            label: 'Dark',
            description: 'Easy on the eyes',
            icon: Moon,
          },
          {
            value: 'system',
            label: 'System',
            description: 'Follow your device',
            icon: Monitor,
          },
        ]
      : kind === 'view'
        ? [
            {
              value: 'grid',
              label: 'Grid',
              description: 'Preview at a glance',
              icon: Grid2X2,
            },
            {
              value: 'list',
              label: 'List',
              description: 'More detail, less space',
              icon: List,
            },
          ]
        : [
            {
              value: 'comfortable',
              label: 'Comfortable',
              description: 'A little room to breathe',
              icon: LayoutPanelTop,
            },
            {
              value: 'compact',
              label: 'Compact',
              description: 'Keep more in view',
              icon: Rows3,
            },
          ];
  return (
    <div
      className={`preference-cards preference-${kind}`}
      role="group"
      aria-label={
        kind === 'theme'
          ? 'Color theme'
          : kind === 'view'
            ? 'Default file view'
            : 'File density'
      }
    >
      {options.map((option) => (
        <button
          type="button"
          key={option.value}
          aria-pressed={value === option.value}
          className={`preference-card ${value === option.value ? 'chosen' : ''}`}
          onClick={() => onChange(option.value)}
        >
          {kind === 'theme' ? (
            <span className={`theme-miniature ${option.value}`}>
              <i />
              <span>
                <b />
                <b />
                <b />
              </span>
            </span>
          ) : (
            <span className="preference-icon">
              <option.icon size={22} />
            </span>
          )}
          <span className="preference-card-name">
            <option.icon size={14} />
            {option.label}
            {value === option.value && <Check size={14} />}
          </span>
          <small>{option.description}</small>
        </button>
      ))}
    </div>
  );
}
