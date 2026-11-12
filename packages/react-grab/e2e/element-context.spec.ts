import { test, expect } from "./fixtures.js";

test.describe("Element Context Fallback", () => {
  test.describe("React Elements", () => {
    test("should include component names in clipboard for React elements", async ({
      reactGrab,
    }) => {
      await reactGrab.page
        .locator("[data-testid='todo-list'] h1")
        .scrollIntoViewIfNeeded();
      await reactGrab.activate();

      await reactGrab.hoverElement("[data-testid='todo-list'] h1");
      await reactGrab.waitForSelectionBox();
      await reactGrab.clickElement("[data-testid='todo-list'] h1");

      const clipboard = await reactGrab.getClipboardContent();
      expect(clipboard).toContain("TodoList");
    });

    test("should include HTML preview with tag and content", async ({
      reactGrab,
    }) => {
      await reactGrab.page
        .locator("[data-testid='main-title']")
        .scrollIntoViewIfNeeded();
      await reactGrab.activate();

      await reactGrab.hoverElement("[data-testid='main-title']");
      await reactGrab.waitForSelectionBox();
      await reactGrab.clickElement("[data-testid='main-title']");

      const clipboard = await reactGrab.getClipboardContent();
      expect(clipboard).toContain("<h1");
      expect(clipboard).toContain("React Grab");
    });

    test("should include the source owner and selector for deeply nested elements", async ({
      reactGrab,
    }) => {
      await reactGrab.page
        .locator("[data-testid='nested-button']")
        .scrollIntoViewIfNeeded();
      await reactGrab.activate();

      await reactGrab.hoverElement("[data-testid='nested-button']");
      await reactGrab.waitForSelectionBox();
      await reactGrab.clickElement("[data-testid='nested-button']");

      const clipboard = await reactGrab.getClipboardContent();
      expect(clipboard).toContain("DeeplyNested");
      expect(clipboard).toContain("selector:");
      expect(clipboard).toContain('data-testid="nested-button"');
    });
  });

  test.describe("Non-React Elements Fallback", () => {
    test("should fallback to HTML for plain DOM elements without React fiber", async ({
      reactGrab,
    }) => {
      await reactGrab.page.evaluate(() => {
        const plainElement = document.createElement("div");
        plainElement.id = "plain-dom-element";
        plainElement.className = "test-class";
        plainElement.textContent = "Plain DOM content";
        plainElement.style.cssText =
          "position:fixed;left:40%;top:40%;z-index:1000";
        document.body.appendChild(plainElement);
      });

      await reactGrab.page
        .locator("#plain-dom-element")
        .scrollIntoViewIfNeeded();
      await reactGrab.activate();

      await reactGrab.hoverElement("#plain-dom-element");
      await reactGrab.waitForSelectionBox();
      await reactGrab.clickElement("#plain-dom-element");

      const clipboard = await reactGrab.getClipboardContent();
      expect(clipboard).toContain("plain-dom-element");
      expect(clipboard).toContain("Plain DOM content");
    });

    test("should include SVG identity and viewBox context", async ({
      reactGrab,
    }) => {
      await reactGrab.page.evaluate(() => {
        const svgElement = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "svg",
        );
        svgElement.id = "test-svg-icon";
        svgElement.setAttribute("class", "icon-class");
        svgElement.setAttribute("aria-label", "Close the modal dialog");
        svgElement.setAttribute("viewBox", "0 0 24 24");
        svgElement.style.width = "50px";
        svgElement.style.height = "50px";
        document.body.appendChild(svgElement);
      });

      await reactGrab.page.locator("#test-svg-icon").scrollIntoViewIfNeeded();
      await reactGrab.activate();

      await reactGrab.hoverElement("#test-svg-icon");
      await reactGrab.waitForSelectionBox();
      await reactGrab.clickElement("#test-svg-icon");

      const clipboard = await reactGrab.getClipboardContent();
      expect(clipboard).toContain("<svg");
      expect(clipboard).toContain('id="test-svg-icon"');
      expect(clipboard).toContain('class="icon-class"');
      expect(clipboard).toContain('aria-label="Close the modal dialog"');
      expect(clipboard).toContain('viewBox="0 0 24 24"');
      expect(clipboard).toContain("selector: #test-svg-icon");
    });

    test("should truncate long outerHTML to max length", async ({
      reactGrab,
    }) => {
      await reactGrab.page.evaluate(() => {
        const longElement = document.createElement("div");
        longElement.id = "long-dom-element";
        longElement.className = "a".repeat(300);
        longElement.textContent = "b".repeat(300);
        document.body.appendChild(longElement);
      });

      await reactGrab.page
        .locator("#long-dom-element")
        .scrollIntoViewIfNeeded();
      await reactGrab.activate();

      await reactGrab.hoverElement("#long-dom-element");
      await reactGrab.waitForSelectionBox();
      await reactGrab.clickElement("#long-dom-element");

      const clipboard = await reactGrab.getClipboardContent();
      expect(clipboard).toContain("long-dom-element");
      expect(clipboard.length).toBeLessThanOrEqual(510);
    });
  });
});
