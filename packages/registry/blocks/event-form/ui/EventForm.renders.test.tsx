import { page, userEvent } from 'vitest/browser'
import {
    LONG_FORM,
    LONG_FORM_RULES,
    LONG_FORM_VARIABLES,
    longFormProgram,
} from '../test/longForm'
import { renderForm } from '../test/serve'

const renderLongForm = (blame: 'markers' | 'off') =>
    renderForm(
        {
            program: longFormProgram(),
            rules: LONG_FORM_RULES,
            variables: LONG_FORM_VARIABLES,
        },
        {
            programId: LONG_FORM.programId,
            programStageId: LONG_FORM.stageId,
            orgUnitId: LONG_FORM.orgUnitId,
            blame,
        }
    )

const box = (name: string) => page.getByRole('textbox', { name })

const inputProps = () =>
    new Map(
        [...document.querySelectorAll('form input[id]')].map((input) => [
            input.id.replace(/^.*-/, ''),
            Object.entries(input).find(([name]) =>
                name.startsWith('__reactProps$')
            )?.[1],
        ])
    )

const renderedBetween = (
    before: Map<string, unknown>,
    after: Map<string, unknown>
) =>
    new Set(
        [...after].flatMap(([id, props]) =>
            before.get(id) === props ||
            id === 'occurredAt' ||
            document.activeElement?.id.endsWith(`-${id}`)
                ? []
                : [id]
        )
    )

describe.each(['markers', 'off'] as const)('blame="%s"', (blame) => {
    test('a commit to a field no rule reads renders only that field', async () => {
        await renderLongForm(blame)
        await expect.element(box('Note f010')).not.toHaveAttribute('readonly')
        await userEvent.click(box('Note f010'))
        await userEvent.keyboard('first')
        const before = inputProps()
        await userEvent.keyboard('{Tab}')
        await expect.element(box('Reading f011')).toHaveFocus()
        expect(renderedBetween(before, inputProps())).toEqual(new Set(['f010']))
    })

    test('a commit a rule reads renders that field and the one the rule sets', async () => {
        await renderLongForm(blame)
        await expect
            .element(box('Reading f001'))
            .not.toHaveAttribute('readonly')
        await userEvent.click(box('Reading f001'))
        await userEvent.keyboard('21')
        const before = inputProps()
        await userEvent.keyboard('{Tab}')
        await expect.element(box('Reading f003')).toHaveValue('42')
        expect(renderedBetween(before, inputProps())).toEqual(
            new Set(['f001', 'f003'])
        )
    })
})
