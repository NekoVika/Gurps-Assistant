---
description: Configure Global Core Source
---
# Workflow: Configure Core Source

**Command Trigger:** `/configure_core_source`

## Objective
Optionally override the preconfigured global core Git source for this campaign.

> Note (Develop Branch):
> Requires the CLI on `feature/cli`. On `develop` without the CLI, record core source details in your project notes and proceed with manual update steps when needed.

## Execution Steps

1. **Collect Inputs:**
   Ask for (only if overriding defaults):
   - Core repository URL
   - Default ref (branch/tag), default `main`
   - Whether updates should use the latest tag by default

2. **Save Configuration:**
   Run:
   `gurpsai set-core-source -RepoUrl "<REPO_URL>" -DefaultRef "<REF>" [-UseLatestTag]`

3. **Confirm:**
   Report that `%USERPROFILE%\.gurps-assistant\core-source.json` (or `GURPSAI_HOME`) was created/updated.
