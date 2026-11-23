import type { Example, LabSettings } from './labData'

export const DEFAULT_SETTINGS: LabSettings = {
    example: 'newVisit',
    blame: 'markers',
    confirmSaved: 'status',
    mayUncomplete: true,
    network: { delay: 50, endpoints: {} },
}

export interface Preset {
    group: string
    name: string
    folded?: boolean
    settings: LabSettings
}

const preset = (
    group: string,
    name: string,
    example: Example,
    folded?: boolean,
    settings?: Partial<LabSettings>
) =>
    ({
        group,
        name,
        folded,
        settings: { ...DEFAULT_SETTINGS, example, ...settings },
    }) satisfies Preset

export const PRESETS: readonly Preset[] = [
    preset('Child visit', 'New child visit', 'newVisit'),
    preset('Child visit', 'Edit a saved visit', 'savedVisit'),
    preset(
        'Child visit',
        'Edit a visit the rules changed',
        'rulesChangedVisit'
    ),
    preset('Child visit', 'New visit with categories', 'fundedVisit'),
    preset('Child visit', 'Edit a visit with categories', 'savedFundedVisit'),
    preset('Child visit', 'Completed, locked', 'locked'),
    preset(
        'Child visit',
        'Completed, locked, may not reopen',
        'locked',
        false,
        {
            mayUncomplete: false,
        }
    ),
    preset('Child visit', 'No write access', 'noWrite'),
    preset('Location', 'New visit with a location', 'pointVisit'),
    preset('Location', 'Edit a visit with a location', 'savedPointVisit'),
    preset('Location', 'Location in an org unit area', 'areaVisit', false, {
        locationWarnKm: 100,
    }),
    preset('Other stages', 'Every value type', 'valueTypes'),
    preset('Other stages', 'RMNCH First ANC', 'rmnch'),
    preset('Other stages', 'Long form', 'longForm'),
    preset('Failures', 'DHIS2 refuses the save', 'refused', true),
    preset('Failures', 'Rules fail to load', 'rulesFail', true),
    preset('Stage settings', 'Stage without sections', 'noSections', true),
    preset('Stage settings', 'Validation on complete only', 'onComplete', true),
]
