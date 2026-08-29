import {
    ContextOrganisationUnitSelector,
    ContextProgramSelector,
    ContextSelector,
    type ContextControl,
    type ContextOption,
    type ContextPopupControl,
    type ContextSelectorClearAction,
} from '@dhis2-blocks/context-selector'
import { Button, MenuDivider } from '@dhis2/ui'
import type { ReactNode } from 'react'
import React from 'react'
import i18n from '../../i18n'

interface WorkingListContextControlsProps {
    clearAction: ContextSelectorClearAction
    programOptions: ContextOption[]
    selectedProgramId?: string
    programControl: ContextControl
    programsAreFiltered: boolean
    onShowAllPrograms: () => void
    showOrganisationUnit: boolean
    organisationUnitValue?: string
    organisationUnitControl: ContextPopupControl
    organisationUnitContent: ReactNode
}

export const WorkingListContextControls = ({
    clearAction,
    programOptions,
    selectedProgramId,
    programControl,
    programsAreFiltered,
    onShowAllPrograms,
    showOrganisationUnit,
    organisationUnitValue,
    organisationUnitControl,
    organisationUnitContent,
}: WorkingListContextControlsProps) => (
    <ContextSelector
        ariaLabel={i18n.t('Working list context')}
        dataTest="context-selector-bar"
        clearAction={clearAction}
    >
        <ContextProgramSelector
            options={programOptions}
            selectedValue={selectedProgramId}
            control={programControl}
        >
            {programOptions.length === 0 ? (
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
        </ContextProgramSelector>

        {showOrganisationUnit ? (
            <ContextOrganisationUnitSelector
                key={selectedProgramId}
                value={organisationUnitValue}
                control={organisationUnitControl}
            >
                {organisationUnitContent}
            </ContextOrganisationUnitSelector>
        ) : null}
    </ContextSelector>
)
