const palette = [
  '#4f7ff0',
  '#a69af1',
  '#4b9e82',
  '#e1a64b',
  '#d17a8b',
  '#6599bd',
  '#a479ba',
  '#68a8a0',
  '#b39754',
  '#7182a8',
  '#d08859',
  '#84a25e',
];

export function storageColor(index: number) {
  return palette[index] ?? `hsl(${(index * 137.508) % 360} 48% 57%)`;
}

export function storageArc(start: number, end: number) {
  if (end - start >= 100 - 1e-8)
    return 'M 50 5 A 45 45 0 1 1 50 95 A 45 45 0 1 1 50 5';
  const point = (percent: number) => {
    const angle = (percent / 100) * Math.PI * 2 - Math.PI / 2;
    return `${50 + 45 * Math.cos(angle)} ${50 + 45 * Math.sin(angle)}`;
  };
  return `M ${point(start)} A 45 45 0 ${end - start > 50 ? 1 : 0} 1 ${point(end)}`;
}
