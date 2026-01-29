import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { api } from "../lib/api";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

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
type SortMode = "activeFirst" | "completedFirst" | "az" | "za";

const ALLOWED_STATUS: StatusFilter[] = ["all", "active", "completed"];
const ALLOWED_SORT: SortMode[] = ["activeFirst", "completedFirst", "az", "za"];
const ALLOWED_PAGE_SIZES = [10, 20, 50] as const;

function toKey(id: Todo["id"]) {
  return String(id);
}

function isTempId(id: Todo["id"]) {
  return typeof id === "string" && id.startsWith("temp-");
}

function clampInt(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

function useDebouncedValue<T>(value: T, delay = 200) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

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

function ChipButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-full px-3 py-1 text-xs font-semibold border",
        active
          ? "bg-gray-900 text-white border-gray-900"
          : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function Modal({
  open,
  title,
  children,
  onClose,
  footer,
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  footer?: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative w-full max-w-md rounded-2xl border bg-white p-4 shadow-lg">
        <div className="text-lg font-bold">{title}</div>
        <div className="mt-3">{children}</div>
        {footer ? <div className="mt-4">{footer}</div> : null}
      </div>
    </div>
  );
}

// PATCH dener; olmazsa PUT fallback
async function updateTodoRobust(input: Todo): Promise<Todo> {
  const { id, title, completed } = input;
  try {
    const res = await api.patch<Todo>(`/todos/${id}`, { title, completed });
    return res.data;
  } catch {
    const res = await api.put<Todo>(`/todos/${id}`, { id, title, completed });
    return res.data;
  }
}

async function deleteTodoRequest(id: Todo["id"]) {
  await api.delete(`/todos/${id}`);
  return id;
}

export default function Todos() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [sp, setSp] = useSearchParams();

  // URL'den ilk state
  const initRef = useRef(() => {
    const q = sp.get("q") ?? "";

    const statusParam = sp.get("status");
    const status: StatusFilter = ALLOWED_STATUS.includes(statusParam as StatusFilter)
      ? (statusParam as StatusFilter)
      : "all";

    const sortParam = sp.get("sort");
    const sort: SortMode = ALLOWED_SORT.includes(sortParam as SortMode)
      ? (sortParam as SortMode)
      : "activeFirst";

    const pageParam = Number(sp.get("page"));
    const page = Number.isFinite(pageParam) && pageParam >= 1 ? pageParam : 1;

    const psParam = Number(sp.get("ps"));
    const pageSize = (ALLOWED_PAGE_SIZES as readonly number[]).includes(psParam)
      ? psParam
      : 10;

    return { q, status, sort, page, pageSize };
  });

  const init = initRef.current();

  const [search, setSearch] = useState(init.q);
  const [status, setStatus] = useState<StatusFilter>(init.status);
  const [sort, setSort] = useState<SortMode>(init.sort);

  const [page, setPage] = useState(init.page);
  const [pageSize, setPageSize] = useState(init.pageSize);
  const [pageInput, setPageInput] = useState(String(init.page));

  const [deleteTarget, setDeleteTarget] = useState<Todo | null>(null);

  const [editTarget, setEditTarget] = useState<Todo | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const editInputRef = useRef<HTMLInputElement | null>(null);

  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // bulk seçim
  const [selected, setSelected] = useState<Record<string, true>>({});

  const debouncedSearch = useDebouncedValue(search, 200);

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

  const todos = data ?? [];

  // son güncelleme yazısı için tick
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const stats = useMemo(() => {
    const total = todos.length;
    const completedCount = todos.filter((t) => t.completed).length;
    const activeCount = total - completedCount;
    return { total, activeCount, completedCount };
  }, [todos]);

  const filteredAndSorted = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();

    const base = todos
      .filter((t) => {
        if (status === "active") return !t.completed;
        if (status === "completed") return t.completed;
        return true;
      })
      .filter((t) => {
        if (!q) return true;
        return t.title.toLowerCase().includes(q);
      });

    const copy = [...base];
    const byTitleAZ = (a: Todo, b: Todo) => a.title.localeCompare(b.title, "tr");
    const byTitleZA = (a: Todo, b: Todo) => b.title.localeCompare(a.title, "tr");

    if (sort === "az") copy.sort(byTitleAZ);
    else if (sort === "za") copy.sort(byTitleZA);
    else if (sort === "completedFirst") copy.sort((a, b) => Number(b.completed) - Number(a.completed));
    else copy.sort((a, b) => Number(a.completed) - Number(b.completed)); // activeFirst

    return copy;
  }, [todos, debouncedSearch, status, sort]);

  // filtreler değişince sayfa 1
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, status, sort, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredAndSorted.length / pageSize));
  const currentPage = clampInt(page, 1, totalPages);

  useEffect(() => {
    if (page !== currentPage) setPage(currentPage);
  }, [page, currentPage]);

  useEffect(() => {
    setPageInput(String(currentPage));
  }, [currentPage]);

  const paged = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAndSorted.slice(start, start + pageSize);
  }, [filteredAndSorted, currentPage, pageSize]);

  const pageFrom = filteredAndSorted.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const pageTo = Math.min(currentPage * pageSize, filteredAndSorted.length);

  // URL state + sessionStorage
  useEffect(() => {
    const params = new URLSearchParams();

    const q = search.trim();
    if (q) params.set("q", q);
    if (status !== "all") params.set("status", status);
    if (sort !== "activeFirst") params.set("sort", sort);
    if (currentPage !== 1) params.set("page", String(currentPage));
    if (pageSize !== 10) params.set("ps", String(pageSize));

    const next = params.toString();
    const curr = sp.toString();
    if (next !== curr) setSp(params, { replace: true });
    sessionStorage.setItem("todos_search", next ? `?${next}` : "");
  }, [search, status, sort, currentPage, pageSize, sp, setSp]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      const isTyping =
        tag === "input" ||
        tag === "textarea" ||
        (e.target as HTMLElement | null)?.isContentEditable;

      if (!isTyping && e.key === "/") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (!isTyping && (e.key === "n" || e.key === "N")) {
        e.preventDefault();
        navigate("/new");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [navigate]);

  const onRefresh = () => {
    const p = (async () => {
      const result = await refetch();
      if (result.error) throw result.error;
      return result.data;
    })();

    toast.promise(p, {
      loading: "Güncelleniyor…",
      success: "Liste güncellendi ✅",
      error: "Güncelleme başarısız ❌",
    });
  };

  const updateMutation = useMutation({
    mutationFn: updateTodoRobust,

    onMutate: async (nextTodo) => {
      await queryClient.cancelQueries({ queryKey: ["todos"] });
      const prev = queryClient.getQueryData<Todo[]>(["todos"]);

      queryClient.setQueryData<Todo[]>(["todos"], (old) => {
        if (!old) return old;
        return old.map((t) => (t.id === nextTodo.id ? nextTodo : t));
      });

      return { prev };
    },

    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["todos"], ctx.prev);
      toast.error("Kaydetme başarısız ❌");
    },

    onSuccess: (serverTodo) => {
      queryClient.setQueryData<Todo[]>(["todos"], (old) => {
        if (!old) return old;
        return old.map((t) => (t.id === serverTodo.id ? serverTodo : t));
      });
      toast.success("Kaydedildi ✅");
      queryClient.invalidateQueries({ queryKey: ["todos"] });
    },
  });

  // UNDO delete: 5sn sonra server delete
  const pendingDeleteTimers = useRef<Record<string, number>>({});

  const removeFromCache = (ids: Todo["id"][]) => {
    queryClient.setQueryData<Todo[]>(["todos"], (old) => {
      if (!old) return old;
      const idSet = new Set(ids.map(toKey));
      return old.filter((t) => !idSet.has(toKey(t.id)));
    });
  };

  const restoreIntoCache = (items: Todo[], indices?: number[]) => {
    queryClient.setQueryData<Todo[]>(["todos"], (old) => {
      const base = old ? [...old] : [];
      const existing = new Set(base.map((t) => toKey(t.id)));

      if (indices && indices.length === items.length) {
        const zipped = items
          .map((item, i) => ({ item, idx: indices[i] }))
          .sort((a, b) => a.idx - b.idx);

        for (const z of zipped) {
          const k = toKey(z.item.id);
          if (existing.has(k)) continue;
          const idx = clampInt(z.idx, 0, base.length);
          base.splice(idx, 0, z.item);
          existing.add(k);
        }
        return base;
      }

      const toAdd = items.filter((it) => !existing.has(toKey(it.id)));
      return [...toAdd, ...base];
    });
  };

  const doDeferredDelete = async (items: Todo[]) => {
    const real = items.filter((t) => !isTempId(t.id));
    if (real.length === 0) return;

    const results = await Promise.allSettled(real.map((t) => deleteTodoRequest(t.id)));
    const failed = results.filter((r) => r.status === "rejected").length;

    if (failed > 0) {
      toast.error("Bazı silmeler başarısız ❌ (liste yenilenecek)");
      queryClient.invalidateQueries({ queryKey: ["todos"] });
    }
  };

  const toastUndo = (label: string, onUndo: () => void) => {
    toast.custom(
      (t) => (
        <div className="rounded-xl border bg-white px-4 py-3 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="text-sm font-semibold text-gray-900">{label}</div>
            <button
              type="button"
              onClick={() => {
                onUndo();
                toast.dismiss(t.id);
              }}
              className="ml-auto rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-black"
            >
              Geri al
            </button>
          </div>
        </div>
      ),
      { duration: 5000 }
    );
  };

  const deleteWithUndo = (todo: Todo) => {
    const key = toKey(todo.id);
    const old = queryClient.getQueryData<Todo[]>(["todos"]) ?? [];
    const idx = old.findIndex((t) => toKey(t.id) === key);

    removeFromCache([todo.id]);

    const timer = window.setTimeout(async () => {
      delete pendingDeleteTimers.current[key];
      await doDeferredDelete([todo]);
    }, 5000);

    pendingDeleteTimers.current[key] = timer;

    toastUndo("Todo silindi", () => {
      const tId = pendingDeleteTimers.current[key];
      if (tId) {
        window.clearTimeout(tId);
        delete pendingDeleteTimers.current[key];
      }
      restoreIntoCache([todo], [idx]);
      toast.success("Geri alındı ✅");
    });
  };

  const bulkDeleteWithUndo = (items: Todo[]) => {
    if (items.length === 0) return;

    const old = queryClient.getQueryData<Todo[]>(["todos"]) ?? [];
    const indices = items.map((it) => old.findIndex((t) => toKey(t.id) === toKey(it.id)));

    removeFromCache(items.map((t) => t.id));
    setSelected({});

    const bulkKey = `bulk-${Date.now()}`;
    const timer = window.setTimeout(async () => {
      delete pendingDeleteTimers.current[bulkKey];
      await doDeferredDelete(items);
    }, 5000);

    pendingDeleteTimers.current[bulkKey] = timer;

    toastUndo(`${items.length} todo silindi`, () => {
      const tId = pendingDeleteTimers.current[bulkKey];
      if (tId) {
        window.clearTimeout(tId);
        delete pendingDeleteTimers.current[bulkKey];
      }
      restoreIntoCache(items, indices);
      toast.success("Geri alındı ✅");
    });
  };

  const isBusy = updateMutation.isPending;

  const onAskDelete = (t: Todo) => {
    if (isBusy) return;
    setDeleteTarget(t);
  };

  const onConfirmDeleteModal = () => {
    if (!deleteTarget) return;
    deleteWithUndo(deleteTarget);
    setDeleteTarget(null);
  };

  const onToggle = (t: Todo) => {
    if (isBusy) return;
    updateMutation.mutate({ ...t, completed: !t.completed });
  };

  const onAskEdit = (t: Todo) => {
    if (isBusy) return;
    setEditTarget(t);
    setEditTitle(t.title);
  };

  useEffect(() => {
    if (!editTarget) return;
    const id = window.setTimeout(() => editInputRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [editTarget]);

  const onConfirmEdit = () => {
    if (!editTarget) return;
    const newTitle = editTitle.trim();
    if (newTitle.length < 3) {
      toast.error("Başlık en az 3 karakter olmalı");
      return;
    }
    updateMutation.mutate({ ...editTarget, title: newTitle });
    setEditTarget(null);
    setEditTitle("");
  };

  const goToPage = (p: number) => setPage(clampInt(p, 1, totalPages));
  const applyPageInput = () => {
    const n = Number(pageInput);
    if (!Number.isFinite(n)) {
      toast.error("Geçerli bir sayı yaz");
      setPageInput(String(currentPage));
      return;
    }
    goToPage(Math.floor(n));
  };

  const selectedCount = useMemo(() => Object.keys(selected).length, [selected]);
  const filteredIds = useMemo(() => filteredAndSorted.map((t) => toKey(t.id)), [filteredAndSorted]);

  const selectedTodos = useMemo(() => {
    if (selectedCount === 0) return [];
    const map = new Map(todos.map((t) => [toKey(t.id), t]));
    return Object.keys(selected)
      .map((k) => map.get(k))
      .filter(Boolean) as Todo[];
  }, [selected, selectedCount, todos]);

  // listede olmayan seçimi temizle
  useEffect(() => {
    if (selectedCount === 0) return;
    const existing = new Set(todos.map((t) => toKey(t.id)));
    setSelected((prev) => {
      const copy: Record<string, true> = {};
      let changed = false;
      for (const k of Object.keys(prev)) {
        if (existing.has(k)) copy[k] = true;
        else changed = true;
      }
      return changed ? copy : prev;
    });
  }, [todos, selectedCount]);

  const selectAllFiltered = () => {
    if (filteredIds.length > 500) {
      toast.error("Çok fazla sonuç var (500+). Önce filtreyi daralt.");
      return;
    }
    setSelected((prev) => {
      const copy = { ...prev };
      for (const k of filteredIds) copy[k] = true;
      return copy;
    });
  };

  const bulkComplete = async () => {
    const items = selectedTodos.filter((t) => !t.completed);
    if (items.length === 0) {
      toast("Seçili todo yok veya hepsi tamam ✅");
      return;
    }

    const prev = queryClient.getQueryData<Todo[]>(["todos"]);
    queryClient.setQueryData<Todo[]>(["todos"], (old) => {
      if (!old) return old;
      const idSet = new Set(items.map((t) => toKey(t.id)));
      return old.map((t) => (idSet.has(toKey(t.id)) ? { ...t, completed: true } : t));
    });

    const promise = Promise.all(items.map((t) => updateTodoRobust({ ...t, completed: true })));

    toast.promise(promise, {
      loading: `${items.length} todo tamamlanıyor…`,
      success: `${items.length} todo tamamlandı ✅`,
      error: "Toplu tamamla başarısız ❌",
    });

    try {
      await promise;
      queryClient.invalidateQueries({ queryKey: ["todos"] });
      setSelected({});
    } catch {
      if (prev) queryClient.setQueryData(["todos"], prev);
    }
  };

  const bulkDelete = () => {
    if (selectedTodos.length === 0) {
      toast("Seçili todo yok");
      return;
    }
    bulkDeleteWithUndo(selectedTodos);
  };

  // ---------------- UI ----------------
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
    const msg = error instanceof Error ? error.message : "Bilinmeyen hata";
    return (
      <div className="mx-auto max-w-5xl p-4">
        <h1 className="text-2xl font-bold">Todos</h1>
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
          <div className="font-semibold">Veri alınamadı</div>
          <div className="mt-1 text-sm">{msg}</div>
          <button
            onClick={() => refetch()}
            className="mt-4 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700"
          >
            Tekrar Dene
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl p-4">
      <Modal
        open={!!deleteTarget}
        title="Todo silinsin mi?"
        onClose={() => setDeleteTarget(null)}
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setDeleteTarget(null)}
              className="rounded-lg border px-3 py-2 text-sm font-semibold hover:bg-gray-50"
            >
              Vazgeç
            </button>
            <button
              type="button"
              onClick={onConfirmDeleteModal}
              className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700"
            >
              Sil (Undo)
            </button>
          </div>
        }
      >
        <div className="text-sm text-gray-600">
          {deleteTarget ? `“${deleteTarget.title}” silinecek (5 sn geri al).` : ""}
        </div>
      </Modal>

      <Modal
        open={!!editTarget}
        title="Todo düzenle"
        onClose={() => {
          setEditTarget(null);
          setEditTitle("");
        }}
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setEditTarget(null);
                setEditTitle("");
              }}
              className="rounded-lg border px-3 py-2 text-sm font-semibold hover:bg-gray-50"
            >
              Vazgeç
            </button>
            <button
              type="button"
              onClick={onConfirmEdit}
              className="rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white hover:bg-black"
            >
              Kaydet
            </button>
          </div>
        }
      >
        <label className="block">
          <div className="mb-1 text-xs font-semibold text-gray-700">Başlık</div>
          <input
            ref={editInputRef}
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onConfirmEdit();
            }}
            className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            placeholder="Todo başlığı…"
          />
          <div className="mt-1 text-xs text-gray-500">En az 3 karakter.</div>
        </label>
      </Modal>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Todos</h1>
          <div className="mt-1 text-sm text-gray-600">
            Toplam: <span className="font-semibold">{stats.total}</span> • Aktif:{" "}
            <span className="font-semibold">{stats.activeCount}</span> • Tamamlanan:{" "}
            <span className="font-semibold">{stats.completedCount}</span>
          </div>
          <div className="mt-1 text-xs text-gray-500">
            Kısayol: <span className="font-semibold">/</span> arama •{" "}
            <span className="font-semibold">N</span> yeni todo
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
              {isFetching ? <span className="text-blue-700">Güncelleniyor…</span> : <span>—</span>}
            </div>
          </div>

          <button
            onClick={onRefresh}
            disabled={isFetching}
            className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {isFetching ? "Refresh…" : "Refresh"}
          </button>

          <Link
            to="/new"
            className="rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white hover:bg-black"
          >
            + New
          </Link>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <ChipButton active={status === "all"} onClick={() => setStatus("all")}>
          Hepsi ({stats.total})
        </ChipButton>
        <ChipButton active={status === "active"} onClick={() => setStatus("active")}>
          Aktifler ({stats.activeCount})
        </ChipButton>
        <ChipButton active={status === "completed"} onClick={() => setStatus("completed")}>
          Tamamlananlar ({stats.completedCount})
        </ChipButton>
      </div>

      <div className="mt-3 rounded-xl border bg-white p-4">
        <div className="grid gap-3 md:grid-cols-4">
          <label className="block">
            <div className="mb-1 text-xs font-semibold text-gray-700">Search</div>
            <input
              ref={searchInputRef}
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

          <label className="block">
            <div className="mb-1 text-xs font-semibold text-gray-700">Sort</div>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortMode)}
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              <option value="activeFirst">Aktifler önce</option>
              <option value="completedFirst">Tamamlananlar önce</option>
              <option value="az">A → Z</option>
              <option value="za">Z → A</option>
            </select>
          </label>

          <div className="flex flex-col gap-2">
            <button
              onClick={() => {
                setSearch("");
                setStatus("all");
                setSort("activeFirst");
                toast.success("Ayarlar sıfırlandı");
              }}
              className="w-full rounded-lg border px-3 py-2 text-sm font-semibold hover:bg-gray-50"
            >
              Reset
            </button>

            <div className="rounded-lg border bg-gray-50 px-3 py-2">
              <div className="text-xs font-semibold text-gray-700">
                Seçili: <span className="font-bold">{selectedCount}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={selectAllFiltered}
                  disabled={filteredAndSorted.length === 0}
                  className="rounded-lg bg-white px-2 py-1 text-xs font-semibold hover:bg-gray-100 disabled:opacity-60"
                >
                  Tüm sonuçları seç
                </button>

                <button
                  type="button"
                  onClick={() => setSelected({})}
                  disabled={selectedCount === 0}
                  className="rounded-lg bg-white px-2 py-1 text-xs font-semibold hover:bg-gray-100 disabled:opacity-60"
                >
                  Seçimi temizle
                </button>

                <button
                  type="button"
                  onClick={bulkComplete}
                  disabled={selectedCount === 0 || isBusy}
                  className="rounded-lg bg-gray-900 px-2 py-1 text-xs font-semibold text-white hover:bg-black disabled:opacity-60"
                >
                  Seçilileri tamamla
                </button>

                <button
                  type="button"
                  onClick={bulkDelete}
                  disabled={selectedCount === 0}
                  className="rounded-lg bg-red-600 px-2 py-1 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                >
                  Seçilileri sil (Undo)
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border bg-white">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="text-sm font-semibold">
            Sonuç: <span className="font-bold">{filteredAndSorted.length}</span>
          </div>
          <div className="text-xs text-gray-500">{isBusy ? "İşleniyor…" : "—"}</div>
        </div>

        {filteredAndSorted.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <div className="text-base font-semibold text-gray-900">Sonuç yok</div>
            <div className="mt-1 text-sm text-gray-600">Filtreyi değiştir veya Reset’e bas.</div>
            <div className="mt-4 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setStatus("all");
                  setSort("activeFirst");
                }}
                className="rounded-lg border px-4 py-2 text-sm font-semibold hover:bg-gray-50"
              >
                Reset
              </button>
              <Link
                to="/new"
                className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black"
              >
                + New Todo
              </Link>
            </div>
          </div>
        ) : (
          <>
            <ul className="divide-y">
              {paged.map((t) => {
                const k = toKey(t.id);
                const checked = !!selected[k];

                return (
                  <li key={k} className="px-4 py-3 hover:bg-gray-50">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setSelected((prev) => {
                            const copy = { ...prev };
                            if (copy[k]) delete copy[k];
                            else copy[k] = true;
                            return copy;
                          })
                        }
                        className="mt-1 h-4 w-4 accent-gray-900"
                      />

                      <button
                        type="button"
                        onClick={() => onToggle(t)}
                        disabled={isBusy}
                        className={[
                          "mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded border text-xs font-bold",
                          "disabled:opacity-60",
                          t.completed
                            ? "border-green-300 bg-green-50 text-green-700"
                            : "border-gray-300 bg-white text-gray-500",
                        ].join(" ")}
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

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onAskEdit(t)}
                          disabled={isBusy}
                          className="rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold hover:bg-gray-200 disabled:opacity-60"
                        >
                          Düzenle
                        </button>

                        <button
                          type="button"
                          onClick={() => onAskDelete(t)}
                          className="rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-800 hover:bg-red-200"
                        >
                          Sil (Undo)
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="flex flex-col gap-2 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                <div className="text-xs text-gray-600">
                  Gösterilen: <span className="font-semibold">{pageFrom}</span>–
                  <span className="font-semibold">{pageTo}</span> /{" "}
                  <span className="font-semibold">{filteredAndSorted.length}</span>
                </div>

                <div className="flex items-center gap-2 text-xs text-gray-700">
                  <span className="font-semibold">Sayfa başına:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    className="rounded-lg border px-2 py-1 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  className="rounded-lg border px-3 py-2 text-sm font-semibold hover:bg-gray-50 disabled:opacity-60"
                  onClick={() => goToPage(1)}
                  disabled={currentPage === 1}
                >
                  İlk
                </button>
                <button
                  className="rounded-lg border px-3 py-2 text-sm font-semibold hover:bg-gray-50 disabled:opacity-60"
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  Önceki
                </button>

                <div className="flex items-center gap-2 rounded-lg border px-2 py-1">
                  <span className="text-xs font-semibold text-gray-700">Sayfa</span>
                  <input
                    value={pageInput}
                    onChange={(e) => setPageInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") applyPageInput();
                      if (e.key === "Escape") setPageInput(String(currentPage));
                    }}
                    className="w-14 rounded-md border px-2 py-1 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    inputMode="numeric"
                  />
                  <span className="text-xs text-gray-600">/ {totalPages}</span>
                  <button
                    type="button"
                    onClick={applyPageInput}
                    className="rounded-md bg-gray-900 px-2 py-1 text-xs font-semibold text-white hover:bg-black"
                  >
                    Git
                  </button>
                </div>

                <button
                  className="rounded-lg border px-3 py-2 text-sm font-semibold hover:bg-gray-50 disabled:opacity-60"
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  Sonraki
                </button>
                <button
                  className="rounded-lg border px-3 py-2 text-sm font-semibold hover:bg-gray-50 disabled:opacity-60"
                  onClick={() => goToPage(totalPages)}
                  disabled={currentPage === totalPages}
                >
                  Son
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
