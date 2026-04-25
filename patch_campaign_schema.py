with open('src/gurpsai/domain/campaign.py', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    'location: str = Field("", title="Location")',
    'location: str = Field("", title="Location")\n    locations: List[Any] = Field(default_factory=list, title="Locations")'
)

with open('src/gurpsai/domain/campaign.py', 'w', encoding='utf-8') as f:
    f.write(content)
