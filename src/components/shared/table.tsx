import { cn } from "@/lib/utils";

export function Table({ children }: { children: React.ReactNode }) {
  return <div className="overflow-x-auto">{children}</div>;
}

export function DataTable({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <table className={cn("min-w-full divide-y divide-slate-200 text-sm", className)}>{children}</table>;
}

export function THead({ children }: { children: React.ReactNode }) {
  return <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">{children}</thead>;
}

export function TH({ children, className }: { children: React.ReactNode; className?: string }) {
  return <th className={cn("px-4 py-3 font-semibold", className)}>{children}</th>;
}

export function TBody({ children }: { children: React.ReactNode }) {
  return <tbody className="divide-y divide-slate-100 bg-white">{children}</tbody>;
}

export function TD({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn("px-4 py-3 align-top text-slate-700", className)}>{children}</td>;
}
