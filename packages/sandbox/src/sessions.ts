import { randomBytes } from 'node:crypto'
import {
    existsSync,
    mkdirSync,
    readFileSync,
    readdirSync,
    realpathSync,
    rmSync,
    writeFileSync,
} from 'node:fs'
import { join, resolve } from 'node:path'
import { Effect, Schema } from 'effect'
import { docker } from './docker.ts'

const root = realpathSync(resolve(import.meta.dirname, '../../..'))
const packageRoot = resolve(import.meta.dirname, '..')
const stateRoot = join(root, '.blocks-sandboxes')
const image = 'dhis2-blocks-sandbox:fx-0.0.16-v2'
const ownerLabel = 'devotta.blocks-sandbox.root'
const io = <A>(fn: () => A) =>
    Effect.try({
        try: fn,
        catch: (error) =>
            error instanceof Error ? error : new Error(String(error)),
    })

type Session = {
    id: string
    createdAt: string
    preview?: string
    prepared: boolean
}
function validateId(id: string) {
    if (!/^[a-f0-9]{12}$/.test(id))
        throw new Error('Use a session ID from `pnpm sandbox list`')
    return id
}
const directory = (id: string) => join(stateRoot, validateId(id))
const container = (id: string) => `blocks-sandbox-${validateId(id)}`
const volume = (id: string) => `${container(id)}-data`
const read = (id: string): Session => {
    const value = Schema.decodeUnknownSync(
        Schema.Struct({
            id: Schema.String,
            createdAt: Schema.String,
            preview: Schema.optionalKey(Schema.String),
            prepared: Schema.Boolean,
        })
    )(JSON.parse(readFileSync(join(directory(id), 'session.json'), 'utf8')))
    if (value.id !== id)
        throw new Error('Session metadata does not match its directory')
    return value
}
const save = (session: Session) =>
    writeFileSync(
        join(directory(session.id), 'session.json'),
        JSON.stringify(session, null, 2),
        { mode: 0o600 }
    )

const owned = (id: string) =>
    Effect.gen(function* () {
        const owner = yield* docker([
            'inspect',
            '--format',
            `{{index .Config.Labels "${ownerLabel}"}}`,
            container(id),
        ])
        if (owner !== root)
            return yield* Effect.fail(
                new Error('Container is not owned by this checkout')
            )
    })

const updatePreview = (session: Session) =>
    Effect.gen(function* () {
        const port = yield* docker(['port', container(session.id), '5173/tcp'])
        session.preview = `http://localhost:${port.split(':').at(-1)}`
        yield* io(() => save(session))
    })

// The harness seam: native fx lives inside Docker; a later harness can replace
// this invocation without changing workspace/server lifetime or session storage.
const launchFx = (id: string) =>
    Effect.gen(function* () {
        if (!process.stdin.isTTY || !process.stdout.isTTY) {
            return yield* Effect.fail(
                new Error(
                    `fx needs an interactive terminal. Run pnpm sandbox attach ${id}, or start with --detach.`
                )
            )
        }
        console.log(
            'fx runs inside Docker. Use /provider to connect an account, or export AI_GATEWAY_API_KEY before attaching. Exit fx to detach; the preview keeps running.'
        )
        const key = process.env.AI_GATEWAY_API_KEY
            ? ['--env', 'AI_GATEWAY_API_KEY']
            : []
        const saved = Schema.decodeUnknownSync(
            Schema.Struct({ count: Schema.Number })
        )(
            JSON.parse(
                yield* docker([
                    'exec',
                    container(id),
                    'fx',
                    'sessions',
                    '--json',
                ])
            )
        )
        yield* docker(
            [
                'exec',
                '-it',
                '--env',
                'TERM=xterm-256color',
                ...key,
                '--workdir',
                '/sandbox/app',
                container(id),
                'fx',
                ...(saved.count > 0 ? ['--resume', 'last'] : []),
            ],
            true
        )
    })

