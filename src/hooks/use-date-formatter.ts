'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { date } from '@/lib/client';
import { userTimeZone } from '@/lib/time';

const subscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

export function useDateFormatter() {
  // React uses the server snapshot for the first hydration render as well.
  const hydrated = useSyncExternalStore(
    subscribe,
    clientSnapshot,
    serverSnapshot,
  );
  const locale = hydrated ? navigator.language : 'en-US';
  const timeZone = hydrated ? userTimeZone() : 'Asia/Kolkata';

  return useCallback(
    (value: string | Date | null) => date(value, locale, timeZone),
    [locale, timeZone],
  );
}
