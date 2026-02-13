**Purpose**: AI-powered web application with Entra ID authentication and Azure AI Foundry Agent Service integration.

## Architecture Quick Reference

| Layer | Tech | Port | Entry Point |
|-------|------|------|-------------|
| **Frontend** | React 19 + Vite | 5173 | `frontend/src/App.tsx` |
| **Backend** | ASP.NET Core 9 | 8080 | `backend/WebApp.Api/Program.cs` |
| **Auth** | MSAL.js → JWT Bearer | — | `frontend/src/config/authConfig.ts` |
| **AI SDK** | Azure.AI.Projects + Agent Framework | — | `backend/.../AgentFrameworkService.cs` |
| **Deploy** | Azure Container Apps | — | `infra/main.bicep` |

**Key Flow**: React → MSAL token → POST /api/chat/stream → AI Foundry → SSE chunks → UI

## Development

```powershell
# Start both servers (VS Code compound task)
# Ctrl+Shift+B → "Start Dev (VS Code Terminals)"

# Or run azd up for full deployment
azd up
```

## Subagent-First Research

For complex or multi-file tasks, delegate research to a subagent before making changes:

```
runSubagent(
  agentName: "Web App Agent",
  description: "Research [topic]",
  prompt: "RESEARCH: [goal]. Work autonomously. Return: [file paths, patterns, line numbers]. Max 50 lines."
)
```

**Parameters**: `agentName` (optional), `description` (3-5 words), `prompt` (detailed task)

**What subagents research**: Codebase patterns, SDK docs, GitHub examples, browser testing, deployment logs.

## Agents

| Agent | Purpose | When to Use |
|-------|---------|-------------|
| `Web App Agent` | Full implementation mode with all tools | Building features, fixing bugs, code changes |
| `Plan Feature` | Read-only planning mode | Design before implementing, multi-step features |
| `Review Issues` | GitHub issue analysis and categorization | Reviewing issues, prioritizing work, assigning labels |
| `Review Docs` | Documentation quality assurance | Reviewing READMEs, skills, agents for consistency |
| `Git Commit` | Git commit with repository standards | Creating detailed commits following conventions |
| `SDK Research` | SDK version analysis and upgrade planning | Analyzing outdated packages, finding breaking changes, planning updates |
| `Test Agent` | UI testing with Playwright | Validating theme, new chat, cancel stream, markdown, token usage |

**Workflow**: Use `Review Issues` to analyze issues → `Plan Feature` for implementation design → `Web App Agent` for implementation → `Test Agent` for UI validation → `Review Docs` for documentation updates → `Git Commit` for standardized commits. Use `SDK Research` periodically to check for SDK updates.

## Skills (ALWAYS Load First)

**CRITICAL**: Before ANY code exploration or subagent research, FIRST read relevant skill files to understand project patterns and conventions. Skills provide the "how things work here" context that makes code exploration productive.

| Skill | Domain |
|-------|--------|
| `writing-csharp-code` | Backend, API, SDK |
| `writing-typescript-code` | Frontend, React, MSAL |
| `implementing-chat-streaming` | SSE, streaming |
| `troubleshooting-authentication` | 401s, tokens |
| `deploying-to-azure` | azd, deployment |
| `researching-azure-ai-sdk` | SDK deep-dive |
| `testing-with-playwright` | Browser testing |
| `writing-bicep-templates` | Infrastructure |
| `validating-ui-features` | Theme, new chat, cancel, markdown, token usage |
