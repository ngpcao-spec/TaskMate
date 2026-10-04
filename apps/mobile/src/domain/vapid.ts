/** Génération d'une paire de clés VAPID (Web Push) avec WebCrypto — 100 % locale : rien n'est stocké ni envoyé. */

const b64url = (bytes: Uint8Array): string => {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const fromB64url = (s: string): Uint8Array => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4)), (c) => c.charCodeAt(0));

export type VapidKeys = { publicKey: string; privateKey: string };

/** publique = point non compressé P-256 (0x04 ‖ x ‖ y, 65 octets) ; privée = d (32 octets), tous deux en base64url. */
export async function generateVapidKeys(subtle: SubtleCrypto = globalThis.crypto.subtle): Promise<VapidKeys> {
  const pair = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const jwk = await subtle.exportKey('jwk', pair.privateKey);
  if (!jwk.x || !jwk.y || !jwk.d) throw new Error('jwk incomplet');
  const raw = new Uint8Array(65);
  raw[0] = 0x04;
  raw.set(fromB64url(jwk.x), 1);
  raw.set(fromB64url(jwk.y), 33);
  return { publicKey: b64url(raw), privateKey: jwk.d };
}
