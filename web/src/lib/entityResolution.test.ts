import { describe, it, expect } from 'vitest';
import {
  normalizeEntityName,
  isPlaceholderName,
  isReferenceName,
  entityExists,
  resolveEntity,
  findMissingEntities,
} from './entityResolution';
import type { RegistryItem } from './api';

// Mirrors tests/test_link_resolver.py — keep both suites in sync with the
// backend resolver in src/gurpsai/app/services/link_resolver.py.
const REGISTRY: RegistryItem[] = [
  { id: 'The_Watch', title: 'The Watch', path: 'Campaign/01_World_Bible/Factions/The_Watch.json', type: 'Faction' },
  { id: 'Grim_Bartender', title: 'Grim Bartender', path: 'Campaign/02_Characters/Main_Cast/Grim_Bartender.json', type: 'Unknown' },
  { id: 'Chapter_Overview', title: 'The Lower Drains', path: 'Campaign/03_Story/Episode_S/Chapter_The_Lower_Drains/Chapter_Overview.json', type: 'Chapter' },
  { id: 'Ambush', title: '2. Ambush', path: 'Campaign/03_Story/Episode_S/Chapter_X/Encounters/Ambush.json', type: 'Encounter' },
];

describe('normalizeEntityName', () => {
  it('strips case, underscores, extensions and ordinal prefixes', () => {
    expect(normalizeEntityName('The_Watch')).toBe('the watch');
    expect(normalizeEntityName('The Watch.json')).toBe('the watch');
    expect(normalizeEntityName('2. Ambush')).toBe('ambush');
    expect(normalizeEntityName('03_Ambush')).toBe('ambush');
    expect(normalizeEntityName('  Spaced   Name ')).toBe('spaced name');
  });
});

describe('isPlaceholderName', () => {
  it('treats placeholders and non-strings as non-references', () => {
    for (const v of ['', '  ', 'TBD', 'tbd', 'None', 'N/A', '?']) {
      expect(isPlaceholderName(v)).toBe(true);
    }
    expect(isPlaceholderName(null)).toBe(true);
    expect(isPlaceholderName(42)).toBe(true);
    expect(isPlaceholderName('The Watch')).toBe(false);
  });
});

describe('isReferenceName', () => {
  it('rejects prose from legacy markdown-migrated arrays', () => {
    expect(isReferenceName('**Dominant Faction:** None (Natural Predators).')).toBe(false);
    expect(isReferenceName('x'.repeat(120))).toBe(false);
    expect(isReferenceName('TBD')).toBe(false);
    expect(isReferenceName('The Watch')).toBe(true);
    expect(isReferenceName('Chapter 01: Descent into Filth')).toBe(true);
  });
});

describe('resolveEntity / entityExists', () => {
  it('matches exactly and case-insensitively', () => {
    expect(resolveEntity(REGISTRY, 'The Watch')?.path).toContain('The_Watch.json');
    expect(entityExists(REGISTRY, 'the watch')).toBe(true);
    expect(entityExists(REGISTRY, 'THE_WATCH')).toBe(true);
  });

  it('resolves ordinal-prefixed names to sanitized stubs', () => {
    expect(entityExists(REGISTRY, '2. Ambush')).toBe(true);
    expect(entityExists(REGISTRY, 'Ambush')).toBe(true);
  });

  it('does not resolve placeholders or missing names', () => {
    expect(entityExists(REGISTRY, 'TBD')).toBe(false);
    expect(entityExists(REGISTRY, '')).toBe(false);
    expect(entityExists(REGISTRY, 'Ghost Chapter')).toBe(false);
  });

  it('resolves story directory names to the files inside them', () => {
    const registry = [
      ...REGISTRY,
      { id: 'Chapter_Overview', title: 'The Drainage Awakening', path: 'Campaign/03_Story/Episode_03/Chapter_01/Chapter_Overview.json', type: 'Chapter' },
      { id: 'Episode_Overview', title: 'Watcher of the Rain', path: 'Campaign/03_Story/Episode_03/Episode_Overview.json', type: 'Episode' },
    ];
    expect(entityExists(registry, 'Chapter 01')).toBe(true);
    expect(entityExists(registry, 'Chapter_01')).toBe(true);
    expect(entityExists(registry, 'Episode 03')).toBe(true);
    expect(entityExists(registry, 'Main Cast')).toBe(false);
  });

  it('accepts tail matches only when unique', () => {
    const registry = [
      ...REGISTRY,
      { id: 'Iron_Watch', title: 'Iron Watch', path: 'Campaign/01_World_Bible/Factions/Iron_Watch.json', type: 'Faction' },
      { id: 'Night_Watch', title: 'Night Watch', path: 'Campaign/01_World_Bible/Factions/Night_Watch.json', type: 'Faction' },
    ];
    expect(entityExists(registry, 'Watch')).toBe(false);
    expect(entityExists(registry, 'Bartender')).toBe(true);
  });
});

describe('findMissingEntities', () => {
  it('returns only real missing names, deduped', () => {
    const missing = findMissingEntities(REGISTRY, [
      'The Watch', 'Ghost Chapter', 'Ghost Chapter', 'TBD', '', 42, 'the_watch',
    ]);
    expect(missing).toEqual(['Ghost Chapter']);
  });
});
