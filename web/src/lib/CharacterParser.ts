import type { CharacterJSON } from './types';

/**
 * Parses the canonical Character JSON data structure.
 */
export function parseCharacter(content: string): CharacterJSON | null {
  try {
    const data = JSON.parse(content);
    
    // Safety fallback just in case old markdown leaks in during transition
    if (typeof data !== 'object' || Array.isArray(data)) return null;

    return data as CharacterJSON;
  } catch (e) {
    console.error("Failed to parse Character JSON:", e);
    return null;
  }
}
