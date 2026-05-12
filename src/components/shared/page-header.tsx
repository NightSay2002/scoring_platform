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
    <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-start sm:gap-4">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight text-slate-950 sm:text-2xl">{title}</h1>
        {description ? <p className="max-w-3xl text-sm text-slate-500">{description}</p> : null}
      </div>
      {action ? <div className="w-full sm:w-auto [&>*]:w-full sm:[&>*]:w-auto">{action}</div> : null}
    </div>
  );
}
