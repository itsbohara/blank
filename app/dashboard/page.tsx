import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getProjectsByUserId } from "@/lib/db";
import { DashboardClient } from "./dashboard-client";

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const projects = getProjectsByUserId(session.user.id);

  return (
    <DashboardClient 
      user={session.user} 
      initialProjects={projects}
    />
  );
}
