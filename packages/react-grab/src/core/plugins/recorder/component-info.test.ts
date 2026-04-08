// packages/react-grab/src/core/plugins/recorder/component-info.test.ts
import { describe, it, expect, vi } from "vitest";
import { createComponentInfoResolver } from "./component-info.js";
import type { SourceInfo } from "../../../types.js";

const makeApi = (impl: () => Promise<SourceInfo | null>) => ({
  getSource: vi.fn(impl),
});

describe("createComponentInfoResolver", () => {
  it("returns component name and file:line for a resolvable element", async () => {
    const api = makeApi(async () => ({
      filePath: "src/components/login-form.tsx",
      lineNumber: 46,
      componentName: "LoginForm",
    }));
    const resolve = createComponentInfoResolver(api);
    const info = await resolve(document.createElement("button"));
    expect(info.component).toBe("LoginForm");
    expect(info.file).toBe("src/components/login-form.tsx:46");
  });

  it("omits the line suffix when lineNumber is null", async () => {
    const api = makeApi(async () => ({
      filePath: "src/foo.tsx",
      lineNumber: null,
      componentName: "Foo",
    }));
    const info = await createComponentInfoResolver(api)(document.createElement("div"));
    expect(info.file).toBe("src/foo.tsx");
  });

  it("returns nulls when getSource returns null", async () => {
    const api = makeApi(async () => null);
    const info = await createComponentInfoResolver(api)(document.createElement("div"));
    expect(info).toEqual({ component: null, file: null });
  });

  it("returns nulls when getSource rejects", async () => {
    const api = makeApi(async () => {
      throw new Error("nope");
    });
    const info = await createComponentInfoResolver(api)(document.createElement("div"));
    expect(info).toEqual({ component: null, file: null });
  });

  it("never produces a file string with a column suffix", async () => {
    const api = makeApi(async () => ({
      filePath: "src/x.tsx",
      lineNumber: 10,
      componentName: "X",
    }));
    const info = await createComponentInfoResolver(api)(document.createElement("div"));
    expect(info.file).not.toMatch(/:\d+:\d+$/); // no col
    expect(info.file).toMatch(/:\d+$/); // line only
  });
});
