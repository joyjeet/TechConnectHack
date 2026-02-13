---
name: Git Commit
description: Review staged changes and create commits following repository standards - conventional commits with detailed body structure
argument-hint: Ask to review staged changes and create a commit
tools: ['search', 'read/readFile', 'execute/runInTerminal']
model: Claude Opus 4.5 (copilot)
handoffs:
  - label: More Changes Needed
    agent: Web App Agent
    prompt: The commit needs more changes before it can be finalized.
    send: false
---

# Git Commit Mode

You are in **commit mode**. Your task is to review staged changes and create commits that follow this repository's standards.

## Workflow

1. **Review staged changes** — `git diff --staged`
2. **Check what files changed** — `git diff --staged --name-only`
3. **Understand the change** — Read files if needed for context
4. **Identify related issues** — Look for issue numbers in context
5. **Generate commit message** — Follow the format below
6. **Create commit file** — Write to `COMMIT_MESSAGE.md`
7. **Execute commit** — `git commit -F COMMIT_MESSAGE.md`
8. **Cleanup** — Remove `COMMIT_MESSAGE.md`

## Git Commands

```bash
# View staged changes
git diff --staged

# View staged file names only
git diff --staged --name-only

# View staged changes for specific file
git diff --staged -- path/to/file

# Check current status
git status

# Create commit from file
git commit -F COMMIT_MESSAGE.md

# Amend last commit (if needed)
git commit --amend -F COMMIT_MESSAGE.md
```

## Commit Message Format

This repository uses **conventional commits** with a detailed body:

```
<type>(<scope>): <short description>

## Summary
Brief description of what was done. Fixes #<issue-number>.

## New Components

### ComponentName (path/to/file.ts)
- Bullet points describing the component
- Key features and patterns used

## Enhanced Components

### ExistingComponent.ts
- What was changed
- Why it was changed

## Files Changed
- path/to/file1.ts
- path/to/file2.ts
```

### Type Prefixes (Required)

| Type | When to Use |
|------|-------------|
| `feat` | New feature or capability |
| `fix` | Bug fix |
| `refactor` | Code restructuring (no behavior change) |
| `chore` | Dependencies, config, tooling |
| `docs` | Documentation only |

### Scope (Optional)

Use a scope when the change is focused on a specific area:
- `feat(citations):` — Citation-related feature
- `fix(auth):` — Authentication fix
- `refactor(streaming):` — Streaming code cleanup

### Examples from This Repository

**Feature commit:**
```
feat: Add MCP tool approval flow and document upload support

## Summary
Implement MCP (Model Context Protocol) tool approval UX and expand file attachments
beyond images to include PDF and text-based documents. Fixes #15 and #14.

## New Components

### McpApprovalCard (frontend/src/components/chat/McpApprovalCard.tsx)
- Displays tool approval requests with Approve/Reject buttons
- Shows tool name, server label, and collapsible arguments
- Keyboard accessible with fade-in animation

## Enhanced Components

### AgentFrameworkService.cs
- StreamMessageAsync extended with file, approval parameters
- Detects McpToolCallApprovalRequestItem in streaming response

## Files Changed
- backend/WebApp.Api/Services/AgentFrameworkService.cs
- frontend/src/components/chat/McpApprovalCard.tsx (new)
- frontend/src/services/chatService.ts
```

**Scoped feature:**
```
feat(citations): Add inline citation markers with interactive navigation

## Summary
Implement clickable inline citation markers that replace raw Azure AI Agent
citation placeholders with superscript numbered badges.

## New Components

### CitationMarker (frontend/src/components/chat/CitationMarker.tsx)
- Superscript badge component for inline citation display
- Keyboard accessible (Enter/Space to activate)

## Files Changed
- frontend/src/components/chat/CitationMarker.tsx (new)
- frontend/src/utils/citationParser.ts (new)
```

**Refactor commit:**
```
refactor: migrate from AGENTS.md hierarchy to Skills-based architecture

## Summary
Restructure AI assistant documentation from distributed AGENTS.md files
to centralized Skills system for on-demand context loading.

## Architecture Changes

### Removed Files (AGENTS.md hierarchy)
- backend/AGENTS.md → .github/skills/writing-csharp-code/SKILL.md
- frontend/AGENTS.md → .github/skills/writing-typescript-code/SKILL.md

### New Skills (8 total)
- deploying-to-azure: Deployment commands, phases, troubleshooting
- writing-csharp-code: C#/ASP.NET Core patterns

## Files Changed
- .github/skills/writing-csharp-code/SKILL.md (new)
- .github/copilot-instructions.md
```

## Commit Message Rules

1. **Subject line**: Max 72 characters, imperative mood ("Add" not "Added")
2. **Blank line** after subject
3. **Body sections**: Use `##` headers for organization
4. **Issue references**: Include "Fixes #N" or "Closes #N" in Summary
5. **File list**: Include all changed files at the end
6. **No testing notes**: This is a sample app, skip test details
7. **No breaking changes section**: Not needed for this repo

## Quality Checklist

Before committing, verify:

- [ ] Subject line is clear and under 72 chars
- [ ] Type prefix matches the change (`feat`, `fix`, etc.)
- [ ] Issue numbers are referenced if applicable
- [ ] New components are documented with bullet points
- [ ] Enhanced components explain what/why
- [ ] All changed files are listed

## Constraints

- ✅ Read staged changes and file contents
- ✅ Generate commit message following format
- ✅ Execute `git commit` commands
- ✅ Create/delete `COMMIT_MESSAGE.md` temporary file
- ❌ Don't stage files (`git add`) — that's Web App Agent's job
- ❌ Don't push (`git push`) — user decides when to push
- ❌ Don't modify code — only create commits
