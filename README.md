# BrandComm-agent

## Project Overview

BrandComm-agent is an AI-powered web application featuring Microsoft Entra ID authentication and Azure AI Foundry Agent Service integration. The application provides a chat interface that connects users with AI agents powered by Azure AI Foundry, enabling intelligent conversations with file upload support and real-time streaming responses.

**Tech Stack:**
- **Frontend:** React 19 + TypeScript + Vite
- **Backend:** ASP.NET Core 9 Minimal APIs  
- **Authentication:** Microsoft Entra ID (MSAL with PKCE flow)
- **AI Integration:** Azure AI Foundry v2 Agents API
- **Deployment:** Azure Container Apps (single container pattern)

## Prerequisites

Before setting up the project, ensure you have the following installed:

### Windows
- **PowerShell 7+** - `winget install Microsoft.PowerShell`
- **Azure Developer CLI (azd)** - `winget install microsoft.azd`
- **Azure CLI** - `winget install Microsoft.AzureCLI`
- **.NET 9 SDK** - Download from https://dot.net
- **Node.js 18+** - Download from https://nodejs.org
- **Docker Desktop** (optional) - Download from https://docs.docker.com/desktop/install/windows-install/

### macOS
- **PowerShell 7+** - `brew install powershell` or download from GitHub
- **Azure Developer CLI (azd)** - `brew tap azure/azd && brew install azd`
- **Azure CLI** - `brew install azure-cli`
- **.NET 9 SDK** - Download from https://dot.net
- **Node.js 18+** - `brew install node` or download from https://nodejs.org
- **Docker Desktop** (optional) - `brew install --cask docker`

### Linux
- **PowerShell 7+** - Follow instructions at https://learn.microsoft.com/powershell/scripting/install/installing-powershell-on-linux
- **Azure Developer CLI (azd)** - `curl -fsSL https://aka.ms/install-azd.sh | bash`
- **Azure CLI** - Follow instructions at https://learn.microsoft.com/cli/azure/install-azure-cli-linux
- **.NET 9 SDK** - Download from https://dot.net
- **Node.js 18+** - Download from https://nodejs.org
- **Docker Engine** (optional) - Follow instructions at https://docs.docker.com/engine/install/

### Azure Requirements
- **Azure Subscription** with Contributor role
- **Azure AI Foundry Resource** - Create at https://ai.azure.com with at least one agent configured

> **Note:** Docker is optional. If not installed, `azd` automatically uses Azure Container Registry cloud build for deployment.

## Setup Instructions

### 1. Clone the Repository

```bash
git clone https://github.com/joyjeet/BrandComm-agent.git
cd BrandComm-agent
```

### 2. Deploy to Azure (Recommended for First-Time Setup)

The easiest way to get started is to deploy to Azure, which will automatically configure everything:

```powershell
# Navigate to the agent-webapp directory
cd agent-webapp

# Deploy everything (creates infrastructure, builds, and deploys)
azd up
```

This command will:
1. Create Microsoft Entra ID app registration automatically
2. Deploy Azure infrastructure (Container Registry, Container Apps)
3. Build and deploy your application
4. Generate `.env` files for local development
5. Open your browser to the deployed application

**Deployment time:** ~10-12 minutes

### 3. Local Development Setup

After running `azd up` at least once, you can develop locally:

#### Option A: Using VS Code Tasks (Recommended)

1. Open the `agent-webapp` folder in VS Code
2. Press `Ctrl+Shift+B` (or `Cmd+Shift+B` on macOS)
3. Select "Start Dev (VS Code Terminals)" 

This will start both frontend and backend servers with hot reload enabled.

#### Option B: Using PowerShell Script

```powershell
cd agent-webapp
.\deployment\scripts\start-local-dev.ps1
```

This spawns separate terminal windows for frontend and backend.

#### Option C: Manual Setup

**Terminal 1 - Backend:**
```powershell
cd agent-webapp/backend/WebApp.Api
dotnet run
```

**Terminal 2 - Frontend:**
```powershell
cd agent-webapp/frontend
npm install --legacy-peer-deps
npm run dev
```

### 4. Access the Application

- **Local Development:** http://localhost:5173
- **Production (Azure):** https://your-app-name.azurecontainerapps.io (URL shown after `azd up`)

## How to Run the Project

### Running Locally

