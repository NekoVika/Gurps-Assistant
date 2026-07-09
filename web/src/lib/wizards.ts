export type WizardField = {
  id: string;
  label: string;
  type: "text" | "textarea" | "select" | "number" | "dynamic-select";
  options?: string[];
  optionsSource?: "episodes" | "chapters" | "encounters";
  placeholder?: string;
  required?: boolean;
  condition?: (answers: Record<string, string>) => boolean;
};

export type WizardStep = {
  title?: string;
  description?: string;
  fields: WizardField[];
  condition?: (answers: Record<string, string>) => boolean;
};

export type WizardDef = {
  id: string;
  title: string;
  description: string;
  steps: WizardStep[];
  aiPromptTemplate: string | ((answers: Record<string, string>) => string);
  stubTargetPath: string | ((answers: Record<string, string>) => string);
  stubTemplatePath: string | ((answers: Record<string, string>) => string);
  workflowPath?: string | ((answers: Record<string, string>) => string);
  /** When present, the wizard uses POST /chat/structured instead of streaming.
   *  The JSON Schema here is forwarded to the provider for schema enforcement.
   *  The returned dict is written directly to stubTargetPath. */
  outputSchema?: Record<string, any>;
  /** Optional Pydantic model name (e.g. "LocationData") in the backend to validate and sanitize the output. */
  pydanticModel?: string;
  /** Optional post-processing hook: transform the raw AI result dict before it is
   *  written to disk. Use this to expand compact AI representations into the full
   *  format expected by the backend Pydantic model (e.g. armorCoverage → hitLocations). */
  postProcess?: (result: Record<string, any>) => Record<string, any>;
};

// ---------------------------------------------------------------------------
// GURPS 4e standard hit location table — names and roll ranges are immutable.
// Only DR values are character-specific and are provided by the AI via armorCoverage.
// ---------------------------------------------------------------------------
export const GURPS_HIT_LOCATIONS: Array<{ key: string; label: string; roll: string }> = [
  { key: "eye",      label: "Eye",       roll: "-"     },
  { key: "skull",    label: "Skull",     roll: "3-4"   },
  { key: "face",     label: "Face",      roll: "5"     },
  { key: "rightLeg", label: "Right Leg", roll: "6-7"   },
  { key: "rightArm", label: "Right Arm", roll: "8"     },
  { key: "torso",    label: "Torso",     roll: "9-10"  },
  { key: "groin",    label: "Groin",     roll: "11"    },
  { key: "leftArm",  label: "Left Arm",  roll: "12"    },
  { key: "leftLeg",  label: "Left Leg",  roll: "13-14" },
  { key: "hand",     label: "Hand",      roll: "15"    },
  { key: "foot",     label: "Foot",      roll: "16"    },
  { key: "neck",     label: "Neck",      roll: "17-18" },
  { key: "vitals",   label: "Vitals",    roll: "-"     },
];

/** Expand a sparse armorCoverage object into a full 13-entry hitLocations string array. */
export function expandArmorCoverage(
  coverage: Record<string, { dr: number; source?: string }> | undefined
): string[] {
  return GURPS_HIT_LOCATIONS.map(({ key, label, roll }) => {
    const entry = coverage?.[key];
    const dr = entry?.dr ?? 0;
    const source = entry?.source ? ` - ${entry.source}` : "";
    return `${label} (${roll}): DR ${dr}${source}`;
  });
}

