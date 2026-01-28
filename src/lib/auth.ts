import { create } from 'zustand';

type User = {
  email: string;
};

type AuthState = {
  user: User | null;
  login: (email: string) => void;
  logout: () => void;
};

export const useAuth = create<AuthState>((set) => ({
  user: null,
  login: (email) => set({ user: { email } }),
  logout: () => set({ user: null }),
}));