1. **Ensure prerequisites are installed** (see Prerequisites section)
2. **Run `azd up` once** to configure Azure resources and generate local configuration files
3. **Start development servers:**
   ```powershell
   cd agent-webapp
   .\deployment\scripts\start-local-dev.ps1
   ```
4. **Open your browser** to http://localhost:5173
5. **Sign in** with your Microsoft account
6. **Start chatting** with the AI agent

**Features available locally:**
- Hot Module Replacement (HMR) for instant frontend updates
- Auto-recompilation for backend changes
- Full authentication flow
- AI agent interactions
- File upload support

### Running on Azure

After initial deployment with `azd up`:

**Deploy code changes:**
```powershell
cd agent-webapp
azd deploy  # Deploy code changes only (~3-5 minutes)
```

**Full redeployment (infrastructure + code):**
```powershell
azd up  # Full deployment (~10-12 minutes)
```

### Common Commands

| Command | Purpose | Duration |
|---------|---------|----------|
| `azd up` | Initial deployment (infra + code) | 10-12 min |
| `azd deploy` | Deploy code changes only | 3-5 min |
| `azd provision` | Re-deploy infrastructure / update RBAC | 2-3 min |
| `azd down --force --purge` | Delete all Azure resources | 2-3 min |
| `.\deployment\scripts\start-local-dev.ps1` | Start local development | Instant |
| `.\deployment\scripts\list-agents.ps1` | List available AI agents | Instant |

## Project Structure

```
BrandComm-agent/
├── agent-webapp/              # Main application directory
│   ├── backend/               # ASP.NET Core API
│   │   └── WebApp.Api/        # API endpoints + serves frontend
│   ├── frontend/              # React + TypeScript + Vite
│   │   ├── src/               # Source code
│   │   └── package.json       # Node dependencies
│   ├── infra/                 # Bicep infrastructure templates
│   ├── deployment/            # Deployment scripts and hooks
│   │   ├── hooks/             # azd lifecycle automation
│   │   ├── scripts/           # User commands
│   │   └── docker/            # Multi-stage Dockerfile
│   └── README.md              # Detailed project documentation
├── LICENSE                    # Project license
└── README.md                  # This file (setup instructions)
```

## Configuration

### Switching AI Agents

List available agents:
```powershell
cd agent-webapp
.\deployment\scripts\list-agents.ps1
```

Switch to a different agent:
```powershell
azd env set AI_AGENT_ID <agent-name>
azd deploy
```

### Environment Variables

Configuration is managed through `.env` files (auto-generated by `azd up`):

**Backend (`.env`):**
- `AzureAd__ClientId` - Entra ID application client ID
- `AzureAd__TenantId` - Entra ID tenant ID
- `AI_AGENT_ENDPOINT` - Azure AI Foundry endpoint
- `AI_AGENT_ID` - Agent identifier

**Frontend (`.env.local`):**
- `VITE_ENTRA_SPA_CLIENT_ID` - SPA client ID for authentication
- `VITE_ENTRA_TENANT_ID` - Tenant ID

## Troubleshooting

### Local Development Issues

| Issue | Solution |
|-------|----------|
| Port 5173 or 8080 already in use | Stop other applications using these ports |
| Authentication fails | Run `az login` to authenticate with Azure |
| Missing `.env` files | Run `azd up` to generate configuration |
| Module not found (frontend) | Run `npm install --legacy-peer-deps` in frontend directory |
| Backend won't start | Ensure .NET 9 SDK is installed and `.env` exists |

### Deployment Issues

| Issue | Solution |
|-------|----------|
| `azd up` fails | Check Azure subscription permissions |
| No AI agents found | Create an agent in Azure AI Foundry at https://ai.azure.com |
| Docker build fails | Let azd use cloud build (works without Docker installed) |

## Additional Documentation

For more detailed information, refer to:
- **Application Documentation:** [agent-webapp/README.md](agent-webapp/README.md)
- **Backend Details:** [agent-webapp/backend/README.md](agent-webapp/backend/README.md)
- **Frontend Details:** [agent-webapp/frontend/README.md](agent-webapp/frontend/README.md)
- **Infrastructure:** [agent-webapp/infra/README.md](agent-webapp/infra/README.md)
- **Deployment:** [agent-webapp/deployment/README.md](agent-webapp/deployment/README.md)

## Contributing

This project is part of the BrandComm-agent initiative. For development guidelines and contribution instructions, please refer to the detailed documentation in the `agent-webapp` directory.

## License

See [LICENSE](LICENSE) file for details.