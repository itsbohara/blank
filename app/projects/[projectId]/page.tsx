import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getProjectById, getActiveSessionByUserId } from "@/lib/db";
import { ProjectClient } from "./project-client";

interface ProjectPageProps {
  params: Promise<{
    projectId: string;
  }>;
}

// Force dynamic rendering - don't try to statically generate
export const dynamic = "force-dynamic";

async function ProjectContent({ projectId, userId }: { projectId: string; userId: string }) {
  const project = getProjectById(projectId);

  if (!project || project.user_id !== userId) {
    redirect("/dashboard");
  }

  const activeSession = getActiveSessionByUserId(userId);
  const existingSandboxSessionId = project.sandbox_session_id;

  return (
    <ProjectClient
      project={project}
      userId={userId}
      existingSandboxSessionId={existingSandboxSessionId}
      activeUserSession={activeSession}
    />
  );
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const { projectId } = await params;

  return (
    <Suspense fallback={
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mb-4"></div>
        <p className="text-lg font-medium">Loading project...</p>
      </div>
    }>
      <ProjectContent projectId={projectId} userId={session.user.id} />
    </Suspense>
  );
}