export const WIZARDS: WizardDef[] = [
  {
    id: "story_wizard",
    title: "Create Story Element",
    description: "Create an Episode, Chapter, or Encounter.",
    stubTargetPath: (answers) => {
      const type = answers.ElementType;
      let name = answers.Name ? answers.Name.replace(/ /g, "_") : "Untitled";
      if (type === "Episode") {
          if (!name.startsWith("Episode_")) name = "Episode_" + name;
          return `Campaign/03_Story/${name}/Episode_Overview.json`;
      }
      if (type === "Chapter") {
          if (!name.startsWith("Chapter_")) name = "Chapter_" + name;
          return `Campaign/03_Story/${answers.ParentEpisode || "Unknown_Episode"}/${name}/Chapter_Overview.json`;
      }
      if (type === "Encounter") return `Campaign/03_Story/${answers.ParentEpisode || "Unknown_Episode"}/${answers.ParentChapter || "Unknown_Chapter"}/Encounters/${name}.json`;
      return "Campaign/03_Story/Unknown.json";
    },
    stubTemplatePath: (answers) => {
      const type = answers.ElementType;
      if (type === "Episode") return ".planning/_templates/Episode_Template.json";
      if (type === "Chapter") return ".planning/_templates/Chapter_Template.json";
      return ".planning/_templates/Encounter_Template.json";
    },
    aiPromptTemplate: (answers) => {
      const type = answers.ElementType || "Story";
      const line = (label: string, value: string) => {
        if (!value || value.trim() === "" || /^\[.*\]$/.test(value.trim())) return null;
        return `- ${label}: ${value}`;
      };

      const required = [
        `- Element Type: ${type}`,
        `- Name: ${answers.Name}`,
      ];

      const optional = [
        line("Premise", answers.Premise),
        line("Objectives", answers.Objectives),
        line("Stakes", answers.Stakes),
        line("Hazards", answers.Hazards),
        line("Outcomes", answers.Outcomes),
        line("Theme / Tone", answers.Theme),
        line("Duration Estimate", answers.Duration),
        line("Encounter Type", answers.EncounterType),
        line("GM Notes", answers.GmNotes),
      ].filter(Boolean);

      const params = [...required, ...optional].join("\n");

      // Type-specific generation emphasis
      const typeGuidance: Record<string, string> = {
        Episode: [
          `\nThis is an EPISODE — the top-level narrative arc container.`,
          `Focus on: overarching premise, multi-session objectives, key antagonists and stakes,`,
          `a high-level main outline with 3-5 beats, branching possibilities, and a GM brief`,
          `that captures the secret truth of the episode.`,
          `The childLinks array should list planned Chapter names.`,
          `The characters/locations/factions arrays should list all entities that appear in this episode.`,
        ].join("\n"),
        Chapter: [
          `\nThis is a CHAPTER — a focused segment within an Episode (typically 1-2 sessions).`,
          `Focus on: concrete scene setup, beat-by-beat main outline (5-8 beats),`,
          `specific mechanics and hazards (skill checks, DCs, environmental dangers),`,
          `clues and props the PCs can find, and branching paths for player agency.`,
          `The childLinks array should list planned Encounter names.`,
          `The characters/locations/factions arrays should list entities appearing in this chapter.`,
        ].join("\n"),
        Encounter: [
          `\nThis is an ENCOUNTER — a single scene or challenge within a Chapter.`,
          `Focus on: specific trigger/premise, concrete mechanics and hazards`,
          `(skill checks with target numbers, combat stats, environmental effects),`,
          `detailed outcomes for success AND failure, rewards and loot,`,
          `and a vivid GM brief with read-aloud text.`,
          `The childLinks array should be empty for encounters.`,
          `The characters array should list NPCs/enemies present in this encounter.`,
        ].join("\n"),
      };

      return [
        `Generate a complete GURPS 4e campaign ${type} JSON with all required fields.\n`,
        `Parameters:\n${params}`,
        typeGuidance[type] || "",
        `\nReturn a COMPLETE JSON object matching the requested schema. Ensure all fields are filled with rich, creative details.`,
        `Output only the JSON object — no explanation, no markdown fences.`,
      ].filter(Boolean).join("\n");
    },
    outputSchema: {
      type: "object",
      properties: {
        title:                { type: "string", description: "Display name" },
        type:                 { type: "string", enum: ["Episode", "Chapter", "Encounter"] },
        status:               { type: "string", enum: ["Draft", "Active", "Complete"] },
        primaryLocation:      { type: "string", description: "Primary setting name" },
        images:               { type: "array", items: { type: "string" } },
        gmBrief:              { type: "string", description: "Secret GM-only summary" },
        premise:              { type: "string", description: "Starting situation and setup" },
        objectives:           { type: "string", description: "What the PCs need to achieve" },
        stakesAndAntagonists: { type: "string", description: "Who opposes them, what happens on failure" },
        mechanicsAndHazards:  { type: "string", description: "Key skill checks, DCs, dangers" },
        cluesAndProps:        { type: "string", description: "Information to uncover, items to find" },
        rewards:              { type: "string", description: "Loot, character points, favors" },
        mainOutline:          { type: "string", description: "Beat-by-beat outline" },
        branchingPath:        { type: "string", description: "Alternate paths if PCs deviate" },
        childLinks:           { type: "array", items: { type: "string" }, description: "Child elements" },
        outcomes:             { type: "string", description: "Resolution and consequences" },
        pcHooks:              { type: "string", description: "Why the party cares" },
        assumptions:          { type: "string", description: "Assumed PC actions" },
        openQuestions:        { type: "string", description: "Things the GM still needs to decide" },
        characters:           { type: "array", items: { type: "string" }, description: "Characters present" },
        locations:            { type: "array", items: { type: "string" }, description: "Locations present" },
        factions:             { type: "array", items: { type: "string" }, description: "Factions involved" },
      },
      required: ["title", "type", "status", "premise", "objectives"]
    },
    pydanticModel: "StoryData",
    steps: [
      {
        title: "Step 1: Element Type & Placement",
        fields: [
          {
            id: "ElementType",
            label: "What are you creating?",
            type: "select",
            options: ["Episode", "Chapter", "Encounter"],
            required: true
          },
          {
            id: "ParentEpisode",
            label: "Parent Episode",
            type: "dynamic-select",
            optionsSource: "episodes",
            required: true,
            condition: (answers) => answers.ElementType === "Chapter" || answers.ElementType === "Encounter"
          },
          {
            id: "ParentChapter",
            label: "Parent Chapter",
            type: "dynamic-select",
            optionsSource: "chapters",
            required: true,
            condition: (answers) => answers.ElementType === "Encounter"
          },
          {
            id: "Name",
            label: "Element Name",
            type: "text",
            required: true,
            placeholder: "Enter name..."
          }
        ]
      },
      {
        title: "Episode Context",
        condition: (answers) => answers.ElementType === "Episode",
        fields: [
          { id: "Premise", label: "Premise & Setup", type: "textarea", required: true, placeholder: "Starting situation — the inciting incident and the world state when the episode begins..." },
          { id: "Stakes", label: "Stakes & Antagonists", type: "textarea", placeholder: "Who opposes the PCs? What happens if they fail?" },
          { id: "Objectives", label: "Objectives", type: "textarea", required: true, placeholder: "What must be achieved to complete this episode?" },
          { id: "Theme", label: "Theme / Tone", type: "text", placeholder: "e.g., Noir investigation, Desperate survival, Political intrigue" },
          { id: "GmNotes", label: "GM Notes / Additional Context", type: "textarea", placeholder: "Any extra instructions, lore anchors, or constraints for the AI..." }
        ]
      },
      {
        title: "Chapter Context",
        condition: (answers) => answers.ElementType === "Chapter",
        fields: [
          { id: "Premise", label: "Starting Situation & Purpose", type: "textarea", required: true, placeholder: "Where does it start? What is the chapter's purpose within the episode?" },
          { id: "Objectives", label: "Key Objectives", type: "textarea", required: true, placeholder: "Specific goals the PCs should accomplish in this chapter..." },
          { id: "Hazards", label: "Mechanics & Hazards", type: "textarea", placeholder: "Environmental dangers, skill check DCs, combat encounters..." },
          { id: "Duration", label: "Duration Estimate", type: "select", options: ["Short (< 1 hour)", "Medium (1-2 hours)", "Long (2-3 hours)", "Full Session (3+ hours)"] },
          { id: "GmNotes", label: "GM Notes / Additional Context", type: "textarea", placeholder: "Any extra instructions, NPC behavior notes, or constraints..." }
        ]
      },
      {
        title: "Encounter Context",
        condition: (answers) => answers.ElementType === "Encounter",
        fields: [
          { id: "EncounterType", label: "Encounter Type", type: "select", options: ["Combat", "Social", "Exploration", "Puzzle", "Trap", "Chase", "Mixed"] },
          { id: "Premise", label: "Trigger / Scene Start", type: "textarea", required: true, placeholder: "How does this encounter begin? What triggers it?" },
          { id: "Hazards", label: "Mechanics & Hazards", type: "textarea", placeholder: "Skill checks with target numbers, combat stats, environmental effects..." },
          { id: "Outcomes", label: "Outcomes", type: "textarea", placeholder: "What happens on success? What happens on failure?" },
          { id: "GmNotes", label: "GM Notes / Additional Context", type: "textarea", placeholder: "Any extra instructions, NPC dialogue hooks, or constraints..." }
        ]
      },
      {
        title: "AI Generation Settings",
        description: "Control how creatively the AI generates this element.",
        fields: [
          { id: "CreativityLevel", label: "Creativity Level", type: "select", options: ["Balanced", "Strict", "Unrestricted"] },
          { id: "NarrativeIntent", label: "Narrative Intent", type: "textarea", placeholder: "e.g., 'Make this a fast transition to get to the main dungeon.'" }
        ]
      }
    ]
  },
  {
    id: "create_npc",
    title: "Create Entity",
    description: "Generates a fully statted GURPS 4e character sheet and narrative anchor for an NPC, PC, or Bestiary entity.",
    stubTargetPath: (answers) => `Campaign/02_Characters/Main_Cast/${answers.Name ? answers.Name.replace(/ /g, "_") : "Untitled"}.json`,
    stubTemplatePath: ".planning/_templates/NPC_Template.json",
    workflowPath: ".agents/workflows/create_npc.md",
    aiPromptTemplate: (answers) => {
      const type = answers.EntityType || "NPC";

      // Helper: only include a line if the value is non-empty and not a raw bracket placeholder.
      const line = (label: string, value: string) => {
        if (!value || value.trim() === "" || /^\[.*\]$/.test(value.trim())) return null;
        return `- ${label}: ${value}`;
      };

      const required = [
        `- Entity Type: ${type}`,
        `- Name: ${answers.Name}`,
        `- Concept: ${answers.Concept}`,
      ];

      const optional = [
        line("GM Description", answers.Description),
        line("Narrative Role", answers.Role),
        line("Significance", answers.Significance),
        line("Build Complexity", answers.Complexity),
        line("Key Focus", answers.Focus),
        line("Target Points", answers.Points),
        line("Required Advantages", answers.Advantages),
        line("Required Disadvantages", answers.Disadvantages),
        line("Key Skills", answers.Skills),
        line("Visuals", answers.Visuals),
        line("Constraints / Exceptions", answers.Exceptions),
      ].filter(Boolean);

      const params = [...required, ...optional].join("\n");

      const entityNote =
        type === "Bestiary"
          ? "\nThis is a Bestiary entry — include a Variations section with loadout kits, stat toggles (Rookie/Regular/Veteran/Elite), and behavior tags."
          : type === "PC"
          ? "\nThis is a Player Character sheet — focus on completeness and narrative integration over GM-facing notes."
          : "";

      return [
        `Generate a fully statted GURPS 4e ${type} with all required fields.\n`,
        `Parameters:\n${params}`,
        entityNote,
        `\nReturn a COMPLETE JSON object. Use these EXACT string formats for mechanical fields:`,
        `- attributes: array of strings like "ST 10 [0]", "DX 12 [40]", "Basic Speed 5.50 [0]"`,
        `- advantages: array of strings like "Combat Reflexes [15] - Reacts quickly (B43)"`,
        `- disadvantages: array of strings like "Curious [-5] - CR: 12 (B129)"`,
        `- skills: array of strings like "First Aid (IQ+0)-10 [1] - Field stabilization"`,
        `- gear: array of strings like "Medkit (2 lbs, $100) - First Aid kit"`,
        `- pointTotal: a string like "150"`,
        `- significance: the exact string provided above (e.g. "1 Extra")`,
        `- armorCoverage: a SPARSE object — only include locations where DR > 0. Keys are camelCase location names: eye, skull, face, rightLeg, rightArm, torso, groin, leftArm, leftLeg, hand, foot, neck, vitals. Each value is { "dr": <number>, "source": "<armor name>" }. Omit locations with DR 0 entirely.`,
        `\nOutput only the JSON object — no explanation, no markdown fences.`,
      ].filter(Boolean).join("\n");
    },
    outputSchema: {
      type: "object",
      properties: {
        name:               { type: "string" },
        concept:            { type: "string" },
        significance:       { type: "string" },
        role:               { type: "string" },
        location:           { type: "string" },
        status:             { type: "string" },
        appearance:         { type: "string" },
        personality:        { type: "string" },
        motivation:         { type: "string" },
        speech:             { type: "string" },
        pointTotal:         { type: "string" },
        // GURPS mechanical fields — all string arrays with strict formatting
        attributes: {
          type: "array",
          items: { type: "string" },
          description: "e.g. ['ST 10 [0]', 'DX 12 [40]', 'IQ 10 [0]', 'HT 10 [0]', 'HP 10 [0]', 'Will 10 [0]', 'Per 10 [0]', 'FP 10 [0]', 'Basic Speed 5.50 [0]', 'Basic Move 5 [0]']"
        },
        advantages: {
          type: "array",
          items: { type: "string" },
          description: "e.g. ['Combat Reflexes [15] - Reacts quickly (B43)']"
        },
        disadvantages: {
          type: "array",
          items: { type: "string" },
          description: "e.g. ['Curious [-5] - CR: 12 (B129)']"
        },
        skills: {
          type: "array",
          items: { type: "string" },
          description: "e.g. ['First Aid (IQ+0)-10 [1] - Field stabilization', 'Guns/TL9 (Pistol) (DX+1)-13 [2]']"
        },
        gear: {
          type: "array",
          items: { type: "string" },
          description: "e.g. ['Medkit (2 lbs, $100) - First Aid kit', 'Light Pistol [1] (1.5 lbs, $200) - 2d-1 pi']"
        },
        armorCoverage: {
          type: "object",
          description: "Sparse map of only the locations with DR > 0. Omit locations with DR 0.",
          properties: Object.fromEntries(
            ["eye","skull","face","rightLeg","rightArm","torso","groin","leftArm","leftLeg","hand","foot","neck","vitals"].map(k => [
              k,
              {
                type: "object",
                properties: {
                  dr:     { type: "integer" },
                  source: { type: "string"  },
                },
              }
            ])
          ),
        },
        tactics:           { type: "string" },
        pcHooks:           { type: "string" },
        gmSummary:         { type: "string" },
        characterRelations: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name:     { type: "string" },
              relation: { type: "string" }
            },
            required: ["name", "relation"]
          }
        },
        locationRelations: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name:     { type: "string" },
              relation: { type: "string" }
            },
            required: ["name", "relation"]
          }
        },
        factionRelations: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name:     { type: "string" },
              relation: { type: "string" }
            },
            required: ["name", "relation"]
          }
        },
        storyAppearances: { type: "array", items: { type: "string" } },
        images:           { type: "array", items: { type: "string" } },
        variations:       { type: "array", items: { type: "string" } },
      },
      required: [
        "name", "concept", "significance", "role",
        "appearance", "personality", "motivation",
        "pointTotal", "attributes", "advantages", "disadvantages",
        "skills", "gear", "armorCoverage", "tactics"
      ]
    },
    pydanticModel: "CharacterData",
    postProcess: (result) => {
      const { armorCoverage, ...rest } = result;
      return {
        ...rest,
        hitLocations: expandArmorCoverage(
          armorCoverage as Record<string, { dr: number; source?: string }> | undefined
        ),
      };
    },
    steps: [
      {
        title: "Step 1: Core Identity",
        description: "Define the fundamental identity and significance of the entity.",
        fields: [
          {
            id: "EntityType",
            label: "Entity Type",
            type: "select",
            options: ["NPC", "Bestiary", "PC"]
          },
          {
            id: "Name",
            label: "Entity Name",
            type: "text",
            required: true,
            placeholder: "e.g., Abella"
          },
          {
            id: "Concept",
            label: "Concept / Archetype",
            type: "text",
            required: true,
            placeholder: "e.g., Ex-military smuggling pilot"
          },
          {
            id: "Description",
            label: "GM Description",
            type: "textarea",
            placeholder: "Describe the NPC in your own words. The AI will use this to fill in the rest..."
          },
          {
            id: "Role",
            label: "Narrative Role",
            type: "select",
            options: ["Ally", "Enemy", "Contact", "Patron", "Neutral", "Mook"]
          },
          {
            id: "Significance",
            label: "Significance (0=Bestiary... 5=Keystone)",
            type: "select",
            options: ["1 Extra", "2 Supporting", "3 Featured", "4 Major", "5 Keystone", "0 Common Variant"]
          }
        ]
      },
      {
        title: "Step 2: Mechanics & Scope",
        description: "Set parameters for the mechanical build.",
        fields: [
          {
            id: "Complexity",
            label: "Build Complexity",
            type: "select",
            options: ["Standard", "Quick", "Detailed"]
          },
          {
            id: "Focus",
            label: "Key Focus",
            type: "select",
            options: ["Combat", "Social", "Support", "Specialist", "Mixed"]
          },
          {
            id: "Points",
            label: "Target Points",
            type: "text",
            placeholder: "e.g., 150, 250, Unknown"
          },
          {
            id: "Advantages",
            label: "Desired Advantages (Optional)",
            type: "textarea",
            placeholder: "e.g., Combat Reflexes, Wealth..."
          },
          {
            id: "Disadvantages",
            label: "Desired Disadvantages (Optional)",
            type: "textarea",
            placeholder: "e.g., Bloodlust, One Eye..."
          },
          {
            id: "Skills",
            label: "Key Skills (Optional)",
            type: "textarea",
            placeholder: "e.g., Piloting (Spacecraft), Guns (Pistol)..."
          }
        ]
      },
      {
        title: "Step 3: Narrative & Constraints",
        description: "Provide a visual anchor and any GM exceptions.",
        fields: [
          {
            id: "Visuals",
            label: "Visual Anchor",
            type: "textarea",
            placeholder: "Descriptive appearance to treat as absolute canon...",
            required: true
          },
          {
            id: "Exceptions",
            label: "Constraints / Exceptions",
            type: "textarea",
            placeholder: "e.g., No magic, must have a cybernetic arm."
          }
        ]
      },
      {
        title: "Step 4: AI Generation Settings",
        description: "Control how creatively the AI generates this entity.",
        fields: [
          { id: "CreativityLevel", label: "Creativity Level", type: "select", options: ["Balanced", "Strict", "Unrestricted"] },
          { id: "PlacementContext", label: "Placement Context (Episode)", type: "dynamic-select", optionsSource: "episodes" },
          { id: "NarrativeIntent", label: "Narrative Intent", type: "textarea", placeholder: "What is your main goal for this entity?" }
        ]
      }
    ]
  },
  {
    id: "create_location",
    title: "Create Location",
    description: "Design a new geographical point of interest, facility, or settlement.",
    stubTargetPath: (answers) => `Campaign/01_World_Bible/Locations/${answers.Name ? answers.Name.replace(/ /g, "_") : "Untitled"}.json`,
    stubTemplatePath: ".planning/_templates/Location_Template.json",
    workflowPath: ".agents/workflows/create_world_dossier.md",
    aiPromptTemplate: (answers) => {
      const line = (label: string, value: string) => {
        if (!value || value.trim() === "" || /^\[.*\]$/.test(value.trim())) return null;
        return `- ${label}: ${value}`;
      };

      const required = [
        `- Name: ${answers.Name}`,
      ];

      const optional = [
        line("Type", answers.Type),
        line("Region", answers.Region),
        line("Tech Level", answers.TechLevel),
        line("Mana Level", answers.ManaLevel),
        line("Vibe & Key Features", answers.Vibe),
        line("Notable NPCs", answers.NotableNpcs),
        line("Key Factions", answers.Factions),
        line("Plot Hooks", answers.PlotHooks),
        line("Constraints", answers.Constraints),
      ].filter(Boolean);

      const params = [...required, ...optional].join("\n");

      return [
        `Generate a complete GURPS 4e campaign location JSON with all required fields.\n`,
        `Parameters:\n${params}`,
        `\nReturn a COMPLETE JSON object matching the requested schema. Ensure all fields are filled with rich, creative details.`,
        `Output only the JSON object — no explanation, no markdown fences.`,
      ].filter(Boolean).join("\n");
    },
    outputSchema: {
      type: "object",
      properties: {
        name:           { type: "string", description: "Display name" },
        type:           { type: "string", enum: ["Building", "District", "Settlement", "Base", "Ruin", "Wilderness", "Vehicle", "Space Station", "Other"] },
        region:         { type: "string", description: "The broader area or world" },
        techLevel:      { type: "string", description: "e.g., TL9, Mixed" },
        manaLevel:      { type: "string", enum: ["None", "Low", "Normal", "High", "Very High"] },
        overview:       { type: "string", description: "Rich multi-paragraph description" },
        landmarks:      { type: "array", items: { type: "string" }, description: "Notable landmarks" },
        internalStructure: {
          type: "array",
          description: "List of zones/floors and their rooms",
          items: {
            type: "object",
            properties: { title: { type: "string" }, items: { type: "array", items: { type: "string" } } },
            required: ["title", "items"]
          }
        },
        factions:       { type: "array", items: { type: "string" }, description: "Present factions" },
        notableNpcs:    { type: "array", items: { type: "string" }, description: "Present NPCs" },
        plotHooks:      { type: "array", items: { type: "string" }, description: "Adventure seeds" },
        characterRelations: {
          type: "array",
          items: {
            type: "object",
            properties: { name: { type: "string" }, relation: { type: "string" } },
            required: ["name", "relation"],
          },
        },
        locationRelations: {
          type: "array",
          items: {
            type: "object",
            properties: { name: { type: "string" }, relation: { type: "string" } },
            required: ["name", "relation"],
          },
        },
        factionRelations: {
          type: "array",
          items: {
            type: "object",
            properties: { name: { type: "string" }, relation: { type: "string" } },
            required: ["name", "relation"],
          },
        },
        storyAppearances: { type: "array", items: { type: "string" } },
        images:           { type: "array", items: { type: "string" } },
      },
      required: ["name", "type", "region", "overview", "landmarks", "internalStructure", "plotHooks"],
    },
    pydanticModel: "LocationData",
    steps: [
      {
        title: "Step 1: Identity",
        description: "Name and classify this location.",
        fields: [
          { id: "Name",      label: "Location Name",  type: "text",   required: true, placeholder: "e.g., The Rust Yard" },
          { id: "Type",      label: "Location Type",  type: "select", options: ["Building", "District", "Settlement", "Base", "Ruin", "Wilderness", "Vehicle", "Space Station", "Other"] },
          { id: "Region",    label: "Region / World", type: "text",   placeholder: "e.g., Anchor World, Shard-7, City of Voss" },
          { id: "TechLevel", label: "Tech Level",     type: "select", options: ["TL4", "TL5", "TL6", "TL7", "TL8", "TL9", "TL10", "TL11", "Mixed", "Unknown"] },
          { id: "ManaLevel", label: "Mana Level",     type: "select", options: ["None", "Low", "Normal", "High", "Very High", "Mana Void", "Unknown"] },
        ],
      },
      {
        title: "Step 2: Details",
        description: "Describe the feel, people, and hooks of this location.",
        fields: [
          { id: "Vibe",       label: "Vibe & Key Features", type: "textarea", required: true, placeholder: "e.g., Grimy, neon-lit, guarded by automated turrets. Known for a black market in anomalous items." },
          { id: "NotableNpcs", label: "Notable NPCs (Optional)",  type: "textarea", placeholder: "e.g., Commander Voss, Black-market dealer Rin" },
          { id: "Factions",   label: "Key Factions (Optional)",   type: "textarea", placeholder: "e.g., Anomaly Hunters, Black Horde Remnants" },
          { id: "PlotHooks",  label: "Plot Hooks (Optional)",     type: "textarea", placeholder: "e.g., A Gate anomaly was detected here last week." },
          { id: "Constraints", label: "Constraints / GM Notes (Optional)", type: "textarea", placeholder: "e.g., No magic. Must include a collapsed section." },
        ],
      },
      {
        title: "Step 3: AI Generation Settings",
        description: "Control how creatively the AI generates this location.",
        fields: [
          { id: "CreativityLevel", label: "Creativity Level", type: "select", options: ["Balanced", "Strict", "Unrestricted"] },
          { id: "PlacementContext", label: "Placement Context (Episode)", type: "dynamic-select", optionsSource: "episodes" },
          { id: "NarrativeIntent", label: "Narrative Intent", type: "textarea", placeholder: "What is your main goal for this location?" }
        ]
      }
    ],
  },
  {
    id: "create_faction",
    title: "Create Faction",
    description: "Design a new faction, organization, or guild.",
    stubTargetPath: (answers) => `Campaign/01_World_Bible/Factions/${answers.Name ? answers.Name.replace(/ /g, "_") : "Untitled"}.json`,
    stubTemplatePath: ".planning/_templates/Faction_Template.json",
    aiPromptTemplate: (answers) => {
      const line = (label: string, value: string) => {
        if (!value || value.trim() === "" || /^\[.*\]$/.test(value.trim())) return null;
        return `- ${label}: ${value}`;
      };

      const required = [
        `- Name: ${answers.Name}`,
      ];

      const optional = [
        line("Type", answers.Type),
        line("Headquarters", answers.Headquarters),
        line("Leader", answers.Leader),
        line("Goals", answers.Goals),
        line("Overview", answers.Overview),
        line("Assets", answers.Assets),
        line("Allies", answers.Allies),
        line("Enemies", answers.Enemies),
        line("Notable Members", answers.NotableMembers),
        line("Reputation / Public Perception", answers.Reputation),
      ].filter(Boolean);

      const params = [...required, ...optional].join("\n");

      return [
        `Generate a complete GURPS 4e campaign faction JSON with all required fields.\n`,
        `Parameters:\n${params}`,
        `\nReturn a COMPLETE JSON object matching the requested schema. Ensure all fields are filled with rich, creative details.`,
        `Output only the JSON object — no explanation, no markdown fences.`,
      ].filter(Boolean).join("\n");
    },
    outputSchema: {
      type: "object",
      properties: {
        name:           { type: "string", description: "Display name of the faction" },
        type:           { type: "string", enum: ["Guild", "Military", "Corporation", "Cult", "Government", "Syndicate", "Other"] },
        status:         { type: "string", enum: ["Active", "Destroyed", "Secret", "Dormant", "Emerging"] },
        headquarters:   { type: "string", description: "Base of operations" },
        leader:         { type: "string", description: "Leader or ruling body" },
        allies:         { type: "array", items: { type: "string" } },
        enemies:        { type: "array", items: { type: "string" } },
        overview:       { type: "string", description: "Rich multi-paragraph description of history, culture, and public perception" },
        goals:          { type: "string", description: "What the faction wants to achieve" },
        assets:         { type: "array", items: { type: "string" }, description: "List of resources and assets" },
        notableMembers: { type: "array", items: { type: "string" } },
        images:         { type: "array", items: { type: "string" } },
        characterRelations: {
          type: "array",
          items: {
            type: "object",
            properties: { name: { type: "string" }, relation: { type: "string" } },
            required: ["name", "relation"],
          },
        },
        locationRelations: {
          type: "array",
          items: {
            type: "object",
            properties: { name: { type: "string" }, relation: { type: "string" } },
            required: ["name", "relation"],
          },
        },
        factionRelations: {
          type: "array",
          items: {
            type: "object",
            properties: { name: { type: "string" }, relation: { type: "string" } },
            required: ["name", "relation"],
          },
        },
        storyAppearances: { type: "array", items: { type: "string" } },
      },
      required: ["name", "type", "overview", "goals"]
    },
    pydanticModel: "FactionData",
    steps: [
      {
        title: "Step 1: Identity",
        description: "Core identity and leadership.",
        fields: [
          { id: "Name", label: "Faction Name", type: "text", required: true, placeholder: "e.g., The Black Horde" },
          { id: "Type", label: "Type", type: "select", options: ["Guild", "Military", "Corporation", "Cult", "Government", "Syndicate", "Other"] },
          { id: "Headquarters", label: "Headquarters", type: "text", placeholder: "e.g., The Rust Yard" },
          { id: "Leader", label: "Leader", type: "text", placeholder: "e.g., Commander Voss" }
        ]
      },
      {
        title: "Step 2: Details",
        description: "Motivations, resources, and standing.",
        fields: [
          { id: "Overview", label: "Overview & Vibe", type: "textarea", required: true, placeholder: "e.g., A ruthless mercenary company forged in the aftermath of the Gate Wars..." },
          { id: "Goals", label: "Primary Goals", type: "textarea", required: true, placeholder: "What do they want? What are they working toward?" },
          { id: "Assets", label: "Key Assets", type: "textarea", placeholder: "e.g., Heavy weapons, political influence, fleet of cargo ships..." },
          { id: "NotableMembers", label: "Notable Members", type: "textarea", placeholder: "e.g., Captain Reyes (field commander), Dr. Lun (chief scientist)..." },
          { id: "Reputation", label: "Reputation / Public Perception", type: "textarea", placeholder: "How are they seen by outsiders? What rumors surround them?" },
          { id: "Allies", label: "Allies", type: "text", placeholder: "e.g., Anomaly Hunters" },
          { id: "Enemies", label: "Enemies", type: "text", placeholder: "e.g., System Police" }
        ]
      },
      {
        title: "Step 3: AI Generation Settings",
        description: "Control how creatively the AI generates this faction.",
        fields: [
          { id: "CreativityLevel", label: "Creativity Level", type: "select", options: ["Balanced", "Strict", "Unrestricted"] },
          { id: "PlacementContext", label: "Placement Context (Episode)", type: "dynamic-select", optionsSource: "episodes" },
          { id: "NarrativeIntent", label: "Narrative Intent", type: "textarea", placeholder: "What is your main goal for this faction?" }
        ]
      }
    ]
  },
  {
    id: "prep_session",
    title: "Prep Session",
    description: "Launch the GM Session Prep wizard to generate hooks and checklists.",
    stubTargetPath: "Campaign/_reports/sessions/Session_{{Number}}.md",
    stubTemplatePath: ".planning/_templates/Episode_Overview_Template.md", 
    workflowPath: ".agents/workflows/prep_session.md",
    aiPromptTemplate: "Run the Prep Session workflow.\n- Session Number: {{Number}}\n- Focus/Goals: {{Focus}}\n\nPlease identify required prep and offer hooks/NPCs necessary.",
    steps: [
      {
        fields: [
          { id: "Number", label: "Session Target Identifier", type: "text", required: true, placeholder: "e.g., Ep 03.1" },
          { id: "Focus", label: "GM Focus & Open Loops", type: "textarea", required: true, placeholder: "What do you definitely want to accomplish next game?" }
        ]
      }
    ]
  }
];
