import { OpenAPI } from './core/OpenAPI';

// Configure OpenAPI client
OpenAPI.BASE = import.meta.env.VITE_API_BASE_URL || '/api';
OpenAPI.WITH_CREDENTIALS = true; 