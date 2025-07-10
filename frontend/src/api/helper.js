// API Helper with automatic endpoint detection
class ApiHelper {
  constructor() {
    this.baseUrl = '';
    this.endpointTested = false;
  }

  async detectEndpoint() {
    if (this.endpointTested) {
      return this.baseUrl;
    }

    // Test endpoints in order of preference
    const endpoints = [
      '', // Relative path (proxy)
      'http://localhost:8001', // Direct backend
      window.location.origin, // Same origin
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(`${endpoint}/api/`, {
          method: 'GET',
          timeout: 5000
        });
        
        if (response.ok) {
          this.baseUrl = endpoint;
          this.endpointTested = true;
          console.log('API endpoint detected:', this.baseUrl || 'proxy');
          return this.baseUrl;
        }
      } catch (error) {
        console.warn(`Failed to connect to ${endpoint}/api/`, error);
      }
    }

    // Fallback to empty string (proxy)
    this.baseUrl = '';
    this.endpointTested = true;
    console.warn('No API endpoint detected, using proxy');
    return this.baseUrl;
  }

  async makeRequest(path, options = {}) {
    const baseUrl = await this.detectEndpoint();
    const url = `${baseUrl}${path}`;
    
    return fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
  }
}

export const apiHelper = new ApiHelper();