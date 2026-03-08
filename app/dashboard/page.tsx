import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getProjectsByUserId } from "@/lib/db";
import { DashboardClient } from "./dashboard-client";

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const userId = session.user.id!;
  const projects = getProjectsByUserId(userId);

  return (
    <DashboardClient
      user={{
        id: userId,
        email: session.user.email!,
        name: session.user.name ?? null,
      }}
      initialProjects={projects}
    />
  );
}
