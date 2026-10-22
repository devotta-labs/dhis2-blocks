import { CustomDataProvider, FetchError } from '@dhis2/app-runtime'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Result } from 'better-result'
import React, { useMemo, type ComponentProps, type ReactNode } from 'react'
import { renderHook } from 'vitest-browser-react'
import { useTimelineSources } from '../core/useTimelineSources'
import type { SourceError, SourcePage, TimelineSource } from '../core/types'
import type { ChangeGroup } from './changelog'
import v41 from './__fixtures__/v41/tracked-entity-changelog.json'
import v42 from './__fixtures__/v42/tracked-entity-changelog.json'
import v43 from './__fixtures__/v43/tracked-entity-changelog.json'
import { timelineKeys } from './timelineKeys'
import { useTrackedEntityAttributeChangelogSource } from './useTrackedEntityAttributeChangelogSource'
import { z } from 'zod'

type CustomData = ComponentProps<typeof CustomDataProvider>['data']

/** Recorded or generated rows, as the JSON the engine passes on. */
const ChangeLogsSchema = z.object({ changeLogs: z.array(z.json()) })

type RawRow = z.infer<typeof ChangeLogsSchema>['changeLogs'][number]

const subject = { trackedEntity: 'TlE2eTei001', program: 'WSGAb5XwJ3Y' }
const RESOURCE = `tracker/trackedEntities/${subject.trackedEntity}/changeLogs`

const rawRow = (
    createdAt: string,
    attribute: string,
    username = 'admin'
): RawRow => ({
    change: {
        attributeValue: {
            attribute,
            currentValue: 'new',
            previousValue: 'old',
        },
    },
    createdAt,
    createdBy: { firstName: 'John', surname: 'Traore', uid: 'u1', username },
    type: 'UPDATE',
})

const notFound = () =>
    new FetchError({
        type: 'unknown',
        message: 'An unknown error occurred - Not Found (404)',
        details: {
            httpStatus: 'Not Found',
            httpStatusCode: 404,
            status: 'ERROR',
        },
    })

/** Serves `rows` newest first, paged the way the server pages them. */
const setup = (rows: () => RawRow[] | Error) => {
    const queryClient = new QueryClient()
    const requests: Array<{
        order: string
        page: number
        pageSize: number
        program: string
    }> = []
    const data: CustomData = {
        [RESOURCE]: async (_type, query) => {
            const params = query.params ?? {}
            const page = Number(params.page)
            const pageSize = Number(params.pageSize)
            requests.push({
                order: String(params.order),
                page,
                pageSize,
                program: String(params.program),
            })
            await new Promise((resolve) => setTimeout(resolve, 5))
            const all = rows()
            if (all instanceof Error) throw all
            return {
                changeLogs: all.slice((page - 1) * pageSize, page * pageSize),
                pager: { page, pageSize },
            }
        },
    }
    const wrapper = ({ children }: { children: ReactNode }) => (
        <CustomDataProvider data={data}>
            <QueryClientProvider client={queryClient}>
                {children}
            </QueryClientProvider>
        </CustomDataProvider>
    )
    return { requests, wrapper, queryClient }
}

const render = async (
    wrapper: ReturnType<typeof setup>['wrapper'],
    pageSize?: number
) =>
    renderHook(
        () =>
            useTrackedEntityAttributeChangelogSource(
                pageSize === undefined ? subject : { ...subject, pageSize }
            ),
        { wrapper }
    )

const signal = () => new AbortController().signal

/** Every page of the source, first to last. */
const allPages = async (source: TimelineSource<ChangeGroup>) => {
    const pages: Array<SourcePage<ChangeGroup>> = []
    let cursor: unknown
    do {
        const result = await source.fetchPage(cursor, signal())
        if (Result.isError(result)) {
            throw new Error(JSON.stringify(result.error))
        }
        pages.push(result.value)
        cursor = result.value.nextCursor
    } while (cursor !== undefined && pages.length < 20)
    return pages
}

const T0 = '2026-10-22T10:00:05.000'
const T1 = '2026-10-22T10:00:04.000'
const TS = '2026-10-22T10:00:03.000'
const T3 = '2026-10-22T10:00:02.000'

