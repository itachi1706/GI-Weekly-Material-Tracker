import { BrowserWindow, dialog } from 'electron'

/** Opens the native folder picker. Returns the chosen path, or null if cancelled. */
export async function selectDatasetFolder(): Promise<string | null> {
  const win = BrowserWindow.getFocusedWindow()
  const options: Electron.OpenDialogOptions = {
    title: 'Select dataset folder',
    properties: ['openDirectory']
  }
  const result = win
    ? await dialog.showOpenDialog(win, options)
    : await dialog.showOpenDialog(options)

  if (result.canceled || result.filePaths.length === 0) return null
  return result.filePaths[0]
}
