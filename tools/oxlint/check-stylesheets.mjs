import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = process.argv[2]
    ? resolve(process.argv[2])
    : fileURLToPath(new URL('../../', import.meta.url))

const entry = 'apps/web/src/index.css'

const extensions = /\.(?:css|scss|sass|less|styl|stylus|pcss|postcss|sss)$/i

const paths = new Set(
    execFileSync(
        'git',
        ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
        { cwd: root, encoding: 'utf8' }
    )
        .split('\0')
        .filter(Boolean)
)

const errors = []

for (const path of paths) {
    if (!extensions.test(path) || !existsSync(resolve(root, path))) continue

    if (path !== entry) {
        errors.push(
            `${path}: authored stylesheets are banned; use inline Tailwind classes.`
        )
        continue
    }

    // Preserve quoted text while removing CSS comments, including multi-line comments.
    let source = readFileSync(resolve(root, path), 'utf8').replace(
        /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\/\*[\s\S]*?\*\//g,
        (token) => (token.startsWith('/*') ? '' : token)
    )

    const directive =
        /^\s*(?:@import\s+(['"])tailwindcss\/(?:theme|preflight|utilities)\.css\1\s*;|@source\s+(?:not\s+inline\(\s*(['"])container\2\s*\)|(['"])(?:\.{1,2}\/)[^'"\\;{}\n]*\3)\s*;)/

    while (source.trim()) {
        const match = directive.exec(source)

        if (!match) {
            errors.push(
                `${path}: only Tailwind compiler imports and source directives are allowed; selectors, declarations, custom at-rules, and other imports are banned.`
            )
            break
        }

        source = source.slice(match[0].length)
    }
}

if (errors.length) {
    console.error(errors.join('\n'))
    process.exit(1)
}

console.log('Stylesheet policy passed.')
