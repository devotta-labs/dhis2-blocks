import React, { Profiler } from 'react'
import { page, userEvent } from 'vitest/browser'
import { eventFormKeys } from '../../api/queries'
import { EventFormField } from '../EventFormField'
import { RMNCH, renderEventForm } from './eventFormTestSupport'

const FIELD_COUNT = 200
const SECTION_COUNT = 4

/** Lets React Query notify its observers and React commit. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 50))

const fieldId = (index: number) => `de${String(index).padStart(9, '0')}`

/** A stage of 200 text questions in 4 sections, and no program rules. */
const generatedStage = () => ({
    id: RMNCH.programId,
    displayName: 'Generated program',
    programStages: [
        {
            id: RMNCH.stageId,
            displayName: 'Generated stage',
            validationStrategy: 'ON_COMPLETE',
            programStageSections: Array.from(
                { length: SECTION_COUNT },
                (_, section) => ({
                    id: `section${section}`,
                    displayName: `Section ${section + 1}`,
                    sortOrder: section,
                    dataElements: Array.from(
                        { length: FIELD_COUNT / SECTION_COUNT },
                        (_, index) => ({
                            id: fieldId(
                                section * (FIELD_COUNT / SECTION_COUNT) + index
                            ),
                        })
                    ),
                })
            ),
            programStageDataElements: Array.from(
                { length: FIELD_COUNT },
                (_, index) => ({
                    compulsory: false,
                    sortOrder: index,
                    dataElement: {
                        id: fieldId(index),
                        displayFormName: `Question ${index + 1}`,
                        valueType: 'TEXT',
                    },
                })
            ),
        },
    ],
})

describe('render count', () => {
    it('answering one question re-renders one EventFormField', async () => {
        const renders = new Map<string, number>()
        const ids = Array.from({ length: FIELD_COUNT }, (_, index) =>
            fieldId(index)
        )
        const { queryClient } = await renderEventForm({
            stage: generatedStage,
            rules: () => ({ programRules: [] }),
            children: ids.map((id) => (
                <Profiler
                    key={id}
                    id={id}
                    onRender={() => renders.set(id, (renders.get(id) ?? 0) + 1)}
                >
                    <EventFormField id={id} />
                </Profiler>
            )),
        })
        const input = page.getByRole('textbox', {
            name: 'Question 6',
            exact: true,
        })
        await expect.element(input).toBeEnabled()
        await userEvent.type(input, 'answer')
        renders.clear()

        // Blurring commits the typed value, which re-evaluates rules and rebuilds the model.
        await userEvent.tab()
        await expect.element(input).toHaveValue('answer')
        await expect.poll(() => [...renders.keys()]).toEqual([fieldId(5)])
        await settle()
        // Focus moved to the next question, which did not re-render either.
        expect([...renders.keys()]).toEqual([fieldId(5)])

        // A metadata refetch with the same content (a new Map and new arrays) rebuilds nothing.
        renders.clear()
        const stageKey = eventFormKeys.stage(RMNCH.programId, RMNCH.stageId)
        const before = queryClient.getQueryState(stageKey)?.dataUpdatedAt
        await queryClient.refetchQueries({ queryKey: stageKey })
        await settle()
        expect(queryClient.getQueryState(stageKey)?.dataUpdatedAt).not.toBe(
            before
        )
        expect([...renders.keys()]).toEqual([])
    })
})
