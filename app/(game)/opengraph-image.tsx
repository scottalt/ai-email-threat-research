import { ImageResponse } from 'next/og';
import { readFileSync } from 'fs';
import { join } from 'path';

export const alt = 'Threat Terminal — Season 0. Head-to-head PvP phishing detection. Can you spot the fake?';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OGImage() {
  const fontData = readFileSync(join(process.cwd(), 'app', 'fonts', 'JetBrainsMono-Regular.ttf'));

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: '#0a120a',
          fontFamily: 'GeistMono',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Scanlines */}
        <div
          style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundImage: 'repeating-linear-gradient(0deg, rgba(0,255,65,0.03) 0px, rgba(0,255,65,0.03) 1px, transparent 1px, transparent 3px)',
          }}
        />
        {/* Vignette */}
        <div
          style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.6) 100%)',
          }}
        />
        {/* Border */}
        <div
          style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            border: '2px solid rgba(0,255,65,0.3)',
          }}
        />

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '20px',
            position: 'relative',
          }}
        >
          <div style={{ fontSize: '72px', fontWeight: 900, color: '#00ff41', textShadow: '0 0 20px rgba(0,255,65,0.6), 0 0 60px rgba(0,255,65,0.2)', letterSpacing: '0.08em', lineHeight: 1 }}>
            THREAT TERMINAL
          </div>
          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{ fontSize: '14px', color: '#ff0080', letterSpacing: '0.3em', border: '1px solid rgba(255,0,128,0.4)', padding: '4px 12px' }}>SEASON 0</div>
            <div style={{ fontSize: '14px', color: '#ffaa00', letterSpacing: '0.3em', border: '1px solid rgba(255,170,0,0.4)', padding: '4px 12px' }}>V2.0</div>
          </div>
          <div style={{ fontSize: '22px', color: '#3cc462', letterSpacing: '0.05em', textAlign: 'center' }}>
            AI-generated phishing emails. Can you tell which are real?
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [{ name: 'GeistMono', data: fontData, style: 'normal' as const, weight: 400 }],
    },
  );
}
