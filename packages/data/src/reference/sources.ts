/**
 * Where the place boundaries come from (SPEC P5). The same record is kept in each GeoJSON
 * file's top-level "source" member; update both when re-downloading a layer.
 */
export const BOUNDARY_SOURCES = {
  neighborhoods: {
    name: "Neighborhood Map Atlas Neighborhoods",
    publisher: "City of Seattle, Office of the City Clerk",
    item: "https://data-seattlecitygis.opendata.arcgis.com/datasets/b4a142f592e94d39a3bf787f3c112c1d",
    url: "https://services.arcgis.com/ZOyb2t4B0UYuYNYH/arcgis/rest/services/nma_nhoods_sub/FeatureServer/0",
    retrieved: "2026-11-22",
    note: "The atlas's smallest neighborhoods (94). They cover the city with no overlaps.",
  },
  centers: {
    name: "Centers Boundaries 2044",
    publisher: "City of Seattle, Office of Planning and Community Development (Comprehensive Plan, Ord. 127375, effective 2026-01-21)",
    item: "https://data-seattlecitygis.opendata.arcgis.com/datasets/61fbadcc0b5247ec8b5c2fad0fe329e1",
    url: "https://services.arcgis.com/ZOyb2t4B0UYuYNYH/arcgis/rest/services/Centers_Boundaries_2044/FeatureServer/0",
    retrieved: "2026-11-22",
    note: "Regional, Urban and Neighborhood Centers, which replaced the 2035 plan's urban centers and villages. Manufacturing/industrial centers are left out.",
  },
} as const;
