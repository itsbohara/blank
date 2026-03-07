import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { 
  getProjectById, 
  updateProjectSandboxSession, 
  updateLastAccessed,
  createUserSession,
  getActiveSessionByUserId,
  endSession
} from "@/lib/db";

const SANDBOX_API_URL = process.env.SANDBOX_API_URL || "http://localhost:3001";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { projectId, existingSessionId, template } = body;

    if (!projectId) {
      return NextResponse.json(
        { error: "Project ID is required" },
        { status: 400 }
      );
    }

    // Verify project ownership
    const project = getProjectById(projectId);
    if (!project || project.user_id !== session.user.id) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    // Update last accessed time
    updateLastAccessed(projectId);

    // Check for any existing active sessions for this user and end them
    // (One session at a time per user for now)
    const activeSession = getActiveSessionByUserId(session.user.id);
    if (activeSession && activeSession.project_id !== projectId) {
      endSession(activeSession.id);
    }

    // Try to create or reuse sandbox session
    let sandboxSessionId = existingSessionId;
    let sandboxData: any = null;

    if (sandboxSessionId) {
      // Try to validate and reuse existing session
      try {
        const checkResponse = await fetch(`${SANDBOX_API_URL}/api/session/${sandboxSessionId}`, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });

        if (checkResponse.ok) {
          // Session exists and is healthy
          sandboxData = await checkResponse.json();
        } else if (checkResponse.status === 404) {
          // Session doesn't exist anymore, create new one
          sandboxSessionId = null;
        }
      } catch (error) {
        console.error("Error checking existing session:", error);
        sandboxSessionId = null;
      }
    }

    // Create new session if needed
    if (!sandboxData) {
      const createBody: any = {
        template: template || "nextjs",
      };

      // If we have an existing session ID, try to reuse it (once blank-sandbox supports this)
      // For now, we'll create a new session
      // TODO: Pass existingSessionId once blank-sandbox supports session ID reuse

      const createResponse = await fetch(`${SANDBOX_API_URL}/api/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createBody),
      });

      if (!createResponse.ok) {
        const errorData = await createResponse.json();
        throw new Error(errorData.error || "Failed to create sandbox session");
      }

      sandboxData = await createResponse.json();
      sandboxSessionId = sandboxData.id;

      // Update project with new session ID
      updateProjectSandboxSession(projectId, sandboxSessionId);

      // Create user session record
      createUserSession({
        user_id: session.user.id,
        sandbox_session_id: sandboxSessionId,
        project_id: projectId,
      });
    }

    // Construct the sandbox URL
    // The blank-sandbox runs on its own URL, we can either:
    // 1. Redirect to it directly
    // 2. Embed it in an iframe
    // For now, we'll redirect to the sandbox editor page
    const sandboxUrl = `${SANDBOX_API_URL}/editor?sessionId=${sandboxData.id}`;

    return NextResponse.json({
      success: true,
      sandboxUrl,
      sessionId: sandboxData.id,
      mode: sandboxData.mode,
      editorUrl: sandboxData.editorUrl,
      previewUrl: sandboxData.previewUrl,
    });
  } catch (error) {
    console.error("Sandbox session error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to initialize sandbox" },
      { status: 500 }
    );
  }
}
