import { RuleTester } from 'oxlint/plugins-dev'
import { inlineClassnamesRule } from './inline-classnames.ts'

const tester = new RuleTester({
    languageOptions: { parserOptions: { lang: 'tsx' } },
})

const error = { messageId: 'extracted' }

tester.run('dhis2-blocks/inline-classnames', inlineClassnamesRule, {
    valid: [
        '<div className="flex px-4" />',
        'const selected = true; <div className={selected ? "block" : "hidden"} />;',
        'const selected = true; <div className={selected && "block"} />;',
        'const selected = true; <div className={`p-4 ${selected ? "block" : "hidden"}`} />;',
        'const selected = true; <div className={clsx("p-4", { block: selected })} />;',
        'function Component({ className }: Props) { return <div className={className} />; }',
        'function Component({ className }: Props) { return <div className={`p-4 ${className ?? ""}`} />; }',
        'function Component(props: Props) { return <div className={props.className} />; }',
        'function Component(props: Props) { const className = props.className; return <div className={className} />; }',
        'function Component(props: Props) { const className = props.className; return <div className={cn("p-4", className)} />; }',
        'function Component(props: Props) { const alias = props.className; return <div className={alias} />; }',
        'import styles from "./styles.module.css"; <div className={styles.body} />;',
        'import { clsx as merge } from "clsx"; <div className={merge("p-4")} />;',
        'const title = "Some text"; <div title={title} />;',
        '<div className={["block", "p-4"].join(" ")} />',
        'const visible = true; element.classList.toggle("block", visible);',
    ],
    invalid: [
        {
            code: 'const base = "flex"; element.setAttribute("class", base);',
            errors: [error],
        },
        {
            code: 'const base = "flex"; element.classList.add(base);',
            errors: [error],
        },
        {
            code: 'const base = "flex"; element.classList.toggle(base, visible);',
            errors: [error],
        },
        { code: 'const contextStateClassName = "flex";', errors: [error] },
        {
            code: 'const base = "flex"; <div className={base} />;',
            errors: [error],
        },
        {
            code: 'const base = "flex"; <><div className={base} /><div className={base} /></>;',
            errors: [error],
        },
        {
            code: 'const base = "flex"; <div className={`p-4 ${base}`} />;',
            errors: [error],
        },
        {
            code: 'const base = "flex"; <div className={selected ? base : "hidden"} />;',
            errors: [error],
        },
        {
            code: 'const base = "flex"; <div className={selected && base} />;',
            errors: [error],
        },
        {
            code: 'const base = "flex"; <div className={cn(base, "p-4")} />;',
            errors: [error],
        },
        {
            code: 'const base = "flex"; <div className={cn({ [base]: selected })} />;',
            errors: [error],
        },
        {
            code: 'const base = clsx("flex", selected && "p-4"); <div className={base} />;',
            errors: [error],
        },
        {
            code: 'const base = { body: "flex" }; <div className={base.body} />;',
            errors: [error],
        },
        {
            code: 'const base = ["flex", "p-4"]; <div className={base.join(" ")} />;',
            errors: [error],
        },
        {
            code: 'const props = { className: "p-4" }; <div className={props.className} />;',
            errors: [error],
        },
        {
            code: 'const props = { className: "p-4" }; const className = props.className; <div className={className} />;',
            errors: [error],
        },
        {
            code: 'const compact = "p-2"; cva("base", { variants: { size: { small: compact } } });',
            errors: [error],
        },
        {
            code: 'const compact = "p-2"; cva("base", { compoundVariants: [{ size: "small", class: compact }] });',
            errors: [error],
        },
        {
            code: 'const compact = "p-2"; <div className={clsx({ [compact]: selected })} />;',
            errors: [error],
        },
        {
            code: 'const getStyles = () => "flex"; <div className={getStyles()} />;',
            errors: [error],
        },
        {
            code: 'function getStyles() { return "flex"; } <div className={getStyles()} />;',
            errors: [error],
        },
        {
            code: 'const base = "flex"; element.className = base;',
            errors: [error],
        },
        {
            code: 'const base = "flex"; React.createElement("div", { className: base });',
            errors: [error],
        },
    ],
})
