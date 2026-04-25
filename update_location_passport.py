with open('web/src/components/LocationPassport.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Add import
if 'InternalLink' not in content:
    content = content.replace(
        '''import React, { useState } from "react";''',
        '''import React, { useState } from "react";\nimport { InternalLink } from "./InternalLink";'''
    )

# Update Props
content = content.replace(
    '''type Props = {
  data: LocationJSON;
  documentPath: string;
};''',
    '''type Props = {
  data: LocationJSON;
  documentPath: string;
  onNavigate?: (target: string) => void;
};'''
)

# Update signature
content = content.replace(
    '''export function LocationPassport({ data, documentPath }: Props) {''',
    '''export function LocationPassport({ data, documentPath, onNavigate }: Props) {'''
)

# Replace factions li mapping
content = content.replace(
    '''{data.factions.map((fac: string, idx: number) => <li key={idx}>{fac}</li>)}''',
    '''{data.factions.map((fac: string, idx: number) => <li key={idx}><InternalLink target={fac} onNavigate={onNavigate} /></li>)}'''
)

# Replace notableNpcs li mapping
content = content.replace(
    '''{data.notableNpcs.map((npc: string, idx: number) => <li key={idx}>{npc}</li>)}''',
    '''{data.notableNpcs.map((npc: string, idx: number) => <li key={idx}><InternalLink target={npc} onNavigate={onNavigate} /></li>)}'''
)

with open('web/src/components/LocationPassport.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
