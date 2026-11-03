import { z } from 'zod'

/** Which of a stage's events: the only one, the nth by date (1-based), or the one holding these values (data element id → option code or value). */
export interface EventSlot {
    occurrence?: number
    where?: Readonly<Record<string, string>>
}

export type FieldRef =
    | { attribute: string }
    | { enrollment: 'enrolledAt' | 'occurredAt' }
    | ({ stage: string } & EventSlot &
          ({ dataElement: string } | { eventDate: true }))

export interface LayoutColumn {
    field: FieldRef
    /** The paper's heading; defaults to the field's form name. */
    label?: string
    width?: 'narrow' | 'normal' | 'wide'
    /** A rotated heading. */
    vertical?: boolean
    total?: 'count' | 'sum'
    /** Option cells show the code, as the paper's legend has it. */
    show?: 'name' | 'code'
}

export interface LayoutGroup {
    group: string
    children: LayoutNode[]
}

export type LayoutNode = LayoutGroup | LayoutColumn

/** The paper register as data: its columns and grouped headings, in the paper's order. */
export interface RegisterLayout {
    programId: string
    title?: string
    /** A heading row of column numbers 1, 2, 3… as the paper prints them. */
    numbered?: boolean
    /** What names each row on screen; defaults to the first two text attributes. */
    rowLabel?: FieldRef[]
    columns: LayoutNode[]
}

// An occurrence and a where name two different ways to pick the event.
const eventPick = {
    stage: z.string(),
    occurrence: z.int().min(1).optional(),
    where: z.record(z.string(), z.string()).optional(),
}
const onePick = ({
    occurrence,
    where,
}: {
    occurrence?: number
    where?: unknown
}) => occurrence === undefined || where === undefined
const onePickMessage = 'A slot has an occurrence or a where, not both'

const fieldRefSchema: z.ZodType<FieldRef> = z.union([
    z.object({ attribute: z.string() }),
    z.object({ enrollment: z.enum(['enrolledAt', 'occurredAt']) }),
    z
        .object({ ...eventPick, dataElement: z.string() })
        .refine(onePick, onePickMessage),
    z
        .object({ ...eventPick, eventDate: z.literal(true) })
        .refine(onePick, onePickMessage),
])

const columnSchema: z.ZodType<LayoutColumn> = z.object({
    field: fieldRefSchema,
    label: z.string().optional(),
    width: z.enum(['narrow', 'normal', 'wide']).optional(),
    vertical: z.boolean().optional(),
    total: z.enum(['count', 'sum']).optional(),
    show: z.enum(['name', 'code']).optional(),
})

const nodeSchema: z.ZodType<LayoutNode> = z.lazy(() =>
    z.union([
        z.object({ group: z.string(), children: z.array(nodeSchema) }),
        columnSchema,
    ])
)

/** Checks a stored or hand-written layout. */
export const registerLayoutSchema: z.ZodType<RegisterLayout> = z.object({
    programId: z.string(),
    title: z.string().optional(),
    numbered: z.boolean().optional(),
    rowLabel: z.array(fieldRefSchema).optional(),
    columns: z.array(nodeSchema),
})

/** A node is a group when it has children. */
export const isGroup = (node: LayoutNode): node is LayoutGroup =>
    'children' in node
