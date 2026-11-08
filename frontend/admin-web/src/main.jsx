import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Preserve the cascade: foundation -> UI -> application shell -> admin workspace.
import './dung-chung/CSS/base.css'
import './dung-chung/CSS/ui.css'
import './dung-chung/CSS/shell.css'
import './dung-chung/CSS/workspace.css'
import App from './ung-dung/App.jsx'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000, // Dùng cache trong 30 giây trước khi coi dữ liệu là cũ.
    },
  },
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)
