import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000",
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem("access_token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // If backend returns 401 Unauthorized (e.g. token expired, invalid, or missing)
    if (error.response && error.response.status === 401) {
      sessionStorage.removeItem("access_token");
      sessionStorage.removeItem("role");

      // Redirect to login if user isn't already on the login page
      if (window.location.pathname !== "/" && !window.location.pathname.startsWith("/login")) {
        window.location.href = "/";
      }
    }
    return Promise.reject(error);
  }
);

export default api;
