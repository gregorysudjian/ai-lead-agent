import { describe, expect, it } from "vitest";

import { safeInternalPath } from "./safe-redirect";

describe("safeInternalPath accepts", () => {
  it("an ordinary internal path", () => {
    expect(safeInternalPath("/leads")).toBe("/leads");
  });

  it("a path with a query string and fragment", () => {
    expect(safeInternalPath("/leads?status=new#top")).toBe("/leads?status=new#top");
  });

  it("a nested path", () => {
    expect(safeInternalPath("/leads/abc-123")).toBe("/leads/abc-123");
  });
});

describe("safeInternalPath rejects", () => {
  const fallback = "/";

  it("an absolute URL", () => {
    expect(safeInternalPath("https://evil.example/steal")).toBe(fallback);
    expect(safeInternalPath("http://evil.example")).toBe(fallback);
  });

  it("a scheme-relative URL", () => {
    // The classic open-redirect bypass: browsers read this as absolute.
    expect(safeInternalPath("//evil.example")).toBe(fallback);
    expect(safeInternalPath("//evil.example/leads")).toBe(fallback);
  });

  it("a backslash-prefixed host", () => {
    // Some browsers normalise the backslash to a slash, making this
    // scheme-relative after the fact.
    expect(safeInternalPath("/\\evil.example")).toBe(fallback);
  });

  it("a javascript: URL", () => {
    expect(safeInternalPath("javascript:alert(1)")).toBe(fallback);
  });

  it("a path containing a newline or carriage return", () => {
    expect(safeInternalPath("/leads\nLocation: https://evil.example")).toBe(fallback);
    expect(safeInternalPath("/leads\r\nSet-Cookie: a=b")).toBe(fallback);
  });

  it("a path containing a NUL byte", () => {
    expect(safeInternalPath("/leads\u0000")).toBe(fallback);
  });

  it("a relative path with no leading slash", () => {
    expect(safeInternalPath("leads")).toBe(fallback);
  });

  it("empty and whitespace", () => {
    expect(safeInternalPath("")).toBe(fallback);
    expect(safeInternalPath("   ")).toBe(fallback);
  });

  it("an absurdly long value", () => {
    expect(safeInternalPath(`/${"a".repeat(3000)}`)).toBe(fallback);
  });

  it("non-string input", () => {
    for (const bad of [undefined, null, 42, {}, [], true]) {
      expect(safeInternalPath(bad)).toBe(fallback);
    }
  });

  it("and honours a caller-supplied fallback", () => {
    expect(safeInternalPath("https://evil.example", "/leads")).toBe("/leads");
  });
});
