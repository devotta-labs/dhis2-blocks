import i18n from '@dhis2/d2-i18n'
import { Button } from '@/components/dhis2/ui/button'
import { Kbd } from '@/components/dhis2/ui/kbd'

/** The button after a table that takes new rows, described by the table's title, showing Ctrl+Enter's shortcut. */
export const AddRowButton = ({
    label,
    describedBy,
    onClick,
}: {
    label: string
    describedBy: string
    onClick(): void
}) => (
    <Button
        variant="secondary"
        size="sm"
        className="gap-1.5 self-start pe-1"
        aria-describedby={describedBy}
        aria-keyshortcuts="Control+Enter Meta+Enter"
        onClick={onClick}
    >
        {label}
        {/* Screen readers hear the shortcut from aria-keyshortcuts; the button keeps its name. */}
        <Kbd aria-hidden>
            {/* Apple keyboards say ⌘ where others say Ctrl. */}
            {/Mac|iPhone|iPad/.test(navigator.platform)
                ? '⌘↵'
                : i18n.t('Ctrl ↵')}
        </Kbd>
    </Button>
)
