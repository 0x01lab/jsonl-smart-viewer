import { StartClient } from '@tanstack/react-start/client'
import { StrictMode, startTransition } from 'react'
import { hydrateRoot } from 'react-dom/client'
import { getRouter } from './router'
import { QueryProvider } from './context/query-provider'

// Register the router globally before hydration
getRouter()

startTransition(() => {
  hydrateRoot(
    document,
    import.meta.env.DEV ? (
      <StrictMode>
        <QueryProvider>
          <StartClient />
        </QueryProvider>
      </StrictMode>
    ) : (
      <QueryProvider>
        <StartClient />
      </QueryProvider>
    ),
  )
})
