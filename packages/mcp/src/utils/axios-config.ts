import axios from "axios";

// Create a custom Axios instance
const axiosInstance = axios.create({
  baseURL: process.env.API_BASE_URL,
  timeout: 10000, // 10 seconds timeout
  headers: {
    "Content-Type": "application/json",
  },
});

// Add a request interceptor to inject the Authorization header
axiosInstance.interceptors.request.use(
  (config) => {
    // Add Authorization header if API_TOKEN is available
    if (process.env.API_TOKEN) {
      config.headers.Authorization = `Bearer ${process.env.API_TOKEN}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default axiosInstance;
