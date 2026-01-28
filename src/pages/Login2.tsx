import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';

const schema = z.object({
  email: z.string().email('Geçerli bir email girin.'),
});

type FormValues = z.infer<typeof schema>;

export default function Login() {
  const navigate = useNavigate();
  const login = useAuth((s) => s.login);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '' },
  });

  const onSubmit = async (values: FormValues) => {
    await new Promise((r) => setTimeout(r, 300));
    login(values.email);          // zustand store'a kullanıcıyı yaz
    navigate('/admin', { replace: true }); // admin'e yönlendir
  };

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold">Login</h1>
      <p className="mt-2 text-slate-600">Mock login (Zod + React Hook Form + Zustand).</p>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 max-w-xl space-y-3">
        <div>
          <label className="text-sm font-medium">Email</label>
          <input
            className="mt-1 w-full rounded-lg border px-3 py-2 outline-none focus:ring"
            placeholder="ornek@mail.com"
            {...register('email')}
          />
          {errors.email ? <p className="mt-1 text-sm text-red-600">{errors.email.message}</p> : null}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-lg border px-4 py-2 font-semibold hover:bg-slate-50 disabled:opacity-50"
        >
          {isSubmitting ? 'Giriş yapılıyor…' : 'Giriş Yap'}
        </button>
      </form>
    </div>
  );
}
