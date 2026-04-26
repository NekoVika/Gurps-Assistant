# Campaign Migration Workflow

Follow these steps exactly when the GM asks you to migrate their legacy campaign. 

## Preparation Phase
1. Confirm with the GM that they have placed their old `.md` campaign files into the `Source/` directory.
2. Read the templates in the `Templates/` directory to familiarize yourself with the exact JSON schemas required for the new system.
   - `Character_Template.json`
   - `Location_Template.json`
   - `Faction_Template.json`
   - `Story_Template.json`
3. Read `MAP.md` to familiarize yourself with the exact directory structure required for the output files.

## Execution Phase
For **every file** in the `Source/` directory (including any subdirectories):

1. **Read the raw file content.** Ignore poor markdown formatting, mixing of languages, or unstructured data dumps.
2. **Determine the Entity Type** based on the content (is it a Character/NPC, a Location, a Faction, or a Story/Episode/Chapter?).
3. **Map the Content to the Schema:**
   - Use your intelligence to extract stats, relations, and lore from the raw text.
   - Map this information to the strict JSON keys defined in the corresponding template.
   - **CRITICAL RULE (Language Preservation):** The JSON keys must be exactly as written in the English templates (e.g., `"name"`, `"overview"`, `"factionRelations"`). However, the **values** (the actual narrative text, descriptions, and names) MUST be preserved in the GM's original language (e.g., Ukrainian). Do not translate their narrative text into English.
   - If an old field does not clearly map to a new key, place it in an appropriate text field like `"overview"`, `"gmSummary"`, or `"gmBrief"` so no data is lost.
4. **Write the New File:**
   - Write the resulting JSON object to a new file in the `Destination/` folder.
   - **Important:** Recreate the exact subfolder structure defined in `MAP.md` inside the `Destination` folder. For example, place characters in `Destination/02_Characters/`, locations in `Destination/01_World_Bible/Locations/`, and stories in `Destination/03_Story/`.
   - Use the `.json` extension instead of `.md`.

## Completion Phase
1. Inform the GM once all files have been migrated.
2. Summarize how many files were successfully converted and note any specific files that required heavy manual deduction.
3. Advise the GM that they can now copy the contents of the `Destination/` folder into their actual Campaign workspace.
