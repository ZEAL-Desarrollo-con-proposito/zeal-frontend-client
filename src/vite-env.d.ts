/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL base del API Gateway. Vacío = mismo origen del frontend. */
  readonly VITE_API_BASE_URL?: string;
  /** "enabled" activa el API local simulado (MSW) en desarrollo. */
  readonly VITE_API_MOCKING?: 'enabled' | 'disabled';
  /** Endpoint SockJS del Real-Time Gateway (STOMP). */
  readonly VITE_REALTIME_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
