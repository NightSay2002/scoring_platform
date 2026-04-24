import { Card, CardContent } from "@/components/shared/card";

export function StatCard({
  label,
  value,
  help,
}: {
  label: string;
  value: string | number;
  help: string;
}) {
  return (
    <Card>
      <CardContent>
        <p className="text-sm text-slate-500">{label}</p>
        <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{value}</p>
        <p className="mt-2 text-xs text-slate-500">{help}</p>
      </CardContent>
    </Card>
  );
}
