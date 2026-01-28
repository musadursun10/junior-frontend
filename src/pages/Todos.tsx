// src/pages/Todos.tsx
import { useEffect, useMemo, useState } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import toast from "react-hot-toast";
import { api } from "../lib/api";

type Todo = {
  id: number | string;
  title: string;
  completed: boolean;
};

async function fetchTodos(): Promise<Todo[]> {
  const res = await api.get<Todo[]>("/todos");
  return res.data;
}

type StatusFilter = "all" | "active" | "completed";

function formatDateTimeTR(ms: number) {
  if (!ms) return "-";
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(ms));
}

function formatRelativeTR(fromMs: number) {
  if (!fromMs) return "-";
  const diffSec = Math.floor((Date.now() - fromMs) / 1000);

  if (diffSec < 5) return "Az önce";
  if (diffSec < 60) return `${diffSec} sn önce`;

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} dk önce`;

  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} sa önce`;

  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay} gün önce`;
}

function useDebouncedValue<T>(value: T, delay = 200) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(id);
  }, [value, delay]);

  return debounced;
}

async function patchTodoCompleted(params: { id: Todo["id"]; completed: boolean }) {
  const { id, completed } = params;
  const res = await api.patch(`/todos/${id}`, { completed });
  return res.data;
}

export default function Todos() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");

  const debouncedSearch = useDebouncedValue(search, 200);

  const queryClient = useQueryClient();

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
    dataUpdatedAt,
  } = useQuery({
    queryKey: ["todos"],
    queryFn: fetchTodos,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  // relative time canlı aksın diye (30 sn'de bir) tick
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const todos = data ?? [];

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();

    return todos
      .filter((t) => {
        if (status === "active") return !t.completed;
        if (status === "completed") return t.completed;
        return true;
      })
      .filter((t) => {
        if (!q) return true;
        return t.title.toLowerCase().includes(q);
      });
  }, [todos, debouncedSearch, status]);

  const stats = useMemo(() => {
    const total = todos.length;
    const completedCount = todos.filter((t) => t.completed).length;
    const activeCount = total - completedCount;
    return { total, activeCount, completedCount };
  }, [todos]);

  const onRefresh = () => {
    const refreshPromise = (async () => {
      await queryClient.invalidateQueries({ queryKey: ["todos"] });

      const result = await refetch();
      if (result.error) throw result.error;
      return result.data;
    })();

    toast.promise(refreshPromise, {
      loading: "Güncelleniyor…",
      success: "Liste güncellendi ✅",
      error: "Güncelleme başarısız ❌",
    });
  };

  // ✅ Optimistic update + rollback
  const toggleMutation = useMutation({
    mutationFn: patchTodoCompleted,

    onMutate: async ({ id, completed }) => {
      await queryClient.cancelQueries({ queryKey: ["todos"] });

      const prev = queryClient.getQueryData<Todo[]>(["todos"]);

      queryClient.setQueryData<Todo[]>(["todos"], (old) => {
        if (!old) return old;
        return old.map((t) => (t.id === id ? { ...t, completed } : t));
      });

      return { prev };
    },

    onError: (_err, _vars, ctx) => {
      // ✅ rollback
      if (ctx?.prev) {
        queryClient.setQueryData(["todos"], ctx.prev);
      }
      toast.error("Güncelleme başarısız ❌ (geri alındı)");
    },

    onSuccess: () => {
      toast.success("Güncellendi ✅");
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["todos"] });
    },
  });

  const onToggle = (t: Todo) => {
    toggleMutation.mutate({ id: t.id, completed: !t.completed });
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl p-4">
        <h1 className="text-2xl font-bold">Todos</h1>
        <div className="mt-4 rounded-xl border bg-white p-4">
          <div className="h-5 w-48 animate-pulse rounded bg-gray-200" />
          <div className="mt-4 space-y-3">
            <div className="h-4 w-full animate-pulse rounded bg-gray-200" />
            <div className="h-4 w-11/12 animate-pulse rounded bg-gray-200" />
            <div className="h-4 w-10/12 animate-pulse rounded bg-gray-200" />
          </div>
        </div>
      </div>
    );
  }

  if (isError) {
    const message =
      error instanceof Error ? error.message : "Bilinmeyen bir hata oluştu.";
    return (
      <div className="mx-auto max-w-5xl p-4">
        <h1 className="text-2xl font-bold">Todos</h1>

        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
          <div className="font-semibold">Veri alınamadı</div>
          <div className="mt-1 text-sm">{message}</div>

          <button
            onClick={onRefresh}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 active:scale-[0.99]"
          >
            Tekrar Dene
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl p-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Todos</h1>
          <div className="mt-1 text-sm text-gray-600">
            Toplam: <span className="font-semibold">{stats.total}</span> • Aktif:{" "}
            <span className="font-semibold">{stats.activeCount}</span> • Tamamlanan:{" "}
            <span className="font-semibold">{stats.completedCount}</span>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="text-xs text-gray-600 sm:text-right">
            <div>
              Son güncelleme:{" "}
              <span className="font-semibold" title={formatDateTimeTR(dataUpdatedAt)}>
                {formatRelativeTR(dataUpdatedAt)}
                <span className="hidden">{tick}</span>
              </span>
            </div>
            <div className="h-4">
              {isFetching ? (
                <span className="text-blue-700">Güncelleniyor…</span>
              ) : (
                <span className="text-gray-500">—</span>
              )}
            </div>
          </div>

          <button
            onClick={onRefresh}
            disabled={isFetching}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 active:scale-[0.99]"
            title="Listeyi yeniden çek"
          >
            {isFetching ? "Refresh…" : "Refresh"}
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="mt-4 rounded-xl border bg-white p-4">
        <div className="grid gap-3 md:grid-cols-3">
          <label className="block">
            <div className="mb-1 text-xs font-semibold text-gray-700">Search</div>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Başlığa göre ara…"
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </label>

          <label className="block">
            <div className="mb-1 text-xs font-semibold text-gray-700">Filter</div>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as StatusFilter)}
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              <option value="all">Hepsi</option>
              <option value="active">Aktif</option>
              <option value="completed">Tamamlanan</option>
            </select>
          </label>

          <div className="flex items-end">
            <button
              onClick={() => {
                setSearch("");
                setStatus("all");
                toast.success("Filtreler sıfırlandı");
              }}
              className="w-full rounded-lg border px-3 py-2 text-sm font-semibold hover:bg-gray-50 active:scale-[0.99]"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="mt-4 overflow-hidden rounded-xl border bg-white">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="text-sm font-semibold">
            Sonuç: <span className="font-bold">{filtered.length}</span>
          </div>
          <div className="text-xs text-gray-500">
            {toggleMutation.isPending ? "Kaydediliyor…" : "—"}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-gray-600">
            Sonuç yok. Arama/filtreyi değiştir.
          </div>
        ) : (
          <ul className="divide-y">
            {filtered.map((t) => (
              <li key={t.id} className="px-4 py-3 hover:bg-gray-50">
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() => onToggle(t)}
                    disabled={toggleMutation.isPending}
                    className={[
                      "mt-1 inline-flex h-5 w-5 items-center justify-center rounded border text-xs font-bold",
                      "disabled:cursor-not-allowed disabled:opacity-60",
                      t.completed
                        ? "border-green-300 bg-green-50 text-green-700"
                        : "border-gray-300 bg-white text-gray-500",
                    ].join(" ")}
                    title="Durumu değiştir"
                  >
                    {t.completed ? "✓" : "•"}
                  </button>

                  <div className="min-w-0 flex-1">
                    <div
                      className={[
                        "text-sm font-semibold",
                        t.completed ? "text-gray-500 line-through" : "text-gray-900",
                      ].join(" ")}
                    >
                      {t.title}
                    </div>
                    <div className="mt-1 text-xs text-gray-500">ID: {t.id}</div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onToggle(t)}
                    disabled={toggleMutation.isPending}
                    className={[
                      "rounded-full px-2 py-1 text-xs font-semibold",
                      "disabled:cursor-not-allowed disabled:opacity-60",
                      t.completed
                        ? "bg-green-100 text-green-800"
                        : "bg-yellow-100 text-yellow-800",
                    ].join(" ")}
                    title="Durumu değiştir"
                  >
                    {t.completed ? "Completed" : "Active"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
