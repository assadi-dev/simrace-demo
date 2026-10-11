/*
 * Ports dedies aux tests e2e : ils ne touchent ni au serveur ni au front de developpement
 * (8000 et 5173), ni au `.env.local` (VITE_API_URL est force pour le front de test).
 */
export const API_PORT = 8100
export const WEB_PORT = 5273

export const API_URL = `http://localhost:${API_PORT}`
export const WEB_URL = `http://localhost:${WEB_PORT}`
