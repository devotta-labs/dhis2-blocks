import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import type { IncomingMessage, Server, ServerResponse } from 'node:http'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'
import {
    events,
    ORG_UNIT,
    parseScenario,
    program,
    rules,
    variables,
} from './scenario.mts'
import type { GeneratedEvent } from './scenario.mts'

const APP = 'blocks-perf'
const BUILD = fileURLToPath(new URL('../build/app', import.meta.url))

const TYPES = new Map(
    Object.entries({
        '.html': 'text/html; charset=utf-8',
        '.js': 'text/javascript; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.json': 'application/json',
        '.webapp': 'application/json',
        '.map': 'application/json',
        '.svg': 'image/svg+xml',
        '.png': 'image/png',
        '.ico': 'image/x-icon',
        '.woff': 'font/woff',
        '.woff2': 'font/woff2',
    })
)

const COMPRESSED = new Set(['.html', '.js', '.css', '.json', '.svg'])

const ME = {
    id: 'PerfUser001',
    username: 'perf',
    name: 'Perf User',
    displayName: 'Perf User',
    firstName: 'Perf',
    surname: 'User',
    email: 'perf@example.org',
    authorities: ['ALL'],
    userRoles: [{ id: 'PerfRole001' }],
    userGroups: [],
    organisationUnits: [{ id: ORG_UNIT }],
    settings: { keyUiLocale: 'en', keyDbLocale: 'en' },
}

const SYSTEM_INFO = {
    version: '2.42.0',
    revision: 'perf',
    calendar: 'iso8601',
    dateFormat: 'yyyy-mm-dd',
    serverTimeZoneId: 'Etc/UTC',
    systemName: 'Blocks performance',
    instanceBaseUrl: '',
}

type Held = Map<string, GeneratedEvent>

/** The events of each program asked for, with what the grid has saved into them since the last reset. */
const programs = new Map<string, Held>()

const eventsOf = (programId: string): Held | undefined => {
    const held = programs.get(programId)
    if (held !== undefined) {
        return held
    }
    const scenario = parseScenario(programId)
    if (scenario === undefined) {
        return undefined
    }
    const made: Held = new Map(
        events(programId, scenario).map((event) => [event.event, event])
    )
    programs.set(programId, made)
    return made
}

class NotFound extends Error {}

/** The program a `program.id:eq:<id>` filter names. */
const filteredProgram = (query: URLSearchParams) => {
    const id = /^program\.id:eq:(.+)$/.exec(query.get('filter') ?? '')?.[1]
    const scenario = id === undefined ? undefined : parseScenario(id)
    if (scenario === undefined) {
        throw new NotFound(`No generated program in ${query.get('filter')}`)
    }
    return scenario
}

const readEvents = (query: URLSearchParams) => {
    const held = eventsOf(query.get('program') ?? '')
    if (held === undefined) {
        throw new NotFound(`No generated program ${query.get('program')}`)
    }
    const only = (query.get('events') ?? query.get('event'))?.split(/[,;]/)
    const found = [...held.values()].filter(
        (event) => only === undefined || only.includes(event.event)
    )
    const direction = query.get('order') === 'occurredAt:asc' ? 1 : -1
    found.sort((a, b) => direction * a.occurredAt.localeCompare(b.occurredAt))
    const page = Number(query.get('page') ?? 1)
    const pageSize = Number(query.get('pageSize') ?? 50)
    return {
        pager: { page, pageSize },
        events: found.slice((page - 1) * pageSize, page * pageSize),
    }
}

type Sent = {
    events?: Array<
        Omit<GeneratedEvent, 'dataValues'> & {
            dataValues?: Array<{ dataElement: string; value: string | null }>
        }
    >
}

/** Saves the events sent as DHIS2 does: their own fields replaced, their values merged, an empty value deleted. */
const save = (sent: Sent) => {
    const stats = { created: 0, updated: 0 }
    for (const event of sent.events ?? []) {
        const held = eventsOf(event.program)
        if (held === undefined) {
            throw new NotFound(`No generated program ${event.program}`)
        }
        const before = held.get(event.event)
        stats[before === undefined ? 'created' : 'updated'] += 1
        const values = new Map(
            [...(before?.dataValues ?? []), ...(event.dataValues ?? [])].map(
                (value) => [value.dataElement, value]
            )
        )
        held.set(event.event, {
            ...event,
            dataValues: [...values.values()].filter(
                (value): value is { dataElement: string; value: string } =>
                    Boolean(value.value)
            ),
        })
    }
    return {
        status: 'OK',
        validationReport: { errorReports: [], warningReports: [] },
        stats: {
            ...stats,
            deleted: 0,
            ignored: 0,
            total: stats.created + stats.updated,
        },
        bundleReport: { typeReportMap: {} },
    }
}

