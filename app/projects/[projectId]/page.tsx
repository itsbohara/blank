import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getProjectById, getActiveSessionByUserId } from "@/lib/db";
import { ProjectClient } from "./project-client";

interface ProjectPageProps {
  params: Promise<{
    projectId: string;
  }>;
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const { projectId } = await params;
  const project = getProjectById(projectId);

  if (!project || project.user_id !== session.user.id) {
    redirect("/dashboard");
  }

  // Check for any existing active sessions for this user
  const activeSession = getActiveSessionByUserId(session.user.id);
  
  // If project has a sandbox session, we'll try to reuse it
  const existingSandboxSessionId = project.sandbox_session_id;

  return (
    <ProjectClient
      project={project}
      userId={session.user.id}
      existingSandboxSessionId={existingSandboxSessionId}
      activeUserSession={activeSession}
    />
  );
}
