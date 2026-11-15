export function userTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
}
export function timeZoneLabel(zone = userTimeZone()) {
  if (zone === 'Asia/Kolkata' || zone === 'Asia/Calcutta') return 'IST';
  return (
    new Intl.DateTimeFormat(undefined, {
      timeZone: zone,
      timeZoneName: 'short',
    })
      .formatToParts(new Date())
      .find((part) => part.type === 'timeZoneName')?.value ?? zone
  );
}
export function localDateValue(value: string | Date) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function localDateBoundary(value: string, endOfDay = false) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) throw new Error('Choose a valid date.');
  if (endOfDay) date.setHours(23, 59, 59, 999);
  return date.toISOString();
}
export function localDateLabel(value: string) {
  if (!value) return '';
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
}

export function defaultShareExpiry() {
  const value = new Date();
  value.setDate(value.getDate() + 1);
  return (
    localDateValue(value) +
    'T' +
    String(value.getHours()).padStart(2, '0') +
    ':' +
    String(value.getMinutes()).padStart(2, '0')
  );
}
