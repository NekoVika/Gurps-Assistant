with open('web/src/components/CharacterPassport.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

old_loc = '''          {data.location && (
            <section className="passport-block">
              <h3>Base of Operations</h3>
              <p><InternalLink target={data.location.replace(/\[|\]/g, "")} onNavigate={onNavigate} /></p>
            </section>
          )}'''

new_loc = '''          {data.locations && data.locations.length > 0 && (
            <section className="passport-block">
              <h3>Locations</h3>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {data.locations.map((loc, i) => (
                   <span className="tag-pill" key={i}>
                      <InternalLink target={loc.replace(/\[|\]/g, "")} onNavigate={onNavigate} />
                   </span>
                ))}
              </div>
            </section>
          )}
          {data.location && (!data.locations || data.locations.length === 0) && (
            <section className="passport-block">
              <h3>Base of Operations</h3>
              <p><InternalLink target={data.location.replace(/\[|\]/g, "")} onNavigate={onNavigate} /></p>
            </section>
          )}'''

content = content.replace(old_loc, new_loc)

with open('web/src/components/CharacterPassport.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
