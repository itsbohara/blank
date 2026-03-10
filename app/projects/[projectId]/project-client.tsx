"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Loader2,
  ChevronLeft,
  Layout,
  Code,
  Eye,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { signOut } from "next-auth/react";
import { ChatSidebar } from "@/components/chat-sidebar";

interface Project {
  id: string;
  name: string;
  description: string | null;
  template: string;
  sandbox_session_id: string | null;
  status: string;
}

interface UserSession {
  id: string;
  sandbox_session_id: string;
  project_id: string | null;
  status: string;
}

interface ProjectClientProps {
  project: Project;
  userId: string;
  existingSandboxSessionId: string | null;
  activeUserSession: UserSession | null;
}

export function ProjectClient({
  project,
  userId,
  existingSandboxSessionId,
  activeUserSession,
}: ProjectClientProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sandboxUrl, setSandboxUrl] = useState<string | null>(null);
  const [iframeError, setIframeError] = useState<string | null>(null);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [chatExpanded, setChatExpanded] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [previewTimestamp, setPreviewTimestamp] = useState<number>(Date.now());
  const hasInitialized = useRef(false);

  useEffect(() => {
    // Prevent duplicate initialization (React StrictMode double mount)
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    // Reset states when project changes
    setIsLoading(true);
    setError(null);
    setSandboxUrl(null);
    setPreviewUrl(null);
    setSessionId(null);
    setIframeError(null);
    setIframeLoaded(false);

    async function initializeSandbox() {
      try {
        const response = await fetch(`/api/sandbox/session`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId: project.id,
            existingSessionId: existingSandboxSessionId,
            template: project.template,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to initialize sandbox");
        }

        const data = await response.json();
        setSandboxUrl(data.sandboxUrl);
        setPreviewUrl(data.previewUrl);
        setSessionId(data.sessionId);
        setIsLoading(false);
      } catch (err) {
        console.error("Sandbox initialization error:", err);
        setError(
          err instanceof Error ? err.message : "Failed to initialize sandbox",
        );
        setSessionId(null);
        setIsLoading(false);
      }
    }

    initializeSandbox();
  }, [project.id, project.template, existingSandboxSessionId]);

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-2">Error</h1>
          <p className="text-muted-foreground mb-6">{error}</p>
          <Link href="/dashboard" className="text-primary hover:underline">
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Top Navigation Bar */}
      <header className="h-14 border-b bg-card flex items-center px-4 shrink-0">
        <div className="flex items-center gap-4 flex-1">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm" className="gap-2">
              <ChevronLeft className="h-4 w-4" />
              Back
            </Button>
          </Link>

          <Separator orientation="vertical" className="h-6" />

          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-primary rounded flex items-center justify-center">
              <span className="text-primary-foreground text-xs font-bold">
                B
              </span>
            </div>
            <span className="font-medium">{project.name}</span>
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="gap-2"
            onClick={() => setChatExpanded(!chatExpanded)}
          >
            {chatExpanded ? (
              <>
                <PanelLeftClose className="h-4 w-4" />
                Hide Chat
              </>
            ) : (
              <>
                <PanelLeftOpen className="h-4 w-4" />
                Expand Chat
              </>
            )}
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm">
            <Settings className="h-4 w-4" />
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => signOut({ callbackUrl: "/login" })}
          >
            Sign out
          </Button>
        </div>
      </header>

      {/* Main Content Area with Optional Chat Sidebar */}
      <div className="flex-1 flex overflow-hidden">
        {/* AI Chat Sidebar */}
        {chatExpanded && (
          <div className="w-96 border-r bg-card flex flex-col overflow-hidden">
            <ChatSidebar sessionId={sessionId} />
          </div>
        )}

        {/* Sandbox Iframe with v0-style border wrapper */}
        <div className="flex-1 relative bg-muted/30">
          <div className="absolute inset-0 p-2">
            <div className="h-full w-full rounded border border-border bg-card shadow-sm overflow-hidden flex flex-col">
              {/* Editor Toolbar */}
              <Tabs defaultValue="code" className="flex flex-col h-full gap-0">
                <div className="h-10 border-b flex items-center px-3">
                  <TabsList variant="line">
                    <TabsTrigger value="code" className="gap-1.5 text-xs">
                      <Code className="h-3.5 w-3.5" />
                      Code
                    </TabsTrigger>
                    <TabsTrigger value="preview" className="gap-1.5 text-xs">
                      <Eye className="h-3.5 w-3.5" />
                      Preview
                    </TabsTrigger>
                    <TabsTrigger value="split" className="gap-1.5 text-xs">
                      <Layout className="h-3.5 w-3.5" />
                      Split
                    </TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent
                  value="code"
                  className="flex-1 mt-0 h-full data-[state=inactive]:hidden"
                  forceMount
                >
                  <div className="h-full relative">
                    {!sandboxUrl && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-background z-10">
                        <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
                        <p className="text-sm font-medium">Initializing sandbox environment...</p>
                        <p className="text-xs text-muted-foreground mt-2">You can send messages while the preview loads</p>
                      </div>
                    )}
                    {sandboxUrl && !iframeLoaded && !iframeError && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-background z-10">
                        <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                        <p className="text-sm text-muted-foreground">
                          Loading editor...
                        </p>
                      </div>
                    )}
                    {iframeError && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-background z-10">
                        <p className="text-red-600 mb-2">
                          Failed to load editor
                        </p>
                        <p className="text-sm text-muted-foreground mb-4">
                          {iframeError}
                        </p>
                        <Button
                          onClick={() => window.location.reload()}
                          variant="outline"
                          size="sm"
                        >
                          Reload Page
                        </Button>
                      </div>
                    )}

                    {sandboxUrl && (
                      <iframe
                        key={`${sessionId}-code`}
                        src={sandboxUrl}
                        className="w-full h-full border-0"
                        allow="clipboard-read; clipboard-write"
                        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads"
                        onLoad={() => {
                          console.log("Iframe loaded successfully");
                          setIframeLoaded(true);
                        }}
                        onError={(e) => {
                          console.error("Iframe error:", e);
                          setIframeError("Failed to load sandbox environment");
                        }}
                      />
                    )}
                  </div>
                </TabsContent>

                <TabsContent
                  value="preview"
                  className="flex-1 mt-0 h-full data-[state=inactive]:hidden"
                  forceMount
                >
                  {!sandboxUrl ? (
                    <div className="h-full flex flex-col items-center justify-center bg-background">
                      <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
                      <p className="text-sm font-medium">Initializing sandbox environment...</p>
                      <p className="text-xs text-muted-foreground mt-2">You can send messages while the preview loads</p>
                    </div>
                  ) : (
                    <iframe
                      key={`${sessionId}-preview-${previewTimestamp}`}
                      src={previewUrl || ""}
                      className="w-full h-full border-0"
                      allow="clipboard-read; clipboard-write"
                      sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads"
                    />
                  )}
                </TabsContent>

                <TabsContent
                  value="split"
                  className="flex-1 mt-0 h-full data-[state=inactive]:hidden"
                  forceMount
                >
                  {!sandboxUrl ? (
                    <div className="h-full flex flex-col items-center justify-center bg-background">
                      <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
                      <p className="text-sm font-medium">Initializing sandbox environment...</p>
                      <p className="text-xs text-muted-foreground mt-2">You can send messages while the preview loads</p>
                    </div>
                  ) : (
                    <div className="h-full flex">
                      <div className="w-1/2 h-full relative">
                        {!iframeLoaded && !iframeError && (
                          <div className="absolute inset-0 flex flex-col items-center justify-center bg-background z-10">
                            <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                            <p className="text-sm text-muted-foreground">
                              Loading editor...
                            </p>
                          </div>
                        )}

                        <iframe
                          key={`${sessionId}-split-code`}
                          src={sandboxUrl}
                          className="w-full h-full border-0"
                          allow="clipboard-read; clipboard-write"
                          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads"
                          onLoad={() => {
                            console.log("Iframe loaded successfully");
                            setIframeLoaded(true);
                          }}
                          onError={(e) => {
                            console.error("Iframe error:", e);
                            setIframeError(
                              "Failed to load sandbox environment",
                            );
                          }}
                        />
                      </div>

                      <div className="w-1/2 h-full border-l">
                        <iframe
                          key={`${sessionId}-split-preview-${previewTimestamp}`}
                          src={previewUrl || ""}
                          className="w-full h-full border-0"
                          allow="clipboard-read; clipboard-write"
                          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads"
                        />
                      </div>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
