import type { FactionJSON } from './types';

/**
 * Parses the canonical Faction JSON data structure.
 */
export function parseFaction(content: string): FactionJSON | null {
  try {
    const data = JSON.parse(content);
    if (typeof data !== 'object' || Array.isArray(data)) return null;

    return data as FactionJSON;
  } catch (e) {
    console.error("Failed to parse Faction JSON:", e);
    return null;
  }
}
