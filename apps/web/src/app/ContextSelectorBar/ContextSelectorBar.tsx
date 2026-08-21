import {
    SelectorBar,
    SelectorBarItem,
    SingleSelectField,
    SingleSelectOption,
} from '@dhis2/ui'
import React, { useState } from 'react'
import i18n from '../../i18n'
import accessibilityStyles from '../../styles/accessibility.module.css'

interface ProgramOption {
    id: string
    displayName: string
}

interface ContextSelectorBarProps {
    programs: ProgramOption[]
    selectedProgram?: ProgramOption
    selectedOrgUnitName?: string
    programsLoading: boolean
    orgUnitDisabled: boolean
    onClearAll: () => void
    onClearOrgUnit: () => void
    onOpenOrgUnit: () => void
    onProgramChange: (programId: string) => void
}

export const ContextSelectorBar = ({
    programs,
    selectedProgram,
    selectedOrgUnitName,
    programsLoading,
    orgUnitDisabled,
    onClearAll,
    onClearOrgUnit,
    onOpenOrgUnit,
    onProgramChange,
}: ContextSelectorBarProps) => {
    const [programSelectorOpen, setProgramSelectorOpen] = useState(false)

    return (
        <>
            <nav
                className="context-selector-bar"
                data-testid="context-selector-bar"
                aria-label={i18n.t('Working list context')}
            >
                <SelectorBar
                    ariaLabel={i18n.t('Working list context')}
                    className="context-selector-bar__toolbar"
                    disableClearSelections={!selectedProgram}
                    onClearSelectionClick={() => {
                        setProgramSelectorOpen(false)
                        onClearAll()
                    }}
                >
                    <SelectorBarItem
                        className="context-selector-item context-selector-item--program"
                        dataTest="program-selector"
                        disabled={programsLoading}
                        label={i18n.t('Program')}
                        noValueMessage={i18n.t('Choose a tracker program')}
                        open={programSelectorOpen}
                        value={selectedProgram?.displayName}
                        setOpen={setProgramSelectorOpen}
                        onClearSelectionClick={() => {
                            setProgramSelectorOpen(false)
                            onProgramChange('')
                        }}
                    >
                        <div className="context-selector-program-popover">
                            <SingleSelectField
                                dense
                                dataTest="program-selector-input"
                                filterable
                                initialFocus
                                label={i18n.t('Program')}
                                loading={programsLoading}
                                noMatchText={i18n.t(
                                    'No programs match the search'
                                )}
                                placeholder={i18n.t('Choose a tracker program')}
                                selected={selectedProgram?.id}
                                onChange={({ selected }) => {
                                    setProgramSelectorOpen(false)
                                    onProgramChange(selected)
                                }}
                            >
                                {programs.map((program) => (
                                    <SingleSelectOption
                                        key={program.id}
                                        label={program.displayName}
                                        value={program.id}
                                    />
                                ))}
                            </SingleSelectField>
                        </div>
                    </SelectorBarItem>

                    <SelectorBarItem
                        className="context-selector-item context-selector-item--org-unit"
                        dataTest="org-unit-selector"
                        disabled={orgUnitDisabled}
                        label={i18n.t('Organisation unit')}
                        noValueMessage={i18n.t('Choose an organisation unit')}
                        open={false}
                        value={selectedOrgUnitName}
                        setOpen={(open: boolean) => {
                            if (open) {
                                onOpenOrgUnit()
                            }
                        }}
                        onClearSelectionClick={onClearOrgUnit}
                    >
                        {null}
                    </SelectorBarItem>
                </SelectorBar>
            </nav>
            <h1
                className={accessibilityStyles['visually-hidden']}
                data-testid="working-list-heading"
            >
                {i18n.t('Working lists')}
            </h1>
        </>
    )
}
