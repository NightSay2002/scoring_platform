import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Download, Image as ImageIcon } from "lucide-react";

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
  const data = await getJudgeScoringPageData(session.user.id, teamId, session.user.role);

  if (!data) {
    notFound();
  }

  const embedUrl = getVideoEmbedUrl(data.team.videoUrl);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
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
                  {data.team.members.map((member, index) => (
                    <Badge key={`${member}-${index}`} tone="slate">
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
            <CardHeader title={t.teamAttachmentsTitle} description={t.teamAttachmentsDesc} />
            <CardContent className="space-y-4">
              {data.team.imageUrl ? (
                <div className="space-y-3">
                  <p className="text-xs uppercase tracking-wide text-slate-400">{t.submittedImage}</p>
                  <a href={data.team.imageUrl} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                    {/* Keep a plain img so uploaded/local and arbitrary external URLs both render for judges. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={data.team.imageUrl}
                      alt={`${data.team.teamName} submitted image`}
                      className="max-h-72 w-full object-contain"
                    />
                  </a>
                  <Link
                    href={data.team.imageUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700"
                  >
                    <ImageIcon className="h-4 w-4" />
                    {t.viewImage}
                  </Link>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                  {t.noSubmittedImage}
                </div>
              )}

              {data.team.documentLinks.length ? (
                <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-400">{t.submittedFile}</p>
                  <div className="space-y-2">
                    {data.team.documentLinks.map((link, index) => (
                      <div key={`${link.url}-${index}`} className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="break-all text-sm font-medium text-slate-950">{link.name}</p>
                        <Link
                          href={link.url}
                          target="_blank"
                          rel="noreferrer"
                          download
                          className="inline-flex w-fit items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white"
                        >
                          <Download className="h-4 w-4" />
                          {t.downloadFile}
                        </Link>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                  {t.noSubmittedFile}
                </div>
              )}
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
          scoringClosed={data.scoringAvailability.scoringClosed}
          scoringClosedReason={data.scoringAvailability.scoringClosedReason}
          navigation={data.navigation}
        />
      </div>
    </div>
  );
}
