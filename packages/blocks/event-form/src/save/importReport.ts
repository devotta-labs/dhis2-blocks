import { z } from 'zod'

const ErrorReportSchema = z.looseObject({
    message: z.string().default(''),
    args: z.array(z.string().catch('')).default([]),
})

const ImportReportSchema = z.looseObject({
    status: z.string().optional(),
    message: z.string().optional(),
    stats: z.looseObject({ ignored: z.number().default(0) }).optional(),
    validationReport: z
        .looseObject({ errorReports: z.array(ErrorReportSchema).default([]) })
        .optional(),
})

export type ImportReport = z.infer<typeof ImportReportSchema>

/** A response body that has been through `z.json()`. */
export type ResponseBody = z.infer<ReturnType<typeof z.json>>

/**
 * DHIS2 puts the import report at the top of a 200 response and under `response`
 * in an error body. A body with no `validationReport` at either place is not a report.
 */
export const parseImportReport = (
    body: ResponseBody | undefined
): ImportReport | undefined => {
    const direct = ImportReportSchema.safeParse(body)
    if (direct.success && direct.data.validationReport) {
        return direct.data
    }
    const nested = z
        .looseObject({ response: ImportReportSchema })
        .safeParse(body)
    return nested.success && nested.data.response.validationReport
        ? nested.data.response
        : undefined
}

/**
 * The import report of a 200 response, wherever DHIS2 put it, even when it has no
 * `validationReport`. The one with error reports wins, then the one with stats.
 */
export const parseImportResponse = (
    body: ResponseBody | undefined
): ImportReport | undefined => {
    const direct = ImportReportSchema.safeParse(body)
    const nested = z
        .looseObject({ response: ImportReportSchema })
        .safeParse(body)
    const candidates = [
        direct.success ? direct.data : undefined,
        nested.success ? nested.data.response : undefined,
    ]
    return (
        candidates.find((report) => report?.validationReport) ??
        candidates.find((report) => report?.stats) ??
        candidates.find((report) => report?.status)
    )
}

export interface MappedImportReport {
    fieldErrors: Record<string, string>
    formErrors: string[]
}

const UID_TOKEN = /(?<![A-Za-z0-9])[A-Za-z][A-Za-z0-9]{10}(?![A-Za-z0-9])/g

const dataElementIn = (
    text: string,
    dataElementIds: ReadonlySet<string>
): string | undefined =>
    text.match(UID_TOKEN)?.find((token) => dataElementIds.has(token))

/**
 * An error report names its data element in `args` or in `message`; `args` wins as it is
 * the structured one. A report that names no known data element is a form error.
 */
export const mapImportReport = (
    report: ImportReport,
    dataElementIds: ReadonlySet<string>
): MappedImportReport => {
    const fieldErrors: Record<string, string> = {}
    const formErrors: string[] = []
    for (const { message, args } of report.validationReport?.errorReports ??
        []) {
        const dataElementId =
            args
                .map((arg) => dataElementIn(arg, dataElementIds))
                .find((id) => id !== undefined) ??
            dataElementIn(message, dataElementIds)
        if (dataElementId === undefined) {
            formErrors.push(message)
        } else {
            const previous = fieldErrors[dataElementId]
            fieldErrors[dataElementId] =
                previous === undefined ? message : `${previous}; ${message}`
        }
    }
    return { fieldErrors, formErrors }
}
