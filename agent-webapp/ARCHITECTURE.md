# Agent-WebApp Architecture

## Table of Contents
- [Overview](#overview)
- [System Architecture](#system-architecture)
- [Backend Architecture](#backend-architecture)
- [Frontend Architecture](#frontend-architecture)
- [Authentication & Authorization](#authentication--authorization)
- [Data Flow](#data-flow)
- [Deployment Architecture](#deployment-architecture)
- [Key Technologies](#key-technologies)
- [Design Patterns](#design-patterns)

---

## Overview

The Agent-WebApp is a full-stack Azure-native chat application that integrates with Azure AI Foundry Agent Services. It provides a modern, secure, and scalable web interface for interacting with AI agents.

### Key Features
- **Real-time Streaming**: Server-Sent Events (SSE) for streaming AI responses
- **File Attachments**: Support for images and documents (PDFs, text files)
- **MCP Tool Approval**: Interactive approval workflow for agent tool usage
- **Enterprise Authentication**: Microsoft Entra ID integration
- **Production Ready**: Docker containerization, Azure deployment, auto-scaling

---

## System Architecture

### High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Browser                             │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  React Frontend (SPA)                                      │  │
│  │  - React 18+ with TypeScript                               │  │
│  │  - MSAL for authentication                                 │  │
│  │  - Fluent UI components                                    │  │
│  │  - Redux-style state management                            │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS (JWT Bearer Token)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Azure Container Apps                          │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  ASP.NET Core Backend (Minimal APIs)                       │  │
│  │  - JWT token validation                                    │  │
│  │  - Chat streaming endpoints                                │  │
│  │  - Static file serving                                     │  │
│  │  - Health checks                                           │  │
│  └───────────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Managed Identity                                          │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Managed Identity (RBAC)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Azure AI Foundry                              │
│  - AI Project with configured agents                           │
│  - Responses API (v2)                                          │
│  - Model deployment                                            │
│  - File storage for attachments                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Microsoft Entra ID                            │
│  - User authentication                                         │
│  - App registration                                            │
│  - Token issuance                                              │
└─────────────────────────────────────────────────────────────────┘
```

### Component Interaction

```
User → Frontend → Backend → Azure AI Agent
  ↓       ↓         ↓            ↓
  └───→ Entra ID ←─┘            │
          ↓                      │
          └──────────────────────┘
                (RBAC)
```

---

## Backend Architecture

### Technology Stack
- **Framework**: ASP.NET Core 8+ (Minimal APIs)
- **Authentication**: Microsoft.Identity.Web (JWT Bearer)
- **AI SDK**: Azure.AI.Projects v1.2.0-beta.5
- **Configuration**: Environment variables + .env files

### Project Structure

```
backend/
├── WebApp.Api/
│   ├── Program.cs              # Application entry point & configuration
│   ├── Models/                 # Request/response DTOs
│   │   ├── ChatRequest.cs
│   │   ├── ChatResponse.cs
│   │   ├── AgentMetadata.cs
│   │   ├── FileAttachment.cs
│   │   └── AnnotationInfo.cs
│   ├── Services/
│   │   └── AgentFrameworkService.cs  # Azure AI Foundry integration
│   └── appsettings.json       # Configuration
└── WebApp.ServiceDefaults/    # Shared configuration
```

### Core Components

#### Program.cs - Application Bootstrap

**Configuration Loading**:
```csharp
// Load .env files for local development
DotNetEnv.Env.Load();

// Environment variables:
// - ENTRA_API_CLIENT_ID
// - ENTRA_TENANT_ID
// - AI_AGENT_ENDPOINT
// - AI_AGENT_ID
```

**Authentication Pipeline**:
```csharp
services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddMicrosoftIdentityWebApi(configuration)
    .EnableTokenAcquisitionToCallDownstreamApi()
    .AddInMemoryTokenCaches();
```

**CORS Configuration**:
- **Development**: Allow localhost origins (5173, 3000, 8080)
- **Production**: Restricted to application domain

**Middleware Stack**:
1. Problem Details (RFC 7807 error responses)
2. Exception Handling
3. Status Code Pages
4. Static Files (serves frontend from wwwroot)
5. Authentication
6. Authorization

#### AgentFrameworkService - AI Agent Orchestration

**Responsibilities**:
- Agent lifecycle management (caching, retrieval)
- Message streaming via Azure AI Foundry Responses API
- File attachment handling (images and documents)
- Annotation extraction (citations, file references)
- Token usage tracking
- MCP tool approval coordination

**Key Methods**:
- `GetAgentMetadataAsync()`: Retrieves agent configuration
- `StreamAgentResponseAsync()`: Handles chat streaming with SSE
- `ValidateAndProcessAttachments()`: Processes file uploads
- `ExtractAnnotations()`: Parses citations from responses

**File Handling**:
- **Images**: PNG, JPEG, GIF, WebP (max 5MB, up to 5 per message)
- **Documents**: PDF, TXT, MD, CSV, JSON, HTML, XML (max 20MB, up to 10 per message)
- Text files: Inlined as message content
- PDFs: Sent as file input to agent

### API Endpoints

#### 1. POST /api/chat/stream (Authenticated)

**Request**:
```json
{
  "message": "What is the weather?",
  "conversationId": "optional-conversation-id",
  "imageDataUris": ["data:image/png;base64,..."],
  "fileDataUris": [
    {
      "filename": "document.pdf",
      "mimeType": "application/pdf",
      "dataUri": "data:application/pdf;base64,..."
    }
  ],
  "previousResponseId": "optional-for-mcp-approval",
  "mcpApproval": {
    "approvalRequestId": "approval-id",
    "approved": true
  }
}
```

**Response** (Server-Sent Events):
```
event: conversationId
data: "conv-123"

event: chunk
data: {"text": "The weather"}

event: chunk
data: {"text": " is sunny."}

event: annotations
data: [{"type": "uri", "label": "Source", "url": "https://..."}]

event: usage
data: {"inputTokens": 50, "outputTokens": 10, "durationMs": 1200}

event: done
data: true
```

**SSE Event Types**:
- `conversationId`: Conversation ID for subsequent requests
- `chunk`: Incremental text response
- `annotations`: Citations and file references
- `mcpApprovalRequest`: Tool approval request
- `usage`: Token counts and processing time
- `done`: Stream completion signal

#### 2. GET /api/agent (Authenticated)

**Response**:
```json
{
  "name": "Customer Support Agent",
  "description": "Helps with customer inquiries",
  "model": "gpt-4",
  "metadata": {},
  "starterMessages": [
    "How can I track my order?",
    "What's your return policy?"
  ]
}
```

#### 3. GET /api/health (Authenticated)

**Response**:
```json
{
  "status": "healthy",
  "user": "user@example.com"
}
```

### Error Handling

**Error Response Format** (RFC 7807):
```json
{
  "type": "https://tools.ietf.org/html/rfc7231#section-6.5.1",
  "title": "One or more validation errors occurred.",
  "status": 400,
  "errors": {
    "Message": ["The Message field is required."]
  }
}
```

---

## Frontend Architecture

### Technology Stack
- **Framework**: React 18+ with TypeScript
- **Build Tool**: Vite
- **UI Library**: Fluent UI React 9
- **Authentication**: @azure/msal-react
- **Styling**: CSS Modules + custom CSS

### Project Structure

```
frontend/
├── src/
│   ├── main.tsx                # Application entry point
│   ├── App.tsx                 # Root component
│   ├── components/             # React components
│   │   ├── AgentPreview.tsx
│   │   ├── ChatInterface.tsx
│   │   ├── ChatInput.tsx
│   │   ├── UserMessage.tsx
│   │   ├── AssistantMessage.tsx
│   │   ├── McpApprovalCard.tsx
│   │   ├── ErrorMessage.tsx
│   │   └── SettingsPanel.tsx
│   ├── contexts/
│   │   └── AppContext.tsx      # Global state context
│   ├── reducers/
│   │   └── appReducer.ts       # State management logic
│   ├── hooks/                  # Custom React hooks
│   │   ├── useAppState.ts
│   │   ├── useAuth.ts
│   │   └── useThemeProvider.ts
│   ├── services/
│   │   └── chatService.ts      # API communication
│   ├── utils/                  # Helper functions
│   │   ├── sseParser.ts
│   │   ├── fileAttachments.ts
│   │   ├── errorHandler.ts
│   │   └── citationParser.ts
│   ├── types/                  # TypeScript definitions
│   └── config/
│       └── authConfig.ts       # MSAL configuration
├── index.html
├── vite.config.ts
└── package.json
```

### State Management Architecture

**Pattern**: Redux-style with Context API (no Redux library)

```
┌──────────────────────────────────────────────────────┐
│                    AppContext                        │
│  ┌────────────────────────────────────────────────┐  │
│  │  AppState (single source of truth)             │  │
│  │  ├── auth: {                                   │  │
│  │  │     status: "authenticated",                │  │
│  │  │     user: { name, email },                  │  │
│  │  │     error: null                             │  │
│  │  │   }                                         │  │
│  │  ├── chat: {                                   │  │
│  │  │     status: "streaming",                    │  │
│  │  │     messages: [...],                        │  │
│  │  │     conversationId: "conv-123",             │  │
│  │  │     error: null                             │  │
│  │  │   }                                         │  │
│  │  └── ui: {                                     │  │
│  │        chatInputEnabled: true                  │  │
│  │      }                                         │  │
│  └────────────────────────────────────────────────┘  │
│                         │                            │
│                    dispatch(action)                  │
│                         ▼                            │
│  ┌────────────────────────────────────────────────┐  │
│  │  appReducer (pure function)                    │  │
│  │  - Handles all state transitions               │  │
│  │  - Returns new state based on action type      │  │
│  └────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

**State Types**:

```typescript
// Authentication states
type AuthStatus = 
  | "initializing"  // Loading MSAL
  | "authenticated" // Logged in
  | "unauthenticated" // Not logged in
  | "error";        // Auth failed

// Chat states
type ChatStatus = 
  | "idle"      // Ready to send
  | "sending"   // Request in flight
  | "streaming" // Receiving chunks
  | "error";    // Request failed

// Message structure
interface IChatItem {
  role: "user" | "assistant" | "approval";
  content: string;
  timestamp: Date;
  attachments?: IAttachment[];
  annotations?: IAnnotation[];
  usage?: IUsage;
  mcpApprovalRequest?: IMcpApprovalRequest;
}
```

### Component Hierarchy

```
App
├── ErrorBoundary
│   └── AgentPreview
│       ├── Header (Agent name, description)
│       ├── ChatInterface
│       │   ├── StarterMessages (if no messages)
│       │   ├── Messages (scrollable list)
│       │   │   ├── UserMessage
│       │   │   │   ├── Content
│       │   │   │   └── Attachments
│       │   │   ├── AssistantMessage
│       │   │   │   ├── StreamingText
│       │   │   │   ├── Citations (Popover)
│       │   │   │   └── UsageInfo
│       │   │   └── McpApprovalCard
│       │   │       ├── ToolInfo
│       │   │       └── ApproveRejectButtons
│       │   └── ChatInput
│       │       ├── TextArea
│       │       ├── FileAttachments
│       │       └── SendButton
│       ├── ErrorMessage (if error)
│       ├── SettingsPanel (sidebar)
│       │   ├── ThemePicker
│       │   └── AgentInfo
│       └── BuiltWithBadge
```

### Key Services

#### ChatService - API Communication

**Responsibilities**:
- Token acquisition via MSAL
- File conversion to Base64 data URIs
- Message sending with retry logic
- SSE stream processing
- MCP approval handling
- Error recovery

**Key Methods**:

```typescript
class ChatService {
  // Send a new message
  async sendMessage(
    message: string,
    conversationId: string | null,
    images: File[],
    files: File[],
    dispatch: Dispatch
  ): Promise<void>

  // Handle MCP tool approval
  async sendMcpApproval(
    previousResponseId: string,
    approvalRequestId: string,
    approved: boolean,
    dispatch: Dispatch
  ): Promise<void>

  // Process SSE stream
  private async processStream(
    reader: ReadableStreamDefaultReader,
    dispatch: Dispatch
  ): Promise<void>

  // Convert files to data URIs
  private async convertFilesToDataUris(
    files: File[]
  ): Promise<FileDataUri[]>
}
```

**Error Handling & Retry**:
- Automatic retry with exponential backoff (max 3 attempts)
- Token expiration detection and re-authentication
- Network error recovery
- Typed error responses with user-friendly messages

### Custom Hooks

#### useAppState() - State Selectors

```typescript
function useAppState() {
  const { state } = useAppContext();
  
  return {
    // Direct state
    auth: state.auth,
    chat: state.chat,
    ui: state.ui,
    
    // Computed values
    isAuthenticated: state.auth.status === "authenticated",
    isChatBusy: ["sending", "streaming"].includes(state.chat.status),
    canSendMessage: state.ui.chatInputEnabled && !isChatBusy,
    isStreaming: state.chat.status === "streaming",
    
    // Helpers
    getLastMessage: () => state.chat.messages[state.chat.messages.length - 1],
    hasMessages: state.chat.messages.length > 0
  };
}
```

#### useAuth() - MSAL Integration

```typescript
function useAuth() {
  const { instance, accounts } = useMsal();
  
  const acquireToken = async (): Promise<string> => {
    // Acquire token with retry logic
    // Handles silent token acquisition and interactive fallback
  };
  
  return { acquireToken };
}
```

### Utilities

#### SSE Parser

```typescript
// Parses Server-Sent Events from stream
function parseSSE(buffer: string): {
  events: Array<{ event: string; data: string }>;
  remainder: string;
}
```

#### Citation Parser

```typescript
// Marks citations in text with numbered badges
function markCitations(
  text: string,
  annotations: IAnnotation[]
): React.ReactNode[]
```

#### File Attachment Converter

```typescript
// Converts File objects to Base64 data URIs
async function fileToDataUri(file: File): Promise<string>

// Validates file MIME types and sizes
function validateFile(file: File): { valid: boolean; error?: string }
```

---

## Authentication & Authorization

### Authentication Flow

```
1. User navigates to app
   ↓
2. Frontend: MSAL redirect to Entra ID login
   ↓
3. User authenticates with Entra ID
   ↓
4. Entra ID returns authorization code
   ↓
5. MSAL exchanges code for tokens (PKCE flow)
   ├── ID Token (user identity)
   └── Access Token (API access with scope: Chat.ReadWrite)
   ↓
6. Frontend stores tokens in localStorage
   ↓
7. Frontend sends API requests with Bearer token
   ↓
8. Backend validates JWT signature and claims
   ├── Audience: API client ID
   ├── Issuer: Entra tenant
   └── Scope: Chat.ReadWrite
   ↓
9. Backend uses Managed Identity for Azure AI Foundry access
```

### MSAL Configuration

**Frontend** (authConfig.ts):
```typescript
export const msalConfig = {
  auth: {
    clientId: process.env.VITE_ENTRA_SPA_CLIENT_ID,
    authority: `https://login.microsoftonline.com/${tenantId}`,
    redirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: "localStorage",
    storeAuthStateInCookie: false,
  }
};

export const loginRequest = {
  scopes: [`api://${apiClientId}/Chat.ReadWrite`]
};
```

**Backend** (appsettings.json):
```json
{
  "AzureAd": {
    "Instance": "https://login.microsoftonline.com/",
    "TenantId": "<tenant-id>",
    "ClientId": "<api-client-id>",
    "Audience": "api://<api-client-id>"
  }
}
```

### Security Features

1. **Token Validation**:
   - JWT signature verification
   - Audience validation (prevents token reuse)
   - Issuer validation (correct tenant)
   - Scope validation (Chat.ReadWrite required)

2. **CORS Protection**:
   - Development: Restricted to localhost
   - Production: Single domain only

3. **Managed Identity**:
   - Backend uses system-assigned managed identity
   - No credential storage in code
   - RBAC-based access to Azure AI Foundry

4. **Content Security**:
   - File type validation (MIME type checking)
   - File size limits
   - Base64 encoding validation

---

## Data Flow

### Sending a Message

```
┌─────────────────────────────────────────────────────────────┐
│  1. User Input                                              │
│     - Types message                                         │
│     - Attaches files (optional)                             │
│     - Clicks send                                           │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│  2. ChatInput Component                                     │
│     - Validates input                                       │
│     - Converts files to Base64 data URIs                    │
│     - Dispatches CHAT_SEND_MESSAGE action                   │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│  3. AppReducer (Optimistic Update)                          │
│     - Adds user message to state                            │
│     - Sets status to "sending"                              │
│     - Disables chat input                                   │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│  4. ChatService.sendMessage()                               │
│     - Acquires access token (MSAL)                          │
│     - Constructs request body                               │
│     - POST /api/chat/stream with retry                      │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│  5. Backend Endpoint                                        │
│     - Validates JWT + scope                                 │
│     - Creates/retrieves conversation                        │
│     - Processes file attachments                            │
│     - Calls Azure AI Foundry Responses API                  │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│  6. Azure AI Foundry                                        │
│     - Processes message with agent                          │
│     - Streams response chunks                               │
│     - Generates citations                                   │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│  7. SSE Stream Processing                                   │
│     Event: conversationId                                   │
│       → Dispatch CHAT_START_STREAM                          │
│     Event: chunk                                            │
│       → Dispatch CHAT_STREAM_CHUNK (streaming UI)           │
│     Event: annotations                                      │
│       → Dispatch CHAT_STREAM_ANNOTATIONS                    │
│     Event: mcpApprovalRequest                               │
│       → Dispatch CHAT_MCP_APPROVAL_REQUEST (pause)          │
│     Event: usage                                            │
│       → Dispatch CHAT_STREAM_COMPLETE                       │
│     Event: done                                             │
│       → Stream ends                                         │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│  8. UI Rendering                                            │
│     - AssistantMessage shows streaming text                 │
│     - Citation badges with popovers                         │
│     - McpApprovalCard if approval needed                    │
│     - Token usage information                               │
│     - Re-enable chat input                                  │
└─────────────────────────────────────────────────────────────┘
```

### MCP Tool Approval Flow

```
┌─────────────────────────────────────────────────────────────┐
│  1. Agent requests tool approval                            │
│     - Tool name: "search_database"                          │
│     - Arguments: {"query": "sales data"}                    │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│  2. Backend sends mcpApprovalRequest event                  │
│     {                                                       │
│       "approvalRequestId": "approval-123",                  │
│       "toolName": "search_database",                        │
│       "arguments": { "query": "sales data" }                │
│     }                                                       │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│  3. Frontend dispatches CHAT_MCP_APPROVAL_REQUEST           │
│     - Stream pauses                                         │
│     - Stores approval request in state                      │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│  4. McpApprovalCard renders                                 │
│     - Shows tool name and arguments                         │
│     - Displays "Approve" and "Reject" buttons               │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│  5. User clicks Approve/Reject                              │
│     - Dispatches CHAT_MCP_APPROVAL_RESPONSE                 │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│  6. ChatService.sendMcpApproval()                           │
│     - Sends approval decision to backend                    │
│     - previousResponseId: response ID from step 2           │
│     - mcpApproval: { approvalRequestId, approved }          │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│  7. Backend resumes stream                                  │
│     - If approved: Agent executes tool                      │
│     - If rejected: Agent continues without tool             │
│     - Stream continues with remaining response              │
└─────────────────────────────────────────────────────────────┘
```

---

## Deployment Architecture

### Azure Resources

```
┌─────────────────────────────────────────────────────────────┐
│                    Resource Group                           │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Azure Container Registry (ACR)                       │  │
│  │  - Stores Docker images                               │  │
│  │  - SKU: Basic                                         │  │
│  └───────────────────────────────────────────────────────┘  │
│                         │                                   │
│                         │ (image pull)                      │
│                         ▼                                   │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Container Apps Environment                           │  │
│  │  - Managed Kubernetes environment                     │  │
│  │  - Auto-scaling configuration                         │  │
│  └───────────────────────────────────────────────────────┘  │
│                         │                                   │
│                         ▼                                   │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Container App (Web)                                  │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │  Container                                       │  │  │
│  │  │  - ASP.NET Core backend                          │  │  │
│  │  │  - React frontend (wwwroot)                      │  │  │
│  │  │  - Port: 80                                      │  │  │
│  │  │  - CPU: 0.5 vCPU                                 │  │  │
│  │  │  - Memory: 1 GB                                  │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │  Managed Identity (System-assigned)             │  │  │
│  │  │  - Azure AI Foundry RBAC                        │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │  Environment Variables                          │  │  │
│  │  │  - ENTRA_SPA_CLIENT_ID                          │  │  │
│  │  │  - ENTRA_API_CLIENT_ID                          │  │  │
│  │  │  - ENTRA_TENANT_ID                              │  │  │
│  │  │  - AI_AGENT_ENDPOINT                            │  │  │
│  │  │  - AI_AGENT_ID                                  │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │  Ingress                                        │  │  │
│  │  │  - HTTPS enabled (SSL termination)             │  │  │
│  │  │  - External traffic allowed                    │  │  │
│  │  │  - Custom domain support                       │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
│                         │                                   │
│                         ▼                                   │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Log Analytics Workspace                              │  │
│  │  - Application logs                                   │  │
│  │  - System logs                                        │  │
│  │  - Metrics                                            │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Infrastructure as Code (Bicep)

**Main Template** (`infra/main.bicep`):
```bicep
// Parameters
param location string = resourceGroup().location
param containerAppName string
param acrName string

// Modules
module acr 'modules/acr.bicep' = { ... }
module containerAppEnv 'modules/container-app-env.bicep' = { ... }
module containerApp 'modules/container-app.bicep' = { ... }
module logAnalytics 'modules/log-analytics.bicep' = { ... }
```

### Deployment Workflow

```
┌─────────────────────────────────────────────────────────────┐
│  azd up                                                     │
└─────────────────────────────────────────────────────────────┘
          │
          ├── preprovision hook
          │   ├── Create Entra app registration (if not exists)
          │   ├── Generate .env files
          │   └── Set environment variables
          │
          ├── azd provision
          │   ├── Deploy ACR
          │   ├── Deploy Container Apps Environment
          │   ├── Deploy Log Analytics
          │   └── Deploy Container App (placeholder image)
          │
          ├── postprovision hook
          │   ├── Update Entra redirect URIs
          │   └── Assign RBAC (Managed Identity → AI Foundry)
          │
          ├── predeploy hook
          │   ├── Build frontend (npm run build)
          │   ├── Build Docker image
          │   └── Push to ACR
          │
          └── azd deploy
              └── Update Container App with new image
```

### Docker Multi-Stage Build

```dockerfile
# Stage 1: Build frontend
FROM node:18-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci --legacy-peer-deps
COPY frontend/ ./
RUN npm run build

# Stage 2: Build backend
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS backend-build
WORKDIR /app
COPY backend/ ./
COPY --from=frontend-build /app/frontend/dist ./WebApp.Api/wwwroot
RUN dotnet publish WebApp.Api/WebApp.Api.csproj -c Release -o out

# Stage 3: Runtime
FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
COPY --from=backend-build /app/out ./
ENV ASPNETCORE_URLS=http://+:80
EXPOSE 80
ENTRYPOINT ["dotnet", "WebApp.Api.dll"]
```

### Configuration Management

**Development** (.env files):
```bash
# backend/.env
ENTRA_API_CLIENT_ID=<api-client-id>
ENTRA_TENANT_ID=<tenant-id>
AI_AGENT_ENDPOINT=https://<project>.api.azureml.ms
AI_AGENT_ID=<agent-name>

# frontend/.env
VITE_ENTRA_SPA_CLIENT_ID=<spa-client-id>
VITE_ENTRA_API_CLIENT_ID=<api-client-id>
VITE_ENTRA_TENANT_ID=<tenant-id>
```

**Production** (Environment Variables):
- Set via Bicep templates
- Stored in Azure Container App configuration
- Managed by azd environment

---

## Key Technologies

### Backend
| Technology | Purpose | Version |
|------------|---------|---------|
| ASP.NET Core | Web framework | 8+ |
| Microsoft.Identity.Web | JWT authentication | Latest |
| Azure.AI.Projects | AI Foundry SDK | v1.2.0-beta.5 |
| DotNetEnv | .env file loading | Latest |

### Frontend
| Technology | Purpose | Version |
|------------|---------|---------|
| React | UI framework | 18+ |
| TypeScript | Type safety | Latest |
| Vite | Build tool | Latest |
| Fluent UI React | Component library | 9 |
| @azure/msal-react | Authentication | Latest |

### Infrastructure
| Technology | Purpose |
|------------|---------|
| Azure Container Apps | Serverless containers |
| Azure Container Registry | Image storage |
| Azure AI Foundry | AI agent service |
| Microsoft Entra ID | Identity provider |
| Azure Bicep | IaC templates |
| Azure Developer CLI (azd) | Deployment automation |

---

## Design Patterns

### Backend Patterns

1. **Minimal API Pattern**
   - Lightweight endpoints without controllers
   - Functional programming style
   - Reduced boilerplate

2. **Dependency Injection**
   - Services registered in Program.cs
   - Constructor injection for testability
   - Scoped lifetimes for per-request state

3. **Stream Processing**
   - Server-Sent Events for real-time updates
   - Async/await throughout
   - IAsyncEnumerable for streaming

4. **Problem Details (RFC 7807)**
   - Standardized error responses
   - Machine-readable error format
   - Consistent error handling

### Frontend Patterns

1. **Redux-Style State Management**
   - Single source of truth (AppState)
   - Pure reducer functions
   - Action-based state updates
   - No external Redux library (using Context API)

2. **Custom Hooks**
   - Encapsulated logic reuse
   - Separation of concerns
   - Computed values (selectors)

3. **Service Layer**
   - API communication abstraction
   - Centralized error handling
   - Retry logic and resilience

4. **Component Composition**
   - Small, focused components
   - Props-based communication
   - Presentational vs. container components

5. **Optimistic UI Updates**
   - Immediate feedback to users
   - Rollback on error
   - Enhanced perceived performance

### Architectural Patterns

1. **Single Container Deployment**
   - Frontend served as static files from backend
   - Simplified deployment and routing
   - Reduced infrastructure complexity

2. **Managed Identity**
   - No credential storage
   - Azure AD service principal
   - RBAC-based access control

3. **Infrastructure as Code**
   - Bicep templates for reproducibility
   - Environment-based configuration
   - Automated deployment pipeline

4. **Streaming Architecture**
   - Server-Sent Events for real-time updates
   - Incremental response rendering
   - Enhanced user experience for long-running operations

---

## Security Considerations

### Authentication & Authorization
- ✅ Microsoft Entra ID integration
- ✅ JWT token validation (signature, audience, issuer)
- ✅ Scope-based authorization (Chat.ReadWrite)
- ✅ Token caching and automatic refresh
- ✅ Secure token storage (localStorage with MSAL)

### Network Security
- ✅ HTTPS only in production
- ✅ CORS restrictions
- ✅ SSL termination at ingress

### Data Security
- ✅ File type validation (MIME type checking)
- ✅ File size limits
- ✅ Base64 encoding validation
- ✅ No credential storage in code
- ✅ Environment variable-based secrets

### Azure Security
- ✅ Managed Identity for service-to-service auth
- ✅ RBAC for Azure AI Foundry access
- ✅ Private container registry
- ✅ Application logs in Log Analytics

---

## Performance Considerations

### Frontend Optimization
- **Code Splitting**: Vite automatically splits chunks
- **Lazy Loading**: Components loaded on demand
- **Memoization**: React.memo for expensive components
- **Debouncing**: Input debouncing for search/filter
- **Virtual Scrolling**: Can be added for long message lists

### Backend Optimization
- **Streaming**: Reduces time-to-first-byte
- **Caching**: Agent metadata cached in memory
- **Async/Await**: Non-blocking I/O operations
- **Connection Pooling**: HTTP client reuse

### Deployment Optimization
- **Multi-Stage Docker Build**: Minimal image size
- **Static File Serving**: Efficient frontend delivery
- **CDN-Ready**: Static assets can be offloaded to CDN
- **Auto-Scaling**: Container Apps scales based on load
- **Scale-to-Zero**: Reduces costs during inactivity

---

## Monitoring & Observability

### Logging
- **ASP.NET Core Logging**: Structured logging to console
- **Log Analytics**: Centralized log aggregation
- **Log Levels**: Information, Warning, Error, Critical
- **PII Logging**: Enabled in development only

### Metrics
- **Container Apps Metrics**: CPU, memory, request count
- **HTTP Metrics**: Request duration, status codes
- **Token Usage**: Input/output token counts tracked

### Health Checks
- **Authenticated Health Endpoint**: Validates auth pipeline
- **Dependency Checks**: Can be extended for AI Foundry health
- **Startup Probes**: Ensures container ready before traffic

---

## Future Enhancements

### Planned Features
- [ ] Conversation history persistence (database integration)
- [ ] Multi-agent support (agent switching)
- [ ] File upload to Azure Storage (replace Base64)
- [ ] Advanced citation rendering (code blocks, tables)
- [ ] Voice input/output
- [ ] Mobile app (React Native)
- [ ] Offline support (Service Worker)

### Scalability Improvements
- [ ] Redis cache for session state
- [ ] Azure CDN for static assets
- [ ] Database for conversation persistence
- [ ] Message queuing for background tasks
- [ ] Horizontal scaling with sticky sessions

### Security Enhancements
- [ ] Content Security Policy (CSP)
- [ ] Rate limiting
- [ ] Input sanitization
- [ ] File malware scanning
- [ ] Audit logging

---

## References

### Documentation
- [ASP.NET Core Minimal APIs](https://learn.microsoft.com/en-us/aspnet/core/fundamentals/minimal-apis)
- [Azure AI Foundry SDK](https://learn.microsoft.com/en-us/azure/ai-studio/)
- [React Documentation](https://react.dev/)
- [Azure Container Apps](https://learn.microsoft.com/en-us/azure/container-apps/)
- [Microsoft Entra ID](https://learn.microsoft.com/en-us/entra/identity/)
- [MSAL.js Documentation](https://github.com/AzureAD/microsoft-authentication-library-for-js)

### Code Repositories
- Backend: `/backend/WebApp.Api/`
- Frontend: `/frontend/`
- Infrastructure: `/infra/`
- Deployment: `/deployment/`

---

## Glossary

- **AZD**: Azure Developer CLI - Command-line tool for deploying Azure applications
- **Bicep**: Infrastructure as Code (IaC) language for Azure
- **Entra ID**: Microsoft's identity platform (formerly Azure AD)
- **JWT**: JSON Web Token - Standard for secure authentication
- **MCP**: Model Context Protocol - Framework for AI tool usage with user approval
- **MSAL**: Microsoft Authentication Library
- **PKCE**: Proof Key for Code Exchange - OAuth 2.0 security extension
- **RBAC**: Role-Based Access Control
- **SSE**: Server-Sent Events - HTTP streaming protocol
- **Managed Identity**: Azure AD service principal for Azure resources

---

**Document Version**: 1.0  
**Last Updated**: 2026-02-13  
**Maintained By**: Development Team
