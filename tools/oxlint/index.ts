import { eslintCompatPlugin } from '@oxlint/plugins'
import { noTailwindImportantRule } from './rules/no-tailwind-important.ts'
import { inlineClassnamesRule } from './rules/inline-classnames.ts'

export default eslintCompatPlugin({
    meta: { name: 'dhis2-blocks' },
    rules: {
        'no-tailwind-important': noTailwindImportantRule,
        'inline-classnames': inlineClassnamesRule,
    },
})
