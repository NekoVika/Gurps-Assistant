with open('src/gurpsai/api/routers/campaign.py', 'r', encoding='utf-8') as f:
    content = f.read()

import re
old_block = '''    # Check if file exists inside campaign
    target_path = Path(request.path)
    try:
        target_path.relative_to(campaign_path)
    except ValueError:
        raise HTTPException(status_code=400, detail="Path is outside the active campaign.")'''

new_block = '''    # Check if file exists inside campaign
    # the frontend usually sends relative paths
    if Path(request.path).is_absolute():
        target_path = Path(request.path).resolve()
    else:
        target_path = (campaign_path / request.path).resolve()
        
    try:
        target_path.relative_to(campaign_path.resolve())
    except ValueError:
        raise HTTPException(status_code=400, detail="Path is outside the active campaign.")'''

content = content.replace(old_block, new_block)

with open('src/gurpsai/api/routers/campaign.py', 'w', encoding='utf-8') as f:
    f.write(content)
