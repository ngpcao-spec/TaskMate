// Génère une paire de clés VAPID (Web Push). Usage : node scripts/generate-vapid.mjs
// La clé PUBLIQUE va dans EXPO_PUBLIC_VAPID_PUBLIC_KEY (Vercel) ; la PRIVÉE uniquement dans les secrets Supabase
// (`supabase secrets set VAPID_PUBLIC_KEY=… VAPID_PRIVATE_KEY=… VAPID_SUBJECT=mailto:vous@exemple.com`). Ne jamais la committer.
import { generateKeyPairSync } from 'node:crypto';

const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const pub = publicKey.export({ format: 'jwk' });
const priv = privateKey.export({ format: 'jwk' });
const b64u = (s) => s;
const publicRaw = Buffer.concat([Buffer.from([0x04]), Buffer.from(pub.x, 'base64url'), Buffer.from(pub.y, 'base64url')]).toString('base64url');
console.log(`VAPID_PUBLIC_KEY=${b64u(publicRaw)}`);
console.log(`VAPID_PRIVATE_KEY=${b64u(priv.d)}`);
