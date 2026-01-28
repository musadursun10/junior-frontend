import { useAuth } from '../lib/auth';

export default function Admin() {
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold">Admin Panel</h1>
      <p className="mt-2 text-slate-600">Bu sayfa ProtectedRoute ile korunuyor.</p>

      <div className="mt-6 rounded-xl border p-4">
        <p className="font-medium">Giriş yapan kullanıcı</p>
        <p className="mt-1 text-slate-700">{user?.email}</p>

        <button
          onClick={() => logout()}
          className="mt-4 rounded-lg border px-4 py-2 font-semibold hover:bg-slate-50"
        >
          Çıkış Yap
        </button>
      </div>
    </div>
  );
}
