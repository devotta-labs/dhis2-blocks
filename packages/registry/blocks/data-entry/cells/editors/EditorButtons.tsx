import i18n from '@dhis2/d2-i18n'
import type { KeyboardEvent, ReactNode } from 'react'
import { Button } from '@/components/dhis2/ui/button'
import { composing } from '../useCellMode'

interface EditorButtonsProps {
    save(): void
    cancel(): void
    /** More buttons, before Save. */
    children?: ReactNode
}

/** The row every editor ends with: its own buttons, then Save and Cancel. */
export const EditorButtons = ({
    save,
    cancel,
    children,
}: EditorButtonsProps) => (
    <div className="flex justify-end gap-2">
        {children}
        <Button type="button" size="sm" onClick={save}>
            {i18n.t('Save')}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={cancel}>
            {i18n.t('Cancel')}
        </Button>
    </div>
)

/** A key handler for a field of an editor: Ctrl+Enter or ⌘+Enter saves. */
export const saveOnCtrlEnter = (save: () => void) => (event: KeyboardEvent) => {
    if (
        event.key === 'Enter' &&
        (event.ctrlKey || event.metaKey) &&
        !composing(event)
    ) {
        event.preventDefault()
        save()
    }
}
