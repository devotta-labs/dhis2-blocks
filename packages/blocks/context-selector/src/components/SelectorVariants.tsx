import React from 'react'
import i18n from '@dhis2/d2-i18n'
import type { SelectorProps } from '../types'
import { FramedOptionSelector, MenuSelector } from './OptionSelector'
import { lowerCaseFirst } from './internal'

export type ProgramSelectorProps = SelectorProps

export const ProgramSelector = ({
    label = i18n.t('Program'),
    placeholder,
    searchPlaceholder,
    ...props
}: ProgramSelectorProps) => {
    const title = lowerCaseFirst(label)

    const emptyMessage =
        placeholder ??
        i18n.t('Choose a {{title}}', {
            title,
            interpolation: { escapeValue: false },
        })

    return (
        <MenuSelector
            {...props}
            label={label}
            dataTest="program-selector-container"
            emptyMessage={emptyMessage}
            readOnlyEmptyMessage={emptyMessage}
            searchPlaceholder={
                searchPlaceholder ??
                i18n.t('Search for a {{title}}', {
                    title,
                    interpolation: { escapeValue: false },
                })
            }
            contentClassName="max-h-[80vh] overflow-auto pb-[4px]"
        />
    )
}

export type EnrollmentSelectorProps = SelectorProps

export const EnrollmentSelector = ({
    label = i18n.t('Enrollment'),
    ...props
}: EnrollmentSelectorProps) => (
    <FramedOptionSelector
        {...props}
        label={label}
        dataTest="enrollment-selector-container"
    />
)

export type StageSelectorProps = SelectorProps

export const StageSelector = ({
    label = i18n.t('Stage'),
    ...props
}: StageSelectorProps) => (
    <FramedOptionSelector
        {...props}
        label={label}
        dataTest="stage-selector-container"
    />
)

export interface EventSelectorProps extends Omit<SelectorProps, 'label'> {
    label: string
}

export const EventSelector = ({ label, ...props }: EventSelectorProps) => (
    <FramedOptionSelector
        {...props}
        label={label}
        dataTest="event-selector-container"
    />
)
