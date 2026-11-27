import i18n from '@dhis2/d2-i18n'
import { z } from 'zod'

/** What a tracker import answers: the refused objects, with what refused them. */
export const importReportSchema = z.object({
    status: z.string(),
    validationReport: z.object({
        errorReports: z.array(
            z.object({
                errorCode: z.string(),
                message: z.string(),
                trackerType: z.string().optional(),
                uid: z.string().optional(),
                args: z.array(z.string()).optional(),
            })
        ),
    }),
})

export type ImportReport = z.infer<typeof importReportSchema>

/** The import report at the top of a body, else under `response`, where some DHIS2 versions put it. */
export const reportIn = (body: z.infer<ReturnType<typeof z.json>>) => {
    const direct = importReportSchema.safeParse(body)
    if (direct.success) {
        return direct.data satisfies ImportReport | undefined
    }
    const nested = z.object({ response: importReportSchema }).safeParse(body)
    return (nested.success ? nested.data.response : undefined) satisfies
        | ImportReport
        | undefined
}

interface PlacedReport {
    fieldErrors: ReadonlyMap<string, readonly string[]>
    formErrors: readonly string[]
}

const ID_TOKEN = /(?<![A-Za-z0-9])[A-Za-z][A-Za-z0-9]{10}(?![A-Za-z0-9])/g

/** An id or name that is not a field's but stands for one, with its own name: a category option stands for its category. */
export interface Stand {
    fieldId: string
    name: string
}

const fieldIn = (
    text: string,
    fields: ReadonlyMap<string, string>,
    stands: ReadonlyMap<string, Stand>
) =>
    stands.get(text)?.fieldId ??
    text
        .match(ID_TOKEN)
        ?.map((token) =>
            fields.has(token) ? token : stands.get(token)?.fieldId
        )
        .find((fieldId) => fieldId !== undefined)

const GEOMETRY_ERROR = /\bgeometry\b/i

const QUOTES_VALUE = new Set(['E1302', 'E1125'])

const holding = (
    message: string,
    fields: ReadonlyMap<string, string>,
    sent: Readonly<Record<string, string>>
) => {
    const held = [...fields.keys()].filter(
        (fieldId) =>
            sent[fieldId] !== undefined &&
            message.includes(`\`${sent[fieldId]}\``)
    )
    return held.length === 1 ? held[0] : undefined
}

type ErrorReport = ImportReport['validationReport']['errorReports'][number]

const AS_IS = { nsSeparator: '::', interpolation: { escapeValue: false } }

const argObject = z.object({ uid: z.string(), name: z.string() })
const argName = (arg: string) => {
    try {
        return argObject.parse(JSON.parse(arg))
    } catch {
        return undefined
    }
}

const plainly = (
    { errorCode, message, args = [] }: ErrorReport,
    known: ReadonlyMap<string, string | undefined>
) => {
    const [first = '', second = ''] = [...message.matchAll(/`([^`]*)`/g)].map(
        ([, id]) => id
    )
    const named = new Map(
        args.flatMap((arg) => {
            const object = argName(arg)
            return object === undefined ? [] : [[object.uid, object.name]]
        })
    )
    const name = (id: string) => known.get(id) ?? named.get(id)
    let sentence: string | undefined
    if (errorCode === 'E1091' && name(second) !== undefined) {
        sentence = i18n.t(
            'You do not have access to enter data for {{program}}.',
            { ...AS_IS, program: name(second) }
        )
    } else if (
        errorCode === 'E1029' &&
        name(first) !== undefined &&
        name(second) !== undefined
    ) {
        sentence = i18n.t('{{orgUnit}} is not set up for {{program}}.', {
            ...AS_IS,
            orgUnit: name(first),
            program: name(second),
        })
    } else if (errorCode === 'E1000' && name(second) !== undefined) {
        sentence = i18n.t(
            'You do not have access to enter data at {{orgUnit}}.',
            { ...AS_IS, orgUnit: name(second) }
        )
    }
    return sentence === undefined
        ? message
        : i18n.t('{{sentence}} ({{code}})', {
              ...AS_IS,
              sentence,
              code: errorCode,
          })
}

/**
 * Each error on the field it names, in `args` first, else in `message`, with the field's id in it read as its label; a
 * report's `uid` is the event's, never a field's. An error about the geometry is on `geometryField` when the form shows
 * one. An error about a refused value that names no field is on the one field whose value in `sent` it quotes. Errors
 * that name none of `fields` (id → label) or `stands` are the form's; E1091, E1029 and E1000 among them are said in
 * plain words with the names in `known` (id → name: the program's, the org unit's).
 */
export const placeReport = (
    report: ImportReport,
    fields: ReadonlyMap<string, string>,
    stands: ReadonlyMap<string, Stand> = new Map(),
    geometryField?: string,
    sent: Readonly<Record<string, string>> = {},
    known: ReadonlyMap<string, string | undefined> = new Map()
) => {
    const fieldErrors = new Map<string, string[]>()
    const formErrors: string[] = []
    for (const error of report.validationReport.errorReports) {
        const { errorCode, message, args = [] } = error
        const geometry =
            geometryField !== undefined &&
            (errorCode === 'E1012' || GEOMETRY_ERROR.test(message))
                ? geometryField
                : undefined
        const named =
            geometry ??
            args
                .map((arg) => fieldIn(arg, fields, stands))
                .find((id) => id !== undefined) ??
            fieldIn(message, fields, stands)
        const quoted =
            named === undefined && QUOTES_VALUE.has(errorCode)
                ? holding(message, fields, sent)
                : undefined
        const fieldId = named ?? quoted
        if (fieldId === undefined) {
            formErrors.push(plainly(error, known))
        } else {
            const text =
                quoted === undefined
                    ? message
                    : message.replace(
                          `DataElement \`${args[0] ?? ''}\``,
                          `DataElement \`${fieldId}\``
                      )
            fieldErrors.set(fieldId, [
                ...(fieldErrors.get(fieldId) ?? []),
                text.replace(ID_TOKEN, (token) =>
                    token === fieldId
                        ? (fields.get(fieldId) ?? token)
                        : (stands.get(token)?.name ?? token)
                ),
            ])
        }
    }
    return { fieldErrors, formErrors } satisfies PlacedReport
}
