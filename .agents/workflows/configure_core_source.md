---
description: Configure Global Core Source
---
# Workflow: Configure Core Source

**Command Trigger:** `/configure_core_source`

## Objective
Set the default global core Git source once for this campaign so future updates require minimal input.

## Execution Steps

1. **Collect Inputs:**
   Ask for:
   - Core repository URL
   - Default ref (branch/tag), default `main`
   - Whether updates should use the latest tag by default

2. **Save Configuration:**
   Run:
   `powershell -ExecutionPolicy Bypass -File .\scripts\set-core-source.ps1 -RepoUrl "<REPO_URL>" -DefaultRef "<REF>" [-UseLatestTag]`

3. **Confirm:**
   Report that `.framework/core-source.json` was created/updated.
