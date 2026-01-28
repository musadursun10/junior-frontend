import axios from 'axios';

export const api = axios.create({
  baseURL: 'https://jsonplaceholder.typicode.com',
  timeout: 10000,
});

export type Todo = {
  userId: number;
  id: number;
  title: string;
  completed: boolean;
};

export async function fetchTodos(limit = 12) {
  const res = await api.get<Todo[]>(`/todos?_limit=${limit}`);
  return res.data;
}

export async function createTodo(title: string) {
  // JSONPlaceholder sahte bir API'dir; gerçek kaydetmez ama 201 döner.
  const res = await api.post<Todo>('/todos', {
    userId: 1,
    title,
    completed: false,
  });
  return res.data;
}
