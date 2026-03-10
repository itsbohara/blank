const SANDBOX_API_URL = process.env.SANDBOX_API_URL || "http://localhost:9099";

// Blocked commands for security
const BLOCKED_COMMANDS = [
  "rm -rf /",
  "rm -rf /*",
  "dd if=/dev/zero",
  "mkfs",
  "fdisk",
  "format",
  ":(){ :|:& };:", // fork bomb
  "> /dev/sda",
  "> /dev/sdb",
];

function isCommandBlocked(command: string): boolean {
  const normalized = command.toLowerCase().trim();
  return BLOCKED_COMMANDS.some((blocked) =>
    normalized.includes(blocked.toLowerCase()),
  );
}

export interface ReadResult {
  success: boolean;
  content?: string;
  error?: string;
}

export async function readFile(
  sessionId: string,
  filePath: string,
): Promise<ReadResult> {
  try {
    // Remove leading slash and encode the path
    const encodedPath = encodeURIComponent(filePath.replace(/^\//, ""));
    const url = `${SANDBOX_API_URL}/api/files/${encodedPath}?sessionId=${sessionId}`;

    const response = await fetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ error: "Unknown error" }));
      return {
        success: false,
        error: `Failed to read file: ${errorData.error || response.statusText}`,
      };
    }

    const data = await response.json();
    return {
      success: true,
      content: data.content,
    };
  } catch (error) {
    return {
      success: false,
      error: `Error reading file: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export interface WriteResult {
  success: boolean;
  message?: string;
  error?: string;
}

export async function writeFile(
  sessionId: string,
  filePath: string,
  content: string,
): Promise<WriteResult> {
  try {
    const encodedPath = encodeURIComponent(filePath.replace(/^\//, ""));
    const url = `${SANDBOX_API_URL}/api/files/${encodedPath}?sessionId=${sessionId}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });

    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ error: "Unknown error" }));
      return {
        success: false,
        error: `Failed to write file: ${errorData.error || response.statusText}`,
      };
    }

    return {
      success: true,
      message: `Successfully wrote ${filePath}`,
    };
  } catch (error) {
    return {
      success: false,
      error: `Error writing file: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export interface EditResult {
  success: boolean;
  message?: string;
  error?: string;
}

export async function editFile(
  sessionId: string,
  filePath: string,
  oldString: string | undefined,
  newString: string,
): Promise<EditResult> {
  try {
    let content: string;

    if (oldString !== undefined) {
      // Read existing file
      const readResult = await readFile(sessionId, filePath);
      if (!readResult.success) {
        // File doesn't exist, treat as new file
        content = newString;
      } else {
        const existingContent = readResult.content || "";

        // Check if old_string exists in the file
        if (!existingContent.includes(oldString)) {
          return {
            success: false,
            error: `Could not find the text to replace in ${filePath}. The file may have changed.`,
          };
        }

        // Replace old_string with new_string
        content = existingContent.replace(oldString, newString);
      }
    } else {
      // No old_string provided, create/overwrite file
      content = newString;
    }

    // Write the file
    return writeFile(sessionId, filePath, content);
  } catch (error) {
    return {
      success: false,
      error: `Error editing file: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export interface BashResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exit_code: number;
  error?: string;
}

export async function executeCommand(
  sessionId: string,
  command: string,
  _description?: string,
): Promise<BashResult> {
  // Security check
  if (isCommandBlocked(command)) {
    return {
      success: false,
      stdout: "",
      stderr: "",
      exit_code: 1,
      error: "Command blocked for security reasons",
    };
  }

  try {
    const url = `${SANDBOX_API_URL}/api/shell/execute?sessionId=${sessionId}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        command,
        workingDir: "/home/blank/workspace",
      }),
    });

    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ error: "Unknown error" }));
      return {
        success: false,
        stdout: "",
        stderr: errorData.error || response.statusText,
        exit_code: 1,
        error: `Failed to execute command: ${errorData.error || response.statusText}`,
      };
    }

    const data = await response.json();
    return {
      success: data.exitCode === 0,
      stdout: data.stdout || "",
      stderr: data.stderr || "",
      exit_code: data.exitCode ?? 0,
    };
  } catch (error) {
    return {
      success: false,
      stdout: "",
      stderr: "",
      exit_code: 1,
      error: `Error executing command: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export interface GlobResult {
  success: boolean;
  files: string[];
  error?: string;
}

export async function globFiles(
  sessionId: string,
  pattern: string,
  path: string = "/home/blank/workspace",
): Promise<GlobResult> {
  try {
    // Use find command via bash
    const sanitizedPattern = pattern.replace(/["']/g, "\\$&");
    const sanitizedPath = path.replace(/["']/g, "\\$&");
    const findCommand = `find ${sanitizedPath} -type f -name "${sanitizedPattern}" 2>/dev/null | head -50`;

    const result = await executeCommand(sessionId, findCommand);

    if (!result.success) {
      return {
        success: false,
        files: [],
        error: result.error || "Failed to glob files",
      };
    }

    const files = result.stdout
      ? result.stdout.split("\n").filter((f: string) => f.trim() !== "")
      : [];

    return {
      success: true,
      files,
    };
  } catch (error) {
    return {
      success: false,
      files: [],
      error: `Error globbing files: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export interface GrepMatch {
  file: string;
  line: number;
  content: string;
}

export interface GrepResult {
  success: boolean;
  matches: GrepMatch[];
  error?: string;
}

export async function grepSearch(
  sessionId: string,
  pattern: string,
  path: string = "/home/blank/workspace",
  outputMode: string = "files_with_matches",
): Promise<GrepResult> {
  try {
    // Escape special characters for grep
    const sanitizedPattern = pattern.replace(/["']/g, "\\$&");
    const sanitizedPath = path.replace(/["']/g, "\\$&");

    // Use grep with line numbers
    const grepCommand = `grep -r -n "${sanitizedPattern}" ${sanitizedPath} 2>/dev/null | head -50`;

    const result = await executeCommand(sessionId, grepCommand);

    if (!result.success && result.exit_code !== 1) {
      // Exit code 1 means no matches found (not an error)
      return {
        success: false,
        matches: [],
        error: result.error || "Failed to grep",
      };
    }

    // Parse grep output: file:line:content
    const matches: GrepMatch[] = result.stdout
      ? result.stdout
          .split("\n")
          .filter((line: string) => line.trim() !== "")
          .map((line: string) => {
            const firstColon = line.indexOf(":");
            const secondColon = line.indexOf(":", firstColon + 1);

            if (firstColon === -1 || secondColon === -1) {
              return null;
            }

            const file = line.substring(0, firstColon);
            const lineNum = parseInt(
              line.substring(firstColon + 1, secondColon),
              10,
            );
            const content = line.substring(secondColon + 1);

            return {
              file,
              line: isNaN(lineNum) ? 0 : lineNum,
              content,
            };
          })
          .filter((m: GrepMatch | null): m is GrepMatch => m !== null)
      : [];

    return {
      success: true,
      matches,
    };
  } catch (error) {
    return {
      success: false,
      matches: [],
      error: `Error grepping: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export interface LockResult {
  success: boolean;
  message?: string;
  error?: string;
}

export async function lockFile(
  sessionId: string,
  filePath: string,
): Promise<LockResult> {
  try {
    const url = `${SANDBOX_API_URL}/api/editor/lock?sessionId=${sessionId}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filePath }),
    });

    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ error: "Unknown error" }));
      return {
        success: false,
        error: `Failed to lock file: ${errorData.error || response.statusText}`,
      };
    }

    return {
      success: true,
      message: `Locked ${filePath} for editing`,
    };
  } catch (error) {
    return {
      success: false,
      error: `Error locking file: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export interface UnlockResult {
  success: boolean;
  message?: string;
  error?: string;
}

export async function unlockFile(
  sessionId: string,
  filePath: string,
): Promise<UnlockResult> {
  try {
    const url = `${SANDBOX_API_URL}/api/editor/unlock?sessionId=${sessionId}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filePath }),
    });

    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ error: "Unknown error" }));
      return {
        success: false,
        error: `Failed to unlock file: ${errorData.error || response.statusText}`,
      };
    }

    return {
      success: true,
      message: `Unlocked ${filePath}`,
    };
  } catch (error) {
    return {
      success: false,
      error: `Error unlocking file: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export interface OpenResult {
  success: boolean;
  message?: string;
  error?: string;
}

export async function openFile(
  sessionId: string,
  filePath: string,
  line?: number,
  column?: number,
): Promise<OpenResult> {
  try {
    const url = `${SANDBOX_API_URL}/api/editor/open?sessionId=${sessionId}`;

    const body: { filePath: string; line?: number; column?: number } = {
      filePath,
    };
    if (line !== undefined) body.line = line;
    if (column !== undefined) body.column = column;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ error: "Unknown error" }));
      return {
        success: false,
        error: `Failed to open file: ${errorData.error || response.statusText}`,
      };
    }

    return {
      success: true,
      message: `Opened ${filePath}${line ? ` at line ${line}` : ""}`,
    };
  } catch (error) {
    return {
      success: false,
      error: `Error opening file: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export interface SetReadonlyResult {
  success: boolean;
  isGlobalReadonly?: boolean;
  readonlyReason?: string;
  message?: string;
  error?: string;
}

export async function setReadonly(
  sessionId: string,
  readonly: boolean,
  reason?: string,
): Promise<SetReadonlyResult> {
  try {
    const url = `${SANDBOX_API_URL}/api/editor/readonly?sessionId=${sessionId}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ readonly, reason }),
    });

    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ error: "Unknown error" }));
      return {
        success: false,
        error: `Failed to set readonly mode: ${errorData.error || response.statusText}`,
      };
    }

    const data = await response.json();
    return {
      success: true,
      isGlobalReadonly: data.isGlobalReadonly,
      readonlyReason: data.readonlyReason,
      message: readonly ? "Editor locked" : "Editor unlocked",
    };
  } catch (error) {
    return {
      success: false,
      error: `Error setting readonly mode: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
