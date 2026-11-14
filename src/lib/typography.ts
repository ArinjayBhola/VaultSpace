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
    value: 'serif',
    label: 'Georgia',
    description: 'A classic reading style',
    family: 'Georgia, "Times New Roman", serif',
  },
];
export const fontSizes = [
  { value: 'small', label: 'Small', base: 14, scale: 14 / 15 },
  { value: 'default', label: 'Default', base: 15, scale: 1 },
  { value: 'large', label: 'Large', base: 16, scale: 16 / 15 },
  { value: 'extra-large', label: 'Extra large', base: 18, scale: 18 / 15 },
];
export function fontFamily(value: string) {
  return fontFamilies.find((font) => font.value === value) ?? fontFamilies[0];
}
export function fontSize(value: string) {
  return fontSizes.find((size) => size.value === value) ?? fontSizes[1];
}
