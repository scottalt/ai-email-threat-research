import { readFileSync } from 'fs';
import { join } from 'path';

export const alt = 'Threat Terminal — One of these emails is fake. Can you tell which? Most players get it wrong.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OGImage() {
  const imageBuffer = readFileSync(join(process.cwd(), 'public', 'og-image.png'));
  return new Response(imageBuffer, {
    headers: { 'Content-Type': 'image/png' },
  });
}
