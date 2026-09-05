import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CampaignRegistry } from './CampaignRegistry';
import { useCampaignStore } from '../stores/useCampaignStore';
import type { FileTreeNode, RegistryItem } from '../lib/api';

const FILE_CONTENTS: Record<string, string> = {
  'Campaign/03_Story/Campaign_Overview.json': JSON.stringify({ title: 'My Campaign', childLinks: ['Pilot'] }),
  'Campaign/03_Story/Episode_Pilot/Episode_Overview.json': JSON.stringify({
    title: 'Pilot', type: 'Episode', childLinks: ['First Steps', 'Ghost Chapter'],
  }),
  'Campaign/03_Story/Episode_Pilot/Chapter_First_Steps/Chapter_Overview.json': JSON.stringify({
    title: 'First Steps', type: 'Chapter', childLinks: [],
  }),
};

vi.mock('../lib/api', () => ({
  getFileContent: vi.fn((path: string) =>
    Promise.resolve({ path, content: FILE_CONTENTS[path] ?? '{}' })),
  getFileTree: vi.fn().mockResolvedValue([]),
  getCampaignRegistry: vi.fn().mockResolvedValue([]),
  createBatchStubs: vi.fn().mockResolvedValue({ created: 0, paths: [], skipped: [] }),
  getCampaignSettings: vi.fn().mockResolvedValue({}),
  saveCampaignSettings: vi.fn(),
  initCampaign: vi.fn(),
  validateCampaign: vi.fn(),
  browseCampaignFolder: vi.fn(),
  deleteCampaignFile: vi.fn(),
  renameCampaignEntity: vi.fn(),
  writeFileContent: vi.fn(),
  mendFileString: vi.fn(),
}));

const file = (path: string, title?: string): FileTreeNode => ({
  path, name: path.split('/').pop()!, node_type: 'file', children: [], title,
});
const dir = (path: string, children: FileTreeNode[]): FileTreeNode => ({
  path, name: path.split('/').pop()!, node_type: 'directory', children,
});

const TREE: FileTreeNode[] = [
  dir('Campaign', [
    file('Campaign/state.json'),
    dir('Campaign/02_Characters', [
      dir('Campaign/02_Characters/PCs', [file('Campaign/02_Characters/PCs/Hero.json', 'Hero')]),
      dir('Campaign/02_Characters/Main_Cast', [file('Campaign/02_Characters/Main_Cast/Grim.json', 'Grim')]),
    ]),
    dir('Campaign/01_World_Bible', [
      dir('Campaign/01_World_Bible/Locations', [file('Campaign/01_World_Bible/Locations/Docks.json', 'Docks')]),
      dir('Campaign/01_World_Bible/Factions', [file('Campaign/01_World_Bible/Factions/Ring.json', 'Ring')]),
    ]),
    dir('Campaign/03_Story', [
      file('Campaign/03_Story/Campaign_Overview.json', 'My Campaign'),
      dir('Campaign/03_Story/Episode_Pilot', [
        file('Campaign/03_Story/Episode_Pilot/Episode_Overview.json', 'Pilot'),
        dir('Campaign/03_Story/Episode_Pilot/Chapter_First_Steps', [
          file('Campaign/03_Story/Episode_Pilot/Chapter_First_Steps/Chapter_Overview.json', 'First Steps'),
        ]),
      ]),
    ]),
    // Matches no curated bucket -> must land in Unsorted, not vanish
    dir('Campaign/notes', [file('Campaign/notes/Random_Ideas.json', 'Random Ideas')]),
  ]),
];

const REGISTRY: RegistryItem[] = [
  { id: 'Hero', title: 'Hero', path: 'Campaign/02_Characters/PCs/Hero.json', type: 'Unknown' },
  { id: 'Grim', title: 'Grim', path: 'Campaign/02_Characters/Main_Cast/Grim.json', type: 'Unknown' },
  { id: 'Docks', title: 'Docks', path: 'Campaign/01_World_Bible/Locations/Docks.json', type: 'Unknown' },
  { id: 'Ring', title: 'Ring', path: 'Campaign/01_World_Bible/Factions/Ring.json', type: 'Unknown' },
  { id: 'Episode_Overview', title: 'Pilot', path: 'Campaign/03_Story/Episode_Pilot/Episode_Overview.json', type: 'Episode' },
  { id: 'Chapter_Overview', title: 'First Steps', path: 'Campaign/03_Story/Episode_Pilot/Chapter_First_Steps/Chapter_Overview.json', type: 'Chapter' },
];

describe('CampaignRegistry', () => {
  beforeEach(() => {
    useCampaignStore.setState({ entityRegistry: REGISTRY });
  });

  it('renders every entity in its curated section', async () => {
    render(<CampaignRegistry tree={TREE} selectedPath="" onSelect={() => {}} />);
    for (const name of ['Hero', 'Grim', 'Docks', 'Ring']) {
      expect(await screen.findByText(name)).toBeInTheDocument();
    }
    expect(await screen.findByText(/Pilot/)).toBeInTheDocument();
    expect(await screen.findByText(/First Steps/)).toBeInTheDocument();
  });

  it('shows out-of-bucket files under Unsorted instead of dropping them', async () => {
    render(<CampaignRegistry tree={TREE} selectedPath="" onSelect={() => {}} />);
    const header = await screen.findByText(/Unsorted/);
    fireEvent.click(header); // section is collapsed by default
    expect(await screen.findByText('Random Ideas')).toBeInTheDocument();
  });

  it('renders unresolved childLinks as ghost proposed rows', async () => {
    render(<CampaignRegistry tree={TREE} selectedPath="" onSelect={() => {}} />);
    expect(await screen.findByText('Ghost Chapter')).toBeInTheDocument();
    expect((await screen.findAllByText(/\(proposed\)/)).length).toBeGreaterThan(0);
  });
});
