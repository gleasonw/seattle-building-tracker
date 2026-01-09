For data fetching, only use react server components, fetching in parent server components and passing data in to client components.

After a large suite of changes, run pnpm tsc to verify

If you need to explore the data directly, feel free to query psql -h localhost -p 5432 -U postgres -d seattle_building, password postgres
