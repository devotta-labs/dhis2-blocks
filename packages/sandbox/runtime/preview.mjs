#!/usr/bin/env node
import { renameSync, writeFileSync } from 'node:fs'

const [command, ...args] = process.argv.slice(2)
if (!command || command === '--help') {
    console.log(
        'Usage: sandbox-preview <command> [args]\nRun your dev server on 0.0.0.0:5173. Logs: /sandbox/logs/dev.log\nThe server runs independently of fx and restarts after stop/attach.'
    )
    process.exit(command ? 0 : 1)
}
const path = '/sandbox/preview.json'
const temporary = `${path}.${process.pid}.tmp`
writeFileSync(
    temporary,
    JSON.stringify({ command, args, cwd: process.cwd() }),
    { mode: 0o600 }
)
renameSync(temporary, path)
console.log('Preview command saved. Server output: /sandbox/logs/dev.log')
