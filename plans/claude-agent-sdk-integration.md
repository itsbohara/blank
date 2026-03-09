# Claude Agent SDK Integration Plan

## Overview

Integrate the **Claude Agent SDK** (`@anthropic-ai/claude-agent-sdk`) into the Blank platform backend to enable AI agents that can autonomously read, edit, and execute commands in sandbox containers.

## Architecture

```
┌─────────────────┐      ┌─────────────────────────────┐      ┌─────────────────┐
│   Frontend      │      │   Blank Backend (Next.js)     │      │   blank-sandbox │
│   (assistant-ui)  │◄────►│   /api/session/{id}/message │◄────►│   (containers)  │
│                 │      │                             │      │                 │
│  - Chat UI      │      │  - Claude Agent SDK         │      │  - File APIs     │
│  - Streaming    │      │  - Custom Tool Handlers     │      │  - Shell exec    │
│  - Tool logs    │      │  - Anthropic API key        │      │  - Session mgmt  │
└─────────────────┘      └─────────────────────────────┘      └─────────────────┘
```

## Critical Design Decision: Custom Tool Implementations Required

**⚠️ The Agent SDK's default tools CANNOT be used as-is.**

The Agent SDK (`@anthropic-ai/claude-agent-sdk`) includes built-in tools (`Read`, `Edit`, `Bash`, `Glob`, `Grep`) that operate on the **local filesystem** of the Next.js server. However:

- User code lives in **separate sandbox containers** (blank-sandbox), not on the Next.js server
- Each session has an isolated container with its own filesystem
- We **must override every tool** to call the blank-sandbox HTTP API instead

### Why Override is Mandatory

```
Agent SDK Default Behavior (WRONG for Blank):
  Read("/app/page.tsx") → reads from Next.js server disk ❌

Required Custom Behavior (CORRECT for Blank):
  Read("/app/page.tsx") → calls GET /api/files/app/page.tsx?sessionId={id}
                        → returns file from user's container ✅
```

**Without custom tool implementations, the AI would:**
- Read/edit files from your Next.js server instead of the user's project
- Execute bash commands on your server instead of the sandbox container
- Completely break session isolation between users

### Tool Override Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Claude Agent SDK (backend)                             │
│                                                                              │
│   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                  │
│   │  Read Tool   │    │  Edit Tool   │    │  Bash Tool   │                  │
│   │   (override) │    │   (override) │    │   (override) │                  │
│   └──────┬───────┘    └──────┬───────┘    └──────┬───────┘                  │
│          │                    │                    │                           │
│          └────────────────────┼────────────────────┘                           │
│                               │                                              │
│                               ▼                                              │
│                    ┌─────────────────────┐                                   │
│                    │  Tool Handler Layer │ ← YOU MUST IMPLEMENT THIS        │
│                    │  (lib/agent-sdk/)   │                                   │
│                    └──────────┬──────────┘                                   │
│                               │                                              │
│                               │ HTTP calls                                   │
└───────────────────────────────┼──────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         blank-sandbox (separate service)                    │
│                                                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │  Session Container (e.g., session_abc123)                          │   │
│   │                                                                      │   │
│   │   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │   │
│   │   │  /app/       │  │  /components/│  │  package.json│               │   │
│   │   │  page.tsx    │  │  ui/         │  │              │               │   │
│   │   └──────────────┘  └──────────────┘  └──────────────┘               │   │
│   │                                                                      │   │
│   │   ┌──────────────┐  ┌──────────────┐                                │   │
│   │   │  Terminal    │  │  Dev Server  │                                │   │
│   │   │  (bash)      │  │  (port 3000) │                                │   │
│   │   └──────────────┘  └──────────────┘                                │   │
│   │                                                                      │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│   API Endpoints:                                                             │
│   GET    /api/files?sessionId={id}              ← List files                │
│   GET    /api/files/[path]?sessionId={id}       ← Read file                 │
│   POST   /api/files?sessionId={id}              ← Write/Edit file           │
│   POST   /api/shell/execute?sessionId={id}      ← Execute command           │
│   GET    /api/files/search?sessionId={id}       ← Search/grep               │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Bottom line:** Every tool the Agent SDK might use (`Read`, `Edit`, `Bash`, `Glob`, `Grep`) **must be wrapped or overridden** to proxy through to the blank-sandbox API.

## Implementation Steps

### Phase 1: Install Agent SDK

**Files to modify:**
- `package.json` - Add `@anthropic-ai/claude-agent-sdk`

**Commands:**
```bash
bun add @anthropic-ai/claude-agent-sdk
```

### Phase 2: Create Custom Tool Implementations

**New files:**
- `lib/agent-sdk/tools/read.ts` - Custom Read tool calling sandbox file API
- `lib/agent-sdk/tools/edit.ts` - Custom Edit tool calling sandbox file API  
- `lib/agent-sdk/tools/bash.ts` - Custom Bash tool calling sandbox shell API
- `lib/agent-sdk/tools/glob.ts` - Custom Glob tool calling sandbox file listing
- `lib/agent-sdk/tools/grep.ts` - Custom Grep tool for searching code
- `lib/agent-sdk/index.ts` - Agent SDK setup with custom tools

**Tool API Mapping:**

| Agent SDK Tool | blank-sandbox API |
|----------------|-------------------|
| `Read` | `GET /api/files/{path}?sessionId={id}` |
| `Write` | `POST /api/files?sessionId={id}` |
| `Edit` | `POST /api/files?sessionId={id}` (with diff) |
| `Bash` | `POST /api/shell/execute?sessionId={id}` |
| `Glob` | `GET /api/files?sessionId={id}&pattern={glob}` |
| `Grep` | `GET /api/files/search?sessionId={id}&pattern={pattern}` |

