import { test, expect } from "@playwright/test";
import { clientId, prospectId } from "./fixtures";
import { installGovernmentFixtures } from "./government-fixtures";
test("representative feature screens render at desktop/mobile and in dark mode", async ({
  page,
}, testInfo) => {
  const unexpected = await installGovernmentFixtures(page);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const path of [
    "",
    `/${clientId}`,
    `/${clientId}/objectives`,
    `/${clientId}/work`,
    `/${clientId}/relationships`,
    `/${clientId}/relationships?kind=government`,
    `/${clientId}/capabilities`,
    `/${clientId}/files`,
    `/${clientId}/bills`,
    `/${clientId}/opportunities`,
    "/prospects",
    `/prospects/${prospectId}`,
  ]) {
    const name = path.includes("?kind=government")
      ? "government"
      : path.split("/").pop() || "index";
    await page.goto(`/portfolio${path}`);
    await expect(page.locator("main h1").first()).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    if (path.startsWith(`/${clientId}`)) {
      const action = page.getByRole("button", {
        name: "Meri actions",
        exact: true,
      });
      await expect(action).toBeEnabled();
      expect(
        await action.evaluate(
          (element) => getComputedStyle(element).backgroundImage,
        ),
      ).toContain("linear-gradient");
      const icons = page
        .getByRole("navigation", { name: "Breadcrumb" })
        .locator("img");
      expect(
        await icons.evaluateAll((images) =>
          images.every(
            (element) =>
              element instanceof HTMLImageElement &&
              element.getBoundingClientRect().width === element.naturalWidth &&
              element.getBoundingClientRect().height === element.naturalHeight,
          ),
        ),
      ).toBe(true);
    }
    if (path === `/${clientId}`) {
      // Current Figma 411:47144 uses the card token; the gradient belongs to
      // its latest weekly bar and Meri actions, not the entire pulse surface.
      const pulse = page.getByRole("region", { name: "Engagement pulse" });
      await expect(pulse).toHaveCSS("background-image", "none");
      await expect(pulse).toHaveCSS("background-color", "rgb(255, 255, 255)");
      await expect(pulse).toHaveCSS("padding", "16px 20px");
      await expect(pulse.locator("strong").first().locator("..")).toHaveCSS(
        "background-color",
        "rgb(245, 245, 244)",
      );
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
    if (path === `/${clientId}`) {
      const pulse = page.getByRole("region", { name: "Engagement pulse" });
      await expect(pulse).toHaveCSS("background-color", "rgb(27, 27, 27)");
      await expect(pulse.locator("strong").first().locator("..")).toHaveCSS(
        "background-color",
        "rgb(18, 18, 18)",
      );
    }
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
