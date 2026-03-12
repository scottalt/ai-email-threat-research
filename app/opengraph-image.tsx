import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Retro Phish — Can you spot the malicious email?';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#060c06',
          fontFamily: 'monospace',
          position: 'relative',
        }}
      >
        {/* Border */}
        <div
          style={{
            position: 'absolute',
            top: 30,
            left: 40,
            right: 40,
            bottom: 30,
            border: '1.5px solid rgba(0, 255, 65, 0.35)',
            borderRadius: 4,
            display: 'flex',
          }}
        />

        {/* Header bar */}
        <div
          style={{
            position: 'absolute',
            top: 30,
            left: 40,
            right: 40,
            height: 50,
            borderBottom: '1px solid rgba(0, 255, 65, 0.35)',
            display: 'flex',
            alignItems: 'center',
            paddingLeft: 25,
            paddingRight: 25,
            justifyContent: 'space-between',
          }}
        >
          <span style={{ color: '#00aa28', fontSize: 14, letterSpacing: 3 }}>
            ANALYST_TERMINAL v2.1
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: '#00ff41',
                boxShadow: '0 0 8px #00ff41',
              }}
            />
            <span style={{ color: '#003a0e', fontSize: 14, letterSpacing: 2 }}>LIVE</span>
          </div>
        </div>

        {/* Main content */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            marginTop: -20,
          }}
        >
          {/* Title */}
          <div
            style={{
              fontSize: 72,
              fontWeight: 900,
              color: '#00ff41',
              letterSpacing: 6,
              textShadow: '0 0 20px rgba(0, 255, 65, 0.6), 0 0 40px rgba(0, 255, 65, 0.2)',
            }}
          >
            RETRO PHISH
          </div>

          {/* Subtitle */}
          <div
            style={{
              fontSize: 22,
              color: '#00aa28',
              letterSpacing: 4,
              marginTop: 12,
            }}
          >
            CAN YOU SPOT THE THREAT?
          </div>

          {/* Divider */}
          <div
            style={{
              width: 500,
              height: 1,
              backgroundColor: 'rgba(0, 255, 65, 0.25)',
              marginTop: 30,
              marginBottom: 30,
            }}
          />

          {/* Stats display */}
          <div
            style={{
              display: 'flex',
              gap: 30,
              marginTop: 10,
            }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                border: '1px solid rgba(0, 255, 65, 0.2)',
                borderRadius: 3,
                backgroundColor: '#0a140a',
                padding: '16px 32px',
                gap: 4,
              }}
            >
              <span style={{ color: '#003a0e', fontSize: 12, letterSpacing: 2 }}>EMAILS ANALYZED</span>
              <span style={{ color: '#00ff41', fontSize: 36, fontWeight: 900 }}>10,000+</span>
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                border: '1px solid rgba(0, 255, 65, 0.2)',
                borderRadius: 3,
                backgroundColor: '#0a140a',
                padding: '16px 32px',
                gap: 4,
              }}
            >
              <span style={{ color: '#003a0e', fontSize: 12, letterSpacing: 2 }}>AVG ACCURACY</span>
              <span style={{ color: '#ffaa00', fontSize: 36, fontWeight: 900 }}>??%</span>
            </div>
          </div>

          {/* CTA */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 320,
              height: 50,
              border: '1.5px solid rgba(0, 255, 65, 0.6)',
              borderRadius: 3,
              color: '#00ff41',
              fontSize: 18,
              fontWeight: 'bold',
              letterSpacing: 4,
              marginTop: 30,
            }}
          >
            PLAY NOW
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            position: 'absolute',
            bottom: 50,
            color: '#003a0e',
            fontSize: 13,
            letterSpacing: 2,
          }}
        >
          A CYBERSECURITY RESEARCH GAME
        </div>
      </div>
    ),
    { ...size }
  );
}
