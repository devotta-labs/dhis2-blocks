import type { GridTable } from '../model/types'
import { registerForm } from '../sources/__tests__/trackerRig'
import { formEffects, withRows } from './formRows'

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

test('a row with the id of one shown replaces it in place; others join at the end', () => {
    const table: GridTable = {
        id: 't1',
        title: 'Register',
        rows: [
            { id: 'en1', label: 'Amina', slots: { visit: 'minted' } },
            { id: 'en2', label: 'Musa' },
        ],
        columns: [],
        headerRows: [],
        closed: new Map(),
    }
    const restored = { id: 'en1', label: 'Amina', slots: { visit: 'typed' } }
    const added = { id: 'en3', label: 'New person' }
    const { rows } = withRows(
        registerForm([]),
        table,
        [restored, added],
        new Map()
    )
    expect(rows).toEqual([restored, table.rows[1], added])
})
