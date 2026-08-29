import {
    ClearSelections,
    ContextSelector,
    OrganisationUnitSelector,
    ProgramSelector,
    type Option,
} from '@dhis2-blocks/context-selector'
import { Button, MenuDivider } from '@dhis2/ui'
import type { ReactNode } from 'react'
import React from 'react'
import i18n from '../../i18n'

interface WorkingListContextControlsProps {
    onClear: () => void
    clearDisabled: boolean
    programOptions: Option[]
    programValue?: string
    programOpen: boolean
    onProgramOpenChange: (open: boolean) => void
    onProgramChange: (value: string) => void
    onProgramClear: () => void
    programLoading: boolean
    programLoadingLabel: string
    programsAreFiltered: boolean
    onShowAllPrograms: () => void
    showOrganisationUnit: boolean
    organisationUnitValue?: string
    organisationUnitOpen: boolean
    onOrganisationUnitOpenChange: (open: boolean) => void
    onOrganisationUnitClear: () => void
    organisationUnitLoading: boolean
    organisationUnitDisabled: boolean
    organisationUnitContent: ReactNode
}

export const WorkingListContextControls = ({
    onClear,
    clearDisabled,
    programOptions,
    programValue,
    programOpen,
    onProgramOpenChange,
    onProgramChange,
    onProgramClear,
    programLoading,
    programLoadingLabel,
    programsAreFiltered,
    onShowAllPrograms,
    showOrganisationUnit,
    organisationUnitValue,
    organisationUnitOpen,
    onOrganisationUnitOpenChange,
    onOrganisationUnitClear,
    organisationUnitLoading,
    organisationUnitDisabled,
    organisationUnitContent,
}: WorkingListContextControlsProps) => {
    const visibleProgramOptions = programOptions.filter(
        (option) => !option.excludeFromMenu
    )

    return (
        <ContextSelector ariaLabel={i18n.t('Working list context')}>
            <ProgramSelector
                label={i18n.t('Program')}
                placeholder={i18n.t('Choose a program')}
                searchPlaceholder={i18n.t('Search for a program')}
                options={programOptions}
                value={programValue}
                open={programOpen}
                onOpenChange={onProgramOpenChange}
                onChange={onProgramChange}
                onClear={onProgramClear}
                loading={programLoading}
                loadingLabel={programLoadingLabel}
            >
                {visibleProgramOptions.length === 0 ? (
                    <div className="flex items-center gap-[8px] px-[12px] py-[4px] text-[14px] text-[#4a5768]">
                        <span>{i18n.t('No programs available.')}</span>
                        <Button
                            small
                            secondary
                            dataTest="program-selector-no-programs"
                            onClick={onShowAllPrograms}
                        >
                            {i18n.t('Show all')}
                        </Button>
                    </div>
                ) : programsAreFiltered ? (
                    <>
                        <MenuDivider />
                        <div className="flex items-center gap-[8px] px-[12px] py-[4px] text-[14px] text-[#4a5768]">
                            <span>
                                {i18n.t(
                                    'Some programs are being filtered by the chosen organisation unit'
                                )}
                            </span>
                            <Button small secondary onClick={onShowAllPrograms}>
                                {i18n.t('Show all programs')}
                            </Button>
                        </div>
                    </>
                ) : null}
            </ProgramSelector>

            {showOrganisationUnit ? (
                <OrganisationUnitSelector
                    key={programValue}
                    label={i18n.t('Organisation unit')}
                    placeholder={i18n.t('Choose an organisation unit')}
                    value={organisationUnitValue}
                    open={organisationUnitOpen}
                    onOpenChange={onOrganisationUnitOpenChange}
                    onClear={onOrganisationUnitClear}
                    loading={organisationUnitLoading}
                    disabled={organisationUnitDisabled}
                >
                    {organisationUnitContent}
                </OrganisationUnitSelector>
            ) : null}
            <ClearSelections onClear={onClear} disabled={clearDisabled} />
        </ContextSelector>
    )
}