const answer = (
    method: string,
    resource: string,
    query: URLSearchParams,
    body: string
) => {
    const [first, second] = resource.split('/')
    switch (first) {
        case 'system':
            return SYSTEM_INFO
        case 'me':
            // `me/dashboard` counts unread messages for the header bar.
            return second === undefined
                ? ME
                : { unreadInterpretations: 0, unreadMessageConversations: 0 }
        case 'userSettings':
            return ME.settings
        case 'systemSettings':
            return { applicationTitle: 'Blocks performance' }
        case 'programs': {
            const scenario = parseScenario(second ?? '')
            if (scenario === undefined) {
                throw new NotFound(`No generated program ${second}`)
            }
            return program(second, scenario)
        }
        case 'programRules':
            return { programRules: rules(filteredProgram(query)) }
        case 'programRuleVariables': {
            const scenario = filteredProgram(query)
            return {
                programRuleVariables:
                    scenario.rules === 0 ? [] : variables(scenario),
            }
        }
        case 'constants':
            return { constants: [] }
        case 'organisationUnits':
            return {
                organisationUnits: [
                    { id: ORG_UNIT, displayName: 'Generated clinic' },
                ],
            }
        case 'organisationUnitGroups':
            return { organisationUnitGroups: [] }
        case 'tracker':
            if (second === 'events') {
                return readEvents(query)
            }
            if (second === undefined && method === 'POST') {
                // SAFETY: the grid's own import payload; the server reads only its events.
                return save(JSON.parse(body) as Sent)
            }
            throw new NotFound(`${method} ${resource} is not served`)
        default:
            throw new NotFound(`${method} ${resource} is not served`)
    }
}

const send = (
    request: IncomingMessage,
    response: ServerResponse,
    status: number,
    type: string,
    body: string | Buffer,
    cache = 'no-store'
) => {
    const raw = Buffer.from(body)
    const zipped =
        raw.length > 1024 &&
        String(request.headers['accept-encoding']).includes('gzip')
    const out = zipped ? gzipSync(raw) : raw
    response.writeHead(status, {
        'content-type': type,
        'content-length': out.length,
        'cache-control': cache,
        ...(zipped && { 'content-encoding': 'gzip' }),
    })
    response.end(out)
}

const LOGO = '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>'
const files = new Map<string, Buffer>()

const sendFile = (
    request: IncomingMessage,
    response: ServerResponse,
    path: string,
    origin: string
) => {
    const file = join(BUILD, normalize(path === '' ? 'index.html' : path))
    if (!file.startsWith(BUILD) || !existsSync(file)) {
        send(request, response, 404, 'text/plain', `No file ${path}`)
        return
    }
    const type = TYPES.get(extname(file)) ?? 'application/octet-stream'
    if (!COMPRESSED.has(extname(file))) {
        response.writeHead(200, {
            'content-type': type,
            'content-length': statSync(file).size,
            'cache-control': 'public, max-age=3600',
        })
        createReadStream(file).pipe(response)
        return
    }
    let content = files.get(file)
    if (content === undefined) {
        content = readFileSync(file)
        files.set(file, content)
    }
    if (file.endsWith('index.html')) {
        // DHIS2 writes its own address into the app's page, which is how an installed app finds the API.
        send(
            request,
            response,
            200,
            type,
            content.toString().replace('__DHIS2_BASE_URL__', origin)
        )
        return
    }
    send(request, response, 200, type, content, 'public, max-age=3600')
}

const bodyOf = async (request: IncomingMessage) => {
    const chunks: Buffer[] = []
    for await (const chunk of request) {
        chunks.push(chunk)
    }
    return Buffer.concat(chunks).toString()
}

/** A DHIS2 that holds only generated event programs, and serves the built app as an installed app. */
export const serve = (port: number, log = false): Promise<Server> => {
    const server = createServer((request, response) => {
        const origin = `http://${request.headers.host}`
        const url = new URL(request.url ?? '/', origin)
        const method = request.method ?? 'GET'
        const app = `/apps/${APP}/`
        if (url.pathname === '/__reset') {
            programs.clear()
            send(request, response, 200, 'text/plain', 'reset')
            return
        }
        if (url.pathname.startsWith(app)) {
            sendFile(request, response, url.pathname.slice(app.length), origin)
            return
        }
        if (url.pathname.endsWith('/menu/getModules.action')) {
            // The header bar's app menu.
            send(request, response, 200, 'application/json', '{"modules":[]}')
            return
        }
        const resource = /^\/api\/(?:\d+\/)?(.+)$/.exec(url.pathname)?.[1]
        if (resource === undefined) {
            response.writeHead(302, { location: app }).end()
            return
        }
        if (resource === 'staticContent/logo_banner') {
            // The header bar's logo.
            send(request, response, 200, 'image/svg+xml', LOGO)
            return
        }
        void bodyOf(request).then((body) => {
            try {
                const json = JSON.stringify(
                    answer(method, resource, url.searchParams, body)
                )
                send(request, response, 200, 'application/json', json)
            } catch (error) {
                const status = error instanceof NotFound ? 404 : 500
                const message = error instanceof Error ? error.message : ''
                if (log) {
                    console.warn(`${status} ${method} ${url.pathname}`)
                }
                send(
                    request,
                    response,
                    status,
                    'application/json',
                    JSON.stringify({ httpStatusCode: status, message })
                )
            }
        })
    })
    return new Promise((resolve) => {
        server.listen(port, () => resolve(server))
    })
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const port = Number(process.env.PORT ?? 8787)
    await serve(port, true)
    console.log(
        `http://localhost:${port}/apps/${APP}/?program=c40r200u20o10&orgUnit=${ORG_UNIT}`
    )
}
