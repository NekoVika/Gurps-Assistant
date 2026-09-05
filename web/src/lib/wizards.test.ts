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
