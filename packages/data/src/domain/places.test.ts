import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildPlaces, slugify, type AliasFile } from "./places";

const read = (name: string) =>
  JSON.parse(readFileSync(fileURLToPath(new URL(`../../data/${name}`, import.meta.url)), "utf8"));

describe("places", () => {
  const rows = buildPlaces(read("neighborhoods.geojson").features, read("centers.geojson").features, read("place-aliases.json"));

  it("slugifies names into readable URLs", () => {
    expect(slugify("Harrison/Denny-Blaine")).toBe("harrison-denny-blaine");
    expect(slugify("Roosevelt Urban Center")).toBe("roosevelt-urban-center");
  });

  it("loads every atlas neighborhood and the Comprehensive Plan centers", () => {
    expect(rows.filter((r) => r.kind === "neighborhood")).toHaveLength(94);
    expect(rows.find((r) => r.id === "roosevelt")?.kind).toBe("neighborhood");
    expect(rows.find((r) => r.id === "roosevelt-urban-center")?.kind).toBe("center");
  });

  it("knows common informal names", () => {
    const named = (alias: string) => rows.filter((r) => r.aliases.includes(alias)).map((r) => r.id);
    expect(named("U District")).toEqual(expect.arrayContaining(["university-district", "university-district-regional-center"]));
    expect(named("The Junction")).toEqual(expect.arrayContaining(["genesee", "west-seattle-junction-urban-center"]));
    expect(named("Capitol Hill")).toContain("broadway");
  });

  it("rejects aliases for places that don't exist", () => {
    const aliases: AliasFile = { neighborhoods: { Atlantis: ["Lost City"] }, centers: {} };
    expect(() => buildPlaces([], [], aliases)).toThrow(/Atlantis/);
  });
});
