import { readFile, writeFile, editFile, executeCommand, globFiles, grepSearch, lockFile, unlockFile, openFile, setReadonly } from "./sandbox-client";

export interface SandboxTools {
  read: (filePath: string) => Promise<unknown>;
  write: (filePath: string, content: string) => Promise<unknown>;
  edit: (filePath: string, oldString: string | undefined, newString: string) => Promise<unknown>;
  bash: (command: string, description?: string) => Promise<unknown>;
  glob: (pattern: string, path?: string) => Promise<unknown>;
  grep: (pattern: string, path?: string, outputMode?: string) => Promise<unknown>;
  lock: (filePath: string) => Promise<unknown>;
  unlock: (filePath: string) => Promise<unknown>;
  open: (filePath: string, line?: number, column?: number) => Promise<unknown>;
  setReadonly: (readonly: boolean, reason?: string) => Promise<unknown>;
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
    lock: async (filePath: string) => {
      return lockFile(sessionId, filePath);
    },
    unlock: async (filePath: string) => {
      return unlockFile(sessionId, filePath);
    },
    open: async (filePath: string, line?: number, column?: number) => {
      return openFile(sessionId, filePath, line, column);
    },
    setReadonly: async (readonly: boolean, reason?: string) => {
      return setReadonly(sessionId, readonly, reason);
    },
  };
}
