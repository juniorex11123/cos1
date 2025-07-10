// API Configuration with fallback support
export const getApiUrl = () => {
  const backendUrl = process.env.REACT_APP_BACKEND_URL;
  
  // If REACT_APP_BACKEND_URL is empty or undefined, use relative path (proxy)
  if (!backendUrl || backendUrl.trim() === '') {
    return '';
  }
  
  return backendUrl;
};

// API endpoints
export const API_ENDPOINTS = {
  AUTH: '/api/auth',
  OWNER: '/api/owner', 
  COMPANY: '/api/company',
  EMPLOYEES: '/api/employees',
  TIME: '/api/time'
};

// Create a configured API base URL
export const API_BASE_URL = getApiUrl();