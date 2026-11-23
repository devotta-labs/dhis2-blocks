'use client'

import { Collapsible as CollapsiblePrimitive } from '@base-ui/react/collapsible'
import * as React from 'react'

/** shadcn Collapsible (Base UI): a trigger that shows and hides a panel. It has no look of its own. */
function Collapsible({ ...props }: CollapsiblePrimitive.Root.Props) {
    return <CollapsiblePrimitive.Root data-slot="collapsible" {...props} />
}

const CollapsibleTrigger = React.forwardRef<
    HTMLButtonElement,
    CollapsiblePrimitive.Trigger.Props
>((props, ref) => (
    <CollapsiblePrimitive.Trigger
        ref={ref}
        data-slot="collapsible-trigger"
        {...props}
    />
))
CollapsibleTrigger.displayName = 'CollapsibleTrigger'

function CollapsibleContent({ ...props }: CollapsiblePrimitive.Panel.Props) {
    return (
        <CollapsiblePrimitive.Panel
            data-slot="collapsible-content"
            {...props}
        />
    )
}

export { Collapsible, CollapsibleTrigger, CollapsibleContent }
