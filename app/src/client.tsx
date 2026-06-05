import { StartClient } from '@tanstack/react-start/client'
import { StrictMode } from 'react'
import { hydrateRoot } from 'react-dom/client'
import { getRouter } from './router'

const router = getRouter()

hydrateRoot(
  document,
  import.meta.env.DEV ? (
    <StrictMode>
      <StartClient router={router} />
    </StrictMode>
  ) : (
    <StartClient router={router} />
  ),
)
