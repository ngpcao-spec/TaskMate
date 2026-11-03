import { createTestQueryClient } from '../test-utils/queryClient';
import { subscribeFamilyRealtime } from '@/sync/realtime';

/**
 * Faux client fidèle à realtime-js 2.x : `channel(topic)` RENVOIE le canal existant du même nom, et `.on()` après `subscribe()` lève
 * « cannot add `postgres_changes` callbacks … after `subscribe()` » (erreur vue sur iPhone juste après la connexion). Le retrait est asynchrone :
 * le canal reste dans la liste jusqu'à la fin du désabonnement.
 */
type Chan = { topic: string; subscribed: boolean; on: () => Chan; subscribe: () => Chan };
const mockChannels: Chan[] = [];
const mockCreated: string[] = [];
const mockRemoved: string[] = [];
jest.mock('@/api/supabase', () => ({
  supabase: {
    channel: (name: string) => {
      const topic = `realtime:${name}`;
      const existing = mockChannels.find((c) => c.topic === topic);
      if (existing) return existing;
      const chan: Chan = {
        topic,
        subscribed: false,
        on() {
          if (chan.subscribed) throw new Error(`cannot add \`postgres_changes\` callbacks for ${topic} after \`subscribe()\`.`);
          return chan;
        },
        subscribe() {
          chan.subscribed = true;
          return chan;
        },
      };
      mockChannels.push(chan);
      mockCreated.push(topic);
      return chan;
    },
    // retrait asynchrone : le canal n'est PAS retiré de la liste tout de suite
    removeChannel: (c: Chan) => {
      mockRemoved.push(c.topic);
      return new Promise(() => undefined);
    },
  },
}));

describe('temps réel : abonnements partagés (plus d’écran d’erreur après la connexion)', () => {
  beforeEach(() => {
    mockChannels.length = 0;
    mockCreated.length = 0;
    mockRemoved.length = 0;
  });

  it('deux écrans s’abonnent en même temps à la même famille : un seul canal, aucune erreur', () => {
    const client = createTestQueryClient();
    let a: () => void = () => undefined;
    let b: () => void = () => undefined;
    expect(() => {
      a = subscribeFamilyRealtime(client, 'fam-1');
      b = subscribeFamilyRealtime(client, 'fam-1');
    }).not.toThrow();
    expect(mockCreated).toHaveLength(1);
    a();
    expect(mockRemoved).toHaveLength(0); // l'autre écran l'utilise encore
    b();
    expect(mockRemoved).toHaveLength(1);
    b(); // deuxième appel sans effet
    expect(mockRemoved).toHaveLength(1);
  });

  it('se réabonner pendant le retrait (asynchrone) du canal précédent : un canal neuf, aucune erreur', () => {
    const client = createTestQueryClient();
    subscribeFamilyRealtime(client, 'fam-1')();
    expect(() => subscribeFamilyRealtime(client, 'fam-1')).not.toThrow();
    expect(mockCreated).toHaveLength(2);
    expect(mockCreated[0]).not.toBe(mockCreated[1]);
  });

  it('familles différentes : un canal chacune', () => {
    const client = createTestQueryClient();
    subscribeFamilyRealtime(client, 'fam-1');
    subscribeFamilyRealtime(client, 'fam-2');
    expect(mockCreated).toHaveLength(2);
  });
});
