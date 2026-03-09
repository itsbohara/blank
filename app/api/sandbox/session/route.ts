import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getProjectById,
  updateProjectSandboxSession,
  updateLastAccessed,
  createUserSession,
  getActiveSessionByUserId,
  endSession,
  getSessionBySandboxId,
} from "@/lib/db";

const SANDBOX_API_URL = process.env.SANDBOX_API_URL || "http://localhost:9099";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { projectId, existingSessionId, template } = body;

    if (!projectId) {
      return NextResponse.json(
        { error: "Project ID is required" },
        { status: 400 },
      );
    }

    // Verify project ownership
    const project = getProjectById(projectId);
    if (!project || project.user_id !== session.user.id) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Update last accessed time
    updateLastAccessed(projectId);

    // Try to create or reuse sandbox session
    let sandboxSessionId = existingSessionId;
    let sandboxData: any = null;

    // Check for any existing active sessions for this user
    // If the active session belongs to a different project, end it and ensure we create a fresh session
    const activeSession = getActiveSessionByUserId(session.user.id);
    if (activeSession && activeSession.project_id !== projectId) {
      // Kill the sandbox container to ensure clean state
      try {
        await fetch(`${SANDBOX_API_URL}/api/session/${activeSession.sandbox_session_id}`, {
          method: "DELETE",
        });
      } catch (err) {
        console.error("Failed to kill old sandbox container:", err);
      }
      
      endSession(activeSession.id);
      // Force creation of a new session for this project
      sandboxSessionId = null;
    }

    if (sandboxSessionId) {
      // Try to validate and reuse existing session
      try {
        const checkResponse = await fetch(
          `${SANDBOX_API_URL}/api/session/${sandboxSessionId}`,
          {
            method: "GET",
            headers: { "Content-Type": "application/json" },
          },
        );

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
    let isNewSession = false;
    if (!sandboxData) {
      const createBody: any = {
        template: template || "nextjs",
        projectId: projectId,  // Pass projectId to ensure session isolation per project
      };
      
      // Only pass sessionId if we're reusing a validated existing session
      // If sandboxSessionId is null (validation failed or no existing session),
      // let blank-sandbox generate a fresh session ID
      if (sandboxSessionId) {
        createBody.sessionId = sandboxSessionId;
      }

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
      sandboxSessionId = sandboxData.sessionId;
      isNewSession = true;

      if (!sandboxSessionId) {
        throw new Error("Sandbox session ID not returned from API");
      }

      // Update project with new session ID
      updateProjectSandboxSession(projectId, sandboxSessionId);
    }

    // Create user session record if one doesn't already exist for this sandbox session
    const existingUserSession = getSessionBySandboxId(sandboxSessionId);
    if (!existingUserSession || existingUserSession.status !== "active") {
      createUserSession({
        user_id: session.user.id,
        sandbox_session_id: sandboxSessionId,
        project_id: projectId,
      });
    }

    // Use /editor and /preview routes for cleaner URLs
    // The blank-sandbox will handle session validation and proxy internally
    const sessionId = sandboxData.sessionId || sandboxSessionId;
    const sandboxUrl = `${SANDBOX_API_URL}/editor?sessionId=${sessionId}`;
    const previewUrl = `${SANDBOX_API_URL}/preview?sessionId=${sessionId}`;

    return NextResponse.json({
      success: true,
      sandboxUrl,
      previewUrl,
      sessionId,
      mode: sandboxData.mode,
    });
  } catch (error) {
    console.error("Sandbox session error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to initialize sandbox",
      },
      { status: 500 },
    );
  }
}
