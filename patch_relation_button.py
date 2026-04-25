with open('web/src/components/editors/StructuredArrayEditors.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace + Add button in RelationEditorList
old_button = '''<button type="button" onClick={handleAdd} className="add-button">+ Add</button>'''
new_button = '''<button type="button" className="ghost-button" style={{ padding: "4px 8px", fontSize: "0.8em" }} onClick={handleAdd}>+ Add Item</button>'''

# Also change section-header slightly to match StringArrayEditor styling if needed
old_header = '''<div className="section-header">
                <h3>{title}</h3>'''

new_header = '''<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <span style={{ fontWeight: "bold", fontSize: "0.9em", color: "var(--color-primary, #a8c7fa)" }}>{title}</span>'''

content = content.replace(old_button, new_button)

# Instead of blindly replacing header which might break other lists, let's just do an inline replace for RelationEditorList specifically.
# The class 'editor-section' is used. Let's see if we can just target RelationEditorList.

with open('web/src/components/editors/StructuredArrayEditors.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
