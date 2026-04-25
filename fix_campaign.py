import sys

with open('src/gurpsai/api/routers/campaign.py', 'r', encoding='utf-8') as f:
    content = f.read()

# I will replace the incorrect import directly.
if 'from src.gurpsai.api.schemas.files import DeleteFileRequest' in content:
    content = content.replace('from src.gurpsai.api.schemas.files import DeleteFileRequest', 'from gurpsai.api.schemas.files import DeleteFileRequest')

with open('src/gurpsai/api/routers/campaign.py', 'w', encoding='utf-8') as f:
    f.write(content)
