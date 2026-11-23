import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import type { Browser, CDPSession, Page } from '@playwright/test'
import { z } from 'zod'
import { OUTPUT } from './event-form-performance.support'

interface CpuProfile {
    nodes: Array<{
        id: number
        callFrame: {
            functionName: string
            url: string
            lineNumber: number
            columnNumber: number
        }
    }>
    samples?: number[]
    timeDeltas?: number[]
}

const CHUNKS: ReadonlyArray<readonly [RegExp, string]> = [
    [/rule-engine-/, 'rule engine'],
    [/useProgramRuleContext-/, 'program-rules glue'],
    [/EventForm-/, 'event-form block'],
    [/ValueInput-|formatDhis2Value-|calendar-/, 'value input/types'],
    [/index-/, 'React + shared UI'],
]

const round = (ms: number, count: number) =>
    Math.round((ms / count) * 100) / 100

const summariseProfile = (profile: CpuProfile, count: number) => {
    const byId = new Map(profile.nodes.map((node) => [node.id, node]))
    const self = new Map<number, number>()
    const deltas = profile.timeDeltas ?? []
    for (const [at, id] of (profile.samples ?? []).entries()) {
        self.set(id, (self.get(id) ?? 0) + (deltas[at + 1] ?? 0) / 1000)
    }
    const byChunk = new Map<string, number>()
    const byFunction = new Map<string, number>()
    for (const [id, ms] of self) {
        const frame = byId.get(id)?.callFrame
        if (frame === undefined || frame.functionName === '(idle)') {
            continue
        }
        const chunk = frame.functionName.startsWith('(')
            ? frame.functionName
            : (CHUNKS.find(([pattern]) => pattern.test(frame.url))?.[1] ??
              (frame.url === '' ? 'native + harness' : 'other chunks'))
        byChunk.set(chunk, (byChunk.get(chunk) ?? 0) + ms)
        if (frame.url !== '') {
            const key = `${frame.functionName || '(anonymous)'} ${frame.url.replace(/^.*\//, '')}:${frame.lineNumber + 1}:${frame.columnNumber + 1}`
            byFunction.set(key, (byFunction.get(key) ?? 0) + ms)
        }
    }
    const ranked = (map: Map<string, number>, top: number) =>
        [...map]
            .sort((a, b) => b[1] - a[1])
            .slice(0, top)
            .map(([key, ms]) => [key, round(ms, count)] as const)
    return { perInput: ranked(byChunk, 12), topSelf: ranked(byFunction, 15) }
}

const traceSchema = z.object({
    traceEvents: z.array(
        z.looseObject({
            name: z.string(),
            ph: z.string().optional(),
            pid: z.number().optional(),
            tid: z.number().optional(),
            dur: z.number().optional(),
            args: z.looseObject({ name: z.string().optional() }).optional(),
        })
    ),
})

const TRACED = new Set([
    'RunTask',
    'UpdateLayoutTree',
    'Layout',
    'PrePaint',
    'Paint',
    'Layerize',
    'Commit',
])

const summariseTrace = (buffer: Buffer, count: number) => {
    const { traceEvents } = traceSchema.parse(JSON.parse(buffer.toString()))
    const mains = traceEvents.filter(
        (e) => e.name === 'thread_name' && e.args?.name === 'CrRendererMain'
    )
    const layouts = (pid?: number, tid?: number) =>
        traceEvents.filter(
            (e) => e.pid === pid && e.tid === tid && e.name === 'Layout'
        ).length
    const main = mains.sort(
        (a, b) => layouts(b.pid, b.tid) - layouts(a.pid, a.tid)
    )[0]
    const sums = new Map<string, number>()
    for (const e of traceEvents) {
        if (
            e.ph === 'X' &&
            e.pid === main?.pid &&
            e.tid === main?.tid &&
            TRACED.has(e.name)
        ) {
            sums.set(e.name, (sums.get(e.name) ?? 0) + (e.dur ?? 0) / 1000)
        }
    }
    return [...sums].map(([name, ms]) => [name, round(ms, count)] as const)
}

/** Profiles `act`, which runs `count` inputs, with a CPU profile and a trace; saves the profile for source maps. */
export const profiled = async (
    page: Page,
    browser: Browser,
    cdp: CDPSession,
    name: string,
    count: number,
    act: () => Promise<void>
) => {
    await cdp.send('Profiler.enable')
    await cdp.send('Profiler.setSamplingInterval', { interval: 100 })
    await browser.startTracing(page, { categories: ['devtools.timeline'] })
    await cdp.send('Profiler.start')
    await act()
    const { profile } = await cdp.send('Profiler.stop')
    const trace = await browser.stopTracing()
    writeFileSync(
        OUTPUT.replace(/\.json$/, `.${name}.cpuprofile`),
        JSON.stringify(profile)
    )
    return {
        cpu: summariseProfile(profile, count),
        trace: summariseTrace(trace, count),
    }
}

/** The gzipped weight of the event form's chunks beyond what the docs shell loads, and of the rule engine. */
export const bundle = (dist: string) => {
    const dir = `${dist}/assets`
    const files = readdirSync(dir).filter((file) => file.endsWith('.js'))
    const text = (file: string) => readFileSync(`${dir}/${file}`, 'utf8')
    const gz = (file: string) => gzipSync(readFileSync(`${dir}/${file}`)).length
    const closure = (start: string) => {
        const found = new Set<string>()
        const visit = (file: string) => {
            if (found.has(file)) {
                return
            }
            found.add(file)
            for (const [, imported] of text(file).matchAll(
                /(?:^|[;}])\s*import\s*(?:[\w{},\s*$]+from\s*)?"\.\/([^"]+\.js)"/g
            )) {
                if (imported !== undefined) visit(imported)
            }
        }
        visit(start)
        return found
    }
    const named = (prefix: string) =>
        files.find((file) => file.startsWith(prefix)) ?? ''
    const entry =
        /src="\/assets\/([^"]+\.js)"/.exec(
            readFileSync(`${dist}/index.html`, 'utf8')
        )?.[1] ?? ''
    const shell = closure(entry)
    const beyond = (start: string) =>
        [...closure(start)].filter((file) => !shell.has(file))
    const kb = (bytes: number) => Math.round(bytes / 102.4) / 10
    const sum = (list: readonly string[]) =>
        kb(list.reduce((total, file) => total + gz(file), 0))
    const block = beyond(named('EventForm-'))
    return {
        shellKb: kb([...shell].reduce((total, file) => total + gz(file), 0)),
        ownChunkKb: kb(gz(named('EventForm-'))),
        blockKb: sum(block),
        labOnlyKb:
            Math.round(
                (sum(beyond(named('EventFormLab-'))) - sum(block)) * 10
            ) / 10,
        ruleEngineKb: kb(gz(named('rule-engine-'))),
        blockChunks: block.map((file) => `${file}: ${kb(gz(file))} KB`),
    }
}
