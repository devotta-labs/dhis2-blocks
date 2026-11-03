import { formOf } from './types'
import type { EventRecord } from './types'

test('an event’s form is its stage', () => {
    const record: EventRecord = {
        kind: 'event',
        id: 'event1',
        programStageId: 'stage1',
        orgUnitId: 'orgUnit1',
        status: 'ACTIVE',
    }
    expect(formOf(record)).toBe('stage1')
})
