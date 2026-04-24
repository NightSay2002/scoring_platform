import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { auth } from "@/auth";
import { Badge } from "@/components/shared/badge";
import { Card, CardContent, CardHeader } from "@/components/shared/card";
import { PageHeader } from "@/components/shared/page-header";
import { ScoringForm } from "@/components/judge/scoring-form";
import { getJudgeScoringPageData } from "@/lib/data";
import { getRequestI18n } from "@/lib/i18n-server";
import { getVideoEmbedUrl } from "@/lib/utils";

export default async function JudgeScoringPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }
  const { messages } = await getRequestI18n();
  const t = messages.judgeScoring;
  const common = messages.common;

  const { teamId } = await params;
  const data = await getJudgeScoringPageData(session.user.id, teamId);

  if (!data) {
    notFound();
  }

  const embedUrl = getVideoEmbedUrl(data.team.videoUrl);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <Link href="/judge/teams" className="inline-flex items-center gap-2 text-sm font-medium text-slate-600">
          <ArrowLeft className="h-4 w-4" />
          {t.backToTeams}
        </Link>
        <Badge tone="blue">
          {data.navigation.currentIndex}/{data.navigation.totalTeams} {t.teams}
        </Badge>
      </div>
      <PageHeader
        title={`${data.team.teamName} (${data.team.teamCode})`}
        description={`${data.team.category?.name ?? common.labels.uncategorized} · ${data.team.projectTitle}`}
      />
      <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader title={t.teamProfileTitle} description={t.teamProfileDesc} />
            <CardContent className="space-y-4 text-sm text-slate-600">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">{t.category}</p>
                <p className="mt-1 text-sm font-medium text-slate-950">{data.team.category?.name ?? common.labels.uncategorized}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">{t.organization}</p>
                <p className="mt-1 text-sm font-medium text-slate-950">{data.team.organization || common.labels.notProvided}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">{t.teamMembers}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {data.team.members.map((member) => (
                    <Badge key={member} tone="slate">
                      {member}
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">{t.description}</p>
                <p className="mt-2 leading-7">{data.team.projectDescription}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader title={t.teamVideoTitle} description={t.teamVideoDesc} />
            <CardContent>
              {embedUrl ? (
                <iframe
                  src={embedUrl}
                  title={`${data.team.teamName} video`}
                  className="aspect-video w-full rounded-2xl border border-slate-200"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">
                  {t.noEmbeddableVideo} {data.team.videoUrl ? <Link className="font-medium text-sky-700" href={data.team.videoUrl}>{t.openOriginalLink}</Link> : t.noVideoUrl}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        <ScoringForm
          teamId={data.team.id}
          criteria={data.criteria}
          existingScore={data.existingScore}
          allowEditAfterSubmit={data.settings?.allowEditAfterSubmit ?? true}
          navigation={data.navigation}
        />
      </div>
    </div>
  );
}
