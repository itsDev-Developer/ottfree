import axios from "axios";

export const API_BASE = "/api/proxy";

export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  headers: { Accept: "text/html,application/json" },
  // We want to inspect redirects ourselves
  maxRedirects: 0,
  validateStatus: (s) => s >= 200 && s < 400,
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    const status = err?.response?.status;
    if (typeof window !== "undefined" && (status === 401 || status === 302 || status === 303)) {
      const here = window.location.pathname + window.location.search;
      if (!window.location.pathname.startsWith("/login")) {
        window.location.assign(`/login?redirect=${encodeURIComponent(here)}`);
      }
    }
    return Promise.reject(err);
  },
);

export function proxyUrl(path: string): string {
  return `${API_BASE}/${path.replace(/^\//, "")}`;
}
