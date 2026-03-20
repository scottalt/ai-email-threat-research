import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-inter',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-jetbrains',
});

export const metadata: Metadata = {
  title: 'Threat Terminal — Can You Spot AI-Generated Phishing?',
  description: 'Test your phishing detection skills. A live research study measuring how humans detect AI-generated email threats. Free, takes 5 minutes.',
  openGraph: {
    title: 'Can You Spot AI-Generated Phishing?',
    description: 'Grammar is perfect. Spelling is flawless. The only way to catch modern phishing is forensic analysis. Test your skills and contribute to real research.',
    type: 'website',
  },
};

export default function LandingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${inter.variable} ${jetbrainsMono.variable}`}
      style={{
        background: '#09090b',
        color: '#fafafa',
        fontFamily: 'var(--font-inter), system-ui, -apple-system, sans-serif',
        minHeight: '100vh',
      }}
    >
      {children}
    </div>
  );
}
