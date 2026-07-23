import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'node:path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { selectDatasetFolder, selectImageFile } from './ipc/dialog'
import { scanDataset } from './ipc/dataset'
import { runValidation } from './ipc/validate'
import { initAutoUpdate } from './updater'
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
import {
  fetchCharacterFromWiki,
  fetchWeaponFromWiki,
  fetchOutfitFromWiki,
  fetchMaterialFromWiki
} from './ipc/wiki'
import { readSettings, writeSettings } from './settings'
import { getDatasetRoot, setDatasetRoot } from './datasetRoot'
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

function createWindow(): BrowserWindow {
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

  return mainWindow
}

function registerIpc(): void {
  // The dataset root is owned by MAIN (see datasetRoot.ts): set only from the native dialog / a
  // re-validated last path, never from a renderer-supplied `rootPath`. Every CRUD handler below
  // therefore ignores any `rootPath` the renderer passes and resolves against getDatasetRoot(),
  // so a compromised renderer cannot redirect file I/O to an arbitrary location (tssecurity:S2083).

  // Open the folder picker, scan the chosen folder, and remember it when valid.
  ipcMain.handle('dataset:select', async (): Promise<DatasetInfo | null> => {
    const path = await selectDatasetFolder()
    if (!path) return null
    const info = await scanDataset(path)
    if (info.valid) {
      setDatasetRoot(path)
      await writeSettings({ lastDatasetPath: path })
    }
    return info
  })

  // Re-scan the active folder (e.g. "reload" after external edits).
  ipcMain.handle('dataset:scan', (): Promise<DatasetInfo> => scanDataset(getDatasetRoot()))

  // On launch, auto-load the last folder if it still validates.
  ipcMain.handle('dataset:last', async (): Promise<DatasetInfo | null> => {
    const { lastDatasetPath } = await readSettings()
    if (!lastDatasetPath) return null
    const info = await scanDataset(lastDatasetPath)
    if (!info.valid) return null
    setDatasetRoot(lastDatasetPath)
    return info
  })

  // Materials CRUD.
  ipcMain.handle('materials:list', () => listMaterials(getDatasetRoot()))
  ipcMain.handle('materials:get', (_e, _root, file: string, key: string) =>
    getMaterial(getDatasetRoot(), file, key)
  )
  ipcMain.handle('materials:templates', () => listTemplates(getDatasetRoot()))
  ipcMain.handle('materials:listImages', (_e, _root, folder: string) =>
    listImages(getDatasetRoot(), folder)
  )
  ipcMain.handle('materials:listImagesMulti', (_e, _root, folders: string[]) =>
    listImagesMulti(getDatasetRoot(), folders)
  )
  ipcMain.handle('materials:previewImage', (_e, _root, plan: ImagePlan) =>
    previewImage(getDatasetRoot(), plan)
  )
  ipcMain.handle('materials:previewImages', (_e, _root, paths: string[]) =>
    previewImages(getDatasetRoot(), paths)
  )
  ipcMain.handle('materials:selectImageFile', () => selectImageFile())
  ipcMain.handle('materials:previewCommit', (_e, _root, change: MaterialChange) =>
    previewCommit(getDatasetRoot(), change)
  )
  ipcMain.handle('materials:commit', (_e, _root, change: MaterialChange) =>
    commit(getDatasetRoot(), change)
  )
  ipcMain.handle('materials:previewBatch', (_e, _root, changes: MaterialChange[]) =>
    previewBatchCommit(getDatasetRoot(), changes)
  )
  ipcMain.handle('materials:batchCommit', (_e, _root, changes: MaterialChange[]) =>
    batchCommit(getDatasetRoot(), changes)
  )
  ipcMain.handle('materials:listFile', (_e, _root, file: string) =>
    getMaterialsForFile(getDatasetRoot(), file)
  )

  // Outfits CRUD.
  ipcMain.handle('outfits:list', () => listOutfits(getDatasetRoot()))
  ipcMain.handle('outfits:get', (_e, _root, file: string, key: string) =>
    getOutfit(getDatasetRoot(), file, key)
  )
  ipcMain.handle('outfits:miscTemplates', () => listMiscTemplates(getDatasetRoot()))
  ipcMain.handle('outfits:previewCommit', (_e, _root, change: OutfitChange) =>
    previewOutfitCommit(getDatasetRoot(), change)
  )
  ipcMain.handle('outfits:commit', (_e, _root, change: OutfitChange) =>
    commitOutfit(getDatasetRoot(), change)
  )

  // Weapons CRUD.
  ipcMain.handle('weapons:list', () => listWeapons(getDatasetRoot()))
  ipcMain.handle('weapons:get', (_e, _root, file: string, key: string) =>
    getWeapon(getDatasetRoot(), file, key)
  )
  ipcMain.handle('weapons:templates', () => listWeaponTemplates(getDatasetRoot()))
  ipcMain.handle('weapons:previewCommit', (_e, _root, change: WeaponChange) =>
    previewWeaponCommit(getDatasetRoot(), change)
  )
  ipcMain.handle('weapons:commit', (_e, _root, change: WeaponChange) =>
    commitWeapon(getDatasetRoot(), change)
  )

  // Characters CRUD.
  ipcMain.handle('characters:list', () => listCharacters(getDatasetRoot()))
  ipcMain.handle('characters:get', (_e, _root, file: string, key: string) =>
    getCharacter(getDatasetRoot(), file, key)
  )
  ipcMain.handle('characters:templates', () => listCharacterTemplates(getDatasetRoot()))
  ipcMain.handle('characters:previewCommit', (_e, _root, change: CharacterChange) =>
    previewCharacterCommit(getDatasetRoot(), change)
  )
  ipcMain.handle('characters:commit', (_e, _root, change: CharacterChange) =>
    commitCharacter(getDatasetRoot(), change)
  )

  // Banners CRUD.
  ipcMain.handle('banners:list', () => listBanners(getDatasetRoot()))
  ipcMain.handle('banners:get', (_e, _root, bannerType: BannerType, index: number) =>
    getBanner(getDatasetRoot(), bannerType, index)
  )
  ipcMain.handle('banners:template', () => getBannerTemplate(getDatasetRoot()))
  ipcMain.handle('banners:previewCommit', (_e, _root, change: BannerChange) =>
    previewBannerCommit(getDatasetRoot(), change)
  )
  ipcMain.handle('banners:commit', (_e, _root, change: BannerChange) =>
    commitBanner(getDatasetRoot(), change)
  )

  // Wiki auto-fill (Fandom). No rootPath — purely external fetch + parse.
  ipcMain.handle('wiki:fetchCharacter', (_e, url: string) => fetchCharacterFromWiki(url))
  ipcMain.handle('wiki:fetchWeapon', (_e, url: string) => fetchWeaponFromWiki(url))
  ipcMain.handle('wiki:fetchOutfit', (_e, url: string) => fetchOutfitFromWiki(url))
  ipcMain.handle('wiki:fetchMaterial', (_e, url: string) => fetchMaterialFromWiki(url))

  // Dataset validation (report-only). Reuses the shared rules that back `npm run validate`.
  ipcMain.handle('validate:run', () => runValidation(getDatasetRoot()))
}

app.whenReady().then(() => {
  // Keep in sync with `appId` in electron-builder.yml.
  electronApp.setAppUserModelId('com.itachi1706.gi-weekly-material-tracker.datatool')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  registerIpc()
  const mainWindow = createWindow()
  initAutoUpdate(mainWindow)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit fully when the window is closed, including on macOS (the default keeps the app alive in the
// dock; this is a single-window utility app, so closing the window should end the process).
app.on('window-all-closed', () => {
  app.quit()
})
