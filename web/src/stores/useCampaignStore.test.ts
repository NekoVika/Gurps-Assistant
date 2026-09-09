import { describe, it, expect, vi, beforeEach } from 'vitest';

const api = vi.hoisted(() => ({
  getCampaignSettings: vi.fn(), getFileTree: vi.fn(), getFileContent: vi.fn(),
  getCampaignRegistry: vi.fn(), createBatchStubs: vi.fn(), saveCampaignSettings: vi.fn(),
  initCampaign: vi.fn(), validateCampaign: vi.fn(), browseCampaignFolder: vi.fn(),
  deleteCampaignFile: vi.fn(), renameCampaignEntity: vi.fn(), writeFileContent: vi.fn(),
  mendFileString: vi.fn(),
}));
vi.mock('../lib/api', () => api);

import { useCampaignStore } from './useCampaignStore';

const ENCOUNTER_PATH = "Campaign/03_Story/Ep/Ch/Encounters/Flooded.json";
const encounter = JSON.stringify({ title: "Flooded Passages Entry", type: "Encounter", childLinks: [] });
const created = { created: 1, paths: ["Campaign/02_Characters/Main_Cast/Rick.json"], skipped: [] };

beforeEach(() => {
  vi.clearAllMocks();
  api.getFileTree.mockResolvedValue([]);
  api.getCampaignRegistry.mockResolvedValue([]);
  api.getFileContent.mockResolvedValue({ path: "x", content: "{}" });
  useCampaignStore.setState({
    selectedPath: ENCOUNTER_PATH,
    selectedFile: { path: ENCOUNTER_PATH, content: encounter } as any,
    stubPrompt: { name: "Rick", type: "Character" },
    stubNotice: null,
  });
});

describe("creating a stub from where the GM is standing", () => {
  it("sends the inferred placement with the request", async () => {
    api.createBatchStubs.mockResolvedValue(created);
    await useCampaignStore.getState().executeCreateStub();
    expect(api.createBatchStubs).toHaveBeenCalledWith([
      expect.objectContaining({ name: "Rick", story_node: "Flooded Passages Entry", story_mode: "appearance" }),
    ]);
  });

  it("leaves the GM where they were by default", async () => {
    // "Rick exists, moving on" is the common case; an empty sheet is the interruption.
    api.createBatchStubs.mockResolvedValue(created);
    await useCampaignStore.getState().executeCreateStub();
    expect(useCampaignStore.getState().selectedPath).toBe(ENCOUNTER_PATH);
    expect(useCampaignStore.getState().stubPrompt).toBeNull();
  });

  it("opens the new file only when asked to", async () => {
    api.createBatchStubs.mockResolvedValue(created);
    await useCampaignStore.getState().executeCreateStub(true);
    expect(useCampaignStore.getState().selectedPath).toBe("Campaign/02_Characters/Main_Cast/Rick.json");
  });

  it("keeps the prompt open and shows why when the name is refused", async () => {
    useCampaignStore.setState({ stubPrompt: { name: "Chapter 04", type: "Chapter" } });
    api.createBatchStubs.mockResolvedValue({
      created: 0, paths: [], skipped: [],
      rejected: [{ name: "Chapter 04", reason: "“Chapter 04” is a category, not a name." }],
    });
    await useCampaignStore.getState().executeCreateStub();
    const state = useCampaignStore.getState();
    expect(state.stubPrompt).not.toBeNull();
    expect(state.stubNotice).toContain("category");
  });

  it("clears an old refusal when a new prompt opens", () => {
    useCampaignStore.setState({ stubNotice: "stale" });
    useCampaignStore.getState().setStubPrompt({ name: "Mara", type: "Character" });
    expect(useCampaignStore.getState().stubNotice).toBeNull();
  });
});
