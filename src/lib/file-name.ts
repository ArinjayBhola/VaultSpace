// The extension is displayed separately by editors and never sent as editable text.
export function splitFileName(value: string) {
  const index = value.lastIndexOf('.');
  return index > 0 && index < value.length - 1
    ? { baseName: value.slice(0, index), extension: value.slice(index) }
    : { baseName: value, extension: '' };
}
export function withFileExtension(currentName: string, baseName: string) {
  return baseName.trim() + splitFileName(currentName).extension;
}
