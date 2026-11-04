import { readFileSync } from 'node:fs'
import { z } from 'zod'

/** A recorded DHIS2 response from `api/__fixtures__`. Node tests only. */
export const fixture = (name: string) =>
    z
        .json()
        .parse(
            JSON.parse(
                readFileSync(
                    new URL(`../api/__fixtures__/${name}`, import.meta.url),
                    'utf8'
                )
            )
        )

const DataElementRef = z.looseObject({ id: z.string() })

const ProgramFixture = z.object({
    programStages: z.array(
        z.looseObject({
            programStageDataElements: z.array(
                z.object({ dataElement: DataElementRef })
            ),
        })
    ),
})

const DataElementsFixture = z.object({
    dataElements: z.array(DataElementRef),
})

/**
 * The `programs/<id>` response the block requests, assembled from the two
 * recordings: each stage's data element ids become the recorded elements.
 * No recorded stage captures the legend-set and option-colour elements, so
 * the last stage captures them too.
 */
export const programMetadataResponse = () => {
    const { programStages } = ProgramFixture.parse(fixture('program.dev.json'))
    const { dataElements } = DataElementsFixture.parse(
        fixture('dataElements.dev.json')
    )
    const byId = new Map(dataElements.map((element) => [element.id, element]))
    const staged = new Set(
        programStages.flatMap((stage) =>
            stage.programStageDataElements.map(
                ({ dataElement }) => dataElement.id
            )
        )
    )
    const unstaged = dataElements.filter((element) => !staged.has(element.id))
    const last = programStages.length - 1
    return z.json().parse({
        programStages: programStages.map((stage, index) => ({
            ...stage,
            programStageDataElements: [
                ...stage.programStageDataElements.map(
                    ({ dataElement }) => byId.get(dataElement.id) ?? dataElement
                ),
                ...(index === last ? unstaged : []),
            ].map((dataElement) => ({ dataElement })),
        })),
    })
}
