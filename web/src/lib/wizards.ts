import { sheetFromBuild, leftToGMBlock, gearLines } from "./generatedSheet";
import type { TraitIndex } from "./traitResolver";

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
  postProcess?: (result: Record<string, any>, context?: PostProcessContext) => Record<string, any>;
  /** The stored fields one pass is contracted to fill, where postProcess makes
   *  them differ from the schema's own `required` list. A deepen pass that
   *  finds all of these written has nothing to do. */
  fills?: string[];
};

export type PostProcessContext = {
  /** The catalogue the app prices traits from, or null when none is loaded. */
  traitIndex: TraitIndex | null;
  /** The file being deepened, or null when creating. */
  existing: Record<string, unknown> | null;
};

/**
 * A key postProcess may return whose lines are appended to the GM Summary
 * rather than merged into it. A merge never replaces what the GM wrote, so
 * anything the app needs them to read has to be added, not offered.
 */
export const APPEND_TO_GM_SUMMARY = "appendToGmSummary";

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

/**
 * `gurpsai.domain.character_build.CharacterBuild`, inlined for the provider.
 *
 * Gemini's response schema takes neither `$ref` nor an integer `enum`, so the
 * Pydantic schema cannot be sent as it is; the backend validates the answer
 * against the Pydantic model afterwards. The field names are pinned on both
 * sides — `wizards.test.ts` and `tests/test_character_build.py` — so neither
 * can drift alone. Like the model, it has nowhere to put a cost.
 */
const TRAIT_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string",
      description: "As the Basic Set names it, with no level, specialty or cost: 'Combat Reflexes', 'Bad Temper'." },
    levels: { type: "integer", description: "Traits priced per level: how many levels." },
    specialty: { type: "string", description: "The parenthesised qualifier or variety: 'Spiders' for Phobia." },
    self_control: { type: "integer",
      description: "Disadvantages with a self-control roll only: 6, 9, 12 or 15. 12 leaves the printed cost." },
    modifiers: {
      type: "array",
      description: "Enhancements and limitations, each with the book's percentage. All of them or none.",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          percent: { type: "integer", description: "+100 for +100%, -50 for -50%." },
        },
        required: ["name", "percent"],
      },
    },
    notes: { type: "string", description: "One short line on what it does at the table. Never a point cost." },
  },
  required: ["name"],
};

export const CHARACTER_BUILD_SCHEMA = {
  type: "object",
  description: "The character's mechanics as choices. The app prices them.",
  properties: {
    attributes: {
      type: "array",
      description: "The four primary attributes, and any secondary one you change.",
      items: {
        type: "object",
        properties: {
          name: { type: "string", description: "'ST', 'DX', 'IQ', 'HT', 'HP', 'Will', 'Per', 'FP', 'Basic Speed' or 'Basic Move'." },
          score: { type: "number", description: "The final score. Basic Speed may carry a quarter." },
          notes: { type: "string" },
        },
        required: ["name", "score"],
      },
    },
    advantages: { type: "array", items: TRAIT_SCHEMA },
    disadvantages: { type: "array", items: TRAIT_SCHEMA },
    // A skill's level is required. On one shared entry it was optional, and
    // Gemini 2.5 Flash left it out of every skill that had a specialty --
    // reproduced on request. A required field cannot be skipped, and
    // propertyOrdering has the model settle name and specialty first.
    skills: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string", description: "As the Basic Set names it, with no level or specialty: 'Guns/TL', 'Driving/TL', 'Stealth'." },
          specialty: { type: "string", description: "Where the skill takes one: 'Pistol' for Guns, 'Automobile' for Driving." },
          level: { type: "string",
            description: "Level relative to its attribute: 'DX+2', 'IQ-1', 'Per'. Required, for a skill with a specialty too. Never the final number." },
          tl: { type: "integer", description: "For a '/TL' skill: the tech level it is learned at." },
          notes: { type: "string", description: "One short line. Never a point cost." },
        },
        required: ["name", "level"],
        propertyOrdering: ["name", "specialty", "level", "tl", "notes"],
      },
    },
    unpriceable: {
      type: "array",
      items: { type: "string" },
      description: "What the book does not price with one figure — a Patron, Ally, Secret, anything "
        + "'Variable' or a range — in plain words, rather than guessing a cost.",
    },
  },
  required: ["attributes", "advantages", "disadvantages", "skills", "unpriceable"],
};

