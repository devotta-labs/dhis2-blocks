import i18n from '@dhis2/d2-i18n'
import type { KeyboardEvent, ReactNode } from 'react'
import { Button } from '@/components/dhis2/ui/button'
import { composing } from '../composing'

interface EditorButtonsProps {
    save(): void
    cancel(): void
    /** More buttons, before Save. */
    children?: ReactNode
    /** In a form: only the editor's own buttons, as a form has no Save or Cancel per field. */
    inline?: boolean
}

/** The row every editor ends with: its own buttons, then Save and Cancel. */
export const EditorButtons = ({
    save,
    cancel,
    children,
    inline = false,
}: EditorButtonsProps) => {
    if (inline) {
        return children === undefined ? null : (
            <div className="flex gap-2">{children}</div>
        )
    }
    return (
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
}

/** In a form, the label of an editor's part, small and muted so the field's own label leads. */
export const SUB_LABEL_CLASS = 'text-xs text-dhis2-muted-foreground'

/** Ids for `aria-describedby`, without the absent ones; undefined for none. */
export const idList = (...ids: Array<string | false | undefined>) =>
    ids.filter(Boolean).join(' ') || undefined

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
