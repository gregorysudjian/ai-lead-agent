import { describe, expect, it } from "vitest";

import { localizeHoursLine } from "./words";

describe("localizeHoursLine", () => {
  it("leaves English pages alone", () => {
    expect(localizeHoursLine("Monday to Saturday   07:00 - 18:30", "en")).toBe("Monday to Saturday   07:00 - 18:30");
  });

  it("writes parsed hours the Quebec way on a French page", () => {
    expect(localizeHoursLine("Monday to Saturday   07:00 - 18:30", "fr").replace(/\s+/g, " ")).toBe("Lundi au samedi 7 h – 18 h 30");
    expect(localizeHoursLine("Saturday   10:00 - 17:00", "fr").replace(/\s+/g, " ")).toBe("Samedi 10 h – 17 h");
    expect(localizeHoursLine("Friday   09:00 - 12:00, 13:00 - 17:00", "fr").replace(/\s+/g, " ")).toBe("Vendredi 9 h – 12 h, 13 h – 17 h");
  });

  it("never half-translates hours a business wrote in its own words", () => {
    for (const line of ["Open late on Thursdays", "Lun-Ven 9h à 17h", "By appointment only, Monday to Friday", "Mon-Fri: 9am to 5pm"]) {
      expect(localizeHoursLine(line, "fr")).toBe(line);
    }
  });
});
