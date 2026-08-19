export const DEMO_OWNER_PASSWORD_HASH = '61b3caffc1520baf3a0712539b9458348ddf21fa11e5feddd711e6ed270d5a40';

async function subtleHash(input: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const enc = new TextEncoder().encode(input);
    const buf = await crypto.subtle.digest('SHA-256', enc);
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  let h = 5381;
  for (let i = 0; i < input.length; i++) h = (h * 33) ^ input.charCodeAt(i);
  return (h >>> 0).toString(16);
}

export async function hashPassword(plain: string): Promise<string> {
  const salt = 'trh-demo-salt-v1';
  return subtleHash(`${salt}::${plain}`);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  const candidate = await hashPassword(plain);
  if (candidate.length !== hash.length) return false;
  let diff = 0;
  for (let i = 0; i < candidate.length; i++) diff |= candidate.charCodeAt(i) ^ hash.charCodeAt(i);
  return diff === 0;
}
