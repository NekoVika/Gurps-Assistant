import re

with open('web/src/components/editors/StructuredArrayEditors.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Helper to inject moveItem and update addItem
def patch_list(name, default_placeholder, serialize_func, content):
    # 1. Add moveItem
    move_item_code = f"""
    const moveItem = (idx: number, direction: -1 | 1) => {{
        if (idx + direction < 0 || idx + direction >= parsed.length) return;
        const newParsed = [...parsed];
        const temp = newParsed[idx];
        newParsed[idx] = newParsed[idx + direction];
        newParsed[idx + direction] = temp;
        onChange(newParsed.map({serialize_func}));
    }};
"""
    content = re.sub(
        fr"(const deleteItem = .*?;\s*onChange\(newParsed\.map\({serialize_func}\)\);\s*}};\n)",
        r"\1" + move_item_code,
        content,
        flags=re.DOTALL
    )

    # 2. Update addItem placeholder
    content = re.sub(
        fr"onChange\(\[\.\.\.parsed\.map\({serialize_func}\), \".*?\"\].*?;",
        f"onChange([...parsed.map({serialize_func}), \"{default_placeholder}\"]);",
        content
    )
    
    # 3. Add sorting arrows for parsed items (string case)
    string_case = r"""(if \(typeof [a-zA-Z]+ === 'string'\) \{\s*return \(\s*<div key=\{idx\} className="editor-array-item" style=\{\{) alignItems: "flex-start" (\}\}>)
\s*(<Field label="Raw String \(Unparsed\)".*?</Field>)
\s*(<button.*?✕</button>)
\s*(</div>\s*\);\s*\})"""
    
    string_case_replacement = r"""\1 alignItems: "flex-start", display: "flex", gap: "8px" \2
                            <div style={{ display: "flex", flexDirection: "column", gap: "2px", marginTop: idx > 0 ? "4px" : "26px" }}>
                                <button type="button" onClick={() => moveItem(idx, -1)} style={{ background: "none", border: "none", color: "white", cursor: idx === 0 ? "default" : "pointer", opacity: idx === 0 ? 0.2 : 0.7, padding: "0 4px" }}>▲</button>
                                <button type="button" onClick={() => moveItem(idx, 1)} style={{ background: "none", border: "none", color: "white", cursor: idx === parsed.length - 1 ? "default" : "pointer", opacity: idx === parsed.length - 1 ? 0.2 : 0.7, padding: "0 4px" }}>▼</button>
                            </div>
                            <div style={{ flex: 1 }}>\n                                \3\n                            </div>\n                            \4\n\5"""
    
    # Make sure we only replace within this component's block
    # A bit risky to run global regex, so we find the component block first
    comp_match = re.search(fr"export function {name}\(.*?\n(?:.|\n)*?return \(\n(?:.|\n)*?</div>\n    \);", content)
    if comp_match:
        comp_block = comp_match.group(0)
        comp_block = re.sub(string_case, string_case_replacement, comp_block)
        
        # 4. Add sorting arrows for object case
        obj_case = r"""(return \(\s*<div key=\{idx\} className="editor-array-item" style=\{\{) flexDirection: "column", alignItems: "stretch", padding: "8px" (\}\}>)
\s*(<div style=\{\{ display: "flex".*?</button>\s*</div>)
\s*(<div style=\{\{ display: "flex".*?</div>)
\s*(</div>)"""

        obj_case_replacement = r"""\1 display: "flex", alignItems: "flex-start", padding: "8px", gap: "8px" \2
                        <div style={{ display: "flex", flexDirection: "column", gap: "2px", paddingTop: "4px" }}>
                            <button type="button" onClick={() => moveItem(idx, -1)} style={{ background: "none", border: "none", color: "white", cursor: idx === 0 ? "default" : "pointer", opacity: idx === 0 ? 0.2 : 0.7, padding: "0 4px" }}>▲</button>
                            <button type="button" onClick={() => moveItem(idx, 1)} style={{ background: "none", border: "none", color: "white", cursor: idx === parsed.length - 1 ? "default" : "pointer", opacity: idx === parsed.length - 1 ? 0.2 : 0.7, padding: "0 4px" }}>▼</button>
                        </div>
                        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "8px" }}>
                            \3
                            \4
                        </div>
                    \5"""
        comp_block = re.sub(obj_case, obj_case_replacement, comp_block, flags=re.DOTALL)
        content = content.replace(comp_match.group(0), comp_block)
        
    return content


content = patch_list('TraitEditorList', ' [0]', 'serializeTrait', content)
content = patch_list('SkillEditorList', ' (-)-0 [0]', 'serializeSkill', content)
content = patch_list('GearEditorList', ' (0, 0)', 'serializeGear', content)
content = patch_list('HitLocationEditorList', ' (-): DR 0', 'serializeHitLocation', content)

# Now EntityRelationEditorList
entity_rel_block_match = re.search(r"export function EntityRelationEditorList(?:.|\n)*?return \(\n(?:.|\n)*?</div>\n    \);", content)
if entity_rel_block_match:
    block = entity_rel_block_match.group(0)
    
    move_item_code = """
    const moveItem = (idx: number, direction: -1 | 1) => {
        if (idx + direction < 0 || idx + direction >= items.length) return;
        const newItems = [...items];
        const temp = newItems[idx];
        newItems[idx] = newItems[idx + direction];
        newItems[idx + direction] = temp;
        onChange(newItems);
    };
"""
    block = re.sub(r"(const updateItem = .*?;\s*onChange\(newItems\);\s*};\n)", r"\1" + move_item_code, block, flags=re.DOTALL)
    
    # Add arrows to items
    item_case = r"""(<div key=\{i\} className="editor-array-item" style=\{\{ display: "flex", gap: "8px", alignItems: "center", padding: "8px" \}\}>)
\s*(<div style=\{\{ flex: 1 \}\}>)"""

    item_replacement = r"""\1
                        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                            <button type="button" onClick={() => moveItem(i, -1)} style={{ background: "none", border: "none", color: "white", cursor: i === 0 ? "default" : "pointer", opacity: i === 0 ? 0.2 : 0.7, padding: "0 4px" }}>▲</button>
                            <button type="button" onClick={() => moveItem(i, 1)} style={{ background: "none", border: "none", color: "white", cursor: i === items.length - 1 ? "default" : "pointer", opacity: i === items.length - 1 ? 0.2 : 0.7, padding: "0 4px" }}>▼</button>
                        </div>
                        \2"""
    block = re.sub(item_case, item_replacement, block, flags=re.DOTALL)
    content = content.replace(entity_rel_block_match.group(0), block)

with open('web/src/components/editors/StructuredArrayEditors.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Patched successfully")
