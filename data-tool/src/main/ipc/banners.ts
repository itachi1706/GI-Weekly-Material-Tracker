import { readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { stringifyDataFile, withTrailingNewline, roundTrips } from '@shared/serialize'
import { datasetFile } from './paths'
import { planActionText, performImageOp } from './entityStore'
import type {
  BannerChange,
  BannerRecord,
  BannerSummary,
  BannerType,
  CommitPreview,
  CommitResult
} from '@shared/types'

const FILE = 'EventBanners.json'
const BANNER_TYPES: BannerType[] = ['character', 'weapon', 'standard', 'chronicled']

interface BannersFile {
  banners: {
    [type: string]: BannerRecord[] | BannerRecord | undefined
    template?: BannerRecord
  }
}

async function readBanners(rootPath: string): Promise<{ raw: string; parsed: BannersFile }> {
  const path = datasetFile(rootPath, FILE)
  if (!existsSync(path)) return { raw: '', parsed: { banners: {} } }
  const raw = await readFile(path, 'utf-8')
  const parsed = JSON.parse(raw)
  if (!parsed.banners || typeof parsed.banners !== 'object') parsed.banners = {}
  return { raw, parsed }
}

/** Array for a banner type (empty array if missing). */
function typeArray(parsed: BannersFile, type: BannerType): BannerRecord[] {
  const arr = parsed.banners[type]
  return Array.isArray(arr) ? arr : []
}

export async function listBanners(rootPath: string): Promise<BannerSummary[]> {
  const { parsed } = await readBanners(rootPath)
  const out: BannerSummary[] = []
  for (const type of BANNER_TYPES) {
    typeArray(parsed, type).forEach((rec, index) => {
      out.push({
        bannerType: type,
        index,
        name: String(rec.name ?? ''),
        version: Number(rec.versionNumber ?? 0),
        start: String(rec.start ?? ''),
        end: String(rec.end ?? ''),
        image: String(rec.image ?? ''),
        rateup: [
          ...((rec.rateupcharacters ?? []) as string[]),
          ...((rec.rateupweapon ?? []) as string[])
        ]
      })
    })
  }
  return out
}

export async function getBanner(
  rootPath: string,
  bannerType: BannerType,
  index: number
): Promise<BannerRecord | null> {
  const { parsed } = await readBanners(rootPath)
  return typeArray(parsed, bannerType)[index] ?? null
}

/** The `banners.template` skeleton object used as a base for new banners. */
export async function getBannerTemplate(rootPath: string): Promise<BannerRecord | null> {
  const { parsed } = await readBanners(rootPath)
  const tpl = parsed.banners.template
  return tpl && !Array.isArray(tpl) ? tpl : null
}

function applyChange(parsed: BannersFile, change: BannerChange): void {
  const arr = typeArray(parsed, change.bannerType)
  if (change.op === 'delete') {
    if (change.index != null) arr.splice(change.index, 1)
  } else if (change.op === 'update') {
    if (change.index != null && change.record) arr[change.index] = change.record
  } else if (change.record) {
    // create → insert at the top (index 0) of the type's array
    arr.unshift(change.record)
  }
  parsed.banners[change.bannerType] = arr
}

export async function previewBannerCommit(
  rootPath: string,
  change: BannerChange
): Promise<CommitPreview> {
  const { raw } = await readBanners(rootPath)
  const before = raw
  const parsed: BannersFile = raw ? JSON.parse(raw) : { banners: {} }
  if (!parsed.banners || typeof parsed.banners !== 'object') parsed.banners = {}

  applyChange(parsed, change)
  const reference = before || '\n'
  const after = withTrailingNewline(stringifyDataFile(parsed), reference)

  return {
    file: FILE,
    before,
    after,
    imageAction: planActionText(change.image),
    formattingDriftWarning:
      before && !roundTrips(before)
        ? 'EventBanners.json does not round-trip under the current serializer; commit is blocked to avoid reformatting untouched banners. Run `npm run normalize:format` against the dataset once to fix.'
        : null
  }
}

export async function commitBanner(rootPath: string, change: BannerChange): Promise<CommitResult> {
  try {
    const preview = await previewBannerCommit(rootPath, change)
    if (preview.formattingDriftWarning) {
      return { ok: false, error: preview.formattingDriftWarning }
    }
    if (change.image) await performImageOp(rootPath, change.image)
    await writeFile(datasetFile(rootPath, FILE), preview.after, 'utf-8')
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}
