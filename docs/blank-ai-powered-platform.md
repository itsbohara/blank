# Blank AI-Powered Platform

## Overview

This document outlines the architecture for AI-assisted code generation and modification in the **blank** platform. The AI layer lives entirely in blank, while **blank-sandbox** provides the execution environment and APIs.

```
User Prompt → Blank (AI Layer) → Sandbox APIs → Container (Shell/Files)
                      ↓
               LLM generates plan
                      ↓
         AI Agent executes tools
                      ↓
         Shows diff/confirmation
                      ↓
         Applies changes
```

## Architecture

### Blank (This Platform)
- **AI Chat Interface** - Sidebar chat for natural language prompts
- **Agent SDK** - Vercel AI SDK with tool calling
- **Tools** - Shell execution, file operations, context gathering
- **Diff Viewer** - Show changes before applying
- **Approval Flow** - User reviews and approves/rejects changes

### Blank-Sandbox (Separate Service)
- **Shell Execution API** - Run commands in container (primary interface)
- **File APIs** - Convenience endpoints for common file operations
- **Session Management** - Container lifecycle

## Agent Tools

The AI agent has access to these tools to interact with the sandbox:

### 1. Shell Execution (Primary Tool)

Execute arbitrary shell commands in the container workspace.

```http
POST /api/shell/execute?sessionId={id}
Content-Type: application/json

{
  "command": "npm install @radix-ui/react-dialog",
  "cwd": "/workspace",
  "timeout": 60000,
  "requireApproval": true  // For destructive operations
}
```

**Response:**
```json
{
  "stdout": "added 5 packages in 2s",
  "stderr": "",
  "exitCode": 0,
  "duration": 2300
}
```

**Use Cases:**
- `npm install <package>` - Install dependencies
- `npx shadcn add button` - Add UI components
- `git status` - Check version control
- `cat package.json` - Read files (alternative to file API)
- `ls -la components/` - List directory contents
- `mkdir -p app/api` - Create directories

### 2. File Operations (Convenience APIs)

For simple read/write operations without shell overhead.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/files?sessionId={id}` | List all files |
| GET | `/api/files/[path]?sessionId={id}` | Read file content |
| POST | `/api/files?sessionId={id}` | Write/create file |
| DELETE | `/api/files/[path]?sessionId={id}` | Delete file |

### 3. Project State

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/build/errors?sessionId={id}` | Current build errors |
| GET | `/api/preview/screenshot?sessionId={id}` | Visual state (optional) |

## AI Agent Flow

### User Permission Levels

**Level 1 - Auto-approved (Safe):**
- Read files: `cat`, `ls`, `find`
- Read build status
- Check git status

**Level 2 - Requires approval:**
- Write files
- Install packages
- Delete files
- Run build commands

**Level 3 - Dangerous (Always confirm):**
- Delete directories
- Git operations (commit, push)
- System-level commands

### Example: Installing Dependencies

**User:** "Add a date picker component"

**AI Agent Thought Process:**
```
1. Check project structure
   Tool: shell_execute("ls -la")
   
2. Check package.json for existing dependencies
   Tool: shell_execute("cat package.json")
   
3. Decide to install @radix-ui/react-popover
   Tool: shell_execute(
     "npm install @radix-ui/react-popover",
     requireApproval=true
   )
   
4. Wait for user approval
   
5. Create component file
   Tool: file_write("components/DatePicker.tsx", "...")
   
6. Import in page
   Tool: file_read("app/page.tsx")
   Tool: file_write("app/page.tsx", updatedContent)
```

**User sees:**
- "I'll install `@radix-ui/react-popover` and create a DatePicker component"
- [Approve] [Cancel]
- Shows: `npm install @radix-ui/react-popover`
- Then shows diff of file changes

### Example: Complex Refactor

**User:** "Convert this to use App Router"

**AI Agent:**
```
1. Analyze current structure
   Tool: shell_execute("find . -name '*.tsx' -o -name '*.ts' | head -20")
   
2. Read key files
   Tool: file_read("pages/index.tsx")
   Tool: file_read("pages/_app.tsx")
   
3. Generate migration plan
   - Create app/layout.tsx
   - Move pages/index.tsx → app/page.tsx
   - Update imports
   
4. Execute with user confirmation
   Tool: shell_execute("mkdir -p app")
   Tool: file_write("app/layout.tsx", "...")
   Tool: file_write("app/page.tsx", "...")
   Tool: shell_execute("rm pages/index.tsx")
```

## Blank Platform Components

