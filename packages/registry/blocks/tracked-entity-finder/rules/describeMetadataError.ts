import i18n from '@dhis2/d2-i18n'
import { attributeOf, searchableAttributes } from './programModel'
import type { MetadataError, ProgramModel } from './types'

const raw = { interpolation: { escapeValue: false } } as const

const whatWentWrong = (model: ProgramModel, error: MetadataError): string => {
    const program = model.name
    if (error.kind === 'form-cannot-search') {
        return i18n.t(
            "This form can never search in {{program}}. It has no usable ID field and too few usable fields to reach the program's minimum.",
            { program, ...raw }
        )
    }
    const attribute = error.attribute
    const found = attributeOf(model, attribute)
    const label = found?.label ?? attribute
    switch (error.kind) {
        case 'unknown-attribute':
            return i18n.t(
                '`{{attribute}}` is not an attribute of {{program}}.',
                {
                    attribute,
                    program,
                    ...raw,
                }
            )
        case 'not-searchable':
            return i18n.t("`{{attribute}}` isn't searchable in {{program}}.", {
                attribute,
                program,
                ...raw,
            })
        case 'unsupported-type':
            if (found?.valueType === 'MULTI_TEXT' && found.options) {
                return i18n.t(
                    "`{{attribute}}` ({{label}}) holds several options (MULTI_TEXT), which DHIS2 searches only from version 2.43, so it can't be searched in {{program}} on this server.",
                    { attribute, label, program, ...raw }
                )
            }
            return i18n.t(
                "`{{attribute}}` ({{label}}) has value type {{valueType}}, which can't be searched in {{program}}.",
                {
                    attribute,
                    label,
                    valueType: found?.valueType ?? '',
                    program,
                    ...raw,
                }
            )
        case 'operators-blocked':
            return i18n.t(
                "`{{attribute}}` ({{label}}) can't be searched this way in {{program}} because the search operators it needs are blocked.",
                { attribute, label, program, ...raw }
            )
        case 'range-not-supported':
            return i18n.t(
                "`{{attribute}}` ({{label}}) can't be a range in {{program}}. FinderRangeField works only for number, date and date-time attributes that aren't unique; use FinderField.",
                { attribute, label, program, ...raw }
            )
        case 'shape-conflict':
            return i18n.t(
                '`{{attribute}}` ({{label}}) is composed both as FinderField and as FinderRangeField in one FinderForm for {{program}}; they cannot share a value, so use one.',
                { attribute, label, program, ...raw }
            )
    }
}

const searchableList = (model: ProgramModel): string => {
    const entries = searchableAttributes(model).map(({ id, label, unique }) =>
        unique
            ? i18n.t('{{label}} (`{{id}}`, unique)', { label, id, ...raw })
            : i18n.t('{{label}} (`{{id}}`)', { label, id, ...raw })
    )
    return entries.length
        ? i18n.t('Searchable attributes are {{list}}.', {
              list: entries.join(', '),
              ...raw,
          })
        : i18n.t('Nothing is searchable.')
}

const minimum = (model: ProgramModel): string => {
    const count = Math.max(model.minAttributes, 1)
    return count === 1
        ? i18n.t('This program needs 1 detail unless an ID is used.')
        : i18n.t('This program needs {{count}} details unless an ID is used.', {
              count,
              ...raw,
          })
}

/**
 * A full, agent-friendly message for a metadata error: what is wrong, the
 * program's searchable attributes with uids, and its minimum.
 */
export const describeMetadataError = (
    model: ProgramModel,
    error: MetadataError
): string =>
    [whatWentWrong(model, error), searchableList(model), minimum(model)].join(
        ' '
    )
