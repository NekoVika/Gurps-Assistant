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
};

export const WIZARDS: WizardDef[] = [
  {
    id: "story_wizard",
    title: "Create Story Element",
    description: "Create an Episode, Chapter, or Encounter.",
    stubTargetPath: (answers) => {
      const type = answers.ElementType;
      const name = answers.Name ? answers.Name.replace(/ /g, "_") : "Untitled";
      if (type === "Episode") return `Campaign/03_Story/${name}/Episode_Overview.json`;
      if (type === "Chapter") return `Campaign/03_Story/${answers.ParentEpisode || "Unknown_Episode"}/${name}/Chapter_Overview.json`;
      if (type === "Encounter") return `Campaign/03_Story/${answers.ParentEpisode || "Unknown_Episode"}/${answers.ParentChapter || "Unknown_Chapter"}/Encounters/${name}.json`;
      return "Campaign/03_Story/Unknown.json";
    },
    stubTemplatePath: (answers) => {
      const type = answers.ElementType;
      if (type === "Episode") return ".planning/_templates/Episode_Template.json";
      if (type === "Chapter") return ".planning/_templates/Chapter_Template.json";
      return ".planning/_templates/Encounter_Template.json";
    },
    aiPromptTemplate: "Run the Create Story workflow.\n\nType: {{ElementType}}\nName: {{Name}}\n\nPremise: {{Premise}}\nObjectives: {{Objectives}}\nStakes: {{Stakes}}\nHazards: {{Hazards}}\nOutcomes: {{Outcomes}}\n\nPlease execute the workflow and provide a Draft.",
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
          { id: "Premise", label: "Premise & Setup", type: "textarea", placeholder: "Starting situation..." },
          { id: "Stakes", label: "Stakes & Antagonists", type: "textarea", placeholder: "Who opposes them?" },
          { id: "Objectives", label: "Objectives", type: "textarea", placeholder: "What must be achieved?" }
        ]
      },
      {
        title: "Chapter Context",
        condition: (answers) => answers.ElementType === "Chapter",
        fields: [
          { id: "Premise", label: "Starting Situation & Purpose", type: "textarea", placeholder: "Where does it start?" },
          { id: "Objectives", label: "Key Objectives", type: "textarea", placeholder: "Chapter goals..." },
          { id: "Hazards", label: "Mechanics & Hazards", type: "textarea", placeholder: "Environmental dangers..." }
        ]
      },
      {
        title: "Encounter Context",
        condition: (answers) => answers.ElementType === "Encounter",
        fields: [
          { id: "Premise", label: "Trigger / Scene start", type: "textarea", placeholder: "How does it start?" },
          { id: "Hazards", label: "Mechanics & Hazards", type: "textarea", placeholder: "Skill checks, DC, attacks..." },
          { id: "Outcomes", label: "Outcomes", type: "textarea", placeholder: "Success / Failure results..." }
        ]
      }
    ]
  },
  {
    id: "create_npc",
    title: "Create Entity",
    description: "Generates a fully statted GURPS 4e character sheet and narrative anchor for an NPC, PC, or Bestiary entity.",
    stubTargetPath: "Campaign/02_Characters/Main_Cast/{{Name}}.json",
    stubTemplatePath: ".planning/_templates/NPC_Template.json",
    workflowPath: ".agents/workflows/create_npc.md",
    aiPromptTemplate: "Run the Create NPC workflow.\n\nHere are my parameters:\n- Entity Type: {{EntityType}}\n- Name: {{Name}}\n- Concept: {{Concept}}\n- GM Description: {{Description}}\n- Narrative Role: {{Role}}\n- Significance: {{Significance}}\n- Build Complexity: {{Complexity}}\n- Key Focus: {{Focus}}\n- Target Points: {{Points}}\n- Required Advantages: {{Advantages}}\n- Required Disadvantages: {{Disadvantages}}\n- Key Skills: {{Skills}}\n- Visuals: {{Visuals}}\n- Constraints/Exceptions: {{Exceptions}}\n\nPlease execute the workflow rules now and provide a Draft.",
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
      }
    ]
  },
  {
    id: "create_location",
    title: "Create Location",
    description: "Design a new geographical point of interest or facility.",
    stubTargetPath: "Campaign/01_World_Bible/Locations/{{Name}}.json",
    stubTemplatePath: ".planning/_templates/Location_Template.json",
    aiPromptTemplate: "Create a new location for the campaign.\n\n- Name: {{Name}}\n- Location Type: {{Type}}\n- Key Features/Vibe: {{Vibe}}\n\nPlease format it against the Location_Template.json and output a patch draft.",
    steps: [
      {
        fields: [
          { id: "Name", label: "Location Name", type: "text", required: true, placeholder: "e.g., The Rust Yard" },
          { id: "Type", label: "Type", type: "text", placeholder: "e.g., Smuggler Base, City Sector, Planet" },
          { id: "Vibe", label: "Vibe & Key Features", type: "textarea", required: true, placeholder: "e.g., Grimy, neon-lit, guarded by automated turrets." }
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
