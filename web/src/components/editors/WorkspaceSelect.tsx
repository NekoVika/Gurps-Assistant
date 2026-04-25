import React, { useEffect, useState } from "react";
import { getFileTree, type FileTreeNode } from "../../lib/api";

type Category = "Character" | "Location" | "Story" | "Faction" | "All";

type Props = {
  category: Category;
  value: string;
  onChange: (val: string) => void;
  style?: React.CSSProperties;
  placeholder?: string;
};

export function WorkspaceSelect({ category, value, onChange, style, placeholder }: Props) {
  const [options, setOptions] = useState<{group: string, name: string}[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const fetchOptions = async () => {
      try {
        const tree = await getFileTree();
        if (!isMounted) return;

        const filterNodes = (nodes: FileTreeNode[], targetCategory: string, currentGroup: string = "Uncategorized"): {group: string, name: string}[] => {
          let results: {group: string, name: string}[] = [];
          for (const node of nodes) {
            if (node.node_type === "file" && node.name.endsWith(".json")) {
              const path = node.path.toLowerCase();
              const matchesCategory = 
                (targetCategory === "Character" && path.includes("02_characters")) ||
                (targetCategory === "Location" && path.includes("locations")) ||
                (targetCategory === "Story" && path.includes("03_story")) ||
                (targetCategory === "Faction" && path.includes("factions")) ||
                targetCategory === "All";

              if (matchesCategory) {
                results.push({ group: currentGroup, name: node.name.replace(".json", "") });
              }
            }
            if (node.children) {
              results = results.concat(filterNodes(node.children, targetCategory, node.name));
            }
          }
          return results;
        };

        const found = filterNodes(tree, category);
        found.sort((a, b) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name));
        setOptions(found);
      } catch (err) {
        console.error("Failed to load workspace select options:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchOptions();
    return () => { isMounted = false; };
  }, [category]);

  const selectStyle = {
    padding: "8px 12px",
    borderRadius: "6px",
    border: "1px solid rgba(255,255,255,0.2)",
    background: "rgba(0,0,0,0.5)",
    color: "white",
    width: "100%",
    ...style
  };

  return (
    <select
      style={selectStyle}
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      disabled={loading}
    >
      <option value="" disabled>
        {loading ? "Loading..." : placeholder || `Select ${category}...`}
      </option>
      {/* If current value is not in options (e.g. legacy data), still show it as an option so we don't clear it immediately */}
      {value && !options.find(o => o.name === value) && (
        <option value={value}>{value} (Legacy/Missing)</option>
      )}
      {Object.entries(
        options.reduce((acc, opt) => {
          if (!acc[opt.group]) acc[opt.group] = [];
          acc[opt.group].push(opt.name);
          return acc;
        }, {} as Record<string, string[]>)
      ).map(([group, opts]) => (
        <optgroup key={group} label={group.replace(/_/g, " ")}>
          {opts.map((opt) => (
            <option key={opt} value={opt}>
              {opt.replace(/_/g, " ")}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
