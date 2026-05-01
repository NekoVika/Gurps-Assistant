import { useState, useEffect } from "react";
import type { FileTreeNode } from "../lib/api";
import { getFileContent } from "../lib/api";

type CollapsibleProps = {
  title: string;
  defaultOpen?: boolean;
  onAdd?: () => void;
  addLabel?: string;
  children: React.ReactNode;
};

function CollapsibleSection({ title, defaultOpen = true, onAdd, addLabel, children }: CollapsibleProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  return (
    <div className="registry-section" style={{ marginBottom: "12px", border: "1px solid rgba(149, 181, 255, 0.1)", borderRadius: "6px", overflow: "hidden", background: "rgba(16, 28, 49, 0.3)" }}>
      <div 
        className="registry-section-header" 
        onClick={() => setIsOpen(!isOpen)}
        style={{ padding: "8px 12px", background: "rgba(149, 181, 255, 0.05)", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", borderBottom: isOpen ? "1px solid rgba(149, 181, 255, 0.1)" : "none" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "0.8rem", transform: isOpen ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>▶</span>
          <span style={{ fontWeight: 600, fontSize: "0.9rem", color: "var(--color-text)" }}>{title}</span>
        </div>
        {onAdd && (
          <button 
            type="button" 
            onClick={(e) => { e.stopPropagation(); onAdd(); }}
            style={{ background: "rgba(149, 181, 255, 0.1)", border: "none", color: "var(--color-primary-light)", padding: "4px 8px", borderRadius: "4px", fontSize: "0.75rem", cursor: "pointer", fontWeight: "bold" }}
            title={addLabel}
          >
            + Create
          </button>
        )}
      </div>
      {isOpen && (
        <div style={{ padding: "8px 12px" }}>
          {children}
        </div>
      )}
    </div>
  );
}

type Props = {
  tree: FileTreeNode[];
  selectedPath: string;
  onSelect: (path: string) => void;
  onActivateWizard?: (wizardId: string) => void;
};

type RegistryData = {
  core: FileTreeNode[];
  pcs: FileTreeNode[];
  npcs: FileTreeNode[];
  bestiary: FileTreeNode[];
  locations: FileTreeNode[];
  factions: FileTreeNode[];
  episodes: { 
      name: string; 
      overviewFile?: FileTreeNode;
      files: FileTreeNode[]; 
      chapters: { 
          name: string; 
          overviewFile?: FileTreeNode;
          files: FileTreeNode[]; 
          path: string;
      }[] 
  }[];
};

function formatEntityName(pathStr: string) {
  const base = pathStr.split('/').pop() || "";
  return base.replace(/\.(md|json)$/, "").replace(/_/g, " ");
}

export function CampaignRegistry({ tree, selectedPath, onSelect, onActivateWizard }: Props) {
  const [orderMap, setOrderMap] = useState<Record<string, string[]>>({});

  useEffect(() => {
     let mounted = true;
     const newOrderMap: Record<string, string[]> = {};
     
     async function loadOrders() {
        const fetchPromises: Promise<void>[] = [];
        
        function walkTree(node: FileTreeNode) {
           if (node.node_type === "directory" && (node.name.startsWith("Episode_") || node.name.startsWith("Chapter_"))) {
               const allFiles: FileTreeNode[] = [];
               function gatherFiles(n: FileTreeNode) {
                   if (n.node_type === "file" && (n.path.endsWith(".md") || n.path.endsWith(".json"))) allFiles.push(n);
                   else if (n.node_type === "directory") n.children.forEach(gatherFiles);
               }
               node.children.forEach(gatherFiles);
               const isDirectChild = (f: FileTreeNode, dirPath: string) => f.path.substring(dirPath.length + 1).indexOf('/') === -1;
               const overviewFile = allFiles.find(f => f.name.endsWith("_Overview.json") || f.name.endsWith("_Overview.md")) ||
                                    allFiles.find(f => isDirectChild(f, node.path) && (f.path.endsWith(".json") || f.path.endsWith(".md")));
               
               if (overviewFile && overviewFile.path.endsWith(".json")) {
                   fetchPromises.push(
                      getFileContent(overviewFile.path).then(res => {
                          try {
                              const data = JSON.parse(res.content);
                              if (Array.isArray(data.childLinks)) {
                                  newOrderMap[node.path] = data.childLinks.map(String);
                              }
                          } catch { /* ignore */ }
                      }).catch(() => {})
                   );
               }
               node.children.forEach(walkTree);
           } else if (node.node_type === "directory") {
               node.children.forEach(walkTree);
           }
        }
        
        tree.forEach(walkTree);
        await Promise.all(fetchPromises);
        if (mounted) {
           setOrderMap(newOrderMap);
        }
     }
     
     loadOrders();
     return () => { mounted = false; };
  }, [tree]);

  const data: RegistryData = {
    core: [],
    pcs: [],
    npcs: [],
    bestiary: [],
    locations: [],
    factions: [],
    episodes: []
  };

  function walk(node: FileTreeNode) {
     if (node.node_type === "file" && (node.path.endsWith(".md") || node.path.endsWith(".json"))) {
        const p = node.path;
        if (p.endsWith("state.json") || p.endsWith("00_System_Rules.json") || p.includes("/Campaign_Overview.json") || p.includes("/World_Dossier.json")) {
            data.core.push(node);
        } else if (p.includes("/02_Characters/PCs/")) {
            data.pcs.push(node);
        } else if (p.includes("/02_Characters/Main_Cast/")) {
            data.npcs.push(node);
        } else if (p.includes("/02_Characters/Bestiary/")) {
            data.bestiary.push(node);
        } else if (p.includes("/01_World_Bible/Locations/")) {
            data.locations.push(node);
        } else if (p.includes("/01_World_Bible/Factions/")) {
            data.factions.push(node);
        }
     } else if (node.node_type === "directory" && node.name.startsWith("Episode_") && node.path.includes("/03_Story/")) {
        const allFiles = node.children.filter((c: FileTreeNode) => c.node_type === "file" && (c.path.endsWith(".md") || c.path.endsWith(".json")));
        
        const isDirectChild = (f: FileTreeNode, dirPath: string) => f.path.substring(dirPath.length + 1).indexOf('/') === -1;
        
        const overviewFile = allFiles.find(f => f.name.endsWith("_Overview.json") || f.name.endsWith("_Overview.md")) ||
                             allFiles.find(f => isDirectChild(f, node.path) && (f.path.endsWith(".json") || f.path.endsWith(".md")));
        
        const files = allFiles.filter(f => f !== overviewFile);
        
        const epOrder = orderMap[node.path] || [];
        
        const getOrderIndex = (f: FileTreeNode, orderList: string[]) => {
            const fName = formatEntityName(f.path);
            const fTitle = f.title || "";
            let idx = orderList.indexOf(fName);
            if (idx === -1 && fTitle) idx = orderList.indexOf(fTitle);
            if (idx === -1) {
                idx = orderList.findIndex(item => item.endsWith(fName) || (fTitle && item.endsWith(fTitle)));
            }
            return idx;
        };
        
        files.sort((a, b) => {
            const aIdx = getOrderIndex(a, epOrder);
            const bIdx = getOrderIndex(b, epOrder);
            if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
            if (aIdx !== -1) return -1;
            if (bIdx !== -1) return 1;
            return a.name.localeCompare(b.name);
        });
        
        const chapters: { name: string; overviewFile?: FileTreeNode; files: FileTreeNode[]; path: string }[] = [];
        const chapterDirs = node.children.filter((c: FileTreeNode) => c.node_type === "directory" && c.name.startsWith("Chapter_"));
        
        chapterDirs.forEach(chDir => {
            const chFilesAll: FileTreeNode[] = [];
            function walkCh(n: FileTreeNode) {
                if (n.node_type === "file" && (n.path.endsWith(".md") || n.path.endsWith(".json"))) {
                    chFilesAll.push(n);
                } else if (n.node_type === "directory") {
                    n.children.forEach(walkCh);
                }
            }
            chDir.children.forEach(walkCh);
            
            const chOverviewFile = chFilesAll.find(f => f.name.endsWith("_Overview.json") || f.name.endsWith("_Overview.md")) ||
                                   chFilesAll.find(f => isDirectChild(f, chDir.path) && (f.path.endsWith(".json") || f.path.endsWith(".md")));
                                   
            const chFiles = chFilesAll.filter(f => f !== chOverviewFile);
            
            const chOrder = orderMap[chDir.path] || [];
            chFiles.sort((a, b) => {
                const aIdx = getOrderIndex(a, chOrder);
                const bIdx = getOrderIndex(b, chOrder);
                if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
                if (aIdx !== -1) return -1;
                if (bIdx !== -1) return 1;
                return a.name.localeCompare(b.name);
            });
            
            chapters.push({ name: formatEntityName(chDir.name), overviewFile: chOverviewFile, files: chFiles, path: chDir.path });
        });
        
        chapters.sort((a, b) => {
            const aTitle = a.overviewFile?.title || a.name;
            const bTitle = b.overviewFile?.title || b.name;
            
            let aIdx = epOrder.indexOf(aTitle);
            if (aIdx === -1) aIdx = epOrder.indexOf(a.name);
            if (aIdx === -1) aIdx = epOrder.findIndex(item => item.endsWith(aTitle) || item.endsWith(a.name));
            
            let bIdx = epOrder.indexOf(bTitle);
            if (bIdx === -1) bIdx = epOrder.indexOf(b.name);
            if (bIdx === -1) bIdx = epOrder.findIndex(item => item.endsWith(bTitle) || item.endsWith(b.name));
            
            if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
            if (aIdx !== -1) return -1;
            if (bIdx !== -1) return 1;
            return a.name.localeCompare(b.name);
        });
        
        data.episodes.push({ name: formatEntityName(node.name), overviewFile, files, chapters });
     }
     
     if (node.node_type === "directory" && !(node.name.startsWith("Episode_") && node.path.includes("/03_Story/"))) {
        node.children.forEach(walk);
     }
  }

  tree.forEach(walk);

  // Default Episodes sort can just be alphabetical for now, or we could support a global Story array later.
  data.episodes.sort((a, b) => a.name.localeCompare(b.name));

  const renderItem = (node: FileTreeNode, overrideName?: string) => {
    const displayName = overrideName || node.title || formatEntityName(node.path);
    return (
    <button
      key={node.path}
      type="button"
      className={`tree-file-button ${selectedPath === node.path ? "selected" : ""}`}
      onClick={() => onSelect(node.path)}
      style={{ paddingLeft: "8px" }}
    >
      {displayName}
    </button>
  );
  };

  return (
    <div className="campaign-registry">
      <CollapsibleSection title="📌 Core Docs" defaultOpen={true}>
        <div className="registry-list">
          {data.core.map(n => renderItem(n))}
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="🎭 Characters" defaultOpen={true} onAdd={onActivateWizard ? () => onActivateWizard("create_npc") : undefined} addLabel="Create NPC">
         {data.pcs.length > 0 && <div className="registry-group"><p className="eyebrow">Player Characters</p><div className="registry-list">{data.pcs.map(n => renderItem(n))}</div></div>}
         {data.npcs.length > 0 && <div className="registry-group"><p className="eyebrow">Main Cast</p><div className="registry-list">{data.npcs.map(n => renderItem(n))}</div></div>}
         {data.bestiary.length > 0 && <div className="registry-group"><p className="eyebrow">Bestiary</p><div className="registry-list">{data.bestiary.map(n => renderItem(n))}</div></div>}
      </CollapsibleSection>

      <CollapsibleSection title="🗺️ World" defaultOpen={true} onAdd={onActivateWizard ? () => onActivateWizard("create_location") : undefined} addLabel="Create Location">
         {data.locations.length > 0 && <div className="registry-group"><p className="eyebrow">Locations</p><div className="registry-list">{data.locations.map(n => renderItem(n))}</div></div>}
         {data.factions.length > 0 && <div className="registry-group"><p className="eyebrow">Factions</p><div className="registry-list">{data.factions.map(n => renderItem(n))}</div></div>}
      </CollapsibleSection>

      <CollapsibleSection title="📖 Story Arcs" defaultOpen={true} onAdd={onActivateWizard ? () => onActivateWizard("story_wizard") : undefined} addLabel="Create Element">
         {data.episodes.map((ep, epIndex) => {
           const epNum = epIndex + 1;
           const epTitle = ep.overviewFile?.title || formatEntityName(ep.name);
           const epDisplay = `${epNum}. ${epTitle}`;
           return (
           <div key={ep.name} className="registry-group" style={{ marginBottom: "12px" }}>
              {ep.overviewFile ? (
                  <button 
                      type="button" 
                      className={`tree-file-button ${selectedPath === ep.overviewFile.path ? "selected" : ""}`}
                      onClick={() => onSelect(ep.overviewFile!.path)}
                      style={{ paddingLeft: "4px", fontWeight: "bold", fontSize: "0.85rem", color: "#a8c7fa" }}
                  >
                      {epDisplay}
                  </button>
              ) : (
                  <p className="eyebrow">{epDisplay}</p>
              )}
              {ep.files.length > 0 && (
                 <div className="registry-list" style={{ marginLeft: "8px" }}>
                    {ep.files.map((file, fileIndex) => renderItem(file, `${fileIndex + 1}. ${file.title || formatEntityName(file.path)}`))}
                 </div>
              )}
              {ep.chapters.map((ch, chIndex) => {
                 const chNum = chIndex + 1;
                 const chTitle = ch.overviewFile?.title || formatEntityName(ch.name);
                 const chDisplay = `${chNum}. ${chTitle}`;
                 return (
                 <div key={ch.name} className="registry-group" style={{ marginLeft: "12px", marginTop: "6px" }}>
                    {ch.overviewFile ? (
                        <button 
                            type="button" 
                            className={`tree-file-button ${selectedPath === ch.overviewFile.path ? "selected" : ""}`}
                            onClick={() => onSelect(ch.overviewFile!.path)}
                            style={{ paddingLeft: "4px", fontWeight: 600, fontSize: "0.8rem", color: "#8ab4f8" }}
                        >
                            ↳ {chDisplay}
                        </button>
                    ) : (
                        <p className="eyebrow" style={{ fontSize: "0.7rem", color: "#6a88b5" }}>{chDisplay}</p>
                    )}
                    {ch.files.length > 0 && (
                        <div className="registry-list" style={{ marginLeft: "16px" }}>
                           {ch.files.map((file, fileIndex) => renderItem(file, `${fileIndex + 1}. ${file.title || formatEntityName(file.path)}`))}
                        </div>
                    )}
                 </div>
                 );
              })}
           </div>
           );
         })}
      </CollapsibleSection>
    </div>
  );
}
