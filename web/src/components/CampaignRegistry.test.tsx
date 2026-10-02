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
  getStoryScope: vi.fn(async (node: string) => ({
    node,
    lineage: [node],
    // Only Grim and Docks belong to this scene; Hero and Ring do not.
    members: [
      { name: 'Grim', via: 'pinned', placed_at: node, path: '' },
      { name: 'Docks', via: 'inherited', placed_at: 'Pilot', path: '' },
    ],
  })),
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
      dir('Campaign/02_Characters/Main_Cast', [
        file('Campaign/02_Characters/Main_Cast/Grim.json', 'Grim'),
        file('Campaign/02_Characters/Main_Cast/Vagrant.json', 'Vagrant'),
      ]),
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
    useCampaignStore.setState({ entityRegistry: REGISTRY, focusNode: null });
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

  describe('focusing the sidebar on one scene', () => {
    it('lists only the cast in scope, and says what it is focused on', async () => {
      // The GM running one encounter does not need every NPC in the campaign.
      useCampaignStore.setState({ entityRegistry: REGISTRY, focusNode: 'First Steps' });
      render(<CampaignRegistry tree={TREE} selectedPath="" onSelect={() => {}} />);

      expect(await screen.findByText('Grim')).toBeInTheDocument();
      expect(await screen.findByText('Docks')).toBeInTheDocument();
      // Narrowing is real: an NPC outside the scene is dropped.
      expect(screen.queryByText('Vagrant')).not.toBeInTheDocument();
      expect(screen.getByText(/Focused on/)).toBeInTheDocument();
    });

    it('leaves a section whole when scope cannot speak about it', async () => {
      // Scope admits an entity by its shape, so a faction can never be a
      // member -- and filtering factions by it emptied the section outright.
      // Same for the party: no PC is in this scene's scope, and making the
      // GM's own characters vanish reads as the sidebar breaking.
      useCampaignStore.setState({ entityRegistry: REGISTRY, focusNode: 'First Steps' });
      render(<CampaignRegistry tree={TREE} selectedPath="" onSelect={() => {}} />);

      expect(await screen.findByText('Ring')).toBeInTheDocument();
      expect(await screen.findByText('Hero')).toBeInTheDocument();
    });

    it('leaves the story arcs navigable while focused', async () => {
      // Narrowing who is listed must not strand the GM in the scene.
      useCampaignStore.setState({ entityRegistry: REGISTRY, focusNode: 'First Steps' });
      render(<CampaignRegistry tree={TREE} selectedPath="" onSelect={() => {}} />);
      expect(await screen.findByText(/Pilot/)).toBeInTheDocument();
    });

    it('restores the whole campaign when focus is dropped', async () => {
      useCampaignStore.setState({ entityRegistry: REGISTRY, focusNode: 'First Steps' });
      render(<CampaignRegistry tree={TREE} selectedPath="" onSelect={() => {}} />);
      fireEvent.click(await screen.findByText('show all'));
      expect(await screen.findByText('Hero')).toBeInTheDocument();
      expect(useCampaignStore.getState().focusNode).toBeNull();
    });

    it('shows everything when scope cannot be loaded', async () => {
      // Failing open is wrong but harmless; failing closed looks like data loss.
      const api = await import('../lib/api');
      (api.getStoryScope as any).mockRejectedValueOnce(new Error('offline'));
      useCampaignStore.setState({ entityRegistry: REGISTRY, focusNode: 'First Steps' });
      render(<CampaignRegistry tree={TREE} selectedPath="" onSelect={() => {}} />);
      expect(await screen.findByText('Hero')).toBeInTheDocument();
    });
  });
});
