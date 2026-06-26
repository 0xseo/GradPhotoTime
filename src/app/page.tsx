import { HomeDashboardShell } from "@/components/home/home-dashboard-shell";
import { AppHeader } from "@/components/layout/app-header";
import { getHomeDashboard } from "@/app/actions/dashboard";

type HomeSearchParams = {
  mobileView?: string | string[];
  shell?: string | string[];
};

export default async function Home({
  searchParams,
}: {
  searchParams?: Promise<HomeSearchParams>;
}) {
  const params = await searchParams;
  const mobileView = parseMobileView(getSearchParam(params?.mobileView));
  const isMobileShell = getSearchParam(params?.shell) === "mobile";
  const dashboardResult = await getHomeDashboard();
  const dashboard = dashboardResult.ok ? dashboardResult.data : null;

  return (
    <main className="min-h-dvh bg-background">
      <section
        className={
          isMobileShell
            ? "mx-auto flex min-h-dvh w-full max-w-[92rem] flex-col px-3 py-3"
            : "mx-auto flex min-h-dvh w-full max-w-[92rem] flex-col px-5 py-5 sm:px-8"
        }
      >
        {!isMobileShell ? <AppHeader /> : null}

        <HomeDashboardShell
          hostedEvents={dashboard?.hostedEvents ?? []}
          isSignedIn={Boolean(dashboard?.user)}
          mobileView={mobileView}
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

function getSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseMobileView(value: string | undefined) {
  if (value === "calendar" || value === "guest" || value === "host") {
    return value;
  }

  return null;
}
