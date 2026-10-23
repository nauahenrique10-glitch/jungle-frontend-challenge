import axios from 'axios'
export const http = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api', timeout: 15_000, headers: { Accept: 'application/json' } })
