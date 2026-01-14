-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Add neighborhood column
ALTER TABLE building_permits ADD COLUMN IF NOT EXISTS neighborhood VARCHAR(255);

-- Create index on neighborhood
CREATE INDEX IF NOT EXISTS neighborhood_idx ON building_permits(neighborhood);

-- Create spatial index on lat/lng for point-in-polygon queries
CREATE INDEX IF NOT EXISTS building_permits_geom_idx ON building_permits 
  USING gist(ST_MakePoint(CAST(longitude AS DOUBLE PRECISION), CAST(latitude AS DOUBLE PRECISION)));
