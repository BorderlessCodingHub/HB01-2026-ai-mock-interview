import { describe, expect, it } from "vitest";

import { formatTopicAngleLabel } from "./format-topic-angle";

describe("formatTopicAngleLabel", () => {
  it("joins topic and angle with an em dash", () => {
    expect(formatTopicAngleLabel("caching", "write-path invalidation")).toBe(
      "caching — write-path invalidation",
    );
  });

  it("returns topic only when angle is missing or blank", () => {
    expect(formatTopicAngleLabel("caching")).toBe("caching");
    expect(formatTopicAngleLabel("caching", null)).toBe("caching");
    expect(formatTopicAngleLabel("caching", undefined)).toBe("caching");
    expect(formatTopicAngleLabel("caching", "   ")).toBe("caching");
  });
});
