export interface StoryPlacementJSON {
    /** Episode, chapter or encounter name. Empty means unplaced. */
    node: string;
    /** "appearance" rolls upward only; "fixture" is present throughout, including descendants. */
    mode: "appearance" | "fixture";
}

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
    kind?: "individual" | "type" | "pc";
    significance: "" | "core" | "supporting" | "featured" | "background";
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
    storyPlacement?: StoryPlacementJSON;
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
    storyPlacement?: StoryPlacementJSON;
    parentLocation?: string;
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
    
    childLinks?: string[] | string;

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
    worldType: string;
    scaleOfPlay: string;
    baselineTL: string;
    baselineMana: string;
    toneAndGenre: string;
    themes: string[];
    elevatorPitch: string;
    worldMeta: string;
    corePremises: string[];
    physicalReality: string;
    metaphysics: string;
    peopleAndCulture: string;
    deepLore: string;
    tags: string[];
    images: string[];
}

export interface CampaignOverviewJSON {
    title: string;
    status: string;
    toneAndGenre: string;
    techAndMana: string;
    players: string[];
    pcs: string[];
    synopsis: string;
    episodeIndex: string;
    currentArcSummary: string;
    timelineBeats: string;
    openThreads: string;
    images: string[];
}

/** A trait this campaign invented. GURPS allows it, so the app has to. */
export interface CustomTraitJSON {
    name: string;
    /** advantage, disadvantage, skill, perk or quirk. */
    kind: string;
    /** As the GM writes it: "12", "-5", "2/level", "Variable". */
    cost: string;
    notes?: string;
}

/**
 * A skill this campaign invented, declared once with what the book's own
 * entries carry (B174): its controlling attribute and difficulty, which set
 * its price on every sheet through the Skill Cost Table (B170), and its
 * default.
 */
export interface CustomSkillJSON {
    name: string;
    /** ST, DX, IQ, HT, Per or Will. */
    attr: string;
    /** E, A, H or VH. */
    difficulty: string;
    /** A technological skill, learned at a tech level: written Name/TL8. */
    tl?: boolean;
    /** Must be learned with a specialty, as Survival (Arctic). */
    specialised?: boolean;
    /** As the book writes defaults: "IQ-5", "None". */
    defaults?: string;
    notes?: string;
}

/**
 * A Talent this campaign invented (B90, "Custom Talents"): a name and the
 * skills it covers. Its cost per level follows from how many skills that is,
 * so it is never typed.
 */
export interface CustomTalentJSON {
    name: string;
    skills: string[];
    notes?: string;
}

export interface SystemRulesJSON {
    title: string;
    /** Homebrew traits, priced by the GM. The catalogue is what the books say;
     *  this is what this table says, and it travels with the campaign. */
    customTraits?: CustomTraitJSON[];
    /** Homebrew skills: an attribute and a difficulty, priced like any skill. */
    customSkills?: CustomSkillJSON[];
    /** Homebrew Talents: a skill list, priced by its size (B90). */
    customTalents?: CustomTalentJSON[];
    baseSystem: string;
    coreBooks: string[];
    houseRules: string;
    allowedOptions: string;
    forbiddenOptions: string;
    pointBudget: string;
    customMechanics: string;
    
    // Editor fields
    corePrompt?: string;
    formattingRules?: string;
    mechanicsRules?: string;
    toneAndStyle?: string;
}

export interface StateJSON {
    campaignName: string;
    currentDate: string;
    currentLocation: string;
    activeQuests: string[];
    recentEvents: string[];
    inventory: string[];
    
    // Editor fields
    currentChapter?: string;
    inGameDate?: string;
    partyStatus?: string;
    flags?: string[];
    gmNotes?: string[];
    reputation: string;
    notes: string;
}
