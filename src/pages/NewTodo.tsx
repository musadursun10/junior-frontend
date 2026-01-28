import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { createTodo } from '../lib/api';

const schema = z.object({
  title: z
    .string()
    .min(3, 'Başlık en az 3 karakter olmalı.')
    .max(60, 'Başlık en fazla 60 karakter olabilir.'),
});

type FormValues = z.infer<typeof schema>;

export default function NewTodo() {
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { title: '' },
  });

  const mutation = useMutation({
    mutationFn: (title: string) => createTodo(title),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todos'] });
      reset();
      toast.success('Todo eklendi (API sahte, akış gerçek).');
    },
    onError: () => {
      toast.error('Kaydetme sırasında hata oluştu.');
    },
  });

  const onSubmit = (values: FormValues) => {
    mutation.mutate(values.title);
  };

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold">Yeni Todo</h1>
      <p className="mt-2 text-slate-600">RHF + Zod + React Query Mutation + Toast.</p>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 max-w-xl space-y-3">
        <div>
          <label className="text-sm font-medium">Başlık</label>
          <input
            className="mt-1 w-full rounded-lg border px-3 py-2 outline-none focus:ring"
            placeholder="Örn: Bugün 30 dk React çalış"
            {...register('title')}
          />
          {errors.title ? <p className="mt-1 text-sm text-red-600">{errors.title.message}</p> : null}
        </div>

        <button
          type="submit"
          disabled={mutation.isPending}
          className="rounded-lg border px-4 py-2 font-semibold hover:bg-slate-50 disabled:opacity-50"
        >
          {mutation.isPending ? 'Kaydediliyor…' : 'Kaydet'}
        </button>
      </form>
    </div>
  );
}
