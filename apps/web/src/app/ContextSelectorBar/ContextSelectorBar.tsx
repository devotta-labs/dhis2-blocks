import {
    SelectorBar,
    SelectorBarItem,
    SingleSelectField,
    SingleSelectOption,
} from '@dhis2/ui'
import React, { useState } from 'react'
import i18n from '../../i18n'

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
                className="w-full min-w-0 max-w-full"
                data-testid="context-selector-bar"
                aria-label={i18n.t('Working list context')}
            >
                <SelectorBar
                    ariaLabel={i18n.t('Working list context')}
                    className="w-full min-w-0 max-w-full"
                    disableClearSelections={!selectedProgram}
                    onClearSelectionClick={() => {
                        setProgramSelectorOpen(false)
                        onClearAll()
                    }}
                >
                    <SelectorBarItem
                        className="w-[min(360px,100%)] min-w-0 max-w-[min(420px,100%)] [@media(max-width:560px)]:w-full [@media(max-width:560px)]:max-w-full [&_.clear-icon]:flex-none [&_.label]:flex-none [&_.toggle-icon]:flex-none [&_.value]:min-w-0 [&_.value]:overflow-hidden [&_.value]:text-ellipsis [&_.value]:whitespace-nowrap"
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
                        <div className="w-[min(360px,calc(100vw-32px))] min-w-0 max-w-full p-3 [&>*]:min-w-0 [&>*]:max-w-full">
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
                        className="w-[min(420px,100%)] min-w-0 max-w-[min(420px,100%)] [@media(max-width:560px)]:w-full [@media(max-width:560px)]:max-w-full [&_.clear-icon]:flex-none [&_.label]:flex-none [&_.toggle-icon]:flex-none [&_.value]:min-w-0 [&_.value]:overflow-hidden [&_.value]:text-ellipsis [&_.value]:whitespace-nowrap"
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
                className="absolute! m-[-1px]! h-px! w-px! overflow-hidden! whitespace-nowrap! border-0! p-0! [clip:rect(0,0,0,0)]!"
                data-testid="working-list-heading"
            >
                {i18n.t('Working lists')}
            </h1>
        </>
    )
}
