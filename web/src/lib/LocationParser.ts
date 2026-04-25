import type { LocationJSON } from './types';

/**
 * Parses the canonical Location JSON data structure.
 */
export function parseLocation(content: string): LocationJSON | null {
  try {
    const data = JSON.parse(content);
    if (typeof data !== 'object' || Array.isArray(data)) return null;

    return data as LocationJSON;
  } catch (e) {
    console.error("Failed to parse Location JSON:", e);
    return null;
  }
}
