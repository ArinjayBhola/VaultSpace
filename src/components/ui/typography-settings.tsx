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
        <div>
          <h3>
            <Type size={18} /> Make it feel like you
          </h3>
          <p className="muted">
            Choose your lettering. Find your reading rhythm.
          </p>
        </div>
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
          <RotateCcw size={14} /> Reset
        </button>
      </div>
      <div className="typography-controls">
        <div className="form-field">
          <label htmlFor="vault-font-style">Font style</label>
          <Select
            id="vault-font-style"
            aria-label="Font style"
            placeholder="Choose a font style"
            value={selectedFamily.value}
            onChange={(event) => setFamily(event.target.value)}
          >
            {fontFamilies.map((font) => (
              <option key={font.value} value={font.value}>
                <span style={{ fontFamily: font.family }}>{font.label}</span>
              </option>
            ))}
          </Select>
          <small className="muted">{selectedFamily.description}</small>
        </div>
        <div className="form-field">
          <label htmlFor="vault-text-size">Text size</label>
          <Select
            id="vault-text-size"
            aria-label="Text size"
            placeholder="Choose a text size"
            value={selectedSize.value}
            onChange={(event) => setSize(event.target.value)}
          >
            {fontSizes.map((size) => (
              <option key={size.value} value={size.value}>
                {size.label} ({size.base}px)
              </option>
            ))}
          </Select>
          <small className="muted">Applies across your workspace</small>
        </div>
      </div>
      <div
        className="typography-preview"
        aria-label="Typography preview"
        style={{ fontFamily: selectedFamily.family }}
      >
        <span className="typography-preview-caption">
          YOUR SPACE, YOUR STYLE
        </span>
        <h4>Everything worth keeping.</h4>
        <p>
          A little more organized. A little more you. Your documents and
          memories, always close at hand.
        </p>
        <span className="typography-preview-sample">Aa Bb Cc · 0123456789</span>
      </div>
      <p className="typography-feedback" role="status">
        {selectedFamily.label} · {selectedSize.base}px base. Saved on this
        browser. Changes apply across the interface; original documents keep
        their own fonts.
      </p>
    </div>
  );
}
