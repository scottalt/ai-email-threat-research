import type { Metadata, Viewport } from 'next';
import { Geist_Mono } from 'next/font/google';
import { ServiceWorker } from '@/components/ServiceWorker';
import { TerminalSounds } from '@/components/TerminalSounds';
import { PlayerProvider } from '@/lib/PlayerContext';
import { Analytics } from '@vercel/analytics/next';
import './globals.css';

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Retro Phish',
  description: 'A retro terminal game and live research study on AI-generated email detection in 2026.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Retro Phish',
  },
  openGraph: {
    title: 'Can You Spot the Threat?',
    description: 'Can you spot a malicious email? A retro terminal game and live research study on AI-generated email detection.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Can You Spot the Threat?',
    description: 'A retro terminal game and live research study on AI-generated email detection.',
  },
};

export const viewport: Viewport = {
  themeColor: '#060c06',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body className={`${geistMono.variable} antialiased`}>
        <ServiceWorker />
        <TerminalSounds />
        <div className="scanline-sweep" aria-hidden="true" />
        <PlayerProvider>
          {children}
        </PlayerProvider>
        <Analytics />
      </body>
    </html>
  );
}
