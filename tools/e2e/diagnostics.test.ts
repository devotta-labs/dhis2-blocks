import assert from 'node:assert/strict'
import { test } from 'node:test'
import { chromium } from '@playwright/test'
import {
    withBrowserDiagnostics,
    type BrowserDiagnostic,
} from '../../e2e/fixtures/browser-diagnostics.ts'
import { unexpectedWebDiagnostics } from '../../e2e/fixtures/web-diagnostic-policy.ts'
import { unexpectedDocsDiagnostics } from '../../e2e/specs-docs/diagnostic-policy.ts'

const defaults = {
    allowOfflineRequestFailures: false,
    allowSharingTypeWarning: false,
}
const diagnostic = (
    overrides: Partial<BrowserDiagnostic>
): BrowserDiagnostic => ({
    kind: 'http',
    message: 'Unauthorized',
    status: 401,
    url: 'http://localhost/dhis2/api/me',
    ...overrides,
})

test('host policies distinguish bootstrap 401s from application errors', () => {
    const bootstrap = diagnostic({})
    const application = diagnostic({
        url: 'http://localhost/dhis2/api/tracker/events',
    })
    assert.deepEqual(unexpectedDocsDiagnostics([bootstrap, application]), [
        application,
    ])
    assert.deepEqual(
        unexpectedWebDiagnostics([bootstrap, application], defaults),
        [bootstrap, application]
    )
    for (const error of [
        diagnostic({ kind: 'pageerror' }),
        diagnostic({ status: 500 }),
        diagnostic({ kind: 'console', message: 'unrelated error' }),
    ]) {
        assert.deepEqual(unexpectedDocsDiagnostics([error]), [error])
        assert.deepEqual(unexpectedWebDiagnostics([error], defaults), [error])
    }
})

test('docs pairs console aborts only with aborted bootstrap GETs, irrespective of event order', () => {
    const aborted = diagnostic({
        kind: 'requestfailed',
        method: 'GET',
        message: 'net::ERR_ABORTED',
    })
    const consoleAbort = diagnostic({
        kind: 'console',
        message: 'AbortError: signal is aborted',
    })
    const excess = { ...consoleAbort }
    assert.deepEqual(unexpectedDocsDiagnostics([consoleAbort, aborted]), [])
    assert.deepEqual(
        unexpectedDocsDiagnostics([consoleAbort, excess, aborted]),
        [excess]
    )
    assert.deepEqual(unexpectedDocsDiagnostics([consoleAbort]), [consoleAbort])
    const post = { ...aborted, method: 'POST' }
    assert.deepEqual(unexpectedDocsDiagnostics([consoleAbort, post]), [
        consoleAbort,
        post,
    ])
})

test('tracker cancellation is narrow and never grants a console abort allowance', () => {
    const aborted = diagnostic({
        kind: 'requestfailed',
        method: 'GET',
        message: 'net::ERR_ABORTED',
        url: 'http://localhost/api/43/tracker/events',
    })
    assert.deepEqual(unexpectedDocsDiagnostics([aborted]), [])
    assert.deepEqual(unexpectedWebDiagnostics([aborted], defaults), [])
    for (const other of [
        { ...aborted, method: 'POST' },
        { ...aborted, url: 'http://localhost/api/programs' },
    ]) {
        assert.deepEqual(unexpectedDocsDiagnostics([other]), [other])
        assert.deepEqual(unexpectedWebDiagnostics([other], defaults), [other])
    }
})

test('offline failures require opt-in and the ping endpoint', () => {
    const offline = diagnostic({
        kind: 'requestfailed',
        message: 'net::ERR_INTERNET_DISCONNECTED',
        url: 'http://localhost/api/ping',
    })
    assert.deepEqual(unexpectedWebDiagnostics([offline], defaults), [offline])
    assert.deepEqual(
        unexpectedWebDiagnostics([offline], {
            ...defaults,
            allowOfflineRequestFailures: true,
        }),
        []
    )
    const other = { ...offline, url: 'http://localhost/api/tracker/events' }
    assert.deepEqual(
        unexpectedWebDiagnostics([other], {
            ...defaults,
            allowOfflineRequestFailures: true,
        }),
        [other]
    )
    assert.deepEqual(unexpectedDocsDiagnostics([offline]), [offline])
})

test('only the two known sharing prop warnings can be opted in', () => {
    for (const component of ['SharingDialog', 'TabbedContent']) {
        const warning = diagnostic({
            kind: 'console',
            message: `Warning: Failed prop type: Invalid prop \`type\` of value \`trackedEntityInstanceFilter\` supplied to \`${component}\`, expected one of ["trackedEntityFilter"].`,
        })
        assert.deepEqual(unexpectedWebDiagnostics([warning], defaults), [
            warning,
        ])
        assert.deepEqual(
            unexpectedWebDiagnostics([warning], {
                ...defaults,
                allowSharingTypeWarning: true,
            }),
            []
        )
        for (const message of [
            warning.message.replace('`type`', '`id`'),
            warning.message.replace(component, 'OtherDialog'),
            warning.message.replace(
                '`trackedEntityInstanceFilter`',
                '`unexpectedType`'
            ),
        ]) {
            const other = { ...warning, message }
            assert.deepEqual(
                unexpectedWebDiagnostics([other], {
                    ...defaults,
                    allowSharingTypeWarning: true,
                }),
                [other]
            )
        }
    }
})

test('real page listeners detach on success, setup failure and diagnostics failure; both hosts retain failure evidence', async () => {
    const browser = await chromium.launch()
    try {
        for (const unexpected of [
            unexpectedDocsDiagnostics,
            (batch: BrowserDiagnostic[]) =>
                unexpectedWebDiagnostics(batch, defaults),
        ]) {
            const page = await browser.newPage()
            const attachments: string[] = []
            const testInfo = {
                status: 'passed' as const,
                expectedStatus: 'passed' as const,
                attach: async (
                    _name: string,
                    attachment: { body?: string | Buffer }
                ) => {
                    attachments.push(String(attachment.body))
                },
            }
            const events = ['console', 'pageerror', 'requestfailed', 'response']
            // SAFETY: Playwright's Page inherits its EventEmitter at runtime;
            // the public type omits listenerCount, used only to check ownership.
            const emitter = page as typeof page & {
                listenerCount(event: string): number
            }
            const before = events.map((event) => emitter.listenerCount(event))
            await withBrowserDiagnostics({
                page,
                testInfo,
                unexpected,
                run: async () => {},
            })
            assert.deepEqual(
                events.map((event) => emitter.listenerCount(event)),
                before
            )
            assert.deepEqual(attachments, [])
            await assert.rejects(
                withBrowserDiagnostics({
                    page,
                    testInfo,
                    unexpected,
                    run: async () => {
                        throw new Error('startup failed')
                    },
                }),
                /startup failed/
            )
            assert.deepEqual(JSON.parse(attachments.pop()!), {
                unexpected: [],
                allowlisted: [],
            })
            assert.deepEqual(
                events.map((event) => emitter.listenerCount(event)),
                before
            )
            await assert.rejects(
                withBrowserDiagnostics({
                    page,
                    testInfo,
                    unexpected,
                    run: async () => {
                        const logged = page.waitForEvent('console')
                        await page.evaluate(() =>
                            console.error('unrelated runtime error')
                        )
                        await logged
                    },
                }),
                /unrelated runtime error/
            )
            assert.equal(JSON.parse(attachments.pop()!).unexpected.length, 1)
            assert.deepEqual(
                events.map((event) => emitter.listenerCount(event)),
                before
            )
            await withBrowserDiagnostics({
                page,
                testInfo: { ...testInfo, status: 'failed' },
                unexpected,
                run: async () => {},
            })
            assert.equal(attachments.length, 1)
            await page.close()
        }
    } finally {
        await browser.close()
    }
})

test('the collector retains allowed sharing evidence and records every browser failure channel', async () => {
    const browser = await chromium.launch()
    try {
        const page = await browser.newPage()
        const attachments: string[] = []
        const testInfo = {
            status: 'passed' as const,
            expectedStatus: 'passed' as const,
            attach: async (
                _name: string,
                attachment: { body?: string | Buffer }
            ) => {
                attachments.push(String(attachment.body))
            },
        }
        await withBrowserDiagnostics({
            page,
            testInfo,
            unexpected: (batch) =>
                unexpectedWebDiagnostics(batch, {
                    ...defaults,
                    allowSharingTypeWarning: true,
                }),
            run: async () => {
                const logged = page.waitForEvent('console')
                await page.evaluate(() =>
                    console.error(
                        'Invalid prop `type` of value `trackedEntityInstanceFilter` supplied to `SharingDialog`, expected one of ["trackedEntityFilter"].'
                    )
                )
                await logged
            },
        })
        const allowed = JSON.parse(attachments.pop()!)
        assert.deepEqual(allowed.unexpected, [])
        assert.equal(allowed.allowlisted.length, 1)

        await page.route('http://fixture.test/**', async (route) => {
            if (route.request().url().endsWith('/failed'))
                await route.abort('failed')
            else
                await route.fulfill({
                    status: 500,
                    body: 'server failure',
                    headers: { 'Access-Control-Allow-Origin': '*' },
                })
        })
        await assert.rejects(
            withBrowserDiagnostics({
                page,
                testInfo,
                unexpected: (batch) =>
                    unexpectedWebDiagnostics(batch, defaults),
                run: async () => {
                    const errored = page.waitForEvent('pageerror')
                    await page.evaluate(() => {
                        setTimeout(() => {
                            throw new Error('page crashed')
                        }, 0)
                    })
                    await errored
                    const response = page.waitForResponse(
                        'http://fixture.test/error'
                    )
                    await page.evaluate(() =>
                        fetch('http://fixture.test/error')
                    )
                    await response
                    const failed = page.waitForEvent('requestfailed')
                    await page.evaluate(() =>
                        fetch('http://fixture.test/failed').catch(
                            () => undefined
                        )
                    )
                    await failed
                },
            }),
            /Unexpected browser\/network diagnostics/
        )
        const errors: BrowserDiagnostic[] = JSON.parse(
            attachments.pop()!
        ).unexpected
        assert.deepEqual(
            new Set(errors.map(({ kind }) => kind)),
            new Set(['console', 'pageerror', 'requestfailed', 'http'])
        )
    } finally {
        await browser.close()
    }
})