/** A character's equipment as items. The app writes the stored line. */
export const GEAR_SCHEMA = {
  type: "array",
  items: {
    type: "object",
    properties: {
      name: { type: "string", description: "The item, e.g. 'Light Pistol', 'Commlink (Handheld)'." },
      quantity: { type: "integer", description: "How many. 1 for a single item." },
      weight: { type: "string", description: "As the book lists it: '1.5 lbs'. 'neg.' for negligible." },
      cost: { type: "string", description: "As the book lists it: '$200'." },
      notes: { type: "string", description: "Tech level, damage, Acc, RoF and anything else." },
    },
    required: ["name", "quantity", "weight", "cost"],
  },
};

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
    // The folder follows the entity type, as it does in the stub endpoint:
    // a bestiary template dropped into Main_Cast reads as an individual, and
    // then the loose-ends report asks where that wolf is standing.
    stubTargetPath: (answers) => {
      const folder = answers.EntityType === "Bestiary" ? "Bestiary"
                   : answers.EntityType === "PC" ? "PCs"
                   : "Main_Cast";
      return `Campaign/02_Characters/${folder}/${answers.Name ? answers.Name.replace(/ /g, "_") : "Untitled"}.json`;
    },
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
        `\nReturn a COMPLETE JSON object.`,
        // The model chooses and the app prices. Asked for "[15]"-style strings,
        // not one sheet in the campaign added up to its own brackets.
        `- build: the character's mechanics as CHOICES. You choose; the app prices every line and`,
        `  states the total. Give no point costs anywhere — not in names, not in notes.`,
        `  Name every trait and skill exactly as the GURPS Basic Set names it, with no level or cost`,
        `  attached: "Guns/TL" with specialty "Rifle" and tl 8, never "Guns/TL8 (Rifle)-14 [8]".`,
        `  attributes: give the final score. Leave out any attribute at its default.`,
        `  skills: every skill needs a level relative to its attribute ("DX+2", "IQ-1", "Per"),`,
        `  a skill with a specialty included. Never the final number.`,
        `  Disadvantages with a self-control roll: self_control is 6, 9, 12 or 15.`,
        `  Levelled traits: levels (e.g. 3 for Damage Resistance 3).`,
        answers.Points && answers.Points.trim()
          ? `  Choose traits that come to roughly ${answers.Points.trim()} points; the app will add them up.`
          : null,
        `  build.unpriceable: anything the book does not price with one figure — a Patron, Ally,`,
        `  Contact, Secret, anything "Variable" or a range — in plain words, rather than a guessed entry.`,
        // Asked for "Name [Qty] (Weight, Cost) - Notes" as a string, a model put
        // the tech level in the parentheses and the weight in the notes, and
        // the app then could not read the line. Each part is its own field now
        // and the app writes the line.
        `- gear: one item per entry, each part in its own field. weight and cost are as the book`,
        `  lists them ("1.5 lbs", "$200"); everything else — tech level, damage, Acc, RoF — goes in notes.`,
        `- concept: a short archetype phrase of 2-5 words — "Ex-military smuggling pilot", "Sewer-dwelling scavenger".`,
        `  NOT a sentence and NOT a summary of their situation; the GM reads it as a label beside the name.`,
        `- role: the exact value provided above, unchanged. Do not expand it into a sentence.`,
        `- significance: exactly one of "core", "supporting", "featured", "background"${type === "Bestiary" ? " (ignored for a Bestiary template — it is cleared afterwards)" : ""}`,
        `- kind: exactly "${type === "Bestiary" ? "type" : type === "PC" ? "pc" : "individual"}"`,
        `- status: one of "Alive", "Dead", "Missing" — "Alive" unless the parameters say otherwise.`,
        `- speech: one characteristic line in their own voice, in quotes.`,
        `- pcHooks: one or two concrete ways the PCs could become entangled with them. Openings, not a summary.`,
        // A guessed place or acquaintance becomes a link to something that does
        // not exist, and the GM is then chasing a loose end the model invented.
        // Where an entity sits and who it knows is the GM's to say.
        `\nLeave these EMPTY — they are the GM's, not yours: location, storyAppearances,`,
        `characterRelations, locationRelations, factionRelations, images. Do not invent a place`,
        `or a person; a name you make up becomes a broken link in their campaign.`,
        `- armorCoverage: a SPARSE object — only include locations where DR > 0. Keys are camelCase location names: eye, skull, face, rightLeg, rightArm, torso, groin, leftArm, leftLeg, hand, foot, neck, vitals. Each value is { "dr": <number>, "source": "<armor name>" }. Omit locations with DR 0 entirely.`,
        `\nOutput only the JSON object — no explanation, no markdown fences.`,
      ].filter(Boolean).join("\n");
    },
    outputSchema: {
      type: "object",
      properties: {
        name:               { type: "string" },
        concept:            { type: "string" },
        kind:               { type: "string", enum: ["individual", "type", "pc"] },
        // No "" member: providers reject an empty enum value outright. A type
        // carries no significance, so postProcess clears it after generation.
        significance:       { type: "string", enum: ["core", "supporting", "featured", "background"] },
        role:               { type: "string" },
        location:           { type: "string" },
        status:             { type: "string" },
        appearance:         { type: "string" },
        personality:        { type: "string" },
        motivation:         { type: "string" },
        speech:             { type: "string" },
        // Attributes, traits, skills and the total are not asked for: postProcess
        // writes them from this, priced by the app.
        build: CHARACTER_BUILD_SCHEMA,
        // Items rather than lines, for the same reason as `build`: postProcess
        // writes each one in the notation the sheet stores.
        gear: GEAR_SCHEMA,
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
      // One pass should finish everything it has any business finishing. A
      // field left off this list is one the model may silently omit, and the
      // GM then reads the blank as the feature failing.
      //
      // `kind` is required because postProcess tests `rest.kind === "type"` to
      // clear significance; omitted, a bestiary template keeps whatever
      // significance the model picked.
      //
      // Deliberately absent, and the prompt says so too: location,
      // storyAppearances, the three relation arrays, images, variations. Those
      // are placement and acquaintance — the GM's to set — and a guessed name
      // is a link to something that does not exist.
      required: [
        "name", "concept", "kind", "significance", "role", "status",
        "appearance", "personality", "motivation", "speech", "pcHooks",
        "build", "gear", "armorCoverage", "tactics"
      ]
    },
    pydanticModel: "CharacterData",
    fills: [
      "name", "concept", "kind", "significance", "role", "status",
      "appearance", "personality", "motivation", "speech", "pcHooks",
      "pointTotal", "attributes", "advantages", "disadvantages", "skills",
      "gear", "hitLocations", "tactics",
    ],
    postProcess: (result, context) => {
      const { armorCoverage, build, ...rest } = result;
      const sheet = sheetFromBuild(build, context?.traitIndex ?? null, context?.existing ?? null);
      const leftToGM = leftToGMBlock(sheet.leftToGM);
      return {
        ...rest,
        // A template has no narrative weight of its own; only its instances do.
        // The schema cannot express "" so the model always picks something.
        significance: rest.kind === "type" ? "" : rest.significance,
        attributes: sheet.attributes,
        advantages: sheet.advantages,
        disadvantages: sheet.disadvantages,
        skills: sheet.skills,
        pointTotal: sheet.pointTotal,
        gear: gearLines(rest.gear),
        hitLocations: expandArmorCoverage(
          armorCoverage as Record<string, { dr: number; source?: string }> | undefined
        ),
        ...(leftToGM ? { [APPEND_TO_GM_SUMMARY]: leftToGM } : {}),
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
            label: "Significance",
            type: "select",
            // Bestiary entries are not on this scale at all -- `kind` says they
            // are templates, and a template has no narrative weight of its own.
            options: ["core", "supporting", "featured", "background"]
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
            placeholder: "Appearance to treat as canon — or leave blank and let the AI invent it",
            // Not required. It is stored as the appearance and the merge never
            // replaces it, so demanding it meant every manual stub had a look
            // the model was then forbidden to improve on. Blank is a real
            // answer here: "you decide".
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
