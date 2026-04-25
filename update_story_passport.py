with open('web/src/components/StoryPassport.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Add import
if 'InternalLink' not in content:
    content = content.replace(
        '''import ReactMarkdown from "react-markdown";''',
        '''import ReactMarkdown from "react-markdown";\nimport { InternalLink } from "./InternalLink";'''
    )

# Update Props
content = content.replace(
    '''type Props = {
  data: StoryJSON;
  documentPath: string;
};''',
    '''type Props = {
  data: StoryJSON;
  documentPath: string;
  onNavigate?: (target: string) => void;
};'''
)

# Update signature
content = content.replace(
    '''export function StoryPassport({ data, documentPath }: Props) {''',
    '''export function StoryPassport({ data, documentPath, onNavigate }: Props) {'''
)

# Update primaryLocation rendering
content = content.replace(
    '''<ReactMarkdown className="markdown-inline">{data.primaryLocation || "?"}</ReactMarkdown>''',
    '''{data.primaryLocation ? <InternalLink target={data.primaryLocation} onNavigate={onNavigate} /> : "?"}'''
)

with open('web/src/components/StoryPassport.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
