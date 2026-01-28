import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-2 rounded-md ${isActive ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'}`;

export default function Navbar() {
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const navigate = useNavigate();

  return (
    <header className="border-b">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <div className="font-extrabold tracking-tight">JUNIOR-FE</div>

        <nav className="flex items-center gap-2">
          <NavLink to="/" className={linkClass}>
            Home
          </NavLink>
          <NavLink to="/about" className={linkClass}>
            About
          </NavLink>
          <NavLink to="/new" className={linkClass}>
            New Todo
          </NavLink>
          <NavLink to="/todos" className={linkClass}>
            Todos
          </NavLink>

          {user ? (
            <>
              <NavLink to="/admin" className={linkClass}>
                Admin
              </NavLink>

              <button
                className="px-3 py-2 rounded-md text-slate-700 hover:bg-slate-100"
                onClick={() => {
                  logout();
                  navigate('/login');
                }}
              >
                Logout
              </button>
            </>
          ) : (
            <NavLink to="/login" className={linkClass}>
              Login
            </NavLink>
          )}
        </nav>
      </div>
    </header>
  );
}
