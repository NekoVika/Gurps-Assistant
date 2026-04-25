with open('src/gurpsai/domain/campaign.py', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    'from typing import List, Optional',
    'from typing import List, Optional, Any'
)

new_fields = '''    attributes: List[Any] = Field(default_factory=list, title="Attributes")
    advantages: List[Any] = Field(default_factory=list, title="Advantages & Perks")
    disadvantages: List[Any] = Field(default_factory=list, title="Disadvantages & Quirks")
    skills: List[Any] = Field(default_factory=list, title="Skills")
    gear: List[Any] = Field(default_factory=list, title="Gear & Weapons")
    relations: List[Any] = Field(default_factory=list, title="Relations")
    appearances: List[str] = Field(default_factory=list, title="Appearances")'''

content = content.replace(
    '''    attributes: List[str] = Field(default_factory=list, title="Attributes")
    advantages: List[str] = Field(default_factory=list, title="Advantages & Perks")
    disadvantages: List[str] = Field(default_factory=list, title="Disadvantages & Quirks")
    skills: List[str] = Field(default_factory=list, title="Skills")
    gear: List[str] = Field(default_factory=list, title="Gear & Weapons")''',
    new_fields
)

content = content.replace(
    '''hitLocations: List[str] = Field(default_factory=list, title="Hit Locations")''',
    '''hitLocations: List[Any] = Field(default_factory=list, title="Hit Locations")'''
)

with open('src/gurpsai/domain/campaign.py', 'w', encoding='utf-8') as f:
    f.write(content)
