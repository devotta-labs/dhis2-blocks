import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { ContextSelectorBar } from '../ContextSelectorBar'

describe('ContextSelectorBar', () => {
    it('renders compact labelled selector items without a page heading', () => {
        const actEnvironment = globalThis as typeof globalThis & {
            IS_REACT_ACT_ENVIRONMENT?: boolean
        }
        const originalActEnvironment = actEnvironment.IS_REACT_ACT_ENVIRONMENT
        actEnvironment.IS_REACT_ACT_ENVIRONMENT = true
        const container = document.createElement('div')
        document.body.appendChild(container)
        const root = createRoot(container)
        const onOpenOrgUnit = jest.fn()

        try {
            act(() => {
                root.render(
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
            })

            const navigation = container.querySelector<HTMLElement>(
                'nav[aria-label="Working list context"]'
            )
            const program = container.querySelector<HTMLButtonElement>(
                '[data-test="program-selector"]'
            )
            const organisationUnit = container.querySelector<HTMLButtonElement>(
                '[data-test="org-unit-selector"]'
            )

            expect(navigation).not.toBeNull()
            expect(
                navigation
                    ?.querySelector('[role="toolbar"]')
                    ?.getAttribute('aria-label')
            ).toBe('Working list context')
            expect(navigation?.querySelector('h1')).toBeNull()
            expect(navigation?.querySelector('label')).toBeNull()
            expect(container.querySelector('h1')?.className).toBe(
                'visually-hidden'
            )
            expect(container.querySelector('h1')?.textContent).toBe(
                'Working lists'
            )
            expect(program?.textContent).toContain('Program')
            expect(program?.textContent).toContain('Child Programme')
            expect(organisationUnit?.textContent).toContain('Organisation unit')
            expect(organisationUnit?.textContent).toContain('Ngelehun CHC')

            act(() => organisationUnit?.click())
            expect(onOpenOrgUnit).toHaveBeenCalledTimes(1)
        } finally {
            act(() => root.unmount())
            container.remove()
            actEnvironment.IS_REACT_ACT_ENVIRONMENT = originalActEnvironment
        }
    })
})
