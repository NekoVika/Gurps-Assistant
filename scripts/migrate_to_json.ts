import * as fs from 'fs';
import * as path from 'path';

const CAMPAIGN_DIR = path.resolve(__dirname, '../Campaign');
const EXPORT_DIR = path.resolve(__dirname, '../AnomalyHuntersCampaign');

// ============================================
// LEGACY PARSERS REBUILT FOR RELIABLE EXPORT
// ============================================

function extractMeta(markdown: string, key: string): string {
    const safeKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\*\\*(?:${safeKey}):\\*\\*\\s*(.+)`, 'i');
    const match = markdown.match(regex);
    return match ? match[1].trim() : "";
}

function extractBlobFuzzy(markdown: string, sectionTitleRegexGroup: string): string {
    // A much more reliable way to extract markdown blocks without lookahead failures
    const regex = new RegExp(`(?:^|\\n)##(?:\\s*\\d+\\S*\\s*|\\s+)(?:${sectionTitleRegexGroup})[^\\n]*\\n([\\s\\S]*?)(?:\\n##|$)`, 'i');
    const matchResult = markdown.match(regex);
    if (!matchResult) return "";
  
    let content = matchResult[1].trim();
    content = content.replace(/^\*\([^)]+\)\*\s*\n*/, ""); // strip italic template advice
    return content.trim();
}

function extractListFuzzy(markdown: string, sectionTitle: string): string[] {
    const blob = extractBlobFuzzy(markdown, sectionTitle);
    if (!blob) return [];
    
    return blob.split("\n")
        .map(line => line.trim())
        .filter(line => line.startsWith("* ") || line.startsWith("- "))
        .map(line => line.substring(2).trim());
}

