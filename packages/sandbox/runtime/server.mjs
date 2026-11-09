import { spawn } from 'node:child_process'
import { existsSync, openSync, readFileSync, statSync } from 'node:fs'

// The sandbox is usable before an app exists. An explicit sandbox-preview
// command starts the user's server independently of fx and restores it on boot.
const config = '/sandbox/preview.json'
const log = openSync('/sandbox/logs/dev.log', 'a', 0o600)
let child
let modified
let stopping = false
function launch() {
    if (stopping) return
    try {
        const { command, args, cwd } = JSON.parse(readFileSync(config, 'utf8'))
        child = spawn(command, args, {
            cwd,
            detached: true,
            stdio: ['ignore', log, log],
        })
        child.on('error', (error) =>
            console.error('Preview failed:', error.message)
        )
        child.on('exit', (code) =>
            console.log(
                `Preview exited (${code}); run sandbox-preview again to restart.`
            )
        )
        console.log('Started preview. Output: /sandbox/logs/dev.log')
    } catch (error) {
        console.error('Cannot start preview:', error.message)
    }
}
function kill() {
    if (child?.pid && child.exitCode === null && child.signalCode === null) {
        try {
            process.kill(-child.pid, 'SIGTERM')
        } catch {
            /* Already exited. */
        }
    }
}
function refresh() {
    if (!existsSync(config)) return
    const next = statSync(config).mtimeMs
    if (next === modified) return
    modified = next
    if (child?.pid && child.exitCode === null && child.signalCode === null) {
        child.once('exit', launch)
        kill()
    } else launch()
}
const timer = setInterval(refresh, 500)
for (const signal of ['SIGTERM', 'SIGINT'])
    process.on(signal, () => {
        stopping = true
        clearInterval(timer)
        kill()
    })
console.log(
    'Empty workspace ready. Create your app with pnpm. Use sandbox-preview to run its server on 0.0.0.0:5173.'
)
refresh()
