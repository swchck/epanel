/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_TARGET?: 'web' | 'desktop'
  // OAuth app client id for GitHub sign-in in the desktop build; public by design, not a secret
  readonly VITE_GITHUB_CLIENT_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare const __APP_VERSION__: string
declare const __REPO_URL__: string
