with open('web/src/components/MainWorkspace.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    '<CharacterPassport data={parsed} documentPath={selectedFile.path} onUpdate={handleSaveParsedData} />',
    '<CharacterPassport data={parsed} documentPath={selectedFile.path} onUpdate={handleSaveParsedData} onNavigate={handleNavigateTo} />'
)
content = content.replace(
    '<LocationPassport data={parsed} documentPath={selectedFile.path} />',
    '<LocationPassport data={parsed} documentPath={selectedFile.path} onNavigate={handleNavigateTo} />'
)
content = content.replace(
    '<StoryPassport data={parsed} documentPath={selectedFile.path} />',
    '<StoryPassport data={parsed} documentPath={selectedFile.path} onNavigate={handleNavigateTo} />'
)

with open('web/src/components/MainWorkspace.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
