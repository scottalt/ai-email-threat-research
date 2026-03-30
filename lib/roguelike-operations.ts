const ADJECTIVES = [
  'GLASS', 'DEAD', 'COLD', 'DARK', 'BLIND', 'GHOST', 'IRON', 'SILENT',
  'BROKEN', 'BLACK', 'FROZEN', 'HOLLOW', 'LOST', 'SHADOW', 'BURNT', 'SPLIT',
  'DEEP', 'THIN', 'SHARP', 'GRAY', 'FADING', 'HIDDEN', 'PALE', 'STATIC',
  'WIRED', 'COVERT', 'RAPID', 'FINAL', 'ROGUE', 'ZERO',
] as const;

const NOUNS = [
  'NEEDLE', 'CIRCUIT', 'SIGNAL', 'VORTEX', 'THREAD', 'CIPHER', 'FRACTURE',
  'PULSE', 'VECTOR', 'TRACE', 'PRISM', 'LATTICE', 'SPARK', 'RELAY', 'BREACH',
  'VERTEX', 'HORIZON', 'STATIC', 'PAYLOAD', 'SOCKET', 'MIRROR', 'NEXUS',
  'DRIFT', 'SURGE', 'CASCADE', 'FLARE', 'ECHO', 'PHANTOM', 'SERPENT', 'ANVIL',
] as const;

export function generateOperationName(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  return `OPERATION: ${adj} ${noun}`;
}
