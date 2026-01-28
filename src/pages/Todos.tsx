import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

type Todo = {
  id: number;
  title: string;
  completed: boolean;
};

async function fetchTodos(): Promise<Todo[]> {
  const res = await api.get<Todo[]>('/todos');
  return res.data;
}

function SkeletonRow() {
  return (
    <div className="rounded-xl border p-4">
      <div className="h-4 w-1/3 animate-pulse rounded bg-slate-200" />
      <div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-slate-200" />
    </div>
  );
}

type Filter = 'all' | 'done' | 'pending';

export default function Todos() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['todos'],
    queryFn: fetchTodos,
  });

  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const filtered = useMemo(() => {
    const list = data ?? [];
    const byText = q.trim().length
      ? list.filter((t) => t.title.toLowerCase().includes(q.trim().toLowerCase()))
      : list;

    if (filter === 'done') return byText.filter((t) => t.completed);
    if (filter === 'pending') return byText.filter((t) => !t.completed);
    return byText;
  }, [data, q, filter]);

  if (isLoading) {
    return (
      <div className="p-6">
        <h1 className="text-3xl font-bold">Todos</h1>
        <p className="mt-2 text-slate-600">Yükleniyor…</p>

        <div className="mt-6 grid gap-3">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-6">
        <h1 className="text-3xl font-bold">Todos</h1>
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="font-semibold text-red-800">Bir hata oluştu.</p>
          <p className="mt-1 text-sm text-red-700">Tekrar denemek için butona bas.</p>
          <button
            onClick={() => refetch()}
            className="mt-3 rounded-lg border px-4 py-2 font-semibold hover:bg-white"
          >
            Tekrar Dene
          </button>
        </div>
      </div>
    );
  }

  // empty state (serverdan gelen liste boşsa)
  if (!data || data.length === 0) {
    return (
      <div className="p-6">
        <h1 className="text-3xl font-bold">Todos</h1>
        <div className="mt-6 rounded-xl border p-6">
          <p className="text-lg font-semibold">Henüz todo yok.</p>
          <p className="mt-1 text-slate-600">İlk todo’nu eklemek için “New Todo” sayfasına git.</p>
        </div>
      </div>
    );
  }

  // empty state (filtre/arama sonucu boşsa)
  const isFilteredEmpty = filtered.length === 0;

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold">Todos</h1>
      <p className="mt-2 text-slate-600">Search + Filter + Empty state.</p>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ara: örn. delectus"
          className="w-full rounded-lg border px-3 py-2 outline-none focus:ring sm:max-w-sm"
        />

        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`rounded-lg border px-3 py-2 text-sm font-semibold ${
              filter === 'all' ? 'bg-slate-900 text-white' : 'hover:bg-slate-50'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('done')}
            className={`rounded-lg border px-3 py-2 text-sm font-semibold ${
              filter === 'done' ? 'bg-slate-900 text-white' : 'hover:bg-slate-50'
            }`}
          >
            Done
          </button>
          <button
            onClick={() => setFilter('pending')}
            className={`rounded-lg border px-3 py-2 text-sm font-semibold ${
              filter === 'pending' ? 'bg-slate-900 text-white' : 'hover:bg-slate-50'
            }`}
          >
            Pending
          </button>
        </div>
      </div>

      {isFilteredEmpty ? (
        <div className="mt-6 rounded-xl border p-6">
          <p className="text-lg font-semibold">Sonuç bulunamadı.</p>
          <p className="mt-1 text-slate-600">Arama terimini veya filtreyi değiştir.</p>
          <button
            className="mt-3 rounded-lg border px-4 py-2 font-semibold hover:bg-slate-50"
            onClick={() => {
              setQ('');
              setFilter('all');
            }}
          >
            Sıfırla
          </button>
        </div>
      ) : (
        <div className="mt-6 grid gap-3">
          {filtered.slice(0, 30).map((t) => (
            <div key={t.id} className="flex items-center justify-between rounded-xl border p-4">
              <div className="min-w-0">
                <p className="truncate font-semibold">{t.title}</p>
                <p className="text-sm text-slate-600">{t.completed ? 'Completed' : 'Not completed'}</p>
              </div>
              <span className="rounded-full border px-3 py-1 text-sm">#{t.id}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
