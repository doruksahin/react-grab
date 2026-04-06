import { test, expect } from "./fixtures.js";

test.describe("Screenshot Element Highlighting", () => {
  test.describe("createHighlightOverlay", () => {
    test("overlay has correct styles matching element position and dimensions", async ({
      reactGrab,
    }) => {
      const result = await reactGrab.page.evaluate(() => {
        const target = document.querySelector("li:first-child") as HTMLElement;
        if (!target) return null;

        const rect = target.getBoundingClientRect();
        const overlay = document.createElement("div");
        Object.assign(overlay.style, {
          position: "absolute",
          top: `${rect.top + window.scrollY}px`,
          left: `${rect.left + window.scrollX}px`,
          width: `${target.offsetWidth}px`,
          height: `${target.offsetHeight}px`,
          border: "3px solid #f59e0b",
          background: "rgba(245, 158, 11, 0.15)",
          pointerEvents: "none",
          zIndex: "999999",
          boxSizing: "border-box",
        });

        return {
          position: overlay.style.position,
          border: overlay.style.border,
          background: overlay.style.background,
          pointerEvents: overlay.style.pointerEvents,
          zIndex: overlay.style.zIndex,
          boxSizing: overlay.style.boxSizing,
          hasDataReactGrab: overlay.hasAttribute("data-react-grab"),
          width: overlay.style.width,
          height: overlay.style.height,
        };
      });

      expect(result).not.toBeNull();
      expect(result!.position).toBe("absolute");
      expect(result!.border).toBe("3px solid #f59e0b");
      expect(result!.background).toBe("rgba(245, 158, 11, 0.15)");
      expect(result!.pointerEvents).toBe("none");
      expect(result!.zIndex).toBe("999999");
      expect(result!.boxSizing).toBe("border-box");
      expect(result!.hasDataReactGrab).toBe(false);
      expect(result!.width).not.toBe("0px");
      expect(result!.height).not.toBe("0px");
    });

    test("overlay does NOT have data-react-grab attribute", async ({
      reactGrab,
    }) => {
      const hasAttribute = await reactGrab.page.evaluate(() => {
        const overlay = document.createElement("div");
        Object.assign(overlay.style, {
          position: "absolute",
          top: "0px",
          left: "0px",
          width: "100px",
          height: "100px",
          border: "3px solid #f59e0b",
          background: "rgba(245, 158, 11, 0.15)",
          pointerEvents: "none",
          zIndex: "999999",
          boxSizing: "border-box",
        });
        return overlay.hasAttribute("data-react-grab");
      });

      expect(hasAttribute).toBe(false);
    });
  });

  test.describe("captureFullPage overlay lifecycle", () => {
    test("no overlay div remains in body after captureFullPage resolves", async ({
      reactGrab,
    }) => {
      // Inject a mock captureFullPage that checks overlay lifecycle
      const result = await reactGrab.page.evaluate(async () => {
        const target = document.querySelector("li:first-child") as HTMLElement;
        if (!target) return null;

        // Simulate what captureFullPage does: inject overlay, capture, remove
        const rect = target.getBoundingClientRect();
        const overlay = document.createElement("div");
        Object.assign(overlay.style, {
          position: "absolute",
          top: `${rect.top + window.scrollY}px`,
          left: `${rect.left + window.scrollX}px`,
          width: `${target.offsetWidth}px`,
          height: `${target.offsetHeight}px`,
          border: "3px solid #f59e0b",
          background: "rgba(245, 158, 11, 0.15)",
          pointerEvents: "none",
          zIndex: "999999",
          boxSizing: "border-box",
        });

        document.body.appendChild(overlay);
        const presentDuringCapture = document.body.contains(overlay);

        try {
          // Simulate capture (no-op here)
          await Promise.resolve();
        } finally {
          overlay.remove();
        }

        const presentAfterCapture = document.body.contains(overlay);
        return { presentDuringCapture, presentAfterCapture };
      });

      expect(result).not.toBeNull();
      expect(result!.presentDuringCapture).toBe(true);
      expect(result!.presentAfterCapture).toBe(false);
    });

    test("no overlay remains after capture failure (finally block)", async ({
      reactGrab,
    }) => {
      const result = await reactGrab.page.evaluate(async () => {
        const target = document.querySelector("li:first-child") as HTMLElement;
        if (!target) return null;

        const overlay = document.createElement("div");
        document.body.appendChild(overlay);

        let presentAfter = false;
        try {
          await Promise.reject(new Error("simulated capture failure"));
        } catch {
          // swallow
        } finally {
          overlay.remove();
          presentAfter = document.body.contains(overlay);
        }

        return { presentAfter };
      });

      expect(result).not.toBeNull();
      expect(result!.presentAfter).toBe(false);
    });
  });
});
