import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'DompetTenang — Catatan Keuangan Pribadi Offline-First',
  description:
    'Aplikasi catatan keuangan ringan & offline-first untuk gaji tetap, freelance, maupun penghasilan serabutan.',
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  themeColor: '#2d6a4f',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className="min-h-screen antialiased pb-24">{children}</body>
    </html>
  );
}
