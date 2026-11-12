export interface AppApi {
  versions: { electron: string; chrome: string }
}

declare global {
  interface Window {
    api: AppApi
  }
}
