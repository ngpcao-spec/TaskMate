import { readFileSync } from 'fs';
import { join } from 'path';
import { DESTINATION_IMAGE_SLUGS, DISCOVERY_IMAGE_SLUGS, destinationImage, discoveryImage } from '@/components/adventure/adventureImages';
import { STORY_DESTINATIONS, storySituation } from '@/domain/panda-lines';
import en from '@/i18n/locales/en.json';
import fr from '@/i18n/locales/fr.json';
import vi from '@/i18n/locales/vi.json';

// Catalogue inséré par la migration 36 : chaque slug a son image (module unique) et son nom dans les trois langues.
const sql = readFileSync(join(__dirname, '../../../supabase/migrations/20260702000036_adventures.sql'), 'utf8');
const destinations = [...sql.matchAll(/\('([a-z-]+)', (\d), (\d)\)/g)].map((m) => m[1]!);
const discoveries = [...sql.matchAll(/\('([a-z-]+)', '([a-z-]+)', \d\)/g)].map((m) => ({ slug: m[1]!, destination: m[2]! }));

describe('catalogue des aventures (D-105)', () => {
  it('6 destinations et 30 trouvailles dans la migration', () => {
    expect(destinations).toEqual(['ha-long', 'hoi-an', 'mekong', 'da-lat', 'sa-pa', 'phong-nha']);
    expect(discoveries).toHaveLength(30);
    for (const d of discoveries) expect(d.slug.startsWith(`${d.destination}-`)).toBe(true);
  });
  it('chaque slug a son image, et seulement celles-là', () => {
    expect([...DESTINATION_IMAGE_SLUGS].sort()).toEqual([...destinations].sort());
    expect([...DISCOVERY_IMAGE_SLUGS].sort()).toEqual(discoveries.map((d) => d.slug).sort());
    expect(destinationImage('atlantide')).toBeNull();
    expect(discoveryImage('inconnu')).toBeNull();
  });
  it.each([
    ['vi', vi],
    ['fr', fr],
    ['en', en],
  ])('%s : noms de toutes les destinations et trouvailles', (_l, locale) => {
    const a = (locale as { adventure: { destinations: Record<string, string>; discoveries: Record<string, string> } }).adventure;
    for (const d of destinations) expect(a.destinations[d]?.trim()).toBeTruthy();
    for (const d of discoveries) expect(a.discoveries[d.slug]?.trim()).toBeTruthy();
  });
  it('noms vietnamiens naturels', () => {
    expect(vi.adventure.destinations['ha-long']).toBe('Vịnh Hạ Long');
    expect(vi.adventure.destinations['hoi-an']).toBe('Phố cổ Hội An');
    expect(vi.adventure.discoveries['ha-long-coquillage']).toBe('vỏ sò');
    expect(vi.adventure.discoveries['hoi-an-non-la']).toBe('nón lá');
    expect(vi.adventure.discoveries['hoi-an-lanterne']).toBe('đèn lồng');
    expect(vi.adventure.discoveries['da-lat-da-quy']).toBe('hoa dã quỳ');
  });
  it('une réplique de récit par destination', () => {
    expect([...STORY_DESTINATIONS]).toEqual(destinations);
    for (const d of destinations) expect(storySituation(d)).not.toBeNull();
  });
});
