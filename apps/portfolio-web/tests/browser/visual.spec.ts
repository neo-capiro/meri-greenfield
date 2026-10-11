import { test, expect } from "@playwright/test";
import { installFixtures, clientId } from "./fixtures";
test("representative feature screens render at desktop/mobile and in dark mode", async ({
  page,
}, testInfo) => {
  const unexpected = await installFixtures(page);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const path of [
    "",
    `/${clientId}`,
    `/${clientId}/objectives`,
    `/${clientId}/work`,
    `/${clientId}/relationships`,
    `/${clientId}/capabilities`,
    `/${clientId}/files`,
  ]) {
    const name = path.split("/").pop() || "index";
    await page.goto(`/portfolio${path}`);
    await expect(page.locator("main h1").first()).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    if (path === `/${clientId}`) {
      const pulse = page
        .locator("section")
        .filter({ hasText: "Engagement pulse" })
        .first();
      expect(
        await pulse.evaluate(
          (element) => getComputedStyle(element).backgroundImage,
        ),
      ).toContain("linear-gradient");
      await expect(pulse.getByText("0", { exact: true })).toHaveCount(2);
    }
    await expect(page.getByRole("alert")).toHaveCount(0);
    await expect(page.locator("img")).not.toHaveCount(0);
    expect(
      await page
        .locator("img")
        .evaluateAll((images) =>
          images.every(
            (image) =>
              image instanceof HTMLImageElement &&
              image.complete &&
              image.naturalWidth > 0,
          ),
        ),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(`${name}-desktop.png`),
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    const geometry = await page.evaluate(() => ({
      width: innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      overflow: Array.from(document.querySelectorAll("main *"))
        .filter((element) => element.getBoundingClientRect().right > innerWidth)
        .slice(0, 12)
        .map((element) => ({
          tag: element.tagName,
          className: element.className,
          width: element.getBoundingClientRect().width,
        })),
    }));
    expect(
      geometry.documentWidth,
      JSON.stringify({ path, ...geometry }),
    ).toBeLessThanOrEqual(geometry.width);
    await page.emulateMedia({ colorScheme: "dark" });
    await page.screenshot({
      path: testInfo.outputPath(`${name}-mobile-dark.png`),
      fullPage: true,
    });
    await page.emulateMedia({ colorScheme: "light" });
    await page.setViewportSize({ width: 1440, height: 1040 });
  }
  expect(errors).toEqual([]);
  expect(unexpected).toEqual([]);
});
