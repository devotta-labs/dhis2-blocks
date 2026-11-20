import {
    generateLabData,
    isInScope,
    type LabData,
    type LabSettings,
    type LabUnit,
} from './labData'

/** One request as the block sends it through app-runtime. */
export interface LabRequest {
    resource: string
    params?: Record<string, string | number | boolean>
}

/** Every resource the block asks for. */
export const RESOURCES = ['me', 'organisationUnits']

const orgUnitJson = ({ id, displayName, displayShortName, path }: LabUnit) => ({
    id,
    displayName,
    displayShortName,
    path,
})

const serverError = () =>
    Object.assign(new Error('Internal server error'), {
        details: { httpStatusCode: 500, message: 'Internal server error' },
    })

const byName = (a: LabUnit, b: LabUnit) =>
    a.displayName.localeCompare(b.displayName)

/** What the lab's DHIS2 answers; how slowly, or whether at all, is the lab network's call. */
export const answer =
    (settings: LabSettings, data: LabData = generateLabData(settings)) =>
    (request: LabRequest) => {
        const params = request.params ?? {}
        switch (request.resource) {
            case 'me':
                return {
                    id: data.userId,
                    organisationUnits: data.assigned.map((unit) => ({
                        ...orgUnitJson(unit),
                        children: unit.hasChildren,
                    })),
                }
            case 'organisationUnits': {
                if (params.filter !== undefined) {
                    if (settings.failValidity) throw serverError()
                    const ids =
                        /^id:in:\[(.*)\]$/
                            .exec(String(params.filter))?.[1]
                            ?.split(',') ?? []
                    return {
                        organisationUnits: data.units
                            .filter(
                                (unit) =>
                                    ids.includes(unit.id) &&
                                    isInScope(unit, data)
                            )
                            .map(orgUnitJson),
                    }
                }
                {
                    if (settings.failSearch) throw serverError()
                    const query = String(params.query ?? '').toLowerCase()
                    const pageSize = Number(params.pageSize ?? 50)
                    const page = Number(params.page ?? 1)
                    const matches = data.units
                        .filter(
                            (unit) =>
                                isInScope(unit, data) &&
                                unit.displayName.toLowerCase().includes(query)
                        )
                        .sort(byName)
                    return {
                        pager: {
                            page,
                            total: matches.length,
                            pageSize,
                            pageCount: Math.max(
                                1,
                                Math.ceil(matches.length / pageSize)
                            ),
                        },
                        organisationUnits: matches
                            .slice((page - 1) * pageSize, page * pageSize)
                            .map(orgUnitJson),
                    }
                }
            }
            default:
                throw new Error(
                    `The organisation unit switcher lab does not serve ${request.resource}`
                )
        }
    }
