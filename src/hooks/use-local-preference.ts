'use client';
import { useSyncExternalStore, useCallback } from 'react';
function subscribe(listener: () => void) {
  window.addEventListener('storage', listener);
  window.addEventListener('vault-preferences', listener);
  return () => {
    window.removeEventListener('storage', listener);
    window.removeEventListener('vault-preferences', listener);
  };
}
export function useLocalPreference(key: string, fallback: string) {
  const get = useCallback(
    () => localStorage.getItem(key) ?? fallback,
    [key, fallback],
  );
  const value = useSyncExternalStore(subscribe, get, () => fallback);
  function set(value: string) {
    localStorage.setItem(key, value);
    window.dispatchEvent(new Event('vault-preferences'));
  }
  return [value, set] as const;
}
