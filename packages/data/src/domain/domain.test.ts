import { describe, expect, it } from "vitest";
import { classifyHousingType, fromDwellingUnitType, isSitePrepOnly } from "./housing-type";
import { normalizeRecord, parseDate } from "./normalize";
import { classifyStatus, UnknownStatusError } from "./status";

describe("classifyStatus", () => {
  const base = { appliedDate: "2020-01-01", issuedDate: null };

  it("maps done and dead statuses", () => {
    expect(classifyStatus({ ...base, statusCurrent: "Completed" }).statusCategory).toBe("done");
    expect(classifyStatus({ ...base, statusCurrent: "Approved to Occupy" }).statusCategory).toBe("done");
    expect(classifyStatus({ ...base, statusCurrent: "Withdrawn" }).statusCategory).toBe("dead");
  });

  it("treats expired-after-issuance as lapsed, otherwise dead", () => {
    expect(classifyStatus({ ...base, statusCurrent: "Expired", issuedDate: "2021-01-01" }).stage).toBe("lapsed");
    expect(classifyStatus({ ...base, statusCurrent: "Expired" }).stage).toBe("dead");
  });

  it("derives pipeline stage from milestones", () => {
    expect(classifyStatus({ statusCurrent: "Ready for Intake", appliedDate: null, issuedDate: null }).stage).toBe(
      "pre_intake",
    );
    expect(classifyStatus({ ...base, statusCurrent: "Reviews In Process" }).stage).toBe("applied");
    expect(classifyStatus({ ...base, statusCurrent: "Issued", issuedDate: "2021-01-01" }).stage).toBe("issued");
  });

  it("rejects unknown statuses", () => {
    expect(() => classifyStatus({ ...base, statusCurrent: "Teleported" })).toThrow(UnknownStatusError);
  });
});

describe("housing type", () => {
  it("prefers apartments, then townhouses, then ADUs, then detached", () => {
    expect(fromDwellingUnitType("Apartment", 200)).toBe("mf_large");
    expect(fromDwellingUnitType("Apartment, Townhouse", 30)).toBe("mf_mid");
    expect(fromDwellingUnitType("Accessory Dwelling Attached, Townhouse", 4)).toBe("townhouse");
    expect(fromDwellingUnitType("Accessory Dwelling Detached, Detached Single-Family", 2)).toBe("adu");
    expect(fromDwellingUnitType("Detached Single-Family", 1)).toBe("detached");
    expect(fromDwellingUnitType("Accessory Live/Work", 2)).toBeNull();
  });

  it("only classifies building permits that add units", () => {
    const input = {
      permitTypeMapped: "Demolition",
      housingUnitsAdded: 3,
      dwellingUnitType: "Townhouse",
      housingCategory: null,
      permitClass: null,
      description: null,
    };
    expect(classifyHousingType(input)).toBeNull();
    expect(classifyHousingType({ ...input, permitTypeMapped: "Building", housingUnitsAdded: 0 })).toBeNull();
    expect(classifyHousingType({ ...input, permitTypeMapped: "Building" })).toEqual({
      housingType: "townhouse",
      housingTypeSource: "city",
    });
  });

  it("infers from descriptions when the City field is missing", () => {
    const infer = (description: string, units: number, permitClass = "Single Family/Duplex", housingCategory = "Middle Housing") =>
      classifyHousingType({ permitTypeMapped: "Building", housingUnitsAdded: units, dwellingUnitType: null, housingCategory, permitClass, description });
    expect(infer("Construct DADU per plan", 1)).toEqual({ housingType: "adu", housingTypeSource: "inferred" });
    expect(infer("Construct 4-unit townhouse", 4, "Multifamily")?.housingType).toBe("townhouse");
    expect(infer("Construct 7-story apartment building", 120, "Commercial", "N/A")?.housingType).toBe("mf_mid");
  });
});

describe("isSitePrepOnly", () => {
  it("flags shoring and excavation permits but not buildings that include shoring", () => {
    expect(isSitePrepOnly("Shoring and excavation for multi-family residential building  per plan.")).toBe(true);
    expect(isSitePrepOnly("Construct shoring & excavation for new mixed-use high rise building  per plan.")).toBe(true);
    expect(isSitePrepOnly("Excavation  shoring and construction of new apartment building and occupy per plan.")).toBe(false);
    expect(isSitePrepOnly("Establish use as residential and construct new mixed-use building. Shoring is included.")).toBe(false);
  });
});

describe("normalizeRecord", () => {
  it("treats placeholder dates as unknown", () => {
    expect(parseDate("1900-01-01T00:00:00.000")).toBeNull();
    expect(parseDate("2017-05-19T00:00:00.000")).toBe("2017-05-19");
  });

  it("normalizes a source row and derives the project key", () => {
    const row = normalizeRecord({
      ":id": "row-1",
      permitnum: "6079378-CN",
      permittypemapped: "Building",
      permitclass: "Commercial",
      housingunitsadded: "11.0",
      applieddate: "2001-03-27T00:00:00.000",
      issueddate: "2004-05-13T00:00:00.000",
      completeddate: "2008-06-03T00:00:00.000",
      statuscurrent: "Completed",
      latitude: "47.66770262",
      longitude: "-122.37718937",
      dwellingunittype: "Multifamily Non-Ground Level Dwelling",
      development_site: "DV0035920",
      link: { url: "https://example.test/6079378-CN" },
    });
    expect(row).toMatchObject({
      housingUnitsAdded: 11,
      stage: "done",
      housingType: "mf_small",
      projectKey: "DV0035920",
      link: "https://example.test/6079378-CN",
      latitude: 47.66770262,
    });
    expect(row.contentHash).toHaveLength(40);
  });

  it("drops coordinates outside Seattle", () => {
    const row = normalizeRecord({ permitnum: "X", permittypemapped: "Building", latitude: "0", longitude: "0" });
    expect(row.latitude).toBeNull();
    expect(row.projectKey).toBe("X");
  });
});
