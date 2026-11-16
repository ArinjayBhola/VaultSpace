import type { VaultFile } from '@/types';

export function galleryRows(files: VaultFile[], width: number) {
  if (width <= 0) return [];
  const gap = 4;
  const target = width < 500 ? 125 : width < 900 ? 170 : 205;
  const rows: { files: VaultFile[]; widths: number[]; height: number }[] = [];
  let pending: VaultFile[] = [];
  let ratios: number[] = [];
  const ratio = (file: VaultFile) =>
    file.width && file.height
      ? Math.max(0.4, Math.min(2.8, file.width / file.height))
      : file.mimeType === 'application/pdf'
        ? 0.72
        : 1;
  function finish(last = false) {
    const sum = ratios.reduce((total, value) => total + value, 0);
    const available = width - gap * (pending.length - 1);
    const height = last ? Math.min(target, available / sum) : available / sum;
    rows.push({
      files: pending,
      widths: ratios.map((value) => value * height),
      height,
    });
    pending = [];
    ratios = [];
  }
  for (const file of files) {
    pending.push(file);
    ratios.push(ratio(file));
    if (
      ratios.reduce((total, value) => total + value, 0) * target +
        gap * (pending.length - 1) >=
      width
    )
      finish();
  }
  if (pending.length) finish(true);
  return rows;
}
