import { ImageResponse } from 'next/og';
import { type NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const size = parseInt(searchParams.get('size') || '512', 10);

  if (![192, 512].includes(size)) {
    return new Response('Invalid size. Use 192 or 512.', { status: 400 });
  }

  const fontSize = Math.round(size * 0.3);
  const borderWidth = Math.round(size * 0.015);
  const borderRadius = Math.round(size * 0.12);
  const innerRadius = Math.round(size * 0.1);
  const cursorWidth = Math.round(size * 0.06);
  const cursorHeight = Math.round(size * 0.09);

  return new ImageResponse(
    (
      <div
        style={{
          width: size,
          height: size,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#060c06',
          borderRadius: borderRadius,
          position: 'relative',
        }}
      >
        {/* Border */}
        <div
          style={{
            position: 'absolute',
            top: borderWidth * 2,
            left: borderWidth * 2,
            right: borderWidth * 2,
            bottom: borderWidth * 2,
            border: `${borderWidth}px solid rgba(0, 255, 65, 0.4)`,
            borderRadius: innerRadius,
            display: 'flex',
          }}
        />

        {/* Scan line accent */}
        <div
          style={{
            position: 'absolute',
            top: Math.round(size * 0.18),
            left: Math.round(size * 0.15),
            right: Math.round(size * 0.15),
            height: Math.round(size * 0.06),
            backgroundColor: 'rgba(0, 255, 65, 0.08)',
            borderRadius: 2,
            display: 'flex',
          }}
        />

        {/* TT monogram */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            marginTop: Math.round(size * 0.05),
          }}
        >
          <span
            style={{
              fontSize: fontSize,
              fontFamily: 'monospace',
              fontWeight: 900,
              color: '#00ff41',
              letterSpacing: Math.round(size * 0.02),
              textShadow: `0 0 ${Math.round(size * 0.04)}px rgba(0, 255, 65, 0.6)`,
            }}
          >
            TT
          </span>
          {/* Blinking cursor */}
          <div
            style={{
              width: cursorWidth,
              height: cursorHeight,
              backgroundColor: '#00ff41',
              opacity: 0.8,
              marginLeft: Math.round(size * 0.01),
              marginTop: Math.round(size * 0.02),
              display: 'flex',
            }}
          />
        </div>

        {/* Bottom label */}
        <div
          style={{
            position: 'absolute',
            bottom: Math.round(size * 0.12),
            display: 'flex',
          }}
        >
          <span
            style={{
              fontSize: Math.round(size * 0.06),
              fontFamily: 'monospace',
              color: 'rgba(0, 255, 65, 0.35)',
              letterSpacing: Math.round(size * 0.02),
            }}
          >
            THREAT TERMINAL
          </span>
        </div>
      </div>
    ),
    { width: size, height: size }
  );
}
