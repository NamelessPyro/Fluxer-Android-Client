// Fluxer API Configuration
export const FLUXER_API_BASE_URL = process.env.REACT_APP_FLUXER_API_URL || 'https://api.fluxer.app';
export const FLUXER_WS_URL = process.env.REACT_APP_FLUXER_WS_URL || 'wss://gateway.fluxer.app';

export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/api/v1/auth/login',
    REGISTER: '/api/v1/auth/register',
  },
  USERS: {
    ME: '/api/v1/users/@me',
  },
  CHANNELS: {
    LIST: '/api/v1/channels',
    GET: (id: string) => `/api/v1/channels/${id}`,
    MESSAGES: (id: string) => `/api/v1/channels/${id}/messages`,
    CREATE_MESSAGE: (id: string) => `/api/v1/channels/${id}/messages`,
  },
};
