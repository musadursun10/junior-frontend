import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { api } from "../lib/api";

type Todo = {
  id: number | string;
  title: string;
  completed: boolean;
};

const schema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "En az 3 karakter yaz")
    .max(80, "En fazla 80 karakter"),
});

type FormValues = z.infer<typeof schema>;

async function createTodoRequest(payload: { title: string }): Promise<Todo> {
  // JSON Server gibi backendlere uyumlu
  const res = await api.post<Todo>("/todos", {
    title: payload.title,
    completed: false,
  });
  return res.data;
}

export default function NewTodo() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    watch,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { title: "" },
    mode: "onSubmit",
  });

  const titleValue = watch("title");
  const remaining = useMemo(() => 80 - (titleValue?.length ?? 0), [titleValue]);

  const createMutation = useMutation({
    mutationFn: createTodoRequest,

    onSuccess: (newTodo) => {
      // ✅ 1) Todos cache’ine anında ekle
      queryClient.setQueryData<Todo[]>(["todos"], (old) => {
        if (!old) return [newTodo];
        // aynı id varsa tekrar ekleme
        if (old.some((t) => t.id === newTodo.id)) return old;
        return [newTodo, ...old];
      });

      // ✅ 2) Kullanıcıya bildirim
      toast.success("Todo eklendi ✅");

      // ✅ 3) Formu sıfırla + listeye dön
      reset();
      navigate("/todos");
    },

    onError: () => {
      toast.error("Todo eklenemedi ❌");
    },
  });

  const onSubmit = (values: FormValues) => {
    const p = createMutation.mutateAsync({ title: values.title });
    toast.promise(p, {
      loading: "Kaydediliyor…",
      success: "Todo eklendi ✅",
      error: "Todo eklenemedi ❌",
    });
  };

  return (
    <div className="mx-auto max-w-xl p-4">
      <h1 className="text-2xl font-bold">New Todo</h1>
      <p className="mt-1 text-sm text-gray-600">
        Başlık yaz, kaydet. Kaydedince otomatik <span className="font-semibold">/todos</span>{" "}
        sayfasına döner.
      </p>

      <div className="mt-4 rounded-xl border bg-white p-4">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <label className="block">
            <div className="mb-1 text-xs font-semibold text-gray-700">Todo başlığı</div>
            <input
              {...register("title")}
              placeholder="Örn: Market alışverişi"
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              disabled={createMutation.isPending || isSubmitting}
            />
            <div className="mt-1 flex items-center justify-between text-xs">
              <span className="text-red-600">{errors.title?.message}</span>
              <span className={remaining < 10 ? "text-red-600" : "text-gray-500"}>
                {remaining} karakter kaldı
              </span>
            </div>
          </label>

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={createMutation.isPending || isSubmitting}
              className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 active:scale-[0.99]"
            >
              {createMutation.isPending ? "Kaydediliyor…" : "Kaydet"}
            </button>

            <button
              type="button"
              onClick={() => navigate("/todos")}
              className="inline-flex items-center justify-center rounded-lg border px-4 py-2 text-sm font-semibold hover:bg-gray-50 active:scale-[0.99]"
              disabled={createMutation.isPending || isSubmitting}
            >
              İptal
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
