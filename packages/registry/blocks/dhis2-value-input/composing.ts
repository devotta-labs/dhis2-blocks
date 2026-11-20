import type { KeyboardEvent } from 'react'

// WARNING: Safari reports keyCode 229 on the key that ends composition, even when isComposing is already false.
export const composing = (event: KeyboardEvent) =>
    event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229
