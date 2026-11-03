import type { GridTable } from '../model/types'
import { formEffects } from './formRows'

test('the event date is an event’s field, not a person’s or an enrolment’s', () => {
    const table: GridTable = {
        id: 't1',
        title: 'Register',
        rows: [{ id: 'p', label: 'Amina' }],
        columns: [],
        headerRows: [],
        closed: new Map(),
    }
    const cells = formEffects(
        {
            required: new Map(),
            fieldsByForm: new Map([['tet', new Set(['a'])]]),
        },
        new Map([['p', 'Not yours']]),
        [table],
        new Map([
            [
                'p',
                {
                    kind: 'trackedEntity',
                    id: 'p',
                    trackedEntityTypeId: 'tet',
                    orgUnitId: 'ou',
                },
            ],
        ])
    )
    expect(cells).toEqual({
        'p.a': { readOnly: 'Not yours', required: false, messages: [] },
    })
})
