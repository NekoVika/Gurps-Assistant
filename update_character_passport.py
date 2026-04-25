with open('web/src/components/CharacterPassport.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Add import
content = content.replace(
    '''import { apiBaseUrl } from '../lib/api';''',
    '''import { apiBaseUrl } from '../lib/api';\nimport { InternalLink } from './InternalLink';'''
)

# Update Props
content = content.replace(
    '''type Props = {
  data: CharacterJSON;
  documentPath: string;
  onUpdate?: (newData: CharacterJSON) => void;
};''',
    '''type Props = {
  data: CharacterJSON;
  documentPath: string;
  onUpdate?: (newData: CharacterJSON) => void;
  onNavigate?: (target: string) => void;
};'''
)

# Update signature
content = content.replace(
    '''export function CharacterPassport({ data, documentPath, onUpdate }: Props) {''',
    '''export function CharacterPassport({ data, documentPath, onUpdate, onNavigate }: Props) {'''
)

# Update Location rendering
content = content.replace(
    '''<span>{data.location}</span>''',
    '''<InternalLink target={data.location} onNavigate={onNavigate} />'''
)

# Add Relations and Appearances rendering
new_sections = '''        </div>
      </header>

      <div className="passport-body">
        {data.relations && data.relations.length > 0 && (
          <div className="mechanics-section">
            <span className="eyebrow">Relations</span>
            <ul className="traits-list">
              {data.relations.map((rel, idx) => (
                <li key={idx}>
                  <InternalLink target={rel.name} onNavigate={onNavigate} style={{fontWeight: "bold"}} />
                  {rel.relationship ? :  : ""}
                </li>
              ))}
            </ul>
          </div>
        )}

        {data.appearances && data.appearances.length > 0 && (
          <div className="mechanics-section">
            <span className="eyebrow">Appearances</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {data.appearances.map((app, idx) => (
                <InternalLink key={idx} target={app} onNavigate={onNavigate} className="status-pill alive" />
              ))}
            </div>
          </div>
        )}'''

content = content.replace(
    '''        </div>
      </header>

      <div className="passport-body">''',
    new_sections
)

with open('web/src/components/CharacterPassport.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
