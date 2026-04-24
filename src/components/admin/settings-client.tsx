"use client";

import { useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";

import {
  createCompetitionAction,
  deleteCategoryAction,
  deleteCriterionAction,
  updateSettingsAction,
  upsertCategoryAction,
  upsertCriterionAction,
  upsertUserAccountAction,
} from "@/actions/team";
import { useI18n } from "@/components/i18n/language-provider";
import { Badge } from "@/components/shared/badge";
import { Button } from "@/components/shared/button";
import { Card, CardContent, CardHeader } from "@/components/shared/card";
import { Input } from "@/components/shared/input";
import { Textarea } from "@/components/shared/textarea";
import { DataTable, Table, TBody, TD, TH, THead } from "@/components/shared/table";

type SettingsValue = {
  competitionId: string | null;
  competitionName: string;
  judgingRounds: number;
  allowEditAfterSubmit: boolean;
  showLeaderboard: boolean;
  judgeScope: "ALL" | "ASSIGNED";
  submissionDeadline: Date | null;
  exportIncludeComments: boolean;
};

type Competition = {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
};

type Criterion = {
  id: string;
  categoryId: string;
  categoryName: string;
  name: string;
  description: string | null;
  minScore: number;
  maxScore: number;
  weight: number;
  displayOrder: number;
  active: boolean;
};

type Category = {
  id: string;
  competitionId: string;
  name: string;
  description: string | null;
  displayOrder: number;
  active: boolean;
};

type Account = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "JUDGE" | "TEAM";
  active: boolean;
  assignmentCount: number;
  submittedCount: number;
  linkedTeamId: string;
  linkedTeamLabel: string;
  categoryName: string;
};

type TeamOption = {
  id: string;
  teamCode: string;
  teamName: string;
  ownerUserId: string | null;
};

