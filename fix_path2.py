with open('src/gurpsai/api/routers/campaign.py', 'r', encoding='utf-8') as f:
    content = f.read()

old_block = '''    # Check if file exists inside campaign
    # the frontend usually sends relative paths
    if Path(request.path).is_absolute():
        target_path = Path(request.path).resolve()
    else:
        target_path = (campaign_path / request.path).resolve()'''

new_block = '''    # Check if file exists inside campaign
    # the frontend usually sends relative paths, often prefixed with "Campaign/"
    normalized_path = request.path.replace("\\\\", "/")
    if normalized_path.startswith("Campaign/"):
        normalized_path = normalized_path[len("Campaign/"):]
        
    if Path(normalized_path).is_absolute():
        target_path = Path(normalized_path).resolve()
    else:
        target_path = (campaign_path / normalized_path).resolve()'''

content = content.replace(old_block, new_block)

with open('src/gurpsai/api/routers/campaign.py', 'w', encoding='utf-8') as f:
    f.write(content)
