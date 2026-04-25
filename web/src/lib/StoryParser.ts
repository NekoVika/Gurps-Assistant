import type { StoryJSON } from './types';

/**
 * Parses the canonical Story JSON data structure.
 */
export function parseStory(content: string): StoryJSON | null {
  try {
    const data = JSON.parse(content);
    if (typeof data !== 'object' || Array.isArray(data)) return null;

    return data as StoryJSON;
  } catch (e) {
    console.error("Failed to parse Story JSON:", e);
    return null;
  }
}
