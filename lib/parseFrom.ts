export interface ParsedFrom {
  displayName: string | null;
  email: string;
}

export function parseFrom(from: string): ParsedFrom {
  const match = from.match(/^(.+?)\s*<([^>]+)>$/);
  if (match) {
    const name = match[1].trim();
    return { displayName: name || null, email: match[2].trim() };
  }
  return { displayName: null, email: from };
}
