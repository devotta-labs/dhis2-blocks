import i18n from '@dhis2/d2-i18n'
import { Alert, AlertDescription } from '@/components/dhis2/ui/alert'
import type { RuleMessage } from '@/components/program-rules'
import { useEventFormContext } from './context'

const AS_IS = { nsSeparator: '::', interpolation: { escapeValue: false } }

const said = ({ kind, text }: RuleMessage) => {
    switch (kind) {
        case 'error':
            return i18n.t('Error: {{text}}', { ...AS_IS, text })
        case 'warning':
            return i18n.t('Warning: {{text}}', { ...AS_IS, text })
        default:
            return i18n.t('On completing: {{text}}', { ...AS_IS, text })
    }
}

/** What the rules say of the whole form: its messages, display texts and key-value pairs. Nothing when there are none. */
export const EventFormFeedback = () => {
    const { rules } = useEventFormContext()
    const lines = [
        ...(rules.outcome?.messages.get('form') ?? []).map(said),
        ...(rules.effects?.displayTexts ?? []).map(({ label, value }) =>
            [label, value].filter(Boolean).join(' ')
        ),
        ...(rules.effects?.keyValuePairs ?? []).map(({ label, value }) =>
            i18n.t('{{label}}: {{value}}', { ...AS_IS, label, value })
        ),
    ]
    if (lines.length === 0) {
        return null
    }
    return (
        <Alert>
            <AlertDescription>
                {lines.map((line, index) => (
                    // oxlint-disable-next-line react/no-array-index-key -- rule lines have no ids, and two can say the same
                    <p key={index}>{line}</p>
                ))}
            </AlertDescription>
        </Alert>
    )
}
