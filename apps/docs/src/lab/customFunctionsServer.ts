import type { CustomDataProvider } from '@dhis2/app-runtime'
import type { ComponentProps } from 'react'
import { z } from 'zod'
import { cellKey } from '@/components/data-entry/model/types'
import type {
    CellKey,
    DataEntrySource,
    GridColumn,
    LoadedForm,
} from '@/components/data-entry'
import {
    ENROLLMENT,
    LAB_STAGE,
    LOOKUP,
    PROGRAM,
    RESULT,
    STAGE,
    TEST,
    type History,
} from './customFunctions'

export interface CustomLabSettings {
    expression: string
    history: History
    network: 'normal' | 'slow' | 'error' | 'hang'
}

interface RequestEntry {
    id: number
    resource: string
    start: number
    duration?: number
    status: 'pending' | 'ok' | 'error'
}

const COLUMNS: GridColumn[] = [
    { id: TEST, label: 'Selected test', field: { valueType: 'TEXT' } },
    { id: LOOKUP, label: 'Custom result', field: { valueType: 'TEXT' } },
]

/** In-memory DHIS2 shapes; no credentials, external server, or script evaluation. */
export const createCustomLabServer = (settings: CustomLabSettings) => {
    let entries: RequestEntry[] = []
    const listeners = new Set<() => void>()
    const publish = () => listeners.forEach((listener) => listener())
    const requests = {
        getSnapshot: () => entries,
        subscribe: (listener: () => void) => {
            listeners.add(listener)
            return () => listeners.delete(listener)
        },
    }
    const answer =
        (resource: string, body: z.infer<ReturnType<typeof z.json>>) =>
        async () => {
            const entry: RequestEntry = {
                id: entries.length,
                resource,
                start: performance.now(),
                status: 'pending',
            }
            entries = [...entries, entry]
            publish()
            if (resource === 'tracker/trackedEntities') {
                if (settings.network === 'hang')
                    return new Promise<never>(() => {})
                if (settings.network === 'slow')
                    await new Promise((resolve) => setTimeout(resolve, 1500))
                if (settings.network === 'error') {
                    entries = entries.map((item) =>
                        item.id === entry.id
                            ? {
                                  ...item,
                                  duration: performance.now() - item.start,
                                  status: 'error',
                              }
                            : item
                    )
                    publish()
                    throw new Error('Simulated tracked-entity history failure')
                }
            }
            entries = entries.map((item) =>
                item.id === entry.id
                    ? {
                          ...item,
                          duration: performance.now() - item.start,
                          status: 'ok',
                      }
                    : item
            )
            publish()
            return z.json().parse(JSON.parse(JSON.stringify(body)))
        }
    const current = {
        event: 'currentRow1',
        programStage: STAGE,
        status: 'ACTIVE',
        occurredAt: '2026-04-01',
        orgUnit: 'orgUnit0001',
        dataValues: [{ dataElement: TEST, value: 'HB' }],
    }
    const enrollmentIds = [
        ...new Set([
            ENROLLMENT,
            ...settings.history.map((event) => event.enrollment),
        ]),
    ]
    const enrollments = enrollmentIds.map((enrollment) => ({
        enrollment,
        trackedEntity: 'trackedEnt1',
        program: PROGRAM,
        enrolledAt: '2025-01-01',
        occurredAt: '2025-01-01',
        orgUnit: 'orgUnit0001',
        status: 'ACTIVE',
        attributes: [],
        events: [
            ...(enrollment === ENROLLMENT ? [current] : []),
            ...settings.history
                .filter((event) => event.enrollment === enrollment)
                .map((event) => ({
                    event: event.event,
                    programStage: event.programStage,
                    status: 'COMPLETED',
                    occurredAt: event.occurredAt,
                    orgUnit: 'orgUnit0001',
                    dataValues: [
                        { dataElement: TEST, value: event.testCode },
                        { dataElement: RESULT, value: event.result },
                    ],
                })),
        ],
    }))
    const program = {
        id: PROGRAM,
        name: 'Custom functions clinic',
        programStages: [
            { id: STAGE, name: 'Visit' },
            { id: LAB_STAGE, name: 'Lab results' },
        ],
    }
    const rawData = {
        me: { id: 'customLab01', userRoles: [], userGroups: [] },
        'system/info': { calendar: 'iso8601', dateFormat: 'yyyy-mm-dd' },
        programs: program,
        programRules: {
            programRules: [
                {
                    id: 'customRule1',
                    name: 'Look up a result from event history',
                    condition: 'true',
                    programRuleActions: [
                        {
                            id: 'customAct01',
                            programRuleActionType: 'ASSIGN',
                            dataElement: { id: LOOKUP },
                            data: settings.expression,
                        },
                    ],
                },
            ],
        },
        programRuleVariables: {
            programRuleVariables: [
                {
                    id: 'customVar01',
                    name: 'selectedTest',
                    programRuleVariableSourceType: 'DATAELEMENT_CURRENT_EVENT',
                    dataElement: { id: TEST, valueType: 'TEXT' },
                },
                {
                    id: 'customVar02',
                    name: 'lookupResult',
                    programRuleVariableSourceType: 'DATAELEMENT_CURRENT_EVENT',
                    dataElement: { id: LOOKUP, valueType: 'TEXT' },
                },
            ],
        },
        constants: { constants: [] },
        'tracker/enrollments': {
            enrollments: enrollments.filter(
                (entry) => entry.enrollment === ENROLLMENT
            ),
        },
        'tracker/trackedEntities': {
            trackedEntity: 'trackedEnt1',
            orgUnit: 'orgUnit0001',
            attributes: [
                { attribute: 'patientName', value: 'Example patient' },
            ],
            enrollments,
        },
    }
    const data: ComponentProps<typeof CustomDataProvider>['data'] =
        Object.fromEntries(
            Object.entries(rawData).map(([resource, body]) => [
                resource,
                answer(resource, body),
            ])
        )
    const values = new Map<CellKey, string>([
        [cellKey('currentRow1', TEST), 'HB'],
    ])
    const form: LoadedForm = {
        tables: [
            {
                id: 'custom',
                title: 'Visit — change the selected test to recalculate',
                rows: [
                    {
                        id: current.event,
                        label: 'Current visit',
                        programStageId: STAGE,
                        enrollmentId: ENROLLMENT,
                        orgUnitId: current.orgUnit,
                        status: 'ACTIVE',
                    },
                ],
                columns: COLUMNS,
                headerRows: [
                    COLUMNS.map(({ id, label }) => ({ id, label, span: 1 })),
                ],
                closed: new Map(),
            },
        ],
        values,
        required: new Map(),
        strategy: new Map(),
        sections: new Map(),
        readOnlyRows: new Map(),
        canReopen: new Set(),
        readOnlyWhenCompleted: new Map(),
        mayUncomplete: false,
        rules: {
            programId: PROGRAM,
            programStageIds: [STAGE],
            tracker: true,
            enrollmentIds: [ENROLLMENT],
            hasRules: true,
        },
        closedByStage: new Map(),
        orgUnitNames: new Map(),
        fileNames: new Map(),
        hasMore: false,
    }
    const source: DataEntrySource = {
        key: `lab:custom:${JSON.stringify(settings)}`,
        load: async () => form,
        save: async (_engine, records) => {
            for (const record of records) {
                if (record.value === null) values.delete(record.key)
                else values.set(record.key, record.value)
            }
            return records.map(({ sourceKey, key }) => ({
                sourceKey,
                key,
                result: 'saved',
            }))
        },
        setStatus: async () => [],
        restoreRows: async () => [],
    }
    return { data, source, requests, rawData }
}
