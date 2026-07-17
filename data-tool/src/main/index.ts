import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'node:path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { selectDatasetFolder, selectImageFile } from './ipc/dialog'
import { scanDataset } from './ipc/dataset'
import {
  listMaterials,
  getMaterial,
  getMaterialsForFile,
  listTemplates,
  listImages,
  listImagesMulti,
  previewImage,
  previewImages,
  previewCommit,
  commit,
  previewBatchCommit,
  batchCommit
} from './ipc/materials'
import {
  listOutfits,
  getOutfit,
  listMiscTemplates,
  previewOutfitCommit,
  commitOutfit
} from './ipc/outfits'
import {
  listWeapons,
  getWeapon,
  listWeaponTemplates,
  previewWeaponCommit,
  commitWeapon
} from './ipc/weapons'
import {
  listCharacters,
  getCharacter,
  listCharacterTemplates,
  previewCharacterCommit,
  commitCharacter
} from './ipc/characters'
import {
  listBanners,
  getBanner,
  getBannerTemplate,
  previewBannerCommit,
  commitBanner
} from './ipc/banners'
import { fetchCharacterFromWiki } from './ipc/wiki'
import { readSettings, writeSettings } from './settings'
import type {
  DatasetInfo,
  ImagePlan,
  MaterialChange,
  OutfitChange,
  WeaponChange,
  CharacterChange,
  BannerChange,
  BannerType
} from '@shared/types'

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
  ipcMain.handle('materials:listImagesMulti', (_e, rootPath: string, folders: string[]) =>
    listImagesMulti(rootPath, folders)
  )
  ipcMain.handle('materials:previewImage', (_e, rootPath: string, plan: ImagePlan) =>
    previewImage(rootPath, plan)
  )
  ipcMain.handle('materials:previewImages', (_e, rootPath: string, paths: string[]) =>
    previewImages(rootPath, paths)
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
  ipcMain.handle('materials:listFile', (_e, rootPath: string, file: string) =>
    getMaterialsForFile(rootPath, file)
  )

  // Outfits CRUD.
  ipcMain.handle('outfits:list', (_e, rootPath: string) => listOutfits(rootPath))
  ipcMain.handle('outfits:get', (_e, rootPath: string, file: string, key: string) =>
    getOutfit(rootPath, file, key)
  )
  ipcMain.handle('outfits:miscTemplates', (_e, rootPath: string) => listMiscTemplates(rootPath))
  ipcMain.handle('outfits:previewCommit', (_e, rootPath: string, change: OutfitChange) =>
    previewOutfitCommit(rootPath, change)
  )
  ipcMain.handle('outfits:commit', (_e, rootPath: string, change: OutfitChange) =>
    commitOutfit(rootPath, change)
  )

  // Weapons CRUD.
  ipcMain.handle('weapons:list', (_e, rootPath: string) => listWeapons(rootPath))
  ipcMain.handle('weapons:get', (_e, rootPath: string, file: string, key: string) =>
    getWeapon(rootPath, file, key)
  )
  ipcMain.handle('weapons:templates', (_e, rootPath: string) => listWeaponTemplates(rootPath))
  ipcMain.handle('weapons:previewCommit', (_e, rootPath: string, change: WeaponChange) =>
    previewWeaponCommit(rootPath, change)
  )
  ipcMain.handle('weapons:commit', (_e, rootPath: string, change: WeaponChange) =>
    commitWeapon(rootPath, change)
  )

  // Characters CRUD.
  ipcMain.handle('characters:list', (_e, rootPath: string) => listCharacters(rootPath))
  ipcMain.handle('characters:get', (_e, rootPath: string, file: string, key: string) =>
    getCharacter(rootPath, file, key)
  )
  ipcMain.handle('characters:templates', (_e, rootPath: string) =>
    listCharacterTemplates(rootPath)
  )
  ipcMain.handle('characters:previewCommit', (_e, rootPath: string, change: CharacterChange) =>
    previewCharacterCommit(rootPath, change)
  )
  ipcMain.handle('characters:commit', (_e, rootPath: string, change: CharacterChange) =>
    commitCharacter(rootPath, change)
  )

  // Banners CRUD.
  ipcMain.handle('banners:list', (_e, rootPath: string) => listBanners(rootPath))
  ipcMain.handle('banners:get', (_e, rootPath: string, bannerType: BannerType, index: number) =>
    getBanner(rootPath, bannerType, index)
  )
  ipcMain.handle('banners:template', (_e, rootPath: string) => getBannerTemplate(rootPath))
  ipcMain.handle('banners:previewCommit', (_e, rootPath: string, change: BannerChange) =>
    previewBannerCommit(rootPath, change)
  )
  ipcMain.handle('banners:commit', (_e, rootPath: string, change: BannerChange) =>
    commitBanner(rootPath, change)
  )

  // Wiki auto-fill (Fandom). No rootPath — purely external fetch + parse.
  ipcMain.handle('wiki:fetchCharacter', (_e, url: string) => fetchCharacterFromWiki(url))
}

app.whenReady().then(() => {
  // Keep in sync with `appId` in electron-builder.yml.
  electronApp.setAppUserModelId('com.itachi1706.gi-weekly-material-tracker.datatool')

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
