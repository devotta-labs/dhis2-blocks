import React from 'react'
import { render } from 'vitest-browser-react'
import { ContextSelectorBar } from '../ContextSelectorBar'

describe('ContextSelectorBar', () => {
    it('renders compact labelled selector items without a page heading', async () => {
        const onOpenOrgUnit = vi.fn()
        const screen = await render(
            <ContextSelectorBar
                programs={[
                    {
                        id: 'Program0001',
                        displayName: 'Child Programme',
                    },
                ]}
                selectedProgram={{
                    id: 'Program0001',
                    displayName: 'Child Programme',
                }}
                selectedOrgUnitName="Ngelehun CHC"
                programsLoading={false}
                orgUnitDisabled={false}
                onClearAll={() => undefined}
                onClearOrgUnit={() => undefined}
                onOpenOrgUnit={onOpenOrgUnit}
                onProgramChange={() => undefined}
            />
        )

        await expect
            .element(
                screen.getByRole('navigation', {
                    name: 'Working list context',
                })
            )
            .toBeVisible()
        await expect
            .element(
                screen.getByRole('toolbar', { name: 'Working list context' })
            )
            .toBeVisible()
        await expect
            .element(screen.getByRole('heading', { level: 1 }))
            .toHaveTextContent('Working lists')
        await expect
            .element(
                screen.getByRole('button', {
                    name: /Program.*Child Programme/,
                })
            )
            .toBeVisible()

        const organisationUnit = screen.getByRole('button', {
            name: /Organisation unit.*Ngelehun CHC/,
        })
        await expect.element(organisationUnit).toBeVisible()
        expect(
            screen.container.querySelector(
                'nav[aria-label="Working list context"] h1'
            )
        ).toBeNull()
        expect(
            screen.container.querySelector(
                'nav[aria-label="Working list context"] label'
            )
        ).toBeNull()

        await organisationUnit.click()
        expect(onOpenOrgUnit).toHaveBeenCalledTimes(1)
    })
})