export const start = (detach: boolean) =>
    Effect.gen(function* () {
        yield* docker(['info', '--format', '{{.ServerVersion}}'])
        const session: Session = {
            id: randomBytes(6).toString('hex'),
            createdAt: new Date().toISOString(),
            prepared: false,
        }
        const dir = directory(session.id)
        yield* io(() => {
            mkdirSync(dir, { recursive: true, mode: 0o700 })
            save(session)
        })
        console.log(
            `Session ${session.id}. Setup failures retain files; remove with: pnpm sandbox remove ${session.id}`
        )
        yield* docker(['build', '-t', image, packageRoot], true)
        yield* docker([
            'volume',
            'create',
            '--label',
            `${ownerLabel}=${root}`,
            volume(session.id),
        ])
        yield* docker([
            'create',
            '--name',
            container(session.id),
            '--label',
            `${ownerLabel}=${root}`,
            '--init',
            '--add-host',
            'host.docker.internal:host-gateway',
            '--publish',
            '127.0.0.1::5173',
            '--mount',
            `type=volume,src=${volume(session.id)},dst=/sandbox`,
            image,
        ])
        yield* docker(['start', container(session.id)])
        session.prepared = true
        yield* updatePreview(session)
        console.log(
            `Session: ${session.id}\nPreview: ${session.preview} (once your server listens on 0.0.0.0:5173)\nFiles: Docker volume ${volume(session.id)} at /sandbox/app\nLogs: docker logs ${container(session.id)}`
        )
        console.log(
            'Empty workspace with internet access. Create your app with pnpm; run its server using sandbox-preview <command> [args] on 0.0.0.0:5173.'
        )
        if (!detach) yield* launchFx(session.id)
    })

export const list = Effect.gen(function* () {
    const ids = yield* io(() =>
        existsSync(stateRoot)
            ? readdirSync(stateRoot).filter((id) => /^[a-f0-9]{12}$/.test(id))
            : []
    )
    if (!ids.length) {
        console.log('No sandbox sessions. Start one with: pnpm sandbox start')
        return
    }
    const states = yield* docker([
        'ps',
        '-a',
        '--filter',
        `label=${ownerLabel}=${root}`,
        '--format',
        '{{.Names}}\t{{.State}}',
    ])
    console.log('SESSION\tSTATE\tPREVIEW')
    for (const id of ids) {
        const session = yield* io(() => read(id))
        const state =
            states
                .split('\n')
                .find((row) => row.startsWith(`${container(id)}\t`))
                ?.split('\t')[1] ?? 'missing'
        console.log(
            `${id}\t${session.prepared ? state : 'setup incomplete'}\t${session.preview ?? '—'}`
        )
    }
})

export const attach = (id: string) =>
    Effect.gen(function* () {
        const session = yield* io(() => read(id))
        if (!session.prepared)
            return yield* Effect.fail(
                new Error(
                    'Container creation did not complete. Inspect the setup output, then remove and start a new session.'
                )
            )
        yield* owned(id)
        yield* docker(['start', container(id)])
        yield* updatePreview(session)
        console.log(`Preview: ${session.preview}`)
        yield* launchFx(id)
    })

export const stop = (id: string) =>
    Effect.gen(function* () {
        yield* io(() => read(id))
        yield* owned(id)
        yield* docker(['stop', container(id)])
        console.log(
            `Stopped ${id}; app, logs and fx sessions retained. Use attach to restart.`
        )
    })

export const remove = (id: string) =>
    Effect.gen(function* () {
        yield* io(() => read(id))
        const containers = yield* docker(['ps', '-a', '--format', '{{.Names}}'])
        if (containers.split('\n').includes(container(id))) {
            yield* owned(id)
            yield* docker(['rm', '-f', container(id)])
        }
        const volumes = yield* docker(['volume', 'ls', '--format', '{{.Name}}'])
        if (volumes.split('\n').includes(volume(id))) {
            const owner = yield* docker([
                'volume',
                'inspect',
                '--format',
                `{{index .Labels "${ownerLabel}"}}`,
                volume(id),
            ])
            if (owner !== root)
                return yield* Effect.fail(
                    new Error('Volume is not owned by this checkout')
                )
            yield* docker(['volume', 'rm', volume(id)])
        }
        yield* io(() => rmSync(directory(id), { recursive: true }))
        console.log(
            `Removed ${id}, including app files, logs, fx history and saved login.`
        )
    })
