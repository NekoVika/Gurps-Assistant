import { describe, it, expect } from 'vitest';
import { WIZARDS, expandArmorCoverage } from './wizards';

const storyWizard = WIZARDS.find(w => w.id === 'story_wizard')!;

function stubTargetPath(answers: Record<string, string>): string {
  const target = storyWizard.stubTargetPath!;
  return typeof target === 'function' ? target(answers) : target;
}

describe('story_wizard stubTargetPath', () => {
  it('places Episodes in their own Episode_ directory', () => {
    const path = stubTargetPath({ ElementType: 'Episode', Name: 'Sewer Descent' });
    expect(path).toBe('Campaign/03_Story/Episode_Sewer_Descent/Episode_Overview.json');
  });

  it('places Chapters under their parent episode', () => {
    const path = stubTargetPath({
      ElementType: 'Chapter', Name: 'The Lower Drains', ParentEpisode: 'Episode_Sewer_Descent',
    });
    expect(path).toBe('Campaign/03_Story/Episode_Sewer_Descent/Chapter_The_Lower_Drains/Chapter_Overview.json');
  });

  it('places Encounters under their parent chapter Encounters folder', () => {
    const path = stubTargetPath({
      ElementType: 'Encounter', Name: 'Drone Defense',
      ParentEpisode: 'Episode_Sewer_Descent', ParentChapter: 'Chapter_The_Lower_Drains',
    });
    expect(path).toBe('Campaign/03_Story/Episode_Sewer_Descent/Chapter_The_Lower_Drains/Encounters/Drone_Defense.json');
  });
});

describe('expandArmorCoverage', () => {
  it('returns all 13 GURPS hit locations with DR 0 defaults', () => {
    const rows = expandArmorCoverage(undefined);
    expect(rows).toHaveLength(13);
    expect(rows.every(r => r.includes('DR 0'))).toBe(true);
  });

  it('applies provided coverage entries', () => {
    const rows = expandArmorCoverage({ skull: { dr: 4, source: 'Helmet' } });
    const skull = rows.find(r => r.toLowerCase().startsWith('skull'));
    expect(skull).toContain('DR 4');
    expect(skull).toContain('Helmet');
  });
});

describe('create_npc fills everything it should in one pass', () => {
  const npc = WIZARDS.find(w => w.id === 'create_npc')!;
  const schema = npc.outputSchema as {
    properties: Record<string, unknown>;
    required: string[];
  };

  // A field in `properties` but not in `required` is one the model may silently
  // omit, and the GM reads the blank as the feature failing. There are only two
  // reasons a field may be optional.

  /** Guessing one invents a link to something that does not exist. */
  const GM_PLACEMENT = [
    'location', 'storyAppearances',
    'characterRelations', 'locationRelations', 'factionRelations',
    'images',
  ];
  /** Writing one would put words in the GM's own voice. */
  const GM_VOICE = ['gmSummary', 'variations'];

  it('asks for every field that is not the GM to set', () => {
    const optional = Object.keys(schema.properties).filter(k => !schema.required.includes(k));
    expect(optional.sort()).toEqual([...GM_PLACEMENT, ...GM_VOICE].sort());
  });

  it('requires kind, which postProcess depends on', () => {
    // postProcess tests `kind === "type"` to clear significance; if the model
    // omits kind, a bestiary template keeps whatever significance it picked.
    expect(schema.required).toContain('kind');
    const cleared = npc.postProcess!({ kind: 'type', significance: 'core' });
    expect(cleared.significance).toBe('');
  });

  it('tells the model not to invent a place or a person', () => {
    const prompt = npc.aiPromptTemplate({ Name: 'Rick', EntityType: 'NPC' });
    expect(prompt).toMatch(/Leave these EMPTY/);
    for (const field of GM_PLACEMENT) {
      expect(prompt).toContain(field);
    }
  });
});
