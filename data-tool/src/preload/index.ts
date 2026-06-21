import { contextBridge, ipcRenderer } from 'electron'
import type {
  DatasetInfo,
  MaterialSummary,
  MaterialRecord,
  MaterialChange,
  OutfitSummary,
  OutfitRecord,
  OutfitChange,
  CommitPreview,
  CommitResult,
  ImagePlan
} from '@shared/types'

const api = {
  /** Open the native folder picker, scan it, persist when valid. Null if cancelled. */
  selectDatasetFolder: (): Promise<DatasetInfo | null> => ipcRenderer.invoke('dataset:select'),
  /** Re-scan a known folder. */
  scanDataset: (rootPath: string): Promise<DatasetInfo> =>
    ipcRenderer.invoke('dataset:scan', rootPath),
  /** Auto-load the last valid folder on launch (null if none / no longer valid). */
  getLastDataset: (): Promise<DatasetInfo | null> => ipcRenderer.invoke('dataset:last'),

  materials: {
    list: (rootPath: string): Promise<MaterialSummary[]> =>
      ipcRenderer.invoke('materials:list', rootPath),
    get: (rootPath: string, file: string, key: string): Promise<MaterialRecord | null> =>
      ipcRenderer.invoke('materials:get', rootPath, file, key),
    templates: (rootPath: string): Promise<Record<string, MaterialRecord>> =>
      ipcRenderer.invoke('materials:templates', rootPath),
    listImages: (rootPath: string, folder: string): Promise<string[]> =>
      ipcRenderer.invoke('materials:listImages', rootPath, folder),
    listImagesMulti: (rootPath: string, folders: string[]): Promise<string[]> =>
      ipcRenderer.invoke('materials:listImagesMulti', rootPath, folders),
    previewImage: (rootPath: string, plan: ImagePlan): Promise<string | null> =>
      ipcRenderer.invoke('materials:previewImage', rootPath, plan),
    selectImageFile: (): Promise<string | null> =>
      ipcRenderer.invoke('materials:selectImageFile'),
    previewCommit: (rootPath: string, change: MaterialChange): Promise<CommitPreview> =>
      ipcRenderer.invoke('materials:previewCommit', rootPath, change),
    commit: (rootPath: string, change: MaterialChange): Promise<CommitResult> =>
      ipcRenderer.invoke('materials:commit', rootPath, change),
    previewBatch: (rootPath: string, changes: MaterialChange[]): Promise<CommitPreview> =>
      ipcRenderer.invoke('materials:previewBatch', rootPath, changes),
    batchCommit: (rootPath: string, changes: MaterialChange[]): Promise<CommitResult> =>
      ipcRenderer.invoke('materials:batchCommit', rootPath, changes),
    listFile: (rootPath: string, file: string): Promise<Record<string, MaterialRecord>> =>
      ipcRenderer.invoke('materials:listFile', rootPath, file)
  },

  outfits: {
    list: (rootPath: string): Promise<OutfitSummary[]> =>
      ipcRenderer.invoke('outfits:list', rootPath),
    get: (rootPath: string, file: string, key: string): Promise<OutfitRecord | null> =>
      ipcRenderer.invoke('outfits:get', rootPath, file, key),
    miscTemplates: (rootPath: string): Promise<Record<string, OutfitRecord>> =>
      ipcRenderer.invoke('outfits:miscTemplates', rootPath),
    previewCommit: (rootPath: string, change: OutfitChange): Promise<CommitPreview> =>
      ipcRenderer.invoke('outfits:previewCommit', rootPath, change),
    commit: (rootPath: string, change: OutfitChange): Promise<CommitResult> =>
      ipcRenderer.invoke('outfits:commit', rootPath, change)
  }
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
