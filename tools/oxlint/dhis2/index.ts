import { eslintCompatPlugin } from '@oxlint/plugins'
import { inlineTranslationsRule } from './inline-translations.ts'

export default eslintCompatPlugin({
    meta: { name: 'dhis2' },
    rules: { 'inline-translations': inlineTranslationsRule },
})
