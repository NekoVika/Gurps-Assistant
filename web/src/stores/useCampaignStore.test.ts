import { describe, it, expect, vi, beforeEach } from 'vitest';

const api = vi.hoisted(() => ({
  getCampaignSettings: vi.fn(), getFileTree: vi.fn(), getFileContent: vi.fn(),
  getCampaignRegistry: vi.fn(), createBatchStubs: vi.fn(), saveCampaignSettings: vi.fn(),
  initCampaign: vi.fn(), validateCampaign: vi.fn(), browseCampaignFolder: vi.fn(),
  deleteCampaignFile: vi.fn(), renameCampaignEntity: vi.fn(), writeFileContent: vi.fn(),
  getTraitCatalogue: vi.fn().mockResolvedValue({ available: false, reason: 'no rules db in tests', books: [], traits: [] }),
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

describe("following a link to an entity that exists", () => {
  const registry = [
    { id: "Missing_Hunter_NPC", title: "Missing Hunter (NPC)", path: "Campaign/02_Characters/Main_Cast/Missing_Hunter_NPC.json", type: "" },
    { id: "The_Watch", title: "The Watch", path: "Campaign/01_World_Bible/Factions/The_Watch.json", type: "" },
  ];

  beforeEach(() => {
    useCampaignStore.setState({ entityRegistry: registry as any, fileTree: [], stubPrompt: null, selectedPath: "" });
  });

  it("opens the file when the name resolves, however it is spelled", async () => {
    // The chip renders blue because the registry resolves it; navigation must
    // agree, or clicking offers to create something that already exists.
    await useCampaignStore.getState().handleNavigateTo("Missing Hunter (NPC)");
    expect(useCampaignStore.getState().selectedPath).toContain("Missing_Hunter_NPC.json");
    expect(useCampaignStore.getState().stubPrompt).toBeNull();
  });

  it.each(["missing hunter (npc)", "Missing_Hunter_NPC", "Missing Hunter"])(
    "resolves the variant %p to the same file",
    async (variant) => {
      await useCampaignStore.getState().handleNavigateTo(variant);
      expect(useCampaignStore.getState().selectedPath).toContain("Missing_Hunter_NPC.json");
    }
  );

  it("still offers a stub for a name nothing backs", async () => {
    await useCampaignStore.getState().handleNavigateTo("Nobody At All", "Character");
    expect(useCampaignStore.getState().stubPrompt).toEqual({ name: "Nobody At All", type: "Character" });
    expect(useCampaignStore.getState().selectedPath).toBe("");
  });
});

describe("making a skill on a sheet into a campaign skill", () => {
  const rules = { title: "Anomaly Hunters", pointBudget: "150",
    customTraits: [{ name: "Struggling", kind: "disadvantage", cost: "-5" }] };
  const skill = { name: "Rumour-Mongering", attr: "IQ", difficulty: "A", defaults: "IQ-5" };

  beforeEach(() => {
    api.getFileContent.mockResolvedValue({ path: "Campaign/System_Rules.json", content: JSON.stringify(rules) });
    api.writeFileContent.mockResolvedValue({ success: true });
  });

  it("adds it to System Rules and keeps everything already there", async () => {
    const result = await useCampaignStore.getState().declareCampaignSkill(skill);
    expect(result.ok).toBe(true);
    const [path, content] = api.writeFileContent.mock.calls[0];
    expect(path).toBe("Campaign/System_Rules.json");
    const written = JSON.parse(content);
    expect(written.customSkills).toEqual([skill]);
    expect(written.customTraits).toEqual(rules.customTraits);
    expect(written.pointBudget).toBe("150");
  });

  it("does not declare the same skill twice", async () => {
    api.getFileContent.mockResolvedValue({ path: "x", content: JSON.stringify({ ...rules, customSkills: [skill] }) });
    const result = await useCampaignStore.getState().declareCampaignSkill({ ...skill, name: "rumour-mongering" });
    expect(result.ok).toBe(false);
    expect(api.writeFileContent).not.toHaveBeenCalled();
  });

  it("writes nothing when System Rules cannot be read", async () => {
    api.getFileContent.mockResolvedValue({ path: "x", content: "not json" });
    const result = await useCampaignStore.getState().declareCampaignSkill(skill);
    expect(result.ok).toBe(false);
    expect(api.writeFileContent).not.toHaveBeenCalled();
  });
});
