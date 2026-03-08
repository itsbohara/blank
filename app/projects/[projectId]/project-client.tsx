"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, ChevronLeft, Layout, Code, Eye, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { signOut } from "next-auth/react";

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

  useEffect(() => {
    // Reset states when project changes
    setIsLoading(true);
    setError(null);
    setSandboxUrl(null);
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
        setIsLoading(false);
      } catch (err) {
        console.error("Sandbox initialization error:", err);
        setError(err instanceof Error ? err.message : "Failed to initialize sandbox");
        setIsLoading(false);
      }
    }

    initializeSandbox();
  }, [project.id, project.template, existingSandboxSessionId]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg font-medium">Initializing sandbox environment...</p>
        <p className="text-sm text-muted-foreground mt-2">{project.name}</p>
      </div>
    );
  }

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
              <span className="text-primary-foreground text-xs font-bold">B</span>
            </div>
            <span className="font-medium">{project.name}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="gap-2">
            <Layout className="h-4 w-4" />
            Split
          </Button>
          <Button variant="ghost" size="sm" className="gap-2">
            <Code className="h-4 w-4" />
            Editor
          </Button>
          <Button variant="ghost" size="sm" className="gap-2">
            <Eye className="h-4 w-4" />
            Preview
          </Button>
          
          <Separator orientation="vertical" className="h-6 mx-2" />
          
          <Button variant="ghost" size="sm">
            <Settings className="h-4 w-4" />
          </Button>
          
          <Button variant="outline" size="sm" onClick={() => signOut({ callbackUrl: "/login" })}>
            Sign out
          </Button>
        </div>
      </header>

      {/* Sandbox Iframe */}
      <div className="flex-1 relative">
        {sandboxUrl ? (
          <>
            {!iframeLoaded && !iframeError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-background z-10">
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                <p className="text-sm text-muted-foreground">Loading editor...</p>
              </div>
            )}
            {iframeError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-background z-10">
                <p className="text-red-600 mb-2">Failed to load editor</p>
                <p className="text-sm text-muted-foreground mb-4">{iframeError}</p>
                <Button onClick={() => window.location.reload()} variant="outline" size="sm">
                  Reload Page
                </Button>
              </div>
            )}
            <iframe
              key={project.id}
              src={sandboxUrl}
              className="w-full h-full border-0"
              allow="clipboard-read; clipboard-write"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads"
              onLoad={() => {
                console.log('Iframe loaded successfully');
                setIframeLoaded(true);
              }}
              onError={(e) => {
                console.error('Iframe error:', e);
                setIframeError('Failed to load sandbox environment');
              }}
            />
          </>
        ) : null}
      </div>
    </div>
  );
}
