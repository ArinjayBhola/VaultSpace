import type { Metadata } from 'next';
import { Providers } from '@/components/providers';
import './globals.css';
import './design.css';
import '@fontsource-variable/inter';
import '@fontsource-variable/dm-sans';
import '@fontsource-variable/manrope';
import '@fontsource-variable/nunito';
import '@fontsource-variable/source-sans-3';
import '@fontsource-variable/lora';
import '@fontsource-variable/caveat';
import '@fontsource/kalam/400.css';
import '@fontsource/kalam/700.css';
import '@fontsource/patrick-hand/400.css';
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
