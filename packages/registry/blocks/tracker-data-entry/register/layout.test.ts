import { z } from 'zod'
import { expect, test } from 'vitest'
import { registerLayoutSchema } from './layout'
import type { LayoutNode } from './layout'

const layoutOf = (columns: LayoutNode[]) => ({
    columns,
})

test('a layout the schema refuses names the path', () => {
    const result = registerLayoutSchema.safeParse(
        // SAFETY: the point is a field the type refuses.
        layoutOf([{ field: { stage: 's' } as never }])
    )

    expect(result.success).toBe(false)
    expect(
        registerLayoutSchema.safeParse(
            layoutOf([
                {
                    field: {
                        stage: 's',
                        occurrence: 1,
                        where: { a: 'b' },
                        eventDate: true,
                    },
                },
            ])
        ).success
    ).toBe(false)
    expect(
        registerLayoutSchema.safeParse(
            layoutOf([
                {
                    group: 'G',
                    children: [
                        {
                            field: {
                                stage: 's',
                                occurrence: 2,
                                eventDate: true,
                            },
                        },
                    ],
                },
            ])
        ).success
    ).toBe(true)
})

test('a misspelt key of an event ref is refused at its path, not dropped', () => {
    for (const [field, key] of [
        [{ stage: 's', occurence: 2, eventDate: true }, 'occurence'],
        [{ stage: 's', wher: { a: 'b' }, dataElement: 'd' }, 'wher'],
    ] as const) {
        const result = registerLayoutSchema.safeParse(
            // SAFETY: the point is a key the type refuses.
            layoutOf([{ group: 'G', children: [{ field: field as never }] }])
        )

        expect(result.success).toBe(false)
        expect(result.error && z.prettifyError(result.error)).toBe(
            `✖ Unrecognized key: "${key}"\n  → at columns[0].children[0].field`
        )
    }
})

test('a layout with a key it does not know is refused', () => {
    const column = { field: { attribute: 'a' } }
    for (const layout of [
        { columns: [{ ...column, width: 'wide' }] },
        { columns: [{ ...column, occurence: 2 }] },
        { columns: [{ group: 'G', children: [column], vertical: true }] },
        { columns: [column], numbered: true },
        { columns: [{ field: { attribute: 'a', lable: 'x' } }] },
    ]) {
        expect(registerLayoutSchema.safeParse(layout).success).toBe(false)
    }
    expect(registerLayoutSchema.safeParse({ columns: [column] }).success).toBe(
        true
    )
})
