import { contextBridge, ipcRenderer } from 'electron'
import type { DatasetInfo } from '@shared/types'

const api = {
  /** Open the native folder picker, scan it, persist when valid. Null if cancelled. */
  selectDatasetFolder: (): Promise<DatasetInfo | null> => ipcRenderer.invoke('dataset:select'),
  /** Re-scan a known folder. */
  scanDataset: (rootPath: string): Promise<DatasetInfo> =>
    ipcRenderer.invoke('dataset:scan', rootPath),
  /** Auto-load the last valid folder on launch (null if none / no longer valid). */
  getLastDataset: (): Promise<DatasetInfo | null> => ipcRenderer.invoke('dataset:last')
}

export type Api = typeof api

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // Fallback for the (unused) non-isolated case.
  // @ts-ignore - defined on Window in index.d.ts
  window.api = api
}
