import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

const schema = z.object({
  title: z
    .string()
    .min(3, 'Başlık en az 3 karakter olmalı.')
    .max(60, 'Başlık en fazla 60 karakter olabilir.'),
});

type FormValues = z.infer<typeof schema>;

export default function NewTodo() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { title: '' },
  });

  const onSubmit = async (values: FormValues) => {
    // Şimdilik API'ye göndermiyoruz; sadece form akışını öğretiyoruz.
    await new Promise((r) => setTimeout(r, 500));
    alert(`Todo eklendi: ${values.title}`);
    reset();
  };

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold">Yeni Todo</h1>
      <p className="mt-2 text-slate-600">React Hook Form + Zod ile doğrulama örneği.</p>

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
          disabled={isSubmitting}
          className="rounded-lg border px-4 py-2 font-semibold hover:bg-slate-50 disabled:opacity-50"
        >
          {isSubmitting ? 'Kaydediliyor…' : 'Kaydet'}
        </button>
      </form>
    </div>
  );
}
