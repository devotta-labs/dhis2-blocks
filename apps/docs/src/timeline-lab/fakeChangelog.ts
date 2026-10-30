import { FetchError, type CustomDataProvider } from '@dhis2/app-runtime'
import type { TrackerEvent } from '@/components/timeline-dhis2'
import type { ComponentProps } from 'react'
import { pad, USERS, type DataConfig } from './fakeHistory'

const notFound = () =>
    new FetchError({
        type: 'unknown',
        message: 'An unknown error occurred - Not Found (404)',
        details: { httpStatusCode: 404 },
    })

interface ValueChange {
    previousValue?: string
    currentValue?: string
}

interface Row {
    createdAt?: string
    createdBy: NonNullable<TrackerEvent['createdBy']>
    type: string
    change: {
        dataValue?: ValueChange & { dataElement: string }
        eventField?: ValueChange & { field: string }
    }
}

/** An event's changelog rows, newest first, as `tracker/events/:id/changeLogs` sends them. */
const changelogRows = (event: TrackerEvent, truncated: boolean): Row[] => {
    const by = event.createdBy ?? USERS[0]
    const editor = USERS[1]
    if (truncated) {
        return Array.from({ length: 510 }, (_, index) => ({
            createdAt: `${event.createdAt?.slice(0, 17)}${pad(index % 60)}.${String(index).padStart(3, '0')}`,
            createdBy: editor,
            type: 'UPDATE',
            change: {
                dataValue: {
                    dataElement: 'deWeight',
                    previousValue: String(3000 + index),
                    currentValue: String(3001 + index),
                },
            },
        }))
    }
    const created = event.dataValues.map(({ dataElement, value }) => ({
        createdAt: event.createdAt,
        createdBy: by,
        type: 'CREATE',
        change: { dataValue: { dataElement, currentValue: value } },
    }))
    if (event.updatedAt === event.createdAt) {
        return created
    }
    // A number edited down, and another value removed.
    const first = event.dataValues.find(
        ({ value }) => value !== '' && !Number.isNaN(Number(value))
    )
    const second = event.dataValues.find((each) => each !== first)
    const updated: Row[] = [
        {
            createdAt: event.updatedAt,
            createdBy: editor,
            type: 'UPDATE',
            change: {
                eventField: {
                    field: 'occurredAt',
                    previousValue: event.createdAt,
                    currentValue: event.occurredAt,
                },
            },
        },
    ]
    if (first) {
        updated.push({
            createdAt: event.updatedAt,
            createdBy: editor,
            type: 'UPDATE',
            change: {
                dataValue: {
                    dataElement: first.dataElement,
                    previousValue: String(Number(first.value) + 120),
                    currentValue: first.value,
                },
            },
        })
    }
    if (second) {
        updated.push({
            createdAt: event.updatedAt,
            createdBy: editor,
            type: 'DELETE',
            change: {
                dataValue: {
                    dataElement: second.dataElement,
                    previousValue: second.value,
                },
            },
        })
    }
    return [...updated, ...created]
}

type CustomData = ComponentProps<typeof CustomDataProvider>['data']

/** `CustomDataProvider` data answering each event's changelog the way `mode` says. */
export const changelogData = (
    events: ReadonlyArray<TrackerEvent>,
    mode: DataConfig['changes']
): CustomData =>
    Object.fromEntries(
        events.map((event): [string, CustomData[string]] => [
            `tracker/events/${event.event}/changeLogs`,
            async (_type, query) => {
                switch (mode) {
                    case 'loading':
                        return new Promise(() => {})
                    case 'error':
                        throw new Error('Internal server error (500)')
                    case 'unsupported':
                        throw notFound()
                    case 'none':
                        return { changeLogs: [] }
                    case 'slow':
                        await new Promise((done) => setTimeout(done, 2000))
                }
                const page = Number(query.params?.page ?? 1)
                const pageSize = Number(query.params?.pageSize ?? 100)
                const rows = changelogRows(event, mode === 'truncated')
                // Through JSON, as the server sends it: unset values drop out.
                return JSON.parse(
                    JSON.stringify({
                        changeLogs: rows.slice(
                            (page - 1) * pageSize,
                            page * pageSize
                        ),
                    })
                )
            },
        ])
    )
