import { CheckCircle2, ClipboardList, Hourglass } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import StatCard from '../components/StatCard';
import { api } from '../lib/api';

type Todo = {
  userId: number;
  id: number;
  title: string;
  completed: boolean;
};

export default function Home() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const res = await api.get<Todo[]>('/todos?_limit=12');
        if (isMounted) setTodos(res.data);
      } catch {
        if (isMounted) setError('Veri çekilirken hata oluştu.');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    load();

    return () => {
      isMounted = false;
    };
  }, []);

  const stats = useMemo(() => {
    const total = todos.length;
    const done = todos.filter((t) => t.completed).length;
    const pending = total - done;
    return { total, done, pending };
  }, [todos]);

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>
      <p className="mt-2 text-slate-600">API’den örnek veri çekme (Axios + TypeScript).</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Görevler" value={stats.total} subtitle="Toplam" icon={<ClipboardList size={18} />} />
        <StatCard label="Tamamlanan" value={stats.done} subtitle="Completed" icon={<CheckCircle2 size={18} />} />
        <StatCard label="Bekleyen" value={stats.pending} subtitle="Pending" icon={<Hourglass size={18} />} />
      </div>

      <div className="mt-8">
        <h2 className="text-xl font-semibold">Son Görevler</h2>

        {loading ? (
          <p className="mt-3 text-slate-600">Yükleniyor...</p>
        ) : error ? (
          <p className="mt-3 text-red-600">{error}</p>
        ) : (
          <ul className="mt-3 divide-y rounded-xl border">
            {todos.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-4 p-4">
                <div className="min-w-0">
                  <p className="truncate font-medium">{t.title}</p>
                  <p className="text-sm text-slate-500">ID: {t.id}</p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-sm ${
                    t.completed ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {t.completed ? 'Done' : 'Pending'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
