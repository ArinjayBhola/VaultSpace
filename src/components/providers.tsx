'use client';
import { TypographyPreferences } from '@/components/typography-preferences';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ThemeProvider } from 'next-themes';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { MotionConfig } from 'motion/react';
export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: 1, staleTime: 15000 } },
      }),
  );
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <TypographyPreferences />
      <QueryClientProvider client={client}>
        <TooltipProvider>
          <MotionConfig reducedMotion="user">{children}</MotionConfig>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
