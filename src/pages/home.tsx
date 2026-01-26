import StatCard from '../components/StatCard';

export default function Home() {
  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>
      <p className="mt-2 text-slate-600">
        Bu sayfa, component mantığını ve Tailwind ile layout kurmayı göstermek için başlangıç örneğidir.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Görevler" value={12} />
        <StatCard label="Tamamlanan" value={5} />
        <StatCard label="Bekleyen" value={7} />
      </div>
    </div>
  );
}
