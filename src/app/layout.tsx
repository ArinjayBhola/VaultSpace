import type { Metadata } from 'next';
import { Providers } from '@/components/providers';
import './globals.css';
import './design.css';
import '@fontsource-variable/inter';
import '@fontsource-variable/dm-sans';
import '@fontsource-variable/manrope';
export const metadata: Metadata = {
  title: {
    default: 'VAULTSPACE — Your private cloud',
    template: '%s · VAULTSPACE',
  },
  description: 'A private, intelligent space for everything worth keeping.',
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