function parseLocation(markdown: string): any {
    const data: any = {};
    data.images = [];
    const imageRegex = /!\[.*?\]\((.*?)\)/g;
    let match;
    while ((match = imageRegex.exec(markdown)) !== null) {
        data.images.push(match[1].trim());
    }
    const cleanedMarkdown = markdown.replace(imageRegex, "").trim();

    const titleMatch = cleanedMarkdown.match(/^#\s+(?:Location:\s*)?(.+)$/m);
    data.name = titleMatch ? titleMatch[1].trim() : "Unknown Location";

    data.type = extractMeta(cleanedMarkdown, "Type");
    data.region = extractMeta(cleanedMarkdown, "Region");
    data.techLevel = extractMeta(cleanedMarkdown, "Tech Level");
    data.manaLevel = extractMeta(cleanedMarkdown, "Mana Level");

    data.overview = extractBlobFuzzy(cleanedMarkdown, "Overview");
    data.landmarks = extractListFuzzy(cleanedMarkdown, "Key Landmarks");
    data.factions = extractListFuzzy(cleanedMarkdown, "Factions");
    data.notableNpcs = extractListFuzzy(cleanedMarkdown, "Notable NPCs");
    data.plotHooks = extractListFuzzy(cleanedMarkdown, "Plot Hooks");

    data.internalStructure = [];
    // Using string splitting for hierarchical safety
    const internalStart = cleanedMarkdown.search(/##(?:\s*\d+\.\s*)?Internal Structure/i);
    if (internalStart !== -1) {
        const sectionTail = cleanedMarkdown.slice(internalStart + 10);
        const nextH2 = sectionTail.search(/\n##\s+/);
        const internalBlock = sectionTail.slice(0, nextH2 === -1 ? undefined : nextH2);

        const subSections = internalBlock.split(/\n###\s+/m);
        for (let i = 1; i < subSections.length; i++) { // Skip index 0 (header text)
            const lines = subSections[i].trim().split("\n");
            const title = lines.shift()?.trim() || "Zone";
            const items = lines.map(l => l.trim()).filter(l => l.startsWith("* ") || l.startsWith("- ")).map(l => l.substring(2).trim());
            data.internalStructure.push({ title, items });
        }
    }

    return data;
}

function parseStory(markdown: string): any {
    const data: any = {};
    data.images = [];
    const imageRegex = /!\[.*?\]\((.*?)\)/g;
    let match;
    while ((match = imageRegex.exec(markdown)) !== null) {
        data.images.push(match[1].trim());
    }
    const cleanedMarkdown = markdown.replace(imageRegex, "").trim();

    const titleMatch = cleanedMarkdown.match(/^#\s+(?:Episode:|Chapter:|Encounter:)?\s*(.+)$/m);
    data.title = titleMatch ? titleMatch[1].trim() : "Unknown Story Part";

    if (/^#\s+Episode:/i.test(cleanedMarkdown)) data.type = "Episode";
    else if (/^#\s+Chapter:/i.test(cleanedMarkdown)) data.type = "Chapter";
    else if (/^#\s+Encounter:/i.test(cleanedMarkdown)) data.type = "Encounter";
    else data.type = "Story";

    data.status = extractMeta(cleanedMarkdown, "Status");
    data.primaryLocation = extractMeta(cleanedMarkdown, "Primary Setting") || extractMeta(cleanedMarkdown, "Primary Location\\(s\\)") || extractMeta(cleanedMarkdown, "Location");

    data.gmBrief = extractBlobFuzzy(cleanedMarkdown, "GM Brief|GM Summary|GM Summary \\(preserved.*\\)");
    data.premise = extractBlobFuzzy(cleanedMarkdown, "Premise & Setup|Starting Situation & Purpose|Scene Setup");
    data.objectives = extractBlobFuzzy(cleanedMarkdown, "Main Objectives|Key Objectives|Objectives");
    data.stakesAndAntagonists = extractBlobFuzzy(cleanedMarkdown, "Key Antagonists & Figures|Stakes & Time Pressure|Participants|Notable NPCs.*");
    data.mechanicsAndHazards = extractBlobFuzzy(cleanedMarkdown, "Key Mechanics & Skill Checks");
    data.cluesAndProps = extractBlobFuzzy(cleanedMarkdown, "Clues & Props");
    data.rewards = extractBlobFuzzy(cleanedMarkdown, "Loot & Rewards");
    data.pcHooks = extractBlobFuzzy(cleanedMarkdown, "PC Hooks");
    data.outcomes = extractBlobFuzzy(cleanedMarkdown, "Resolution & Consequences|Outcomes");
    
    data.assumptions = "";
    data.openQuestions = "";
    const qaBlob = extractBlobFuzzy(cleanedMarkdown, "Assumptions & Open Questions");
    if (qaBlob) {
        const assumpMatch = qaBlob.match(/\*\*((?:Assumptions):)\*\*(.*?)(?=\*\*(?:Open Questions):|$)/is);
        if (assumpMatch) data.assumptions = assumpMatch[2].trim();
        const openMatch = qaBlob.match(/\*\*((?:Open Questions):)\*\*(.*?)$/is);
        if (openMatch) data.openQuestions = openMatch[2].trim();
    }

    data.mainOutline = extractBlobFuzzy(cleanedMarkdown, "Detailed Story Outline|Beat Outline \\(Main Path\\)|Beat Outline");
    data.branchingPath = extractBlobFuzzy(cleanedMarkdown, "Variant / Branching Path \\(Optional\\)");
    data.childLinks = extractBlobFuzzy(cleanedMarkdown, "Chapter Index|Encounters & Scenes");

    return data;
}

// ============================================
// MIGRATOR LOGIC
// ============================================

function ensureDirSync(dirPath: string) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

function processDirectory(currentDir: string, exportDir: string) {
    ensureDirSync(exportDir);

    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
        if (entry.name.startsWith('.') || entry.name.startsWith('_')) continue;

        const fullPath = path.join(currentDir, entry.name);
        const exportPath = path.join(exportDir, entry.name);

        if (entry.isDirectory()) {
            processDirectory(fullPath, exportPath);
        } else if (entry.name.endsWith('.md')) {
            const rawMarkdown = fs.readFileSync(fullPath, 'utf8');

            if (['SYSTEM.md', 'master_philosophy.md', '00_System_Rules.md', 'state.md', 'README.md', 'TODO.md'].includes(entry.name)) {
                fs.copyFileSync(fullPath, exportPath);
                continue;
            }

            let parsedData: any = null;

            if (fullPath.includes('02_Characters') || fullPath.includes('Bestiary')) {
                // Characters already parsed perfectly
                continue; // Skip characters in rewrite loop to save time
            } else if (fullPath.includes('Locations') || fullPath.includes('01_World_Bible')) {
                parsedData = parseLocation(rawMarkdown);
            } else if (fullPath.includes('sessions') || fullPath.includes('Episodes') || fullPath.includes('04_Campaign_Log') || fullPath.includes('03_Story')) {
                const headTitle = rawMarkdown.match(/^#\s+(Episode:|Chapter:|Encounter:)/i);
                if (headTitle) {
                    parsedData = parseStory(rawMarkdown);
                } else {
                    fs.copyFileSync(fullPath, exportPath);
                    console.log(`[COPIED RAW MD] ${entry.name}`);
                    continue;
                }
            } else {
                fs.copyFileSync(fullPath, exportPath);
                continue;
            }

            if (parsedData) {
                const jsonPath = exportPath.replace(/\.md$/i, '.json');
                fs.writeFileSync(jsonPath, JSON.stringify(parsedData, null, 2), 'utf8');
                console.log(`[FIXED EXPORT] ${entry.name} -> ${path.basename(jsonPath)}`);
            }
        }
    }
}

console.log("=== INITIATING HOTFIX MD2JSON EXPORT ===");
processDirectory(CAMPAIGN_DIR, EXPORT_DIR);
console.log("=== HOTFIX EXPORT COMPLETE ===");
