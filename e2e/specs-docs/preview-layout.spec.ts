import { expect, test } from './fixtures'

declare global {
    interface Window {
        docsPreviewHeights: number[][]
    }
}

for (const width of [390, 960, 1600]) {
    for (const delayedFonts of [false, true]) {
        test(`keeps previews stable at ${width}px with ${delayedFonts ? 'delayed' : 'normal'} fonts`, async ({
            page,
        }) => {
            await page.setViewportSize({ width, height: 900 })

            let releaseBackend = () => {}
            let releaseFonts = () => {}
            const backendReady = new Promise<void>((resolve) => {
                releaseBackend = resolve
            })
            const fontsReady = new Promise<void>((resolve) => {
                releaseFonts = resolve
            })

            await page.route('**/dhis2/**', async (route) => {
                await backendReady
                await route.continue()
            })
            if (delayedFonts) {
                await page.route('**/*.woff2', async (route) => {
                    await fontsReady
                    // Miss font-display's first-paint window deliberately.
                    await new Promise((resolve) => setTimeout(resolve, 300))
                    await route.continue()
                })
            }

            await page.addInitScript(() => {
                const samples: number[][] = []
                window.docsPreviewHeights = samples
                const sample = () => {
                    const heights = Array.from(
                        document.querySelectorAll('.docs-preview-surface'),
                        (surface) => surface.getBoundingClientRect().height
                    )
                    if (
                        heights.length === 2 &&
                        heights.every((height) => height > 0) &&
                        heights.some(
                            (height, index) =>
                                height !== samples.at(-1)?.[index]
                        )
                    ) {
                        samples.push(heights)
                    }
                    requestAnimationFrame(sample)
                }
                requestAnimationFrame(sample)
            })

            try {
                await page.goto('/blocks/working-list')
                await expect(
                    page.locator('.docs-preview-surface [aria-busy="true"]')
                ).toHaveCount(2)
                // Measure a painted fallback before the font response arrives.
                await page.evaluate(
                    () =>
                        new Promise<void>((resolve) =>
                            requestAnimationFrame(() =>
                                requestAnimationFrame(() => resolve())
                            )
                        )
                )
                releaseFonts()
                await page.evaluate(() => document.fonts.ready.then(() => {}))
                releaseBackend()

                const surfaces = page.locator('.docs-preview-surface')
                for (const surface of await surfaces.all()) {
                    await expect(
                        surface.locator('[data-testid^="working-list-row-"]')
                    ).toHaveCount(10, { timeout: 30_000 })
                    await expect(
                        surface.getByTestId('working-list-table-scroll')
                    ).toHaveCSS('overflow-x', 'scroll')
                }

                const samples = await page.evaluate(
                    () => window.docsPreviewHeights
                )
                expect(samples.length).toBeGreaterThan(0)
                for (const index of [0, 1]) {
                    const heights = samples.map((sample) => sample[index])
                    expect(
                        Math.max(...heights) - Math.min(...heights),
                        JSON.stringify(samples)
                    ).toBeLessThanOrEqual(1)
                }
            } finally {
                releaseFonts()
                releaseBackend()
            }
        })
    }
}
