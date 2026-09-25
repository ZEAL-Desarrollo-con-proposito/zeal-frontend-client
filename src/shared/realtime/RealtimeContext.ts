import { createContext } from 'react';
import type { RealtimeClient, RealtimeClientFactory } from './realtimeClient';

/** Cómo crear el cliente de tiempo real (lo decide la composición de la app: real o simulado). */
export const RealtimeFactoryContext = createContext<RealtimeClientFactory | null>(null);

/** Cliente de la sesión activa; `null` sin sesión. */
export const RealtimeContext = createContext<RealtimeClient | null>(null);
