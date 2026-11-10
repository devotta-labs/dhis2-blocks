import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { SourceMap } from 'node:module'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { measure } from './measure.mts'
import type { Frame, MainThread, Sampled } from './session.mts'
import { serve } from './serve.mts'

const ASSETS = join(
    dirname(fileURLToPath(import.meta.url)),
    '../build/app/assets'
)
const TOP = 12

const maps = new Map<string, SourceMap | undefined>()

const mapOf = (url: string) => {
    const file = basename(new URL(url).pathname)
    if (!maps.has(file)) {
        try {
            maps.set(
                file,
                new SourceMap(
                    JSON.parse(
                        readFileSync(join(ASSETS, `${file}.map`), 'utf8')
                    )
                )
            )
        } catch {
            maps.set(file, undefined)
        }
    }
    return maps.get(file)
}

/** The package or the registry file a source belongs to. */
const owner = (source: string) => {
    const dependency =
        /node_modules\/(?:\.pnpm\/[^/]+\/node_modules\/)?((?:@[^/]+\/)?[^/]+)/.exec(
            source
        )
    if (dependency !== null) {
        return dependency[1]
    }
    const registry = /packages\/registry\/(.+)$/.exec(source)
    return registry === null ? source : registry[1]
}

/** Where a sampled frame was written, before the build bundled and shortened it. */
const written = ({
    url,
    scriptId,
    functionName,
    lineNumber,
    columnNumber,
}: Frame) => {
    if (functionName.startsWith('(')) {
        // The browser's own work: "(garbage collector)", "(program)", …
        return { where: functionName, what: functionName }
    }
    if (!url.startsWith('http')) {
        return scriptId === '0'
            ? { where: 'DOM calls from script', what: `${functionName} (DOM)` }
            : {
                  where: 'the benchmark itself',
                  what: `${functionName} (benchmark)`,
              }
    }
    const entry = mapOf(url)?.findEntry(lineNumber, columnNumber)
    if (entry === undefined || !('originalSource' in entry)) {
        return { where: basename(url), what: functionName }
    }
    const where = owner(entry.originalSource)
    const file = entry.originalSource.includes('node_modules')
        ? `${where} ${basename(entry.originalSource)}`
        : where
    // The build shortened the name; the line is where to read what it is.
    return {
        where,
        what: `${functionName} (${file}:${entry.originalLine + 1})`,
    }
}

/** The milliseconds each node itself ran, not counting what it called. */
const selfTimes = ({ nodes, samples = [], timeDeltas = [] }: Sampled) => {
    const micros = new Map<number, number>()
    samples.forEach((id, index) => {
        micros.set(id, (micros.get(id) ?? 0) + (timeDeltas[index] ?? 0))
    })
    return nodes.map((node) => ({
        frame: node.callFrame,
        ms: (micros.get(node.id) ?? 0) / 1000,
    }))
}

const largest = (sums: Map<string, number>) =>
    [...sums]
        .sort(([, a], [, b]) => b - a)
        .slice(0, TOP)
        .map(([name, ms]) => ({ name, ms: Math.round(ms * 10) / 10 }))

/** One part's samples as the places and the functions the main thread spent longest in. */
const summary = (samples: Sampled) => {
    const places = new Map<string, number>()
    const functions = new Map<string, number>()
    let busy = 0
    for (const { frame, ms } of selfTimes(samples)) {
        if (frame.functionName === '(idle)' || ms === 0) {
            continue
        }
        const { where, what } = written(frame)
        busy += ms
        places.set(where, (places.get(where) ?? 0) + ms)
        functions.set(what, (functions.get(what) ?? 0) + ms)
    }
    return {
        busyMs: Math.round(busy),
        places: largest(places),
        functions: largest(functions),
    }
}

const { values: args } = parseArgs({
    options: {
        columns: { type: 'string', default: '40' },
        pageSize: { type: 'string', default: '50' },
        rules: { type: 'string', default: '20' },
        options: { type: 'string', default: '10' },
        slowdown: { type: 'string', default: '1' },
        out: { type: 'string', default: 'results' },
        port: { type: 'string', default: '8790' },
    },
})

const port = Number(args.port)
const server = await serve(port)
const grid = {
    columns: Number(args.columns),
    pageSize: Number(args.pageSize),
    rows: Number(args.pageSize) * 2,
    rules: Number(args.rules),
    options: Number(args.options),
}
const name = `c${grid.columns}p${grid.pageSize}u${grid.rules}o${grid.options}`
const parts: Array<
    { part: string; main: MainThread } & ReturnType<typeof summary>
> = []
mkdirSync(join(args.out, 'profiles'), { recursive: true })
await measure(
    `http://localhost:${port}`,
    { name, ...grid },
    { name: 'sampled', cpuSlowdown: Number(args.slowdown) },
    (part, samples, main) => {
        // Opens in the browser's Performance panel, which reads the source maps itself.
        writeFileSync(
            join(args.out, 'profiles', `${name}-${part}.cpuprofile`),
            JSON.stringify(samples)
        )
        parts.push({ part, main, ...summary(samples) })
    }
)
server.close()

const lines = parts.flatMap(({ part, main, busyMs, places, functions }) => [
    `## ${part}`,
    '',
    `The browser counted ${Math.round(main.task)} ms of main thread work: ${Math.round(main.script)} ms running script, ${Math.round(main.layout)} ms on style and layout, ${Math.round(main.task - main.script - main.layout)} ms on the rest (painting, parsing, its own bookkeeping).`,
    `The profiler sampled ${busyMs} ms outside idle; \`(program)\` is the browser's own code, mostly that style, layout and painting.`,
    '',
    '| Where | ms | Share |',
    '| --- | --: | --: |',
    ...places.map(
        ({ name: place, ms }) =>
            `| ${place} | ${ms} | ${Math.round((ms / busyMs) * 100)}% |`
    ),
    '',
    '| Function | ms | Share |',
    '| --- | --: | --: |',
    ...functions.map(
        ({ name: what, ms }) =>
            `| \`${what}\` | ${ms} | ${Math.round((ms / busyMs) * 100)}% |`
    ),
    '',
])
writeFileSync(
    join(args.out, `hotspots-${name}.md`),
    [
        `# Where the main thread's time goes: ${grid.columns} columns, ${grid.pageSize} rows, ${grid.rules} rules, ${grid.options} options`,
        '',
        `Sampled with the processor slowed ${args.slowdown}×. Sampling itself slows the page, so read the shares, not the times.`,
        '',
        ...lines,
    ].join('\n')
)
console.log(lines.join('\n'))
