import { AccessCodeEntry } from "@/components/guest/access-code-entry";
import { AppHeader } from "@/components/layout/app-header";

type AccessSearchParams = {
  shell?: string | string[];
};

export default async function AccessPage({
  searchParams,
}: {
  searchParams?: Promise<AccessSearchParams>;
}) {
  const params = await searchParams;
  const isMobileShell = getSearchParam(params?.shell) === "mobile";

  return (
    <main className="min-h-dvh bg-background">
      <section
        className={
          isMobileShell
            ? "mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center px-4 py-5"
            : "mx-auto flex min-h-dvh w-full max-w-xl flex-col px-5 py-5"
        }
      >
        {!isMobileShell ? <AppHeader /> : null}
        <div className={isMobileShell ? "" : "mt-8"}>
          <AccessCodeEntry />
        </div>
      </section>
    </main>
  );
}

function getSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
