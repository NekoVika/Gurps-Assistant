import re

# Fix ConfirmModal
with open('web/src/components/ConfirmModal.tsx', 'r', encoding='utf-8') as f:
    content = f.read()
content = content.replace('import { useEffect, useRef } from "react";\n', '')
with open('web/src/components/ConfirmModal.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

# Fix TrashbinPanel
with open('web/src/components/TrashbinPanel.tsx', 'r', encoding='utf-8') as f:
    content = f.read()
content = content.replace('import React, { useEffect, useState } from "react";', 'import { useEffect, useState } from "react";')
with open('web/src/components/TrashbinPanel.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

# Fix MainWorkspace
with open('web/src/components/MainWorkspace.tsx', 'r', encoding='utf-8') as f:
    content = f.read()
content = content.replace('const workflowItems = ["prep_session", "create_npc", "brainstorm", "catch_up"];\n', '')
with open('web/src/components/MainWorkspace.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
