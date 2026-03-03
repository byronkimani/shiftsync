import axios from 'axios';

// The singleton instance.
// It relies on dynamic injection of the auth token via a React hook component further up the tree.
// Determine base URL from environment variable, ensuring it ends with /api
const getBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (!envUrl) return 'http://localhost:3000/api';
  return envUrl.endsWith('/api') ? envUrl : `${envUrl.replace(/\/$/, '')}/api`;
};

export const apiClient = axios.create({
  baseURL: getBaseUrl(),
});

// Unwrap { data: ... } standard envelope
apiClient.interceptors.response.use((response) => {
  return response.data?.data ? response.data.data : response.data;
});

// A helper dictionary to organize our network calls logically
export const api = {
  users: {
    getMe: () => apiClient.get('/me'),
    updateMe: (data: any) => apiClient.patch('/me', data),
    getHomeLocation: (userId: string) => apiClient.get(`/users/${userId}/locations`),
    listStaff: (locationId: string) => apiClient.get(`/users?locationId=${locationId}`),
    getAvailability: (userId: string) => apiClient.get(`/users/${userId}/availability`),
    updateAvailability: (userId: string, data: any) => apiClient.put(`/users/${userId}/availability`, data),
  },
  locations: {
    list: () => apiClient.get('/locations'),
  },
  shifts: {
    getWeek: (idOrParam: string, weekStart: string) => {
        // if it's 'me', route to ?userId=me, else locationId
        const param = idOrParam === 'me' ? 'userId=me' : `locationId=${idOrParam}`;
        return apiClient.get(`/shifts?${param}&startUtc=${weekStart}`);
    },
    create: (data: any) => apiClient.post('/shifts', data),
    publish: (shiftId: string, data?: any) => apiClient.post(`/shifts/${shiftId}/publish`, data),
  },
  assignments: {
    create: (shiftId: string, userId: string) => apiClient.post(`/shifts/${shiftId}/assignments`, { userId }),
    drop: (shiftId: string, userId: string) => apiClient.delete(`/shifts/${shiftId}/assignments/${userId}`),
  },
  engine: {
    checkEligibility: (shiftId: string, userId: string) => apiClient.get(`/shifts/${shiftId}/eligibility/${userId}`),
  },
  swaps: {
    list: (locationId?: string) => apiClient.get(locationId ? `/swap-requests?locationId=${locationId}` : '/swap-requests'),
    create: (data: { requesterAssignmentId: string; targetAssignmentId?: string; type: 'swap' | 'drop' }) => apiClient.post('/swap-requests', data),
    accept: (id: string) => apiClient.post(`/swap-requests/${id}/accept`),
    decline: (id: string) => apiClient.post(`/swap-requests/${id}/decline`),
    withdraw: (id: string) => apiClient.post(`/swap-requests/${id}/withdraw`),
    approve: (id: string) => apiClient.post(`/swap-requests/${id}/approve`),
    reject: (id: string) => apiClient.post(`/swap-requests/${id}/reject`),
  },
  notifications: {
    list: () => apiClient.get('/notifications'),
    readAll: () => apiClient.patch('/notifications/read-all'),
    readOne: (id: string) => apiClient.patch(`/notifications/${id}/read`),
  },
  analytics: {
    overtime: (locationId: string, weekStart: string) => apiClient.get(`/analytics/overtime?locationId=${locationId}&weekStart=${weekStart}`),
    fairness: (locationId: string, from: string, to: string) => apiClient.get(`/analytics/fairness?locationId=${locationId}&from=${from}&to=${to}`),
    distribution: (locationId: string, from: string, to: string) => apiClient.get(`/analytics/distribution?locationId=${locationId}&from=${from}&to=${to}`),
  },
  audit: {
    exportCsv: (type: string, locationId: string, from: string, to: string) => 
        apiClient.get(`/audit-logs/export?type=${type}&locationId=${locationId}&from=${from}&to=${to}`, { responseType: 'blob' }),
    history: (shiftId: string) => apiClient.get(`/shifts/${shiftId}/history`),
    export: (from: string, to: string, locationId?: string) => apiClient.get('/audit-logs/export', { params: { from, to, locationId } }),
  },
  poll: {
    schedule: (locationId: string, weekStart: string) => apiClient.get(`/poll/schedule?locationId=${locationId}&weekStart=${weekStart}`),
    notifications: () => apiClient.get('/poll/notifications'),
    swaps: (locationId: string) => apiClient.get(`/poll/swap-requests?locationId=${locationId}`)
  },
  onduty: {
      list: (locationId: string) => apiClient.get(`/on-duty?locationId=${locationId}`)
  }
};
