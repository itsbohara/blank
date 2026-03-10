import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getChatMessagesBySessionId, createChatMessage } from "@/lib/db/chat-messages";
import { getSessionBySandboxId } from "@/lib/db/user-sessions";
import type { MessagePart } from "@/types/chat";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sessionId } = await params;

  if (!sessionId) {
    return NextResponse.json({ error: "Session ID is required" }, { status: 400 });
  }

  try {
    // Verify the session belongs to the user
    const userSession = getSessionBySandboxId(sessionId);
    if (!userSession || userSession.user_id !== session.user.id) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const messages = getChatMessagesBySessionId(userSession.id);
    return NextResponse.json({ messages });
  } catch (error) {
    console.error("Error fetching chat messages:", error);
    return NextResponse.json(
      { error: "Failed to fetch chat messages" },
      { status: 500 }
    );
  }
}

interface SaveMessageRequest {
  userSessionId: string;
  role: "user" | "assistant";
  parts: MessagePart[];
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sessionId } = await params;

  if (!sessionId) {
    return NextResponse.json({ error: "Session ID is required" }, { status: 400 });
  }

  try {
    const body: SaveMessageRequest = await req.json();
    const { userSessionId, role, parts } = body;

    if (!userSessionId || !role || !parts) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Verify the session belongs to the user
    const userSession = getSessionBySandboxId(sessionId);
    if (!userSession || userSession.user_id !== session.user.id) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Verify the provided userSessionId matches
    if (userSession.id !== userSessionId) {
      return NextResponse.json({ error: "Invalid session" }, { status: 403 });
    }

    const message = createChatMessage({
      session_id: userSessionId,
      role,
      parts,
    });

    return NextResponse.json({ message });
  } catch (error) {
    console.error("Error saving chat message:", error);
    return NextResponse.json(
      { error: "Failed to save chat message" },
      { status: 500 }
    );
  }
}
