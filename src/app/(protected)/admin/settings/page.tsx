import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { PageHeader } from "@/components/shared/page-header";
import { SettingsClient } from "@/components/admin/settings-client";
import { getSettingsPageData } from "@/lib/data";
import { getRequestI18n } from "@/lib/i18n-server";

export default async function AdminSettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [session, { messages }] = await Promise.all([auth(), getRequestI18n()]);
  if (session?.user.role === "CHIEF_JUDGE") {
    redirect("/admin");
  }

  const params = await searchParams;
  const competitionId = typeof params.competitionId === "string" ? params.competitionId : undefined;
  const data = await getSettingsPageData(competitionId);
  const t = messages.adminSettings;

  return (
    <div className="space-y-6">
      <PageHeader title={t.title} description={t.description} />
      <SettingsClient
        settings={data.settings}
        competitions={data.competitions}
        selectedCompetitionId={data.selectedCompetitionId}
        criteria={data.criteria}
        categories={data.categories}
        accounts={data.accounts}
      />
    </div>
  );
}
