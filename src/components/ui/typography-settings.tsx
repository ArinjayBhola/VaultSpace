'use client';
import { RotateCcw, Type } from 'lucide-react';
import { Select } from './select';
import { useLocalPreference } from '@/hooks/use-local-preference';
import {
  fontFamilies,
  fontSizes,
  fontFamily,
  fontSize,
} from '@/lib/typography';
export function TypographySettings() {
  const [family, setFamily] = useLocalPreference('vault-font-family', 'inter');
  const [size, setSize] = useLocalPreference('vault-font-size', 'default');
  const selectedFamily = fontFamily(family);
  const selectedSize = fontSize(size);
  return (
    <div className="preference-group typography-settings">
      <div className="typography-title">
        <h3>
          <Type size={15} />
          Typography
        </h3>
        <button
          type="button"
          className="typography-reset"
          disabled={
            selectedFamily.value === 'inter' && selectedSize.value === 'default'
          }
          onClick={() => {
            setFamily('inter');
            setSize('default');
          }}
        >
          <RotateCcw size={12} />
          Reset to default
        </button>
      </div>
      <div className="typography-controls">
        <label className="form-field">
          Font style
          <Select
            aria-label="Font style"
            value={selectedFamily.value}
            onChange={(event) => setFamily(event.target.value)}
          >
            {fontFamilies.map((font) => (
              <option key={font.value} value={font.value}>
                <span style={{ fontFamily: font.family }}>{font.label}</span>
              </option>
            ))}
          </Select>
        </label>
        <label className="form-field">
          Font size
          <Select
            aria-label="Font size"
            value={selectedSize.value}
            onChange={(event) => setSize(event.target.value)}
          >
            {fontSizes.map((font) => (
              <option key={font.value} value={font.value}>
                {font.label} ({font.base}px base)
              </option>
            ))}
          </Select>
        </label>
      </div>
      <div className="typography-preview" aria-label="Typography preview">
        <span className="typography-preview-caption">LIVE PREVIEW</span>
        <h4>Everything worth keeping.</h4>
        <p>
          Your documents, memories, and ideas. A space that feels like yours.
        </p>
        <span className="typography-preview-sample">Aa Bb Cc · 0123456789</span>
      </div>
      <p className="typography-feedback" role="status">
        {selectedFamily.label} · {selectedSize.label} text. Saved automatically
        on this browser. Interface text changes immediately; document formatting
        stays the same.
      </p>
    </div>
  );
}
