export interface InternalStructureJSON {
    title: string;
    items: string[];
}

export interface TraitJSON {
    name: string;
    points: number;
    notes: string;
    reference: string;
}

export interface SkillJSON {
    name: string;
    level: number;
    points: number;
    base: string;
    notes: string;
}

export interface AttributeJSON {
    name: string;
    level: string;
    points: number;
}

export interface GearJSON {
    name: string;
    quantity: number;
    weight: string;
    cost: string;
    notes: string;
}

export interface HitLocationJSON {
    roll: string;
    location: string;
    dr: number;
    notes: string;
}

export interface RelationItem {
    name: string;
    relation: string;
}

export interface CharacterJSON {
    name: string;
    concept: string;
    significance: string;
    role: string;
    location?: string;
    locations?: string[];
    status: string;
    
    appearance: string;
    appearances?: string[];
    personality: string;
    motivation: string;
    speech: string;

    relations?: { name: string; relationship: string }[];
    
    characterRelations?: RelationItem[];
    locationRelations?: RelationItem[];
    factionRelations?: RelationItem[];
    storyAppearances?: string[];

    pointTotal: string;
    attributes: AttributeJSON[];
    advantages: TraitJSON[];
    disadvantages: TraitJSON[];
    skills: SkillJSON[];
    gear: GearJSON[];
    
    tactics: string;
    hitLocations: HitLocationJSON[];
    pcHooks: string;
    gmSummary: string;
    images: string[];
    variations: string[];
}

export interface LocationJSON {
    name: string;
    type: string;
    region: string;
    techLevel: string;
    manaLevel: string;
    
    images: string[];
    overview: string;
    landmarks: string[];
    
    internalStructure: InternalStructureJSON[];
    
    factions?: string[];
    notableNpcs?: string[];
    plotHooks?: string[];

    characterRelations?: RelationItem[];
    locationRelations?: RelationItem[];
    factionRelations?: RelationItem[];
    storyAppearances?: string[];
}

export interface StoryJSON {
    title: string;
    type: "Episode" | "Chapter" | "Encounter" | "Story";
    status: string;
    primaryLocation: string;
    images: string[];

    gmBrief: string;
    premise: string;
    objectives: string;
    
    stakesAndAntagonists: string;
    mechanicsAndHazards: string;
    cluesAndProps: string;
    rewards: string;

    mainOutline: string;
    branchingPath: string;
    
    childLinks: string;

    outcomes: string;
    pcHooks: string;
    assumptions: string;
    openQuestions: string;

    characters?: string[];
    locations?: string[];
    factions?: string[];
}

export interface FactionJSON {
    name: string;
    type: string;
    status: string;
    headquarters: string;
    leader: string;
    allies?: string[];
    enemies?: string[];
    overview: string;
    goals: string;
    assets: string[];
    notableMembers?: string[];
    images: string[];

    characterRelations?: RelationItem[];
    locationRelations?: RelationItem[];
    factionRelations?: RelationItem[];
    storyAppearances?: string[];
}

export interface WorldDossierJSON {
    name: string;
    setting: string;
    themes: string[];
    overview: string;
    coreConflicts: string;
    cosmology: string;
    magicOrTech: string;
    factions: string[];
    keyLocations: string[];
    images: string[];
}

export interface CampaignOverviewJSON {
    title: string;
    concept: string;
    tone: string;
    players: string[];
    pcs: string[];
    currentStatus: string;
    synopsis: string;
    majorArcs: string[];
    images: string[];
}

export interface SystemRulesJSON {
    title: string;
    baseSystem: string;
    coreBooks: string[];
    houseRules: string;
    allowedOptions: string;
    forbiddenOptions: string;
    pointBudget: string;
    customMechanics: string;
}

export interface StateJSON {
    campaignName: string;
    currentDate: string;
    currentLocation: string;
    activeQuests: string[];
    recentEvents: string[];
    inventory: string[];
    reputation: string;
    notes: string;
}
