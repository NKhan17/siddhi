import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/inter';
import '@fontsource-variable/fraunces';
import '../src/styles/index.css';
import { PWARegister } from '../src/components/PWARegister';

export const metadata: Metadata = {
  title: 'Siddhi — IEP Tracking Platform',
  applicationName: 'Siddhi',
  description: 'Individualized Education Program tracking for schools and guardians.',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icons/siddhi.svg', apple: '/icons/siddhi.svg' },
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Siddhi' },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#f0f0eb',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {children}
        <PWARegister />
      </body>
    </html>
  );
}
