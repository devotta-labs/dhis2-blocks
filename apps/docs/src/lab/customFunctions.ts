import { z } from 'zod'
import { defineCustomRuleFunction } from '@/components/program-rules'
import type {
    RuleEventInput,
    TrackedEntityRuleContext,
} from '@/components/program-rules'

export const PROGRAM = 'customProg1'
export const STAGE = 'visitStage1'
export const LAB_STAGE = 'labStage001'
export const TEST = 'testCode001'
export const RESULT = 'labValue001'
export const LOOKUP = 'lookupVal01'
export const ENROLLMENT = 'enrollment1'

export const LookupProps = z
    .object({
        testCode: z.string(),
        matchDataElement: z.string().default(TEST),
        resultDataElement: z.string().default(RESULT),
        stageId: z.string().optional(),
    })
    .strict()

const findEvent = (
    props: z.output<typeof LookupProps>,
    context: TrackedEntityRuleContext
): RuleEventInput | undefined =>
    context.events
        .filter(
            (event) =>
                event.id !== context.currentEvent.id &&
                (props.stageId === undefined ||
                    event.programStageId === props.stageId) &&
                event.dataValues[props.matchDataElement] === props.testCode
        )
        .sort(
            (a, b) =>
                (b.occurredAt ?? '').localeCompare(a.occurredAt ?? '') ||
                b.id.localeCompare(a.id)
        )[0]

/** Newest matching event; a missing result on that event does not fall back to an older event. */
export const CUSTOM_FUNCTIONS = {
    findResult: defineCustomRuleFunction({
        props: LookupProps,
        returns: 'number',
        evaluate: (props, context) => {
            const raw = findEvent(props, context)?.dataValues[
                props.resultDataElement
            ]
            if (raw === undefined || raw.trim() === '') return null
            const number = Number(raw)
            return Number.isFinite(number) ? number : null
        },
    }),
    findText: defineCustomRuleFunction({
        props: LookupProps,
        returns: 'string',
        evaluate: (props, context) =>
            findEvent(props, context)?.dataValues[props.resultDataElement] ??
            null,
    }),
    hasResult: defineCustomRuleFunction({
        props: LookupProps,
        returns: 'boolean',
        evaluate: (props, context) => {
            const value = findEvent(props, context)?.dataValues[
                props.resultDataElement
            ]
            return value !== undefined && value.trim() !== ''
        },
    }),
}

export const DEFAULT_EXPRESSION = `custom:number('findResult', {
  testCode: #{selectedTest},
  stageId: '${LAB_STAGE}',
  resultDataElement: '${RESULT}'
})`

export const HistorySchema = z
    .array(
        z.object({
            event: z.string().min(1),
            enrollment: z.string().min(1),
            programStage: z.string().min(1),
            occurredAt: z.iso.date(),
            testCode: z.string(),
            result: z.string(),
        })
    )
    .superRefine((events, context) => {
        if (
            new Set(events.map((event) => event.event)).size !== events.length
        ) {
            context.addIssue({
                code: 'custom',
                message: 'Event IDs must be unique',
            })
        }
    })

export type History = z.infer<typeof HistorySchema>
export const HISTORY: History = [
    {
        event: 'labEvent001',
        enrollment: ENROLLMENT,
        programStage: LAB_STAGE,
        occurredAt: '2026-01-05',
        testCode: 'HB',
        result: '11.2',
    },
    {
        event: 'labEvent002',
        enrollment: ENROLLMENT,
        programStage: LAB_STAGE,
        occurredAt: '2026-03-12',
        testCode: 'HB',
        result: '13.4',
    },
    {
        event: 'labEvent003',
        enrollment: 'enrollment2',
        programStage: LAB_STAGE,
        occurredAt: '2026-02-20',
        testCode: 'GLUCOSE',
        result: '6.1',
    },
]
