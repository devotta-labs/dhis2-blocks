import React from 'react'
import i18n from '@dhis2/d2-i18n'
import type { ContextOptionSelectorProps } from './ContextOptionSelector'
import { CaptureOptionSelector } from './ContextOptionSelector'

type FixedOptionSelectorProps = Omit<
    ContextOptionSelectorProps,
    'label' | 'noValueMessage' | 'searchPlaceholder' | 'dataTest'
>

export type ContextProgramSelectorProps = FixedOptionSelectorProps

export const ContextProgramSelector = (props: ContextProgramSelectorProps) => (
    <CaptureOptionSelector
        {...props}
        structure="program"
        label={i18n.t('Program')}
        noValueMessage={i18n.t('Choose a program')}
        searchPlaceholder={i18n.t('Search for a program')}
        dataTest="program-selector-container"
    />
)

export type ContextEnrollmentSelectorProps = FixedOptionSelectorProps

export const ContextEnrollmentSelector = (
    props: ContextEnrollmentSelectorProps
) => (
    <CaptureOptionSelector
        {...props}
        structure="locked"
        label={i18n.t('Enrollment')}
        noValueMessage={i18n.t('Choose an enrollment')}
        searchPlaceholder={i18n.t('Search for an enrollment')}
        dataTest="enrollment-selector-container"
    />
)

export type ContextStageSelectorProps = FixedOptionSelectorProps

export const ContextStageSelector = (props: ContextStageSelectorProps) => (
    <CaptureOptionSelector
        {...props}
        structure="locked"
        label={i18n.t('Stage')}
        noValueMessage={i18n.t('Choose a stage')}
        searchPlaceholder={i18n.t('Search for a stage')}
        dataTest="stage-selector-container"
    />
)
