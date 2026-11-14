'use client';
import { useEffect } from 'react';
import { useLocalPreference } from '@/hooks/use-local-preference';
import { fontFamily, fontSize } from '@/lib/typography';
export function TypographyPreferences() {
  const [family] = useLocalPreference('vault-font-family', 'inter');
  const [size] = useLocalPreference('vault-font-size', 'default');
  useEffect(() => {
    document.documentElement.style.setProperty(
      '--vault-font-family',
      fontFamily(family).family,
    );
    document.documentElement.style.setProperty(
      '--vault-font-scale',
      String(fontSize(size).scale),
    );
  }, [family, size]);
  return null;
}
