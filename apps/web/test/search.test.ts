/** Place search ranking (SPEC P2), on a handful of real places and their informal names. */
import { describe, expect, test } from "vitest";
import { matchPlaces, placeSubtitle, type PlaceOption } from "@/lib/search";

const hood = (name: string, district: string, aliases: string[] = [], pipelineUnits = 0): PlaceOption => ({
  id: name.toLowerCase().replace(/\W+/g, "-"),
  kind: "neighborhood",
  name,
  district,
  aliases,
  pipelineUnits,
});
const center = (name: string, aliases: string[] = []): PlaceOption => ({
  ...hood(name, "Urban Center", aliases),
  kind: "center",
});

const PLACES: PlaceOption[] = [
  hood("Broadway", "Capitol Hill", ["Pike/Pine", "Capitol Hill", "Cap Hill"], 900),
  hood("Stevens", "Capitol Hill", ["Capitol Hill", "Cap Hill", "North Capitol Hill"], 200),
  hood("Montlake", "Capitol Hill", ["North Capitol Hill"]),
  hood("Madison Park", "Capitol Hill", ["Broadmoor"]),
  hood("Genesee", "West Seattle", ["The Junction", "Alaska Junction"]),
  hood("Gatewood", "West Seattle", ["Morgan Junction"]),
  hood("Roosevelt", "Northeast"),
  hood("Ravenna", "Northeast"),
  center("First Hill/Capitol Hill Regional Center", ["Capitol Hill", "Cap Hill"]),
  center("Morgan Junction Urban Center"),
  center("West Seattle Junction Urban Center", ["The Junction"]),
  center("Roosevelt Urban Center"),
];

const names = (q: string) => {
  const m = matchPlaces(q, PLACES);
  return { hoods: m.neighborhoods.map((p) => p.name), centers: m.centers.map((p) => p.name) };
};

describe("matchPlaces", () => {
  test("an informal name finds the places that go by it, not the whole district", () => {
    expect(names("Capitol Hill")).toEqual({ hoods: ["Broadway", "Stevens"], centers: ["First Hill/Capitol Hill Regional Center"] });
    expect(names("cap hill")).toEqual(names("Capitol Hill"));
  });

  test("says which informal name matched", () => {
    const [broadway] = matchPlaces("cap hill", PLACES).neighborhoods;
    expect(placeSubtitle(broadway!)).toBe("Neighborhood · Capitol Hill · also called Cap Hill");
    const [roosevelt] = matchPlaces("roosevelt", PLACES).neighborhoods;
    expect(placeSubtitle(roosevelt!)).toBe("Neighborhood · Northeast");
  });

  test("a district name with no place of its own lists its neighborhoods", () => {
    expect(names("northeast").hoods).toEqual(["Ravenna", "Roosevelt"]);
  });

  test("the junction puts the place called that first", () => {
    expect(names("the junction")).toEqual({ hoods: ["Genesee"], centers: ["West Seattle Junction Urban Center", "Morgan Junction Urban Center"] });
  });

  test("tolerates a typo or two", () => {
    expect(names("roosvelt")).toEqual({ hoods: ["Roosevelt"], centers: ["Roosevelt Urban Center"] });
    expect(names("raveena").hoods).toEqual(["Ravenna"]);
    expect(names("roosvel").hoods).toEqual(["Roosevelt"]);
    expect(names("xyz")).toEqual({ hoods: [], centers: [] });
  });
});
