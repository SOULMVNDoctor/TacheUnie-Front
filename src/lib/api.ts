import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:4000",
  timeout: 10000,
});


const token = localStorage.getItem("token");
if (token) {
  api.defaults.headers.common = api.defaults.headers.common || {};
  api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
}


api.interceptors.request.use((config) => {
  const t = localStorage.getItem("token");
  if (t) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${t}`;
  }
  return config;
});


api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err?.response?.status === 401) {

      localStorage.removeItem("token");

    }
    return Promise.reject(err);
  }
);

export default api;