import { RuleTester } from 'oxlint/plugins-dev'
import { noTailwindImportantRule } from './no-tailwind-important.ts'

const tester = new RuleTester({
    languageOptions: { parserOptions: { lang: 'tsx' } },
})

const error = { messageId: 'important' }

tester.run('dhis2-blocks/no-tailwind-important', noTailwindImportantRule, {
    valid: [
        'const message = "Hello!"; clsx({ block: message });',
        'const message = "Hello!"; element.classList.toggle("block", message);',
        '<div className="sr-only hover:bg-white md:px-4" />',
        '<div className={ready ? "block" : "hidden"} />',
        '<div className={!ready && "hidden"} />',
        '<div className={`px-4 ${ready ? "block" : "hidden"}`} />',
        'const message = "Hello!"; const notEmpty = "!null";',
        '<div title="Warning!" data-query="!null">Hello!</div>',
        'const valid = !disabled; const result = value!;',
        'const styles = { body: "sr-only" }; <div className={styles.body} />;',
        'clsx({ "sr-only": !visible, block: visible });',
        'element.classList.toggle("hidden", !visible);',
        'element.setAttribute("title", "Warning!");',
        '<div className="text-[red] [font:inherit] [&>h3]:m-0" />',
        'const token = "hidden"; function Example() { const token = "block"; return <div className={token} />; }',
        // An unused unrelated variable with the same name is not class data.
        'const token = "Wow!"; function Example() { const token = "block"; return <div className={token} />; }',
        // Cycles must terminate without leaking traversal state between files.
        'let classes = classes;',
    ],
    invalid: [
        { code: 'import merge from "clsx"; merge("p-0!");', errors: [error] },
        {
            code: 'import { twMerge as merge } from "tailwind-merge"; merge("p-0!");',
            errors: [error],
        },
        {
            code: 'const getStyles = () => "p-0!"; <div className={getStyles()} />;',
            errors: [error],
        },
        {
            code: 'function getStyles() { if (ready) return "p-0!"; return "block"; } <div className={getStyles()} />;',
            errors: [error],
        },
        {
            code: 'function getStyles(mode) { switch (mode) { case "compact": return "p-0!"; default: return "p-2"; } } <div className={getStyles(mode)} />;',
            errors: [error],
        },
        { code: '<div className="!flex" />', errors: [error] },
        { code: '<div className="flex!" />', errors: [error] },
        {
            code: '<div className="hover:!bg-white md:hover:bg-white!" />',
            errors: [error, error],
        },
        {
            code: '<div className="[&>h3]:[font-size:16px]!" />',
            errors: [error],
        },
        { code: '<div className="[color:red!important]" />', errors: [error] },
        { code: '<div className="content-[\'!\']" />', errors: [error] },
        { code: '<div class="p-0!" />', errors: [error] },
        { code: '<Component contentClassName="sticky!" />', errors: [error] },
        { code: '<div className={"p-0!"} />', errors: [error] },
        {
            code: '<div className={ready ? "p-0!" : "block"} />',
            errors: [error],
        },
        { code: '<div className={ready && "p-0!"} />', errors: [error] },
        { code: '<div className={custom ?? "p-0!"} />', errors: [error] },
        { code: '<div className={`p-0! ${size}`} />', errors: [error] },
        {
            code: '<div className={`block ${ready ? "p-0!" : "p-1"}`} />',
            errors: [error],
        },
        { code: '<div className={"block " + "!p-0"} />', errors: [error] },
        { code: 'const hiddenClassName = "absolute!";', errors: [error] },
        {
            code: 'const token = "absolute!"; <div className={token} />;',
            errors: [error],
        },
        {
            code: 'const first = "absolute!"; const second = first; <div className={second} />;',
            errors: [error],
        },
        {
            code: 'let token = "block"; token = "absolute!"; <div className={token} />;',
            errors: [error],
        },
        {
            code: 'const classes = "absolute!"; <><div className={classes} /><div className={classes} /></>;',
            errors: [error],
        },
        {
            code: 'const styles = { hidden: "absolute!" }; <div className={styles.hidden} />;',
            errors: [error],
        },
        {
            code: 'const styles = { hidden: "absolute!" }; <div className={styles[key]} />;',
            errors: [error],
        },
        {
            code: 'const props = { className: "absolute!" }; <div {...props} />;',
            errors: [error],
        },
        {
            code: 'React.createElement("div", { className: "p-0!" });',
            errors: [error],
        },
        {
            code: 'clsx("absolute!", { "p-0!": ready });',
            errors: [error, error],
        },
        { code: 'cn(["absolute!", ready && "p-0!"]);', errors: [error, error] },
        { code: 'twMerge("absolute!");', errors: [error] },
        {
            code: 'cva("block", { variants: { size: { small: "p-0!" } } });',
            errors: [error],
        },
        {
            code: 'const tokens = ["absolute!"]; <div className={tokens.join(" ")} />;',
            errors: [error],
        },
        { code: '<div className={"p-0!" as string} />', errors: [error] },
        {
            code: '<div className={"p-0!" satisfies string} />',
            errors: [error],
        },
        { code: 'element.className = "absolute!";', errors: [error] },
        { code: 'element["className"] = "absolute!";', errors: [error] },
        {
            code: 'element.setAttribute("class", "absolute!");',
            errors: [error],
        },
        {
            code: 'element.classList.add("absolute!", "p-0!");',
            errors: [error, error],
        },
        {
            code: 'element.classList.replace("block", "absolute!");',
            errors: [error],
        },
        {
            code: 'element.classList.toggle("absolute!", !visible);',
            errors: [error],
        },
        { code: '<div className={"p-0\\u0021"} />', errors: [error] },
    ],
})
