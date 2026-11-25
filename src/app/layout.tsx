import type { Metadata, Viewport } from 'next';
import { Poppins } from 'next/font/google';
import './globals.css';

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-poppins',
});

export const metadata: Metadata = {
  title: 'DompetTenang — Catatan Keuangan Pribadi Offline-First',
  description:
    'Aplikasi catatan keuangan ringan & offline-first untuk gaji tetap, freelance, maupun penghasilan serabutan.',
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#2d6a4f' },
    { media: '(prefers-color-scheme: dark)', color: '#0e1311' },
  ],
  width: 'device-width',
  initialScale: 1,
};

// Skrip mini anti-flash agar tema gelap langsung aktif sebelum React terhidrasi
const themeInitScript = `
(function() {
  try {
    var mode = localStorage.getItem('dompet_tenang_theme') || 'system';
    var isDark = mode === 'dark' || (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (isDark) document.documentElement.classList.add('dark');
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={poppins.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className={`${poppins.className} min-h-screen antialiased pb-24`}>{children}</body>
    </html>
  );
}