export function SettingsClient({
  settings,
  competitions,
  selectedCompetitionId,
  criteria,
  categories,
  accounts,
  teams,
}: {
  settings: SettingsValue | null;
  competitions: Competition[];
  selectedCompetitionId: string;
  criteria: Criterion[];
  categories: Category[];
  accounts: Account[];
  teams: TeamOption[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { messages } = useI18n();
  const t = messages.settingsClient;
  const common = messages.common;
  const initialCompetitionId = selectedCompetitionId || settings?.competitionId || competitions[0]?.id || "";

  const [settingsForm, setSettingsForm] = useState({
    competitionId: initialCompetitionId,
    judgingRounds: settings?.judgingRounds ?? 1,
    allowEditAfterSubmit: settings?.allowEditAfterSubmit ?? true,
    showLeaderboard: settings?.showLeaderboard ?? false,
    judgeScope: settings?.judgeScope ?? "ALL",
    submissionDeadline: settings?.submissionDeadline ? new Date(settings.submissionDeadline).toISOString().slice(0, 16) : "",
    exportIncludeComments: settings?.exportIncludeComments ?? true,
  });

  const [competitionForm, setCompetitionForm] = useState({
    name: "",
    description: "",
  });

  const [criterionForm, setCriterionForm] = useState({
    id: "",
    categoryId: categories[0]?.id ?? "",
    name: "",
    description: "",
    minScore: 0,
    maxScore: 100,
    weight: 0,
    displayOrder: criteria.length + 1,
    active: true,
  });

  const [categoryForm, setCategoryForm] = useState({
    id: "",
    competitionId: initialCompetitionId,
    name: "",
    description: "",
    displayOrder: categories.length + 1,
    active: true,
  });

  const [accountForm, setAccountForm] = useState({
    id: "",
    name: "",
    email: "",
    password: "",
    role: "JUDGE" as "ADMIN" | "JUDGE" | "TEAM",
    active: true,
    linkedTeamId: "",
  });
  const [criteriaFilterCategoryId, setCriteriaFilterCategoryId] = useState("");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  const availableTeamOptions = teams.filter((team) => !team.ownerUserId || team.id === accountForm.linkedTeamId);

  const projectedCategoryWeight = useMemo(() => {
    if (!criterionForm.categoryId) {
      return 0;
    }

    const activeOthers = criteria
      .filter(
        (item) =>
          item.categoryId === criterionForm.categoryId &&
          item.active &&
          item.id !== criterionForm.id,
      )
      .reduce((sum, item) => sum + item.weight, 0);

    return activeOthers + (criterionForm.active ? Number(criterionForm.weight) : 0);
  }, [criteria, criterionForm.active, criterionForm.categoryId, criterionForm.id, criterionForm.weight]);

  const filteredCriteria = useMemo(() => {
    if (!criteriaFilterCategoryId) {
      return criteria;
    }

    return criteria.filter((item) => item.categoryId === criteriaFilterCategoryId);
  }, [criteria, criteriaFilterCategoryId]);

  function switchCompetition(nextCompetitionId: string) {
    setSettingsForm((current) => ({ ...current, competitionId: nextCompetitionId }));
    setCategoryForm({
      id: "",
      competitionId: nextCompetitionId,
      name: "",
      description: "",
      displayOrder: 1,
      active: true,
    });
    setCriterionForm({
      id: "",
      categoryId: "",
      name: "",
      description: "",
      minScore: 0,
      maxScore: 100,
      weight: 0,
      displayOrder: 1,
      active: true,
    });
    setCriteriaFilterCategoryId("");

    const nextParams = new URLSearchParams(searchParams.toString());
    if (nextCompetitionId) {
      nextParams.set("competitionId", nextCompetitionId);
    } else {
      nextParams.delete("competitionId");
    }

    router.push(nextParams.toString() ? `${pathname}?${nextParams.toString()}` : pathname);
  }

  function saveSettings() {
    if (!settingsForm.competitionId) {
      setMessage(t.selectCompetitionFirst);
      return;
    }

    startTransition(async () => {
      const result = await updateSettingsAction({
        competitionId: settingsForm.competitionId,
        judgingRounds: Number(settingsForm.judgingRounds),
        allowEditAfterSubmit: settingsForm.allowEditAfterSubmit,
        showLeaderboard: settingsForm.showLeaderboard,
        judgeScope: settingsForm.judgeScope,
        submissionDeadline: settingsForm.submissionDeadline,
        exportIncludeComments: settingsForm.exportIncludeComments,
      });
      setMessage(result?.error ?? t.settingsUpdated);
    });
  }

  function createCompetition() {
    startTransition(async () => {
      const result = await createCompetitionAction({
        name: competitionForm.name,
        description: competitionForm.description,
      });

      if (result?.error) {
        setMessage(result.error);
        return;
      }

      setMessage(t.competitionCreatedSelectHint);
      setCompetitionForm({ name: "", description: "" });
      if (result?.competitionId) {
        switchCompetition(result.competitionId);
      }
    });
  }

  function saveCriterion() {
    if (!criterionForm.categoryId) {
      setMessage(t.selectCategoryFirst);
      return;
    }

    startTransition(async () => {
      const result = await upsertCriterionAction({
        ...criterionForm,
        categoryId: criterionForm.categoryId,
        minScore: Number(criterionForm.minScore),
        maxScore: Number(criterionForm.maxScore),
        weight: Number(criterionForm.weight),
        displayOrder: Number(criterionForm.displayOrder),
      });
      if (result?.error) {
        setMessage(result.error);
        return;
      }

      setMessage(t.criterionSaved);
      setCriterionForm({
        id: "",
        categoryId: criterionForm.categoryId,
        name: "",
        description: "",
        minScore: 0,
        maxScore: 100,
        weight: 0,
        displayOrder: criteria.filter((item) => item.categoryId === criterionForm.categoryId).length + 1,
        active: true,
      });
    });
  }

  function saveCategory() {
    if (!settingsForm.competitionId) {
      setMessage(t.selectCompetitionFirst);
      return;
    }

    startTransition(async () => {
      const result = await upsertCategoryAction({
        ...categoryForm,
        competitionId: settingsForm.competitionId,
      });
      if (result?.error) {
        setMessage(result.error);
        return;
      }

      setMessage(t.categorySaved);
      setCategoryForm({
        id: "",
        competitionId: settingsForm.competitionId,
        name: "",
        description: "",
        displayOrder: categories.length + 1,
        active: true,
      });
    });
  }

  function saveAccount() {
    startTransition(async () => {
      const result = await upsertUserAccountAction(accountForm);
      if (result?.error) {
        setMessage(result.error);
        return;
      }

      setMessage(t.accountSaved);
      setAccountForm({
        id: "",
        name: "",
        email: "",
        password: "",
        role: "JUDGE",
        active: true,
        linkedTeamId: "",
      });
    });
  }

  function editCriterion(item: Criterion) {
    setCriterionForm({
      id: item.id,
      categoryId: item.categoryId,
      name: item.name,
      description: item.description ?? "",
      minScore: item.minScore,
      maxScore: item.maxScore,
      weight: item.weight,
      displayOrder: item.displayOrder,
      active: item.active,
    });
  }

  function editCategory(item: Category) {
    setCategoryForm({
      id: item.id,
      competitionId: item.competitionId,
      name: item.name,
      description: item.description ?? "",
      displayOrder: item.displayOrder,
      active: item.active,
    });
  }

  function editAccount(item: Account) {
    setAccountForm({
      id: item.id,
      name: item.name,
      email: item.email,
      password: "",
      role: item.role,
      active: item.active,
      linkedTeamId: item.linkedTeamId,
    });
  }

  function removeCriterion(id: string) {
    if (!window.confirm(t.confirmDeleteCriterion)) {
      return;
    }

    startTransition(async () => {
      await deleteCriterionAction(id);
      setMessage(t.criterionDeleted);
    });
  }

  function removeCategory(id: string) {
    if (!window.confirm(t.confirmDeleteCategory)) {
      return;
    }

    startTransition(async () => {
      await deleteCategoryAction(id);
      setMessage(t.categoryDeleted);
    });
  }

  function getRoleTone(role: Account["role"]) {
    return role === "ADMIN" ? "blue" : role === "JUDGE" ? "green" : "amber";
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title={t.competitionSettingsTitle} description={t.competitionSettingsDesc} />
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">{t.competitionLabel}</label>
              <select
                value={settingsForm.competitionId}
                onChange={(event) => switchCompetition(event.target.value)}
                className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900"
              >
                <option value="">{t.selectCompetition}</option>
                {competitions.map((competition) => (
                  <option key={competition.id} value={competition.id}>
                    {competition.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">{t.judgingRounds}</label>
              <Input
                type="number"
                min={1}
                value={settingsForm.judgingRounds}
                onChange={(event) => setSettingsForm((current) => ({ ...current, judgingRounds: Number(event.target.value) }))}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-[1fr_2fr_auto]">
            <Input
              placeholder={t.newCompetitionNamePlaceholder}
              value={competitionForm.name}
              onChange={(event) => setCompetitionForm((current) => ({ ...current, name: event.target.value }))}
            />
            <Input
              placeholder={t.newCompetitionDescriptionPlaceholder}
              value={competitionForm.description}
              onChange={(event) => setCompetitionForm((current) => ({ ...current, description: event.target.value }))}
            />
            <Button variant="outline" onClick={createCompetition} disabled={pending} className="gap-2">
              <Plus className="h-4 w-4" />
              {t.createCompetition}
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">{t.judgeVisibility}</label>
              <select
                value={settingsForm.judgeScope}
                onChange={(event) => setSettingsForm((current) => ({ ...current, judgeScope: event.target.value as "ALL" | "ASSIGNED" }))}
                className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900"
              >
                <option value="ALL">{t.judgeVisibilityAll}</option>
                <option value="ASSIGNED">{t.judgeVisibilityAssigned}</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">{t.submissionDeadline}</label>
              <Input
                type="datetime-local"
                value={settingsForm.submissionDeadline}
                onChange={(event) => setSettingsForm((current) => ({ ...current, submissionDeadline: event.target.value }))}
              />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 p-4 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={settingsForm.allowEditAfterSubmit}
                onChange={(event) => setSettingsForm((current) => ({ ...current, allowEditAfterSubmit: event.target.checked }))}
              />
              {t.allowEditAfterSubmit}
            </label>
            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 p-4 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={settingsForm.showLeaderboard}
                onChange={(event) => setSettingsForm((current) => ({ ...current, showLeaderboard: event.target.checked }))}
              />
              {t.showLeaderboardOutsideAdmin}
            </label>
            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 p-4 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={settingsForm.exportIncludeComments}
                onChange={(event) => setSettingsForm((current) => ({ ...current, exportIncludeComments: event.target.checked }))}
              />
              {t.includeCommentsInExports}
            </label>
          </div>
          {message ? <p className="text-sm text-slate-600">{message}</p> : null}
          <div className="flex justify-end">
            <Button onClick={saveSettings} disabled={pending || !settingsForm.competitionId}>
              {pending ? t.saving : t.saveSettings}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader title={t.projectCategoriesTitle} description={t.projectCategoriesDesc} />
          <CardContent className="space-y-4">
            <Table>
              <DataTable>
                <THead>
                  <tr>
                    <TH>{t.categoryName}</TH>
                    <TH>{t.displayOrder}</TH>
                    <TH>{t.statusLabel}</TH>
                    <TH>{t.actionsLabel}</TH>
                  </tr>
                </THead>
                <TBody>
                  {categories.map((category) => (
                    <tr key={category.id}>
                      <TD>
                        <div className="font-medium text-slate-950">{category.name}</div>
                        <div className="text-xs text-slate-500">{category.description}</div>
                      </TD>
                      <TD>{category.displayOrder}</TD>
                      <TD>
                        <Badge tone={category.active ? "green" : "slate"}>
                          {category.active ? common.statuses.active : common.statuses.inactive}
                        </Badge>
                      </TD>
                      <TD>
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="sm" onClick={() => editCategory(category)}>
                            {common.actions.edit}
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => removeCategory(category.id)}>
                            <Trash2 className="h-4 w-4 text-rose-600" />
                          </Button>
                        </div>
                      </TD>
                    </tr>
                  ))}
                </TBody>
              </DataTable>
            </Table>
            <div className="grid gap-4 md:grid-cols-2">
              <Input placeholder={t.categoryName} value={categoryForm.name} onChange={(event) => setCategoryForm((current) => ({ ...current, name: event.target.value }))} />
              <Input placeholder={t.displayOrder} type="number" value={categoryForm.displayOrder} onChange={(event) => setCategoryForm((current) => ({ ...current, displayOrder: Number(event.target.value) }))} />
            </div>
            <Textarea placeholder={t.categoryDescription} value={categoryForm.description} onChange={(event) => setCategoryForm((current) => ({ ...current, description: event.target.value }))} />
            <label className="flex items-center gap-3 text-sm text-slate-700">
              <input type="checkbox" checked={categoryForm.active} onChange={(event) => setCategoryForm((current) => ({ ...current, active: event.target.checked }))} />
              {t.activeCategory}
            </label>
            <div className="flex justify-end">
              <Button onClick={saveCategory} disabled={pending || !settingsForm.competitionId} className="gap-2">
                <Plus className="h-4 w-4" />
                {t.saveCategory}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader title={t.scoringCriteriaTitle} description={t.scoringCriteriaDesc} />
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-slate-700">{t.filterCategory}</label>
              <select
                value={criteriaFilterCategoryId}
                onChange={(event) => setCriteriaFilterCategoryId(event.target.value)}
                className="h-10 min-w-[220px] rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900"
              >
                <option value="">{t.allCategories}</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
            <Table>
              <DataTable>
                <THead>
                  <tr>
                    <TH>{t.categoryName}</TH>
                    <TH>{t.criterionName}</TH>
                    <TH>{t.rangeLabel}</TH>
                    <TH>{t.weight}</TH>
                    <TH>{t.displayOrder}</TH>
                    <TH>{t.statusLabel}</TH>
                    <TH>{t.actionsLabel}</TH>
                  </tr>
                </THead>
                <TBody>
                  {filteredCriteria.map((item) => (
                    <tr key={item.id}>
                      <TD>{item.categoryName}</TD>
                      <TD>
                        <div className="font-medium text-slate-950">{item.name}</div>
                        <div className="text-xs text-slate-500">{item.description}</div>
                      </TD>
                      <TD>
                        {item.minScore} - {item.maxScore}
                      </TD>
                      <TD>{item.weight}%</TD>
                      <TD>{item.displayOrder}</TD>
                      <TD>
                        <Badge tone={item.active ? "green" : "slate"}>
                          {item.active ? common.statuses.active : common.statuses.inactive}
                        </Badge>
                      </TD>
                      <TD>
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="sm" onClick={() => editCriterion(item)}>
                            {common.actions.edit}
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => removeCriterion(item.id)}>
                            <Trash2 className="h-4 w-4 text-rose-600" />
                          </Button>
                        </div>
                      </TD>
                    </tr>
                  ))}
                </TBody>
              </DataTable>
            </Table>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">{t.categoryName}</label>
                <select
                  value={criterionForm.categoryId}
                  onChange={(event) => setCriterionForm((current) => ({ ...current, categoryId: event.target.value }))}
                  className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900"
                >
                  <option value="">{t.selectCategory}</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">{t.criterionName}</label>
                <Input value={criterionForm.name} onChange={(event) => setCriterionForm((current) => ({ ...current, name: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">{t.displayOrder}</label>
                <Input type="number" value={criterionForm.displayOrder} onChange={(event) => setCriterionForm((current) => ({ ...current, displayOrder: Number(event.target.value) }))} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">{t.minScore}</label>
                <Input type="number" value={criterionForm.minScore} onChange={(event) => setCriterionForm((current) => ({ ...current, minScore: Number(event.target.value) }))} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">{t.maxScore}</label>
                <Input type="number" value={criterionForm.maxScore} onChange={(event) => setCriterionForm((current) => ({ ...current, maxScore: Number(event.target.value) }))} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">{t.weight} (%)</label>
                <Input type="number" step="0.01" min={0} max={100} value={criterionForm.weight} onChange={(event) => setCriterionForm((current) => ({ ...current, weight: Number(event.target.value) }))} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium text-slate-700">{t.statusLabel}</label>
                <label className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700">
                  <input type="checkbox" checked={criterionForm.active} onChange={(event) => setCriterionForm((current) => ({ ...current, active: event.target.checked }))} />
                  {t.activeCriterion}
                </label>
              </div>
            </div>
            <p className={`text-xs ${projectedCategoryWeight > 100 ? "text-rose-600" : "text-slate-500"}`}>
              {t.activeWeightPreview} {projectedCategoryWeight.toFixed(2)}%
            </p>
            <Textarea placeholder={t.criterionDescription} value={criterionForm.description} onChange={(event) => setCriterionForm((current) => ({ ...current, description: event.target.value }))} />
            <div className="flex justify-end">
              <Button onClick={saveCriterion} disabled={pending || !criterionForm.categoryId} className="gap-2">
                <Plus className="h-4 w-4" />
                {t.saveCriterion}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader title={t.accountsTitle} description={t.accountsDesc} />
        <CardContent className="space-y-4">
          <Table>
            <DataTable>
              <THead>
                <tr>
                  <TH>{t.namePlaceholder}</TH>
                  <TH>Role</TH>
                  <TH>{t.linkedTeam}</TH>
                  <TH>{t.activity}</TH>
                  <TH>Status</TH>
                  <TH>Actions</TH>
                </tr>
              </THead>
              <TBody>
                {accounts.map((account) => (
                  <tr key={account.id}>
                    <TD>
                      <div className="font-medium text-slate-950">{account.name}</div>
                      <div className="text-xs text-slate-500">{account.email}</div>
                    </TD>
                    <TD>
                      <Badge tone={getRoleTone(account.role)}>
                        {account.role === "ADMIN" ? t.roleAdmin : account.role === "JUDGE" ? t.roleJudge : t.roleTeam}
                      </Badge>
                    </TD>
                    <TD>
                      {account.linkedTeamLabel ? (
                        <div>
                          <div className="font-medium text-slate-950">{account.linkedTeamLabel}</div>
                          <div className="text-xs text-slate-500">{account.categoryName}</div>
                        </div>
                      ) : (
                        "-"
                      )}
                    </TD>
                    <TD>
                      <div className="text-sm text-slate-600">
                        {account.role === "JUDGE"
                          ? `${account.assignmentCount} / ${account.submittedCount} ${t.assignmentsSubmissions}`
                          : account.role === "TEAM"
                            ? t.teamSubmissionOwner
                            : t.adminAccount}
                      </div>
                    </TD>
                    <TD>
                      <Badge tone={account.active ? "green" : "slate"}>
                        {account.active ? common.statuses.active : common.statuses.inactive}
                      </Badge>
                    </TD>
                    <TD>
                      <Button variant="ghost" size="sm" onClick={() => editAccount(account)}>
                        {common.actions.edit}
                      </Button>
                    </TD>
                  </tr>
                ))}
              </TBody>
            </DataTable>
          </Table>
          <div className="grid gap-4 rounded-2xl border border-slate-200 p-4 md:grid-cols-2">
            <Input placeholder={t.namePlaceholder} value={accountForm.name} onChange={(event) => setAccountForm((current) => ({ ...current, name: event.target.value }))} />
            <Input placeholder={t.emailPlaceholder} value={accountForm.email} onChange={(event) => setAccountForm((current) => ({ ...current, email: event.target.value }))} />
            <select
              value={accountForm.role}
              onChange={(event) =>
                setAccountForm((current) => ({
                  ...current,
                  role: event.target.value as "ADMIN" | "JUDGE" | "TEAM",
                  linkedTeamId: event.target.value === "TEAM" ? current.linkedTeamId : "",
                }))
              }
              className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900"
            >
              <option value="ADMIN">{t.roleAdmin}</option>
              <option value="JUDGE">{t.roleJudge}</option>
              <option value="TEAM">{t.roleTeam}</option>
            </select>
            <Input
              placeholder={accountForm.id ? t.keepPasswordPlaceholder : t.temporaryPasswordPlaceholder}
              type="password"
              value={accountForm.password}
              onChange={(event) => setAccountForm((current) => ({ ...current, password: event.target.value }))}
            />
            {accountForm.role === "TEAM" ? (
              <select
                value={accountForm.linkedTeamId}
                onChange={(event) => setAccountForm((current) => ({ ...current, linkedTeamId: event.target.value }))}
                className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 md:col-span-2"
              >
                <option value="">{t.selectLinkedTeam}</option>
                {availableTeamOptions.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.teamCode} - {team.teamName}
                  </option>
                ))}
              </select>
            ) : null}
            <label className="flex items-center gap-3 text-sm text-slate-700 md:col-span-2">
              <input type="checkbox" checked={accountForm.active} onChange={(event) => setAccountForm((current) => ({ ...current, active: event.target.checked }))} />
              {t.activeAccount}
            </label>
            <div className="flex justify-end md:col-span-2">
              <Button onClick={saveAccount} disabled={pending}>
                {accountForm.id ? t.updateAccount : t.createAccount}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
