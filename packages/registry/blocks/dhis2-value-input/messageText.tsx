import i18n from '@dhis2/d2-i18n'
import { cn } from '@/components/dhis2/ui/cn'

export type Tone = 'error' | 'warning' | 'info'

const AS_IS = { nsSeparator: '::', interpolation: { escapeValue: false } }

export const TONES = {
    error: {
        border: 'border-dhis2-destructive-indicator',
        say: (message: string) =>
            i18n.t('Error: {{message}}', { ...AS_IS, message }),
        mark: () => ({
            colour: 'text-dhis2-destructive-indicator',
            word: i18n.t('Error:', AS_IS),
        }),
    },
    warning: {
        border: 'border-dhis2-warning-indicator',
        say: (message: string) =>
            i18n.t('Warning: {{message}}', { ...AS_IS, message }),
        mark: () => ({
            colour: 'text-dhis2-warning-indicator',
            word: i18n.t('Warning:', AS_IS),
        }),
    },
    info: { border: 'border-dhis2-neutral-indicator', mark: () => undefined },
}

/** One message under the field: information as it is, a warning or an error after its word. */
export const MessageText = ({ tone, text }: { tone: Tone; text: string }) => {
    const mark = TONES[tone].mark()
    if (mark === undefined) {
        return text
    }
    return (
        <span>
            <span className={cn('font-medium', mark.colour)}>{mark.word}</span>{' '}
            {text}
        </span>
    )
}
