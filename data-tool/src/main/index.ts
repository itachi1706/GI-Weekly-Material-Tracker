import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'node:path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { selectDatasetFolder, selectImageFile } from './ipc/dialog'
import { scanDataset } from './ipc/dataset'
import {
  listMaterials,
  getMaterial,
  listTemplates,
  listImages,
  previewImage,
  previewCommit,
  commit,
  previewBatchCommit,
  batchCommit
} from './ipc/materials'
import { readSettings, writeSettings } from './settings'
import type { DatasetInfo, ImagePlan, MaterialChange } from '@shared/types'

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 820,
    minHeight: 560,
    show: false,
    autoHideMenuBar: true,
    title: 'GI Dataset Tool',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow.show())

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function registerIpc(): void {
  // Open the folder picker, scan the chosen folder, and remember it when valid.
  ipcMain.handle('dataset:select', async (): Promise<DatasetInfo | null> => {
    const path = await selectDatasetFolder()
    if (!path) return null
    const info = await scanDataset(path)
    if (info.valid) await writeSettings({ lastDatasetPath: path })
    return info
  })

  // Re-scan an already-known folder (e.g. "reload" after external edits).
  ipcMain.handle('dataset:scan', (_e, rootPath: string): Promise<DatasetInfo> => {
    return scanDataset(rootPath)
  })

  // On launch, auto-load the last folder if it still validates.
  ipcMain.handle('dataset:last', async (): Promise<DatasetInfo | null> => {
    const { lastDatasetPath } = await readSettings()
    if (!lastDatasetPath) return null
    const info = await scanDataset(lastDatasetPath)
    return info.valid ? info : null
  })

  // Materials CRUD.
  ipcMain.handle('materials:list', (_e, rootPath: string) => listMaterials(rootPath))
  ipcMain.handle('materials:get', (_e, rootPath: string, file: string, key: string) =>
    getMaterial(rootPath, file, key)
  )
  ipcMain.handle('materials:templates', (_e, rootPath: string) => listTemplates(rootPath))
  ipcMain.handle('materials:listImages', (_e, rootPath: string, folder: string) =>
    listImages(rootPath, folder)
  )
  ipcMain.handle('materials:previewImage', (_e, rootPath: string, plan: ImagePlan) =>
    previewImage(rootPath, plan)
  )
  ipcMain.handle('materials:selectImageFile', () => selectImageFile())
  ipcMain.handle('materials:previewCommit', (_e, rootPath: string, change: MaterialChange) =>
    previewCommit(rootPath, change)
  )
  ipcMain.handle('materials:commit', (_e, rootPath: string, change: MaterialChange) =>
    commit(rootPath, change)
  )
  ipcMain.handle('materials:previewBatch', (_e, rootPath: string, changes: MaterialChange[]) =>
    previewBatchCommit(rootPath, changes)
  )
  ipcMain.handle('materials:batchCommit', (_e, rootPath: string, changes: MaterialChange[]) =>
    batchCommit(rootPath, changes)
  )
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.giwmt.datatool')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  registerIpc()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
