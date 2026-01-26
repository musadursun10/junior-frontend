import { NavLink } from 'react-router-dom';

export default function Navbar() {
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `text-slate-700 hover:underline ${isActive ? 'font-semibold text-slate-900' : ''}`;

  return (
    <header className="border-b">
      <nav className="mx-auto flex max-w-5xl items-center gap-4 p-4">
        <NavLink className="font-semibold" to="/">
          JUNIOR-FE
        </NavLink>

        <NavLink className={linkClass} to="/">
          Home
        </NavLink>
        <NavLink className={linkClass} to="/about">
          About
        </NavLink>
      </nav>
    </header>
  );
}
