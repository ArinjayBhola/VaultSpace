'use client';
import { TypographyPreferences } from '@/components/typography-preferences';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ThemeProvider } from 'next-themes';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { MotionConfig } from 'motion/react';
import { QUERY_STALE_TIME, QUERY_GC_TIME } from '@/lib/cache-policy';
export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            staleTime: QUERY_STALE_TIME,
            gcTime: QUERY_GC_TIME,
            refetchOnWindowFocus: false,
          },
        },
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
