with open('src/gurpsai/api/routers/campaign.py', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('config.active_campaign_path', 'config.campaign.active_path')

with open('src/gurpsai/api/routers/campaign.py', 'w', encoding='utf-8') as f:
    f.write(content)
