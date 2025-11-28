// src/lib/api.ts
import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:4000",
  timeout: 10000,
});

// ajouter automatiquement l'Authorization header
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// interceptor pour rediriger si 401 (optionnel)
api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err?.response?.status === 401) {
      // on peut centraliser la déconnexion ici si besoin
      localStorage.removeItem("token");
      // ne pas faire de nav ici si pas d'accès au router; laisse le client gérer selon besoin
    }
    return Promise.reject(err);
  }
);

export default api;