### 1. AI Agent Hook

```typescript
// hooks/useAIAgent.ts
export function useAIAgent() {
  const tools = {
    shell_execute: async (params: ShellParams) => {
      if (params.requireApproval) {
        // Show approval modal
        const approved = await showApprovalModal(params.command);
        if (!approved) throw new Error("User rejected");
      }
      return fetchSandboxShell(sessionId, params);
    },
    
    file_read: async (path: string) => {
      return fetchSandboxFile(sessionId, path);
    },
    
    file_write: async (path: string, content: string) => {
      if (!isAutoApproved(path)) {
        await showDiffModal(path, content);
      }
      return writeSandboxFile(sessionId, path, content);
    },
    
    get_build_errors: async () => {
      return fetchSandboxBuildErrors(sessionId);
    }
  };
  
  async function processPrompt(prompt: string) {
    const context = await gatherContext();
    
    return streamAIResponse({
      prompt,
      context,
      tools,
      onToolCall: (tool, params) => {
        console.log(`Agent using ${tool}:`, params);
      }
    });
  }
  
  return { processPrompt, tools };
}
```

### 2. Approval Modal

```tsx
// components/ai/ApprovalModal.tsx
export function ApprovalModal({ command, onApprove, onReject }) {
  return (
    <Dialog>
      <DialogTitle>Agent wants to run command</DialogTitle>
      <CodeBlock>{command}</CodeBlock>
      <DialogFooter>
        <Button onClick={onReject}>Cancel</Button>
        <Button onClick={onApprove} variant="default">
          Allow
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
```

### 3. Tool Call Logger

```tsx
// components/ai/ToolCallLog.tsx
export function ToolCallLog({ calls }) {
  return (
    <div className="tool-log">
      {calls.map((call, i) => (
        <div key={i} className={`tool-call ${call.type}`}>
          <div className="tool-name">{call.tool}</div>
          <div className="tool-params">{JSON.stringify(call.params)}</div>
          {call.result && (
            <div className="tool-result">{call.result}</div>
          )}
        </div>
      ))}
    </div>
  );
}
```

## Sandbox Requirements

### API: Shell Execution

```typescript
// blank-sandbox: app/api/shell/execute/route.ts
export async function POST(req: NextRequest) {
  const { sessionId, command, cwd, timeout } = await req.json();
  
  // Security: Validate session
  // Security: Command whitelist/blacklist
  // Security: Timeout limits
  // Security: Working directory validation
  
  const containerName = `session-${sessionId}`;
  
  const { stdout, stderr, exitCode } = await execInContainer(
    containerName,
    command,
    { cwd: cwd || '/workspace', timeout: timeout || 30000 }
  );
  
  return Response.json({ stdout, stderr, exitCode });
}
```

### Security Considerations

**Command Filtering:**
```typescript
const BLOCKED_COMMANDS = [
  'rm -rf /',
  'curl | bash',
  'wget | sh',
  // etc.
];

function validateCommand(command: string): boolean {
  // Check against blocked patterns
  // Check for path traversal
  // Validate working directory
  return true;
}
```

**Sandbox Escape Prevention:**
- Container runs as non-root user
- Read-only filesystem except /workspace
- No network access (or limited egress)
- CPU/memory limits
- Command timeout (max 60s default)

## Implementation Phases

### Phase 1: Shell Execution
- [ ] POST /api/shell/execute endpoint
- [ ] Command validation and security
- [ ] Timeout and error handling
- [ ] Basic output streaming

### Phase 2: File Convenience APIs
- [ ] GET /api/files (list)
- [ ] GET /api/files/[path] (read)
- [ ] POST /api/files (write)

### Phase 3: AI Integration
- [ ] Agent tool definitions
- [ ] Approval flow UI
- [ ] Tool call logging
- [ ] Context gathering

### Phase 4: Advanced Features
- [ ] Build error integration
- [ ] Git operations
- [ ] Multi-file refactoring
- [ ] Undo/redo support

## Dependencies

**Blank Platform:**
- `@ai-sdk/react` - AI streaming with tool calling
- `@ai-sdk/openai` or `@ai-sdk/anthropic`
- `xterm.js` - Terminal output display
- `diff-match-patch` - Diff generation

**Blank-Sandbox:**
- Container shell access (docker exec)
- File system APIs
- Build process monitoring

---

**Status:** Spec updated for agent-tools approach
**Key Change:** Shell execution as primary interface, file APIs as convenience
**Advantage:** AI can do anything a developer can do via terminal
