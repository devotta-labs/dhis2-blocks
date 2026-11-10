import { cellKey } from '@/components/spreadsheet'
import type { DataRecord } from '../model/types'
import { eventFileUrl, fileUrlOf } from './fileUrl'

test("an event's file and image are read from the event's data value", () => {
    expect(eventFileUrl('https://dhis2.example.org', 'ev1', 'de1', false)).toBe(
        'https://dhis2.example.org/api/tracker/events/ev1/dataValues/de1/file'
    )
    expect(eventFileUrl('..', 'ev1', 'de1', true)).toBe(
        '../api/tracker/events/ev1/dataValues/de1/image'
    )
})

test("only an event's cells have a file address; a person's, an enrolment's and an unknown record's have none", () => {
    const records = new Map<string, DataRecord>([
        [
            'ev1',
            {
                kind: 'event',
                id: 'ev1',
                programStageId: 'st1',
                orgUnitId: 'ou1',
                status: 'ACTIVE',
            },
        ],
        [
            'te1',
            {
                kind: 'trackedEntity',
                id: 'te1',
                trackedEntityTypeId: 'tet1',
                orgUnitId: 'ou1',
            },
        ],
        [
            'en1',
            {
                kind: 'enrollment',
                id: 'en1',
                programId: 'pr1',
                trackedEntityId: 'te1',
                orgUnitId: 'ou1',
                status: 'ACTIVE',
            },
        ],
    ])
    const fileUrl = fileUrlOf('..', () => records)
    expect(fileUrl(cellKey('ev1', 'de1'), true)).toBe(
        '../api/tracker/events/ev1/dataValues/de1/image'
    )
    expect(fileUrl(cellKey('te1', 'photo'), true)).toBeUndefined()
    expect(fileUrl(cellKey('en1', 'scan'), false)).toBeUndefined()
    expect(fileUrl(cellKey('gone', 'de1'), false)).toBeUndefined()
})
