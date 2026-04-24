export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">{title}</h1>
        {description ? <p className="max-w-3xl text-sm text-slate-500">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
