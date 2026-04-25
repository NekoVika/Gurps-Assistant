with open('src/gurpsai/api/routers/campaign.py', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('import uuid\nimport shutil', 'import json\nimport uuid\nimport shutil')

with open('src/gurpsai/api/routers/campaign.py', 'w', encoding='utf-8') as f:
    f.write(content)
