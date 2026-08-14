import { describe, expect, it } from "vitest";

import { toDisplayTurns } from "./display-turns";

describe("toDisplayTurns", () => {
  it("maps the automatic ready message to turn 0 of the user-selected length", () => {
    expect(toDisplayTurns(1, 6)).toEqual({ turnCount: 0, maxTurns: 5 });
  });

  it("maps a finished entry session to 5 / 5", () => {
    expect(toDisplayTurns(6, 6)).toEqual({ turnCount: 5, maxTurns: 5 });
  });

  it("keeps a session that has not started at 0 / user turns", () => {
    expect(toDisplayTurns(0, 6)).toEqual({ turnCount: 0, maxTurns: 5 });
  });
});
