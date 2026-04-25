with open('web/src/components/editors/WorkspaceSelect.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Update state type
content = content.replace(
    'const [options, setOptions] = useState<string[]>([]);',
    'const [options, setOptions] = useState<{group: string, name: string}[]>([]);'
)

# Update filterNodes
old_filterNodes = '''        const filterNodes = (nodes: FileTreeNode[], targetCategory: string): string[] => {
          let results: string[] = [];
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
                results.push(node.name.replace(".json", ""));
              }
            }
            if (node.children) {
              results = results.concat(filterNodes(node.children, targetCategory));
            }
          }
          return results;
        };'''

new_filterNodes = '''        const filterNodes = (nodes: FileTreeNode[], targetCategory: string, currentGroup: string = "Uncategorized"): {group: string, name: string}[] => {
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
        };'''

content = content.replace(old_filterNodes, new_filterNodes)

# Update sort
content = content.replace(
    'found.sort((a, b) => a.localeCompare(b));',
    'found.sort((a, b) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name));'
)

# Update render
old_render = '''      {/* If current value is not in options (e.g. legacy data), still show it as an option so we don't clear it immediately */}
      {value && !options.includes(value) && (
        <option value={value}>{value} (Legacy/Missing)</option>
      )}
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}'''

new_render = '''      {/* If current value is not in options (e.g. legacy data), still show it as an option so we don't clear it immediately */}
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
      ))}'''

content = content.replace(old_render, new_render)

with open('web/src/components/editors/WorkspaceSelect.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
