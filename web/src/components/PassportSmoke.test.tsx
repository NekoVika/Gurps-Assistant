import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

import { CharacterPassport } from './CharacterPassport';
import { LocationPassport } from './LocationPassport';
import { FactionPassport } from './FactionPassport';
import { StoryPassport } from './StoryPassport';

import { parseCharacter } from '../lib/CharacterParser';
import { parseLocation } from '../lib/LocationParser';
import { parseFaction } from '../lib/FactionParser';
import { parseStory } from '../lib/StoryParser';

// Render-only smoke tests: each passport must render a template-shaped
// document (what the wizards/stubs produce) without throwing.

function loadTemplate(name: string, overrides: Record<string, unknown>): string {
  // vitest runs with cwd = web/; templates live at the repo root
  const data = JSON.parse(readFileSync(`../.planning/_templates/${name}`, 'utf-8'));
  return JSON.stringify({ ...data, ...overrides });
}

describe('Passport smoke renders', () => {
  it('CharacterPassport renders NPC template', () => {
    const parsed = parseCharacter(loadTemplate('NPC_Template.json', { name: 'Grim Bartender' }));
    expect(parsed).toBeTruthy();
    const { container } = render(<CharacterPassport data={parsed!} documentPath="Campaign/02_Characters/Main_Cast/Grim_Bartender.json" onUpdate={() => {}} onNavigate={() => {}} />);
    expect(container.firstChild).not.toBeNull();
  });

  it('LocationPassport renders Location template', () => {
    const parsed = parseLocation(loadTemplate('Location_Template.json', { name: 'Old Docks' }));
    expect(parsed).toBeTruthy();
    const { container } = render(<LocationPassport data={parsed!} documentPath="Campaign/01_World_Bible/Locations/Old_Docks.json" onNavigate={() => {}} />);
    expect(container.firstChild).not.toBeNull();
  });

  it('FactionPassport renders Faction template', () => {
    const parsed = parseFaction(loadTemplate('Faction_Template.json', { name: 'Iron Ring' }));
    expect(parsed).toBeTruthy();
    const { container } = render(<FactionPassport data={parsed!} documentPath="Campaign/01_World_Bible/Factions/Iron_Ring.json" onNavigate={() => {}} />);
    expect(container.firstChild).not.toBeNull();
  });

  it('StoryPassport renders Episode template', () => {
    const parsed = parseStory(loadTemplate('Episode_Template.json', { title: 'Sewer Descent', type: 'Episode' }));
    expect(parsed).toBeTruthy();
    expect(screen).toBeTruthy();
    const { container } = render(<StoryPassport data={parsed!} documentPath="Campaign/03_Story/Episode_Sewer_Descent/Episode_Overview.json" onNavigate={() => {}} />);
    expect(container.firstChild).not.toBeNull();
  });
});
