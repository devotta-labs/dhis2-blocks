import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Case } from './measure.mts'
import type { Profile } from './session.mts'

type Results = {
    profile: Profile
    machine: Record<string, string | number>
    results: Array<{
        axis: string
        case: Case
        // JSON has no NaN: a number that could not be measured is null.
        median: { [name: string]: number | null }
        runs: unknown[]
        failures: string[]
    }>
}

const AXES: Array<[axis: string, title: string, size: (grid: Case) => string]> =
    [
        ['columns', 'Columns (data elements)', ({ columns }) => `${columns}`],
        ['rows', 'Rows on a page', ({ pageSize }) => `${pageSize}`],
        ['rules', 'Program rules', ({ rules }) => `${rules}`],
        [
            'options',
            'Options in each option set',
            ({ options }) => `${options}`,
        ],
        ['large', 'A large form', ({ name }) => name],
    ]

type Column = [title: string, path: string, digits?: number]

const LOAD: Column[] = [
    ['First paint', 'load.firstPaintMs'],
    ['Grid ready', 'load.gridReadyMs'],
    ['Rules shown', 'load.rulesVisibleMs'],
    ['Idle', 'load.settledMs'],
    ['Blocked', 'load.blockedMs'],
    ['Longest task', 'load.longestTaskMs'],
    ['Main thread', 'load.taskMs'],
    ['Script', 'load.scriptMs'],
    ['Layout', 'load.layoutMs'],
    ['API kB', 'load.apiKb'],
    ['API requests', 'load.apiRequests'],
    ['Stolen %', 'load.stolenShare', -2],
]

const MEMORY: Column[] = [
    ['JS heap MB', 'memoryLoaded.heapMb', 1],
    ['Renderer RSS MB', 'memoryLoaded.rssMb'],
    ['Renderer PSS MB', 'memoryLoaded.pssMb'],
    ['DOM nodes', 'memoryLoaded.domNodes'],
    ['Listeners', 'memoryLoaded.listeners'],
    ['Heap after use MB', 'memoryUsed.heapMb', 1],
    ['RSS after use MB', 'memoryUsed.rssMb'],
    ['DOM nodes after use', 'memoryUsed.domNodes'],
]

const USE: Column[] = [
    ['Select cell', 'edit.selectMs'],
    ['Key', 'edit.keyMs'],
    ['Enter', 'edit.commitMs'],
    ['Rules run', 'edit.rulesMs', 1],
    ['Rules shown', 'edit.rulesShownMs'],
    ['Edit main thread', 'edit.taskMs'],
    ['Arrow down', 'navigate.downMs'],
    ['Arrow down worst', 'navigate.downWorstMs'],
    ['Open options', 'option.openMs'],
    ['Paste 10×10', 'paste.paintMs'],
    ['Paste rules shown', 'paste.rulesShownMs'],
    ['Add row', 'addRow.paintMs'],
    ['Show more', 'showMore.drawnMs'],
    ['Scroll frame', 'scrollDown.frameMs', 1],
    ['Slow frames %', 'scrollDown.slowShare', -2],
]

const shown = (value: number, digits = 0) => {
    if (!Number.isFinite(value)) {
        return '–'
    }
    // Shares are shown as percentages.
    return digits === -2
        ? `${Math.round(value * 100)}`
        : value.toLocaleString('en', {
              minimumFractionDigits: digits,
              maximumFractionDigits: digits,
          })
}

const table = (
    { results }: Results,
    axis: string,
    size: (grid: Case) => string,
    columns: Column[]
) => {
    const rows = results.filter((result) => result.axis === axis)
    return [
        `| Size | ${columns.map(([title]) => title).join(' | ')} |`,
        `| --- | ${columns.map(() => '--:').join(' | ')} |`,
        ...rows.map(
            (result) =>
                `| ${size(result.case)} | ${columns.map(([, path, digits]) => shown(result.median[path] ?? Number.NaN, digits)).join(' | ')} |`
        ),
    ].join('\n')
}

