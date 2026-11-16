import type { KeyboardEvent } from 'react'

// Safari reports the key that ends a composition as keyCode 229 with `isComposing` already false.
export const composing = (event: KeyboardEvent) =>
    event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229
