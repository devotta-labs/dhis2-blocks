import { RuleTester } from 'oxlint/plugins-dev'
import { noReactEffectsRule } from './no-react-effects.ts'

const tester = new RuleTester({
    languageOptions: { parserOptions: { lang: 'tsx' } },
})

const error = { messageId: 'effect' }

const escape = { messageId: 'escape' }

tester.run('dhis2-blocks/no-react-effects', noReactEffectsRule, {
    valid: [
        'import { useMemo } from "react"; useMemo(() => count * 2, [count]);',
        'import { useEffectEvent } from "react"; useEffectEvent(() => sendMessage());',
        'import { useSyncExternalStore } from "react"; useSyncExternalStore(subscribe, snapshot);',
        'function useEffect() {}; useEffect();',
        'import { useEffect } from "other-library"; useEffect();',
        'const React = { useEffect() {} }; React.useEffect();',
        'import * as React from "react"; function f(React: { useEffect(): void }) { React.useEffect(); }',
        'import { useEffect } from "react"; function f(useEffect: () => void) { useEffect(); }',
        'function f(require: (name: string) => { useEffect(): void }) { require("react").useEffect(); }',
        'const a = b; const b = a; a();',
        'import type { useEffect } from "react";',
        'export type { useEffect } from "react";',
        'export { useMemo } from "react";',
        'import { useEffect } from "react"; const run = useEffect;\n// EFFECT: window.beforeunload -- Subscribe while dirty and unsubscribe on cleanup.\nrun(() => subscribe(), [dirty]);',
        'import React from "react";\n// EFFECT: document.keydown -- Listen while the popup is open and remove the listener on cleanup.\nReact.useEffect(() => subscribe(), [open]);',
        'import { useLayoutEffect as measure } from "react";\n// EFFECT: dom.layout -- Measure the committed widget before paint.\nmeasure(() => resizeWidget(), [width]);',
        'import { useInsertionEffect } from "react";\n/* EFFECT: external-widget -- Synchronize the third-party widget on mount. */\nuseInsertionEffect(connect, []);',
        'import { useEffect } from "react"; /* EFFECT: window.resize -- Subscribe after mount and remove the listener on cleanup. */ useEffect(subscribe, []);',
        'import React from "react"; let key = "useMemo"; key = "useState"; React[key](callback);',
    ],
    invalid: [
        {
            code: 'import { default as React } from "react"; React.useEffect(callback);',
            errors: [error],
        },
        {
            code: 'import React from "react"; const key = "useEffect"; React[key](callback);',
            errors: [error],
        },
        {
            code: 'import React from "react"; let key = "useMemo"; key = "useEffect"; React[key](callback);',
            errors: [error],
        },
        {
            code: 'import React from "react"; React["use" + "Effect"](callback);',
            errors: [error],
        },

        {
            code: 'import { useEffect } from "react";\n// EFFECT: window.resize -- Subscribe on mount.\nuseEffect(callback), useEffect(other);',
            errors: [error, error],
        },
        {
            code: 'import { useEffect } from "react";\n// EFFECT: window.resize -- Subscribe on mount.\nconst Component = () => useEffect(callback);',
            errors: [error],
        },

        {
            code: 'import { useEffect } from "react"; useEffect.call(null, callback);',
            errors: [error],
        },
        {
            code: 'import { useEffect } from "react"; useEffect.apply(null, [callback]);',
            errors: [error],
        },
        {
            code: 'import { useEffect } from "react"; const bound = useEffect.bind(null);',
            errors: [escape],
        },
        {
            code: 'import { useEffect } from "react"; (0, useEffect)(callback);',
            errors: [error],
        },
        {
            code: 'import { useEffect } from "react"; const run = ready ? useEffect : other; run(callback);',
            errors: [error],
        },
        {
            code: 'const { default: R } = await import("react"); R.useEffect(callback);',
            errors: [error],
        },
        {
            code: 'import { useEffect } from "react"; const factory = () => useEffect;',
            errors: [escape],
        },

        ...['useEffect', 'useLayoutEffect', 'useInsertionEffect'].map(
            (hook) => ({
                code: `import { ${hook} } from "react"; ${hook}(() => setCount(count + 1), [count]);`,
                errors: [error],
            })
        ),
        {
            code: 'import { useEffect as run } from "react"; run(callback, []);',
            errors: [error],
        },
        {
            code: 'import React from "react"; React.useEffect(callback, []);',
            errors: [error],
        },
        {
            code: 'import * as R from "react"; R["useEffect"](callback, []);',
            errors: [error],
        },
        {
            code: 'import * as R from "react"; R[`useLayoutEffect`](callback, []);',
            errors: [error],
        },
        {
            code: 'import * as R from "react"; R.useEffect?.(callback, []);',
            errors: [error],
        },
        {
            code: 'import { useEffect } from "react"; (useEffect as typeof useEffect)(callback, []);',
            errors: [error],
        },
        {
            code: 'import { useEffect } from "react"; const a = useEffect; const b = a; b(callback);',
            errors: [error],
        },
        {
            code: 'import React from "react"; const R = React; const { useEffect: run } = R; run(callback);',
            errors: [error],
        },
        {
            code: 'const { useEffect: run } = require("react"); run(callback);',
            errors: [error],
        },
        {
            code: 'const React = await import("react"); React.useEffect(callback);',
            errors: [error],
        },
        {
            code: 'const { useEffect: run } = await import("react"); run(callback);',
            errors: [error],
        },
        {
            code: 'import { useEffect } from "react"; let run; run = useEffect; run(callback);',
            errors: [error],
        },
        {
            code: 'import { useEffect } from "react";\n// EFFECT: window.resize --\nuseEffect(callback);',
            errors: [error],
        },
        {
            code: 'import { useEffect } from "react";\n// EFFECT: window.resize -- TODO explain later\nuseEffect(callback);',
            errors: [error],
        },
        {
            code: 'import { useEffect } from "react";\n// EFFECT: -- No external system.\nuseEffect(callback);',
            errors: [error],
        },
        {
            code: 'import { useEffect } from "react";\n// EFFECT: window.resize -- Subscribe on mount.\n\nuseEffect(callback);',
            errors: [error],
        },
        {
            code: 'import { useEffect } from "react";\n// EFFECT: window.resize -- Subscribe on mount.\nconst value = 1;\nuseEffect(callback);',
            errors: [error],
        },
        {
            code: 'import { useEffect } from "react";\n// EFFECT: window.resize -- Subscribe on mount.\nfunction Component() { useEffect(callback); }',
            errors: [error],
        },
        {
            code: 'import { useEffect } from "react";\n// EFFECT: window.resize -- Subscribe on mount.\nuseEffect(callback);\nuseEffect(otherCallback);',
            errors: [error],
        },
        {
            code: 'import { useEffect } from "react"; useEffect(() => { /* EFFECT: window.resize -- Subscribe on mount. */ subscribe(); });',
            errors: [error],
        },
        {
            code: 'export { useEffect as useOnChange } from "react";',
            errors: [escape],
        },
        { code: 'export * from "react";', errors: [escape] },
        {
            code: 'import { useEffect } from "react"; export { useEffect };',
            errors: [escape],
        },
        {
            code: 'import { useEffect } from "react"; export const useOnChange = useEffect;',
            errors: [escape],
        },
        {
            code: 'import { useEffect } from "react"; export default useEffect;',
            errors: [escape],
        },
        {
            code: 'import { useEffect } from "react"; wrap(useEffect);',
            errors: [escape],
        },
        {
            code: 'import { useEffect } from "react"; const hooks = { run: useEffect };',
            errors: [escape],
        },
        {
            code: 'import { useEffect } from "react"; const hooks = [useEffect];',
            errors: [escape],
        },
        {
            code: 'import { useEffect } from "react"; function factory() { return useEffect; }',
            errors: [escape],
        },
        {
            code: 'import { useEffect } from "react"; hooks.run = useEffect;',
            errors: [escape],
        },
    ],
})
