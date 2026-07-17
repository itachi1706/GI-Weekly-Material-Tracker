// electron-builder afterPack hook: ad-hoc code-sign the macOS app bundle.
//
// We ship UNSIGNED (no Apple Developer identity, so `mac.identity: null` in electron-builder.yml
// skips real signing). But Apple Silicon (arm64) refuses to launch an executable with no signature
// at all — the kernel kills it. An *ad-hoc* signature ("-") satisfies that requirement without any
// certificate, making the double-clicked app runnable locally. Gatekeeper still shows the usual
// unidentified-developer prompt on first open (right-click → Open, or `xattr -cr <app>`).
const { execSync } = require('node:child_process')
const path = require('node:path')

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return
  // Skip the per-arch temp dirs: @electron/universal requires the x64/arm64 apps to have identical
  // non-binary files, and signing them diverges their CodeResources and breaks the merge. Sign only
  // the final merged output (dist/mac-universal, or dist/mac[-arm64] for a single-arch build).
  if (context.appOutDir.includes('-temp')) return
  const appName = context.packager.appInfo.productFilename
  const appPath = path.join(context.appOutDir, `${appName}.app`)
  console.log(`  • afterPack: ad-hoc signing ${appPath}`)
  execSync(`codesign --force --deep --sign - "${appPath}"`, { stdio: 'inherit' })
}
