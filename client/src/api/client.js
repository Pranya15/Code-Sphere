import axios from "axios";
import toast from "react-hot-toast";

export const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || "/api" });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("codesphere_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error("API request failed", error);
    const message = error.response?.data?.message || error.message || "Request failed";
    if (!error.config?.suppressToast) toast.error(message);
    return Promise.reject(error);
  }
);

export function setToken(token) {
  if (token) localStorage.setItem("codesphere_token", token);
  else localStorage.removeItem("codesphere_token");
}
