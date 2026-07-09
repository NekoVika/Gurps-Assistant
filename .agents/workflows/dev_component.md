---
description: Dev Component — Scaffold a new React UI component following established patterns
---
# Workflow: Dev Component

**Command Trigger:** `/dev_component`

## Objective
To scaffold a new React UI component for the GurpsAI GM workspace, following the established Passport pattern, design system, and routing conventions.

## Execution Steps

1. **Define the Component (Shinku):**
   Switch to **Shinku** (FrontendDev) persona. Ask the GM/user:
   - What is this component for? (Which campaign entity type, which panel, which feature?)
   - Is this a new **Passport** (full file viewer) or a supporting component (editor, panel, modal)?
   - What data does it consume? (Which JSON fields from which file type?)

2. **Audit Existing Patterns:**
   Before writing any code, read:
   - A similar existing Passport component (e.g., `LocationPassport.tsx` for a new location-type view)
   - `styles.css` for relevant CSS tokens and utility classes
   - `web/src/lib/types.ts` for existing TypeScript interfaces
   - `web/src/lib/api.ts` for any existing API calls that can be reused

3. **Design the Component:**
   Propose:
   - **Component name** (e.g., `FactionPassport.tsx`)
   - **TypeScript interface** for its props (usually a parsed JSON type from `lib/types.ts`)
   - **Sections/fields** to render and how
   - **Inline editors** needed (which `StructuredArrayEditors.tsx` chips or block editors apply)
   - **Any new API endpoint** needed (flag to Suigintou)
   
   **Wait for approval before writing.**

4. **Scaffold the Component (Shinku):**
   Create the TSX file in `web/src/components/`. Use the established conventions:
   - Import types from `lib/types.ts`
   - Import API calls from `lib/api.ts`
   - Use only `var(--token-name)` CSS custom properties from `styles.css` — no hard-coded values
   - Follow the Header + Full-Width Stack layout pattern used by other Passports

5. **Register in MainWorkspace (Shinku):**
   If this is a new Passport for a campaign file type, register it in the `renderContent()` routing block in `MainWorkspace.tsx`. Match the file type detection pattern used by existing Passports.

6. **Backend Endpoint (Suigintou, if needed):**
   If the component needs a new API endpoint, switch to **Suigintou** (BackendDev) and implement:
   - Route in the appropriate `src/gurpsai/api/routers/` file
   - Service method in `src/gurpsai/app/services/`
   - Pydantic schema in `src/gurpsai/api/schemas/`
   - TypeScript type in `web/src/lib/types.ts`
   - API call in `web/src/lib/api.ts`

7. **Verify (Hinaichigo):**
   Switch to **Hinaichigo** (QAEngineer). Open the app at `http://localhost:5173` and navigate to a campaign file of the relevant type. Verify:
   - The component renders without errors
   - All fields display correctly
   - Inline editors work (if applicable)
   - No browser console errors
   - No TypeScript compile errors (`npm run build` in `web/`)
