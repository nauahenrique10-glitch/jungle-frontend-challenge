import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { queryClient } from './app/query-client'
import '@fontsource/roboto-mono/latin-400.css'
import '@fontsource/roboto-mono/latin-500.css'
import '@fontsource/roboto-mono/latin-700.css'
import './styles/globals.css'

async function bootstrap() {
 // A primeira consulta só começa após o service worker assumir a interceptação.
 if (import.meta.env.VITE_ENABLE_MSW !== 'false') {
  const { startMocking } = await import('./services/mocks/browser')
  await startMocking()
 }
 // socket.io-client must evaluate only after MSW installs its WebSocket interceptor.
 const { router } = await import('./app/router')
 ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><QueryClientProvider client={queryClient}><RouterProvider router={router}/></QueryClientProvider></React.StrictMode>)
}
void bootstrap().catch(() => {
 document.getElementById('root')!.textContent = 'Não foi possível iniciar o Kurio. Recarregue a página para tentar novamente.'
})
