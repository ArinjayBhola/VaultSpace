export const fontFamilies = [
  {
    value: 'inter',
    label: 'Inter',
    description: 'Balanced and familiar',
    family: '"Inter Variable", Inter, system-ui, sans-serif',
  },
  {
    value: 'dm-sans',
    label: 'DM Sans',
    description: 'Soft and contemporary',
    family: '"DM Sans Variable", system-ui, sans-serif',
  },
  {
    value: 'manrope',
    label: 'Manrope',
    description: 'Clean and geometric',
    family: '"Manrope Variable", system-ui, sans-serif',
  },
  {
    value: 'system',
    label: 'System',
    description: 'Your device’s native font',
    family:
      'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  {
    value: 'nunito',
    label: 'Nunito',
    description: 'Friendly and rounded',
    family: '"Nunito Variable", system-ui, sans-serif',
  },
  {
    value: 'source-sans',
    label: 'Source Sans 3',
    description: 'Natural, humanist lettering',
    family: '"Source Sans 3 Variable", system-ui, sans-serif',
  },
  {
    value: 'lora',
    label: 'Lora',
    description: 'Warm, book-inspired serif',
    family: '"Lora Variable", Georgia, serif',
  },
  {
    value: 'caveat',
    label: 'Caveat',
    description: 'Expressive handwriting',
    family: '"Caveat Variable", cursive',
  },
  {
    value: 'kalam',
    label: 'Kalam',
    description: 'Relaxed, handwritten notes',
    family: 'Kalam, cursive',
  },
  {
    value: 'patrick-hand',
    label: 'Patrick Hand',
    description: 'Everyday handwritten print',
    family: '"Patrick Hand", cursive',
  },
  {
    value: 'serif',
    label: 'Georgia',
    description: 'A classic reading style',
    family: 'Georgia, "Times New Roman", serif',
  },
];
export const fontSizes = [
  { value: 'extra-small', label: 'Extra small', base: 13, scale: 13 / 15 },
  { value: 'small', label: 'Small', base: 14, scale: 14 / 15 },
  { value: 'default', label: 'Default', base: 15, scale: 1 },
  { value: 'large', label: 'Large', base: 16, scale: 16 / 15 },
  { value: 'medium-large', label: 'Roomy', base: 17, scale: 17 / 15 },
  { value: 'extra-large', label: 'Extra large', base: 18, scale: 18 / 15 },
  { value: 'xx-large', label: 'Larger', base: 20, scale: 20 / 15 },
  { value: 'largest', label: 'Largest', base: 22, scale: 22 / 15 },
];
export function fontFamily(value: string) {
  return fontFamilies.find((font) => font.value === value) ?? fontFamilies[0];
}
export function fontSize(value: string) {
  return fontSizes.find((size) => size.value === value) ?? fontSizes[2];
}
