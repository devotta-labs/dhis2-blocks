import { execSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { cpus, totalmem } from 'node:os'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { measure, median, round } from './measure.mts'
import type { Case, Metrics } from './measure.mts'
import type { Profile } from './session.mts'
import { serve } from './serve.mts'

const PROFILES: Profile[] = [
    { name: 'desktop', cpuSlowdown: 1 },
    // A low-end phone or an old laptop on a slow mobile connection.
    {
        name: 'low-end',
        cpuSlowdown: 6,
        network: { downloadKbps: 1600, uploadKbps: 750, latencyMs: 150 },
    },
]

const BASE = { columns: 40, pageSize: 50, rules: 20, options: 10 }

type Size = typeof BASE

// The server holds two pages of events, so "Show more" loads a second page of the same size.
const grid = (axis: string, size: Size): Case & { axis: string } => ({
    axis,
    name: `${size.columns} columns, ${size.pageSize} rows, ${size.rules} rules, ${size.options} options`,
    ...size,
    rows: size.pageSize * 2,
})

/** One size changes along each axis; the rest stay as the base form has them. */
const CASES = [
    ...[10, 20, 40, 80, 160].map((columns) =>
        grid('columns', { ...BASE, columns })
    ),
    ...[10, 50, 100, 200, 500].map((pageSize) =>
        grid('rows', { ...BASE, pageSize })
    ),
    ...[0, 5, 20, 50, 100, 200].map((rules) =>
        grid('rules', { ...BASE, rules })
    ),
    ...[10, 100, 1000].map((options) => grid('options', { ...BASE, options })),
    grid('large', { columns: 120, pageSize: 200, rules: 100, options: 500 }),
]

/** The median of each number across the runs. */
const medians = (runs: Metrics[]) =>
    Object.fromEntries(
        [...(runs.at(0)?.keys() ?? [])].map((name) => [
            name,
            round(name, median(runs.map((run) => run.get(name) ?? Number.NaN))),
        ])
    )

const { values: args } = parseArgs({
    options: {
        profile: { type: 'string', default: 'desktop' },
        runs: { type: 'string', default: '3' },
        // A run whose main thread lost a larger share of its processor time than this is measured again.
        stolen: { type: 'string', default: '0.35' },
        axis: { type: 'string' },
        out: { type: 'string', default: 'results' },
        port: { type: 'string', default: '8788' },
    },
})

const profile = PROFILES.find(({ name }) => name === args.profile)
if (profile === undefined) {
    throw new Error(`No profile ${args.profile}`)
}
const port = Number(args.port)
const origin = `http://localhost:${port}`
const server = await serve(port)
const axes = args.axis?.split(',')
const cases = CASES.filter(
    ({ axis }) => axes === undefined || axes.includes(axis)
)
const results: Array<{
    axis: string
    case: Case
    runs: Array<ReturnType<typeof medians>>
    median: ReturnType<typeof medians>
    discarded: number
    failures: string[]
}> = []
mkdirSync(args.out, { recursive: true })

const wanted = Number(args.runs)

try {
    // The first run after a while reads the browser off the disk: it is not counted.
    const [first] = cases
    if (first !== undefined) {
        const { axis: _, ...warm } = first
        await measure(origin, warm, profile)
    }
    const limit = Number(args.stolen)

    for (const { axis, ...each } of cases) {
        const attempts: Array<{ metrics: Metrics; stolen: number }> = []
        const failures: string[] = []
        const quiet = () =>
            attempts.filter(({ stolen }) => stolen <= limit).length
        // Up to twice the runs asked for, until enough of them kept enough of the processor.
        while (
            quiet() < wanted &&
            attempts.length + failures.length < wanted * 2
        ) {
            const started = Date.now()
            let note = ''
            try {
                const metrics = await measure(origin, each, profile)
                const stolen = metrics.get('run.stolenShare') ?? 0
                attempts.push({ metrics, stolen })
                note = `, ${Math.round(stolen * 100)}% stolen`
            } catch (error) {
                failures.push(
                    error instanceof Error ? error.message : String(error)
                )
                note = ` (${failures.at(-1)?.split('\n')[0]})`
            }
            console.log(
                `${profile.name} · ${axis} · ${each.name} · run ${attempts.length + failures.length}: ${Math.round((Date.now() - started) / 1000)} s${note}`
            )
        }
        // The runs that lost least are the ones kept.
        const runs = attempts
            .toSorted((one, other) => one.stolen - other.stolen)
            .slice(0, wanted)
            .map(({ metrics }) => metrics)
        results.push({
            axis,
            case: each,
            runs: runs.map((run) => Object.fromEntries(run)),
            median: medians(runs),
            discarded: attempts.length - runs.length,
            failures,
        })
        writeFileSync(
            join(args.out, `${profile.name}.json`),
            JSON.stringify(
                {
                    profile,
                    machine: {
                        cpu: cpus()[0]?.model,
                        cores: cpus().length,
                        memoryGb: Math.round(totalmem() / 1024 ** 3),
                        node: process.version,
                        commit: execSync('git rev-parse --short HEAD')
                            .toString()
                            .trim(),
                    },
                    results,
                },
                undefined,
                1
            )
        )
    }
} finally {
    server.close()
}
