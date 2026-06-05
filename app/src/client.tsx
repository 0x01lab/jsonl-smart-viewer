import { StartClient } from '@tanstack/react-start/client'
import { StrictMode, startTransition } from 'react'
import { hydrateRoot } from 'react-dom/client'
import { getRouter } from './router'

// Register the router globally before hydration
getRouter()

startTransition(() => {
  hydrateRoot(
    document,
    import.meta.env.DEV ? (
      <StrictMode>
        <StartClient />
      </StrictMode>
    ) : (
      <StartClient />
    ),
  )
})
