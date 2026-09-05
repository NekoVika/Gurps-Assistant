import { getFileContent, writeFileContent } from "./api";

/**
 * After a wizard creates a story element, register it in its parent
 * overview's childLinks so registry ordering and scope hints work.
 *
 * vars are wizard answers keyed by field id (ParentEpisode/ParentChapter/Name).
 */
export async function updateParentChildLinks(tPath: string, vars: Record<string, string>): Promise<void> {
  let parentPath = "";
  if (vars["ParentChapter"] && tPath.includes("Encounters")) {
    parentPath = `Campaign/03_Story/${vars["ParentEpisode"]}/${vars["ParentChapter"]}/Chapter_Overview.json`;
  } else if (vars["ParentEpisode"] && tPath.includes("Chapter_Overview.json")) {
    parentPath = `Campaign/03_Story/${vars["ParentEpisode"]}/Episode_Overview.json`;
  } else if (tPath.includes("Episode_Overview.json")) {
    // New episodes register in the campaign-level overview for story ordering.
    parentPath = `Campaign/03_Story/Campaign_Overview.json`;
  }

  if (parentPath && vars["Name"]) {
    const pFile = await getFileContent(parentPath);
    const pData = JSON.parse(pFile.content);
    if (!Array.isArray(pData.childLinks)) {
      pData.childLinks = [];
    }
    if (!pData.childLinks.includes(vars["Name"])) {
      pData.childLinks.push(vars["Name"]);
      await writeFileContent(parentPath, JSON.stringify(pData, null, 2));
    }
  }
}
