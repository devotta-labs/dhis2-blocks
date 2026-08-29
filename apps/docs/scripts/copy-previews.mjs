import { cp, mkdir, rm } from 'node:fs/promises'
import path from 'node:path'

const docsRoot = path.join(import.meta.dirname, '..')
const previewBuild = path.join(docsRoot, '../previews/dist')
const previewTarget = path.join(docsRoot, 'public/previews')

await rm(previewTarget, { recursive: true, force: true })
await mkdir(path.dirname(previewTarget), { recursive: true })
await cp(previewBuild, previewTarget, { recursive: true })
