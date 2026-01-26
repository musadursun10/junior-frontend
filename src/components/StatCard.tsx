import type { ReactNode } from 'react';

type StatCardProps = {
  label: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
};

export default function StatCard({ label, value, subtitle, icon }: StatCardProps) {
  return (
    <div className="rounded-xl border p-4 transition hover:shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm text-slate-500">{label}</div>
          <div className="mt-2 text-2xl font-semibold">{value}</div>
          {subtitle ? <div className="mt-1 text-sm text-slate-500">{subtitle}</div> : null}
        </div>

        {icon ? (
          <div className="rounded-lg border bg-white p-2 text-slate-700">{icon}</div>
        ) : null}
      </div>
    </div>
  );
}
