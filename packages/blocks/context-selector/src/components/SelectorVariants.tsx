import React from 'react'
import i18n from '@dhis2/d2-i18n'
import type { SelectorProps } from '../types'
import { CaptureOptionSelector } from './OptionSelector'

export type ProgramSelectorProps = SelectorProps

export const ProgramSelector = ({
    label = i18n.t('Program'),
    ...props
}: ProgramSelectorProps) => (
    <CaptureOptionSelector
        {...props}
        structure="program"
        label={label}
        dataTest="program-selector-container"
    />
)

export type EnrollmentSelectorProps = SelectorProps

export const EnrollmentSelector = ({
    label = i18n.t('Enrollment'),
    ...props
}: EnrollmentSelectorProps) => (
    <CaptureOptionSelector
        {...props}
        structure="locked"
        label={label}
        dataTest="enrollment-selector-container"
    />
)

export type StageSelectorProps = SelectorProps

export const StageSelector = ({
    label = i18n.t('Stage'),
    ...props
}: StageSelectorProps) => (
    <CaptureOptionSelector
        {...props}
        structure="locked"
        label={label}
        dataTest="stage-selector-container"
    />
)

export interface EventSelectorProps extends Omit<SelectorProps, 'label'> {
    label: string
}

export const EventSelector = ({ label, ...props }: EventSelectorProps) => (
    <CaptureOptionSelector
        {...props}
        structure="locked"
        label={label}
        dataTest="event-selector-container"
    />
)