const REPEATED: Column[] = [
    ['Grid ready', 'load.gridReadyMs'],
    ['Rules shown', 'load.rulesVisibleMs'],
    ['Main thread', 'load.taskMs'],
    ['Renderer RSS MB', 'memoryLoaded.rssMb'],
    ['Enter', 'edit.commitMs'],
    ['Edit rules shown', 'edit.rulesShownMs'],
    ['Paste 10×10', 'paste.paintMs'],
    ['Add row', 'addRow.paintMs'],
    ['Show more', 'showMore.drawnMs'],
    ['Scroll frame', 'scrollDown.frameMs', 1],
    ['Stolen %', 'run.stolenShare', -2],
]

/** The base form is measured once on every axis: how far those medians lie apart is how far to trust any one. */
const spread = ({ profile, results }: Results) => {
    const same = results.filter(
        ({ axis, case: grid }) =>
            axis !== 'large' &&
            grid.columns === 40 &&
            grid.pageSize === 50 &&
            grid.rules === 20 &&
            grid.options === 10
    )
    if (same.length === 0) {
        return `| ${profile.name} | ${REPEATED.map(() => '–').join(' | ')} |`
    }
    return `| ${profile.name} (${same.length} times) | ${REPEATED.map(
        ([, path, digits]) => {
            const medians = same.map(({ median }) => median[path] ?? Number.NaN)
            return `${shown(Math.min(...medians), digits)}–${shown(Math.max(...medians), digits)}`
        }
    ).join(' | ')} |`
}

const failed = ({ profile, results }: Results) =>
    results
        .filter(({ failures }) => failures.length > 0)
        .map(
            ({ case: grid, failures, runs }) =>
                `- ${profile.name}, ${grid.name}: ${failures.length} of ${failures.length + runs.length} runs failed (${failures[0]?.split('\n')[0]})`
        )

const [directory = 'results', out = 'BASELINE.md'] = process.argv.slice(2)
const profiles = ['desktop', 'low-end'].map(
    // SAFETY: written by run.mts in this shape.
    (name) =>
        JSON.parse(
            readFileSync(join(directory, `${name}.json`), 'utf8')
        ) as Results
)
const [{ machine }] = profiles

const describe = ({ name, cpuSlowdown, network }: Profile) =>
    `**${name}**: processor slowed ${cpuSlowdown}×, ${
        network === undefined
            ? 'no network limit'
            : `${network.downloadKbps} kbit/s down, ${network.uploadKbps} kbit/s up, ${network.latencyMs} ms added to each request`
    }`

writeFileSync(
    out,
    `${[
        '# Tracker data entry grid: performance baseline',
        '',
        'Written by `pnpm --filter @dhis2-blocks/perf report`; see the README beside this file for what each number is.',
        'Every number is the median of the runs, and times are in milliseconds.',
        'The times leave out the processor time the hypervisor stole from the page; "Stolen %" is the share that was.',
        '',
        `Measured at \`${machine.commit}\` on ${machine.cpu} (${machine.cores} cores, ${machine.memoryGb} GB), ${profiles[0].results[0]?.runs.length} runs each.`,
        '',
        ...profiles.map(({ profile }) => `- ${describe(profile)}`),
        '',
        ...profiles.flatMap(failed),
        '',
        '## How far the numbers repeat',
        '',
        'The base form (40 columns, 50 rows, 20 rules, 10 options) is measured again on every axis. The lowest and highest of those medians:',
        '',
        `| Profile | ${REPEATED.map(([title]) => title).join(' | ')} |`,
        `| --- | ${REPEATED.map(() => '--:').join(' | ')} |`,
        ...profiles.map(spread),
        '',
        'A difference smaller than that spread is not a difference.',
        '',
        ...AXES.flatMap(([axis, title, size]) => [
            `## ${title}`,
            '',
            ...profiles.flatMap((results) => [
                `### ${results.profile.name}: loading`,
                '',
                table(results, axis, size, LOAD),
                '',
                `### ${results.profile.name}: memory`,
                '',
                table(results, axis, size, MEMORY),
                '',
                `### ${results.profile.name}: entering data`,
                '',
                table(results, axis, size, USE),
                '',
            ]),
        ]),
    ].join('\n')}`
)
