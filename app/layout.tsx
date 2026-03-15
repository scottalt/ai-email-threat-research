import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { ServiceWorker } from '@/components/ServiceWorker';
import { TerminalSounds } from '@/components/TerminalSounds';
import { PlayerProvider } from '@/lib/PlayerContext';
import { NavVisibilityProvider } from '@/lib/NavVisibilityContext';
import { NavBar } from '@/components/NavBar';
import { Analytics } from '@vercel/analytics/next';
import './globals.css';

const geistMono = localFont({
  src: './fonts/GeistMono-Latin.woff2',
  variable: '--font-geist-mono',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://research.scottaltiparmak.com'),
  title: {
    default: 'Threat Terminal — Can You Spot the Threat?',
    template: '%s | Threat Terminal',
  },
  description: 'Test your phishing detection skills in this retro terminal game. A live research study measuring how humans detect AI-generated email threats in 2026.',
  keywords: ['phishing', 'cybersecurity', 'email security', 'AI', 'research study', 'terminal game', 'social engineering', 'threat detection'],
  manifest: '/manifest.json',
  alternates: {
    canonical: '/',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Threat Terminal',
  },
  openGraph: {
    siteName: 'Threat Terminal',
    title: 'Can You Spot the Threat?',
    description: 'Can you spot a malicious email? Test your phishing detection skills in this retro terminal game and live research study.',
    type: 'website',
    locale: 'en_US',
    url: '/',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Can You Spot the Threat?',
    description: 'Test your phishing detection skills in this retro terminal game. A live research study on AI-generated email detection.',
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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'WebApplication',
              name: 'Threat Terminal',
              url: 'https://research.scottaltiparmak.com',
              description: 'Test your phishing detection skills in this retro terminal game. A live research study measuring how humans detect AI-generated email threats.',
              applicationCategory: 'GameApplication',
              operatingSystem: 'Any',
              offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
              author: {
                '@type': 'Person',
                name: 'Scott Altiparmak',
                url: 'https://scottaltiparmak.com',
              },
            }),
          }}
        />
      </head>
      <body className={`${geistMono.variable} antialiased`}>
        <ServiceWorker />
        <TerminalSounds />
        <div className="scanline-sweep" aria-hidden="true" />
        <PlayerProvider>
          <NavVisibilityProvider>
            <NavBar />
            {children}
          </NavVisibilityProvider>
        </PlayerProvider>
        <Analytics />
      </body>
    </html>
  );
}
