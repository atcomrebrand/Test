import axios, { AxiosRequestConfig } from "axios";

const rawApi = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:3333/api/v1",
});

const TOKEN_KEY = "cc_token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

rawApi.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

rawApi.interceptors.response.use(
  (response) => response.data?.data ?? response.data,
  (error) => {
    if (error.response?.status === 401) {
      setToken(null);
      if (!location.pathname.startsWith("/login") && !location.pathname.startsWith("/register")) {
        location.href = "/login";
      }
    }
    const message = error.response?.data?.message ?? "Erro inesperado. Tente novamente.";
    return Promise.reject(new Error(message));
  },
);

/**
 * The response interceptor above unwraps `{ success, data }` into `data` directly,
 * so at runtime every call resolves to `T`, not `AxiosResponse<T>`. This thin wrapper
 * makes that true at the type level too, so callers only need one generic.
 */
export const api = {
  get: <T = unknown>(url: string, config?: AxiosRequestConfig) => rawApi.get<T, T>(url, config),
  post: <T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig) => rawApi.post<T, T>(url, data, config),
  patch: <T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig) => rawApi.patch<T, T>(url, data, config),
  delete: <T = unknown>(url: string, config?: AxiosRequestConfig) => rawApi.delete<T, T>(url, config),
};
