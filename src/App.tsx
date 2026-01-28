import { Route, Routes } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/home';
import About from './pages/about2';
import NewTodo from './pages/NewTodo';
import NotFound from './pages/NotFound';

export default function App() {
  return (
    <div className="min-h-screen">
      <Navbar />

      <main className="mx-auto max-w-5xl">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/new" element={<NewTodo />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </div>
  );
}