describe('useTrackedEntityAttributeChangelogSource', () => {
    it('carries a save that spans a page boundary into the next page', async () => {
        const rows = [
            rawRow(T0, 'x'),
            rawRow(T1, 'y1'),
            rawRow(T1, 'y2'),
            // Save S: 2 rows end page 1, 3 more start page 2.
            rawRow(TS, 's1'),
            rawRow(TS, 's2'),
            rawRow(TS, 's3'),
            rawRow(TS, 's4'),
            rawRow(TS, 's5'),
            rawRow(T3, 'z'),
        ]
        const { wrapper } = setup(() => rows)
        const { result } = await render(wrapper, 5)

        const pages = await allPages(result.current)

        expect(result.current.key).toBe('changes')
        expect(pages).toHaveLength(2)
        expect(pages[0]?.completeUntil).toBe(T1)
        const entries = pages.flatMap((page) => page.entries)
        const ids = entries.map((entry) => entry.id)
        expect(new Set(ids).size).toBe(ids.length)
        const saves = entries.filter((e) => e.id === `changes:${TS}:admin`)
        expect(saves).toHaveLength(1)
        expect(saves[0]?.at).toBe(TS)
        expect(saves[0]?.sourceKey).toBe('changes')
        expect(saves[0]?.data.changes.map((c) => c.field.id)).toEqual([
            's1',
            's2',
            's3',
            's4',
            's5',
        ])
    })

    it('reports unsupported when the endpoint answers 404', async () => {
        const { wrapper } = setup(() => notFound())
        const { result } = await render(wrapper)

        const page = await result.current.fetchPage(undefined, signal())

        expect(Result.isError(page) && page.error).toEqual({
            kind: 'unsupported',
            message: "Changes aren't available on this DHIS2 version.",
        } satisfies SourceError)
    })

    it('reports other failures as failed', async () => {
        const { wrapper } = setup(
            () =>
                new FetchError({
                    type: 'unknown',
                    message: 'An unknown error occurred - (500)',
                    details: { httpStatusCode: 500 },
                })
        )
        const { result } = await render(wrapper)

        const page = await result.current.fetchPage(undefined, signal())

        expect(Result.isError(page) && page.error.kind).toBe('failed')
    })

    it('reads the 41 fixture rows the same as 42 and 43', async () => {
        const read = async (fixture: typeof v41 | typeof v42 | typeof v43) => {
            const { changeLogs } = ChangeLogsSchema.parse(fixture)
            const { wrapper } = setup(() => changeLogs)
            const { result } = await render(wrapper)
            const [page] = await allPages(result.current)
            // Timestamps differ per recording, and so does the order of
            // rows within one save.
            return page?.entries.map(({ data }) => ({
                user: data.user,
                changes: [...data.changes].sort((a, b) =>
                    a.field.id.localeCompare(b.field.id)
                ),
            }))
        }

        const expected = await read(v43)
        expect(expected?.map((group) => group.changes.length)).toEqual([
            1, 2, 4,
        ])
        expect(expected?.[0]?.user).toEqual({
            username: 'admin',
            displayName: 'John Traore',
        })
        expect(await read(v42)).toEqual(expected)
        expect(await read(v41)).toEqual(expected)
    })

    it('pages newest first and stops on a short page', async () => {
        const rows = [
            rawRow(T0, 'a'),
            rawRow(T1, 'b'),
            rawRow(TS, 'c'),
            rawRow(T3, 'd'),
        ]
        const { wrapper, requests } = setup(() => rows)
        const { result } = await render(wrapper, 2)

        const pages = await allPages(result.current)

        expect(requests).toEqual([
            {
                order: 'createdAt:desc',
                page: 1,
                pageSize: 2,
                program: subject.program,
            },
            {
                order: 'createdAt:desc',
                page: 2,
                pageSize: 2,
                program: subject.program,
            },
            {
                order: 'createdAt:desc',
                page: 3,
                pageSize: 2,
                program: subject.program,
            },
        ])
        expect(pages.flatMap((p) => p.entries.map((e) => e.at))).toEqual([
            T0,
            T1,
            TS,
            T3,
        ])
        expect(pages.at(-1)?.nextCursor).toBeUndefined()
    })

    it('restarts on invalidation but not on its first load', async () => {
        const { wrapper, queryClient, requests } = setup(() => [
            rawRow(T0, 'a'),
        ])
        const { result } = await render(wrapper)
        const initial = result.current.revision

        await expect.poll(() => requests.length).toBe(1)
        await result.current.fetchPage(undefined, signal())
        expect(result.current.revision).toBe(initial)
        expect(requests).toHaveLength(1)

        await queryClient.invalidateQueries({ queryKey: timelineKeys.root })

        await expect.poll(() => result.current.revision).not.toBe(initial)
    })

    it('stops requesting while the endpoint keeps failing', async () => {
        const { wrapper, requests } = setup(
            () =>
                new FetchError({
                    type: 'unknown',
                    message: 'An unknown error occurred - (500)',
                    details: { httpStatusCode: 500 },
                })
        )
        const { result } = await renderHook(
            () => {
                const source = useTrackedEntityAttributeChangelogSource(subject)
                const sources = useMemo(() => [source], [source])
                return useTimelineSources(sources)
            },
            { wrapper }
        )

        await expect.poll(() => result.current.sources[0]?.status).toBe('error')
        await new Promise((resolve) => setTimeout(resolve, 200))

        expect(result.current.sources[0]?.status).toBe('error')
        // The observer's request and the source's own attempt, no more.
        expect(requests.length).toBeLessThanOrEqual(2)
    })
})
