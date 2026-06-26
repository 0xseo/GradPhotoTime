import { HomeDashboardShell } from "@/components/home/home-dashboard-shell";
import { AppHeader } from "@/components/layout/app-header";
import { getHomeDashboard } from "@/app/actions/dashboard";

export default async function Home() {
  const dashboardResult = await getHomeDashboard();
  const dashboard = dashboardResult.ok ? dashboardResult.data : null;

  return (
    <main className="min-h-dvh bg-background">
      <section className="mx-auto flex min-h-dvh w-full max-w-[92rem] flex-col px-5 py-5 sm:px-8">
        <AppHeader />

        <HomeDashboardShell
          hostedEvents={dashboard?.hostedEvents ?? []}
          isSignedIn={Boolean(dashboard?.user)}
          reservations={dashboard?.reservations ?? []}
        />

        {!dashboardResult.ok ? (
          <p className="mb-5 rounded-md border border-danger/30 bg-red-50 px-3 py-2 text-sm text-danger">
            {dashboardResult.error}
          </p>
        ) : null}
      </section>
    </main>
  );
}
