import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { RuleTester } from 'oxlint/plugins-dev'
import { noStylesheetsRule } from './no-stylesheets.ts'

const tester = new RuleTester({
    languageOptions: { parserOptions: { lang: 'tsx' } },
})

const error = { messageId: 'stylesheet' }

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')

tester.run('dhis2-blocks/no-stylesheets', noStylesheetsRule, {
    valid: [
        'import React from "react";',
        'export { value } from "./module.ts";',
        'const label = "styles.css"; const query = "data.css?name=sample";',
        'import("./css-utilities.ts");',
        'import("./styles.css.js");',
        'require("./helpers.js?styles.css");',
        'new URL("./icon.svg", import.meta.url);',
        '<link rel="icon" href="/favicon.ico" />',
        '<link rel="preconnect" href="https://example.com" />',
        '<CustomStyle />',
        '<div className="text-red-500" />',
        'const source = source; import(source);',
        'function load(source: string) { return import(source); }',
        'function load(require: (name: string) => void) { require("./styles.css"); }',
        'function load(require: { resolve(name: string): string }) { require.resolve("./styles.css"); }',
        'class URL { constructor(name: string) {} }; new URL("./styles.css");',
        {
            filename: resolve(root, 'apps/web/src/AppWrapper.tsx'),
            code: 'import "./index.css";',
        },
        {
            filename: resolve(root, 'apps/web/test/setup.ts'),
            code: 'import "../src/index.css";',
        },
        {
            filename: resolve(
                root,
                'packages/blocks/working-list/test/setup.ts'
            ),
            code: 'import "../../../../apps/web/src/index.css";',
        },
    ],
    invalid: [
        { code: 'import "./styles.css";', errors: [error] },
        { code: 'import styles from "./styles.module.css";', errors: [error] },
        {
            code: 'import type styles from "./styles.module.css";',
            errors: [error],
        },
        { code: 'import "./STYLES.CSS";', errors: [error] },
        ...[
            'scss',
            'sass',
            'less',
            'styl',
            'stylus',
            'pcss',
            'postcss',
            'sss',
        ].map((extension) => ({
            code: `import "./styles.${extension}";`,
            errors: [error],
        })),
        { code: 'import "@vendor/theme/styles.css";', errors: [error] },
        { code: 'import "tailwindcss" with { type: "css" };', errors: [error] },
        { code: 'import "./styles.css?inline";', errors: [error] },
        { code: 'import "./styles.css?raw#fragment";', errors: [error] },
        {
            code: 'import "!!style-loader!css-loader!./styles.css";',
            errors: [error],
        },
        { code: 'import "./styles%2Ecss";', errors: [error] },
        { code: 'import "./bad%ZZ/styles.css";', errors: [error] },
        {
            code: 'import "https://example.com/theme.css?version=2";',
            errors: [error],
        },
        {
            code: 'export { default } from "./styles.module.css";',
            errors: [error],
        },
        { code: 'export * from "./styles.css";', errors: [error] },
        {
            code: 'export * from "theme" with { type: "css" };',
            errors: [error],
        },
        { code: 'import("./styles.css");', errors: [error] },
        { code: 'import(`./styles.css`);', errors: [error] },
        { code: 'import(`./${theme}.css`);', errors: [error] },
        { code: 'import(folder + "/styles.css");', errors: [error] },
        {
            code: 'const source = "./styles.css"; import(source);',
            errors: [error],
        },
        {
            code: 'const a = "./styles.css"; const b = a; import(b);',
            errors: [error],
        },
        {
            code: 'let source = "./module.ts"; source = "./styles.css"; import(source);',
            errors: [error],
        },
        {
            code: 'import(ready ? "./module.ts" : "./styles.css");',
            errors: [error],
        },
        {
            code: 'import("theme", { with: { type: "css" } });',
            errors: [error],
        },
        { code: 'require("./styles.css");', errors: [error] },
        { code: 'require.resolve("./styles.css");', errors: [error] },
        { code: 'new URL("./styles.css", import.meta.url);', errors: [error] },
        { code: '<style>{"h1 { color: red; }"}</style>', errors: [error] },
        { code: '<style jsx global>{rules}</style>', errors: [error] },
        { code: '<link rel="stylesheet" href={endpoint} />', errors: [error] },
        {
            code: '<link rel="alternate stylesheet" href="/theme" />',
            errors: [error],
        },
        { code: '<link rel="preload" href="/theme.css" />', errors: [error] },
        {
            code: '<link href="data:text/css;base64,aDEge30=" />',
            errors: [error],
        },
        { code: 'document.createElement("style");', errors: [error] },
        {
            code: 'document.createElementNS(namespace, "style");',
            errors: [error],
        },
        { code: 'React.createElement("style", null, rules);', errors: [error] },
        {
            code: 'React.createElement("link", { rel: "stylesheet", href: endpoint });',
            errors: [error],
        },
        { code: 'link.href = "./styles.css";', errors: [error] },
        { code: 'link.rel = "stylesheet";', errors: [error] },
        { code: 'link.setAttribute("href", "./styles.css");', errors: [error] },
        { code: 'link.setAttribute("rel", "stylesheet");', errors: [error] },
        // A same-named file elsewhere cannot use the compiler-entry exemption.
        {
            filename: resolve(root, 'apps/web/src/app/Example.tsx'),
            code: 'import "./index.css";',
            errors: [error],
        },
        {
            filename: resolve(root, 'apps/web/src/AppWrapper.tsx'),
            code: 'import styles from "./index.css";',
            errors: [error],
        },
        {
            filename: resolve(root, 'apps/web/src/AppWrapper.tsx'),
            code: 'import "./index.css?raw";',
            errors: [error],
        },
        {
            filename: resolve(root, 'apps/web/src/AppWrapper.tsx'),
            code: 'import("./index.css");',
            errors: [error],
        },
    ],
})
