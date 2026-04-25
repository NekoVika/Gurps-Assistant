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

export interface RelationJSON {
    name: string;
    relationship: string;
}

export interface CharacterJSON {
    name: string;
    concept: string;
    significance: string;
    role: string;
    location: string;
    locations?: string[];
    status: string;
    
    appearance: string;
    appearances?: string[];
    personality: string;
    motivation: string;
    speech: string;

    relations?: RelationJSON[];

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
    
    factions: string[];
    notableNpcs: string[];
    plotHooks: string[];
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
}
