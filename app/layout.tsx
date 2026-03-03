import type { Metadata, Viewport } from 'next';
import { Geist_Mono } from 'next/font/google';
import { ServiceWorker } from '@/components/ServiceWorker';
import { PlayerProvider } from '@/lib/PlayerContext';
import './globals.css';

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Retro Phish',
  description: 'Can you spot a phishing attempt? A retro security awareness game.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Retro Phish',
  },
  openGraph: {
    title: 'Retro Phish',
    description: 'Can you spot a phishing attempt? A retro security awareness game.',
    type: 'website',
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
        <PlayerProvider>
          {children}
        </PlayerProvider>
      </body>
    </html>
  );
}
