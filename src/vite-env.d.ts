/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MONTE_CARLO_ITERATIONS: string
  readonly VITE_ENABLE_ADVANCED_METRICS: string
  readonly VITE_API_BASE_URL: string
  readonly VITE_SLEEPER_API_URL: string
  // more env variables...
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}