import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

const api = axios.create({ baseURL: API });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('pob_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response && err.response.status === 401) {
      localStorage.removeItem('pob_token');
      localStorage.removeItem('pob_user');
      if (window.location.pathname !== '/login') window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;

export const PRODUCT_STATUSES = ['Pending', 'Designing', 'Offset', 'Digital Printing', 'Screen Printing', 'Binding', 'Flex', 'Ready', 'Delivered'];

export const STATUS_COLORS = {
  Pending: 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100',
  Designing: 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200',
  Offset: 'bg-cyan-100 text-cyan-900 dark:bg-cyan-900/40 dark:text-cyan-200',
  'Digital Printing': 'bg-blue-100 text-blue-900 dark:bg-blue-900/40 dark:text-blue-200',
  'Screen Printing': 'bg-fuchsia-100 text-fuchsia-900 dark:bg-fuchsia-900/40 dark:text-fuchsia-200',
  Binding: 'bg-indigo-100 text-indigo-900 dark:bg-indigo-900/40 dark:text-indigo-200',
  Flex: 'bg-purple-100 text-purple-900 dark:bg-purple-900/40 dark:text-purple-200',
  Ready: 'bg-teal-100 text-teal-900 dark:bg-teal-900/40 dark:text-teal-200',
  Delivered: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200',
};

export function formatINR(n) {
  const v = Number(n || 0);
  return '₹' + v.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

export function formatDate(d) {
  if (!d) return '';
  const dt = typeof d === 'string' ? new Date(d) : d;
  return dt.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' });
}
