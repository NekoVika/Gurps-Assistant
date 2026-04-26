import { useState } from "react";
import type { FileTreeNode } from "../lib/api";

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
    <div className="registry-section" style={{ marginBottom: "12px", border: "1px solid rgba(149, 181, 255, 0.1)", borderRadius: "6px", overflow: "hidden", background: "var(--color-bg-light)" }}>
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
  episodes: { name: string; files: FileTreeNode[]; chapters: { name: string; files: FileTreeNode[] }[] }[];
};

function formatEntityName(pathStr: string) {
  const base = pathStr.split('/').pop() || "";
  return base.replace(/\.(md|json)$/, "").replace(/_/g, " ");
}

export function CampaignRegistry({ tree, selectedPath, onSelect, onActivateWizard }: Props) {
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
        const files = node.children.filter((c: FileTreeNode) => c.node_type === "file" && (c.path.endsWith(".md") || c.path.endsWith(".json")));
        files.sort((a: FileTreeNode, b: FileTreeNode) => a.name.localeCompare(b.name));
        
        const chapters: { name: string; files: FileTreeNode[] }[] = [];
        const chapterDirs = node.children.filter((c: FileTreeNode) => c.node_type === "directory" && c.name.startsWith("Chapter_"));
        
        chapterDirs.forEach(chDir => {
            const chFiles: FileTreeNode[] = [];
            function walkCh(n: FileTreeNode) {
                if (n.node_type === "file" && (n.path.endsWith(".md") || n.path.endsWith(".json"))) {
                    chFiles.push(n);
                } else if (n.node_type === "directory") {
                    n.children.forEach(walkCh);
                }
            }
            chDir.children.forEach(walkCh);
            chFiles.sort((a,b) => a.name.localeCompare(b.name));
            chapters.push({ name: formatEntityName(chDir.name), files: chFiles });
        });
        
        chapters.sort((a,b) => a.name.localeCompare(b.name));
        
        data.episodes.push({ name: formatEntityName(node.name), files, chapters });
     }
     
     if (node.node_type === "directory" && !(node.name.startsWith("Episode_") && node.path.includes("/03_Story/"))) {
        node.children.forEach(walk);
     }
  }

  tree.forEach(walk);

  data.episodes.sort((a, b) => a.name.localeCompare(b.name));

  const renderItem = (node: FileTreeNode) => (
    <button
      key={node.path}
      type="button"
      className={`tree-file-button ${selectedPath === node.path ? "selected" : ""}`}
      onClick={() => onSelect(node.path)}
      style={{ paddingLeft: "8px" }}
    >
      {formatEntityName(node.path)}
    </button>
  );

  return (
    <div className="campaign-registry" style={{ padding: "8px" }}>
      <CollapsibleSection title="📌 Core Docs" defaultOpen={true}>
        <div className="registry-list">
          {data.core.map(renderItem)}
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="🎭 Characters" defaultOpen={true} onAdd={onActivateWizard ? () => onActivateWizard("create_npc") : undefined} addLabel="Create NPC">
         {data.pcs.length > 0 && <div className="registry-group"><p className="eyebrow">Player Characters</p><div className="registry-list">{data.pcs.map(renderItem)}</div></div>}
         {data.npcs.length > 0 && <div className="registry-group"><p className="eyebrow">Main Cast</p><div className="registry-list">{data.npcs.map(renderItem)}</div></div>}
         {data.bestiary.length > 0 && <div className="registry-group"><p className="eyebrow">Bestiary</p><div className="registry-list">{data.bestiary.map(renderItem)}</div></div>}
      </CollapsibleSection>

      <CollapsibleSection title="🗺️ World" defaultOpen={true} onAdd={onActivateWizard ? () => onActivateWizard("create_location") : undefined} addLabel="Create Location">
         {data.locations.length > 0 && <div className="registry-group"><p className="eyebrow">Locations</p><div className="registry-list">{data.locations.map(renderItem)}</div></div>}
         {data.factions.length > 0 && <div className="registry-group"><p className="eyebrow">Factions</p><div className="registry-list">{data.factions.map(renderItem)}</div></div>}
      </CollapsibleSection>

      <CollapsibleSection title="📖 Story Arcs" defaultOpen={true} onAdd={onActivateWizard ? () => onActivateWizard("prep_session") : undefined} addLabel="Prep Session">
         {data.episodes.map(ep => (
           <div key={ep.name} className="registry-group" style={{ marginBottom: "12px" }}>
              <p className="eyebrow">{ep.name}</p>
              {ep.files.length > 0 && (
                 <div className="registry-list">
                    {ep.files.map(renderItem)}
                 </div>
              )}
              {ep.chapters.map(ch => (
                 <div key={ch.name} className="registry-group" style={{ marginLeft: "12px", marginTop: "6px" }}>
                    <p className="eyebrow" style={{ fontSize: "0.7rem", color: "#6a88b5" }}>{ch.name}</p>
                    <div className="registry-list">
                       {ch.files.map(renderItem)}
                    </div>
                 </div>
              ))}
           </div>
         ))}
      </CollapsibleSection>
    </div>
  );
}