### Phase 3: Create Agent SDK API Route

**New file:**
- `app/api/session/[sessionId]/message/route.ts`

**Responsibilities:**
1. Receive user message from frontend
2. Initialize Agent SDK with session context
3. Stream agent responses back to frontend
4. Execute custom tools against blank-sandbox
5. Return tool call results to agent for next iteration

**Key implementation details:**
- Use `query()` from Agent SDK with custom `allowedTools`
- Override default tool implementations via hooks/options
- Stream responses using Vercel AI SDK streaming patterns
- Handle session context (working directory = sandbox container)

### Phase 4: Update Frontend Chat Integration

**Files to modify:**
- `components/chat-sidebar.tsx` - Update to use new streaming format
- `app/providers.tsx` - Add Agent SDK runtime provider if needed

**Changes:**
- Update message format to handle Agent SDK streaming
- Add UI for showing tool calls (file reads, edits, command execution)
- Show "thinking" states while agent is processing
- Display tool call results in the chat

### Phase 5: Add Tool Call Visualization

**New components:**
- `components/agent/tool-call.tsx` - Show individual tool execution
- `components/agent/tool-log.tsx` - List of all tool calls in a response

**UI States:**
- Tool call pending (spinner)
- Tool call success (checkmark + result preview)
- Tool call error (warning + error message)
- File edit preview (diff view)

## API Contract

### Request

```http
POST /api/session/{sessionId}/message
Content-Type: application/json

{
  "message": "Fix the bug in the auth component",
  "history": [
    { "role": "user", "content": "previous message" },
    { "role": "assistant", "content": "previous response" }
  ]
}
```

### Response (Streaming)

```
data: {"type": "thinking", "content": "I'll help you fix the bug..."}

data: {"type": "tool_call", "tool": "Read", "input": {"file_path": "/app/auth.tsx"}}

data: {"type": "tool_result", "tool": "Read", "result": "...file content..."}

data: {"type": "thinking", "content": "I see the issue..."}

data: {"type": "tool_call", "tool": "Edit", "input": {"file_path": "/app/auth.tsx", "old_string": "...", "new_string": "..."}}

data: {"type": "tool_result", "tool": "Edit", "result": "success"}

data: {"type": "assistant", "content": "I've fixed the bug by..."}

data: {"type": "done"}
```

## Sandbox API Requirements

The blank-sandbox service must expose these endpoints:

```typescript
// File operations
GET    /api/files?sessionId={id}                    // List files
GET    /api/files/[path]?sessionId={id}              // Read file
POST   /api/files?sessionId={id}                     // Write file
DELETE /api/files/[path]?sessionId={id}              // Delete file

// Shell execution
POST   /api/shell/execute?sessionId={id}             // Execute command

// Search
GET    /api/files/search?sessionId={id}&q={query}    // Grep search
```

## Security Considerations

1. **API Key Protection** - `ANTHROPIC_API_KEY` stored only server-side in `.env.local`
2. **Session Isolation** - Each sessionId maps to a specific container; tools cannot access other sessions
3. **Command Validation** - Bash tool validates commands against allowlist/blocklist
4. **Rate Limiting** - Per-user rate limits on agent queries
5. **Timeout Handling** - Agent queries timeout after 5 minutes max
6. **File Path Validation** - Prevent path traversal attacks (../etc/passwd)

## Configuration

**Environment variables:**
```bash
# .env.local
ANTHROPIC_API_KEY=sk-ant-xxxxx
SANDBOX_API_URL=http://localhost:9099
AGENT_MAX_TOKENS=4096
AGENT_TIMEOUT_MS=300000
```

## Dependencies

- `@anthropic-ai/claude-agent-sdk` - Core agent SDK
- `ai` - Vercel AI SDK (already installed)
- `@ai-sdk/react` - React hooks for streaming (already installed)

## Testing Plan

1. **Unit tests:** Custom tool implementations
2. **Integration tests:** API route with mock sandbox responses
3. **E2E tests:** Full flow from chat UI to sandbox file modification

## Rollout Phases

### Phase 1: Basic Setup
- Install SDK
- Create API route structure
- Simple "hello world" agent response

### Phase 2: Read-Only Tools
- Implement Read tool
- Implement Glob tool
- Implement Grep tool
- Agent can analyze code but not modify

### Phase 3: Write Tools
- Implement Write tool
- Implement Edit tool
- Implement Bash tool
- Full agent capabilities

### Phase 4: UI Polish
- Tool call visualization
- Approval flows for destructive operations
- Error handling and recovery

## Success Criteria

- [ ] User can chat with AI agent in project sidebar
- [ ] Agent can read files from sandbox container
- [ ] Agent can suggest file edits
- [ ] Agent can execute shell commands
- [ ] Streaming responses work smoothly
- [ ] Tool calls are visible to user
- [ ] Session isolation is maintained

## Open Questions

1. Should we require user approval for file edits? (recommend: yes for MVP)
2. How to handle long-running bash commands? (recommend: streaming output)
3. Do we need to support multiple AI providers? (recommend: Anthropic only for now)
4. Should we persist conversation history? (recommend: yes, in SQLite)

## Related Documentation

- [Claude Agent SDK Docs](https://platform.claude.com/docs/en/agent-sdk/overview)
- [blank-sandbox architecture](../docs/sandbox-architecture.md)
- [AI Agent Flow spec](../docs/blank-ai-powered-platform.md)
