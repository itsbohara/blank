import { readFile, writeFile, editFile, executeCommand, globFiles, grepSearch } from "./sandbox-client";

export interface SandboxTools {
  read: (filePath: string) => Promise<unknown>;
  write: (filePath: string, content: string) => Promise<unknown>;
  edit: (filePath: string, oldString: string | undefined, newString: string) => Promise<unknown>;
  bash: (command: string, description?: string) => Promise<unknown>;
  glob: (pattern: string, path?: string) => Promise<unknown>;
  grep: (pattern: string, path?: string, outputMode?: string) => Promise<unknown>;
}

export function getSandboxTools(sessionId: string): SandboxTools {
  return {
    read: async (filePath: string) => {
      return readFile(sessionId, filePath);
    },
    write: async (filePath: string, content: string) => {
      return writeFile(sessionId, filePath, content);
    },
    edit: async (filePath: string, oldString: string | undefined, newString: string) => {
      return editFile(sessionId, filePath, oldString, newString);
    },
    bash: async (command: string, description?: string) => {
      return executeCommand(sessionId, command, description);
    },
    glob: async (pattern: string, path?: string) => {
      return globFiles(sessionId, pattern, path);
    },
    grep: async (pattern: string, path?: string, outputMode?: string) => {
      return grepSearch(sessionId, pattern, path, outputMode);
    },
  };
}
