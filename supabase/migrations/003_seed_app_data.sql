-- ============================================================================
-- CycleNet — 003: Seed campus stations + bicycle fleet
-- Run AFTER 002_app_schema.sql. Safe to re-run (upserts).
-- ============================================================================

-- ── Stations (real NIT Trichy campus locations) ──────────────────────────────
insert into public.stations (id, name, short_name, capacity, zone, lat, lng, map_x, map_y) values
  ('STN-GATE',     'Main Gate Station',          'Main Gate',      24, 'Entrance',    10.7572, 78.8139, 160, 520),
  ('STN-LIB',      'Central Library Station',    'Library',        20, 'Academic',    10.7585, 78.8166, 588, 662),
  ('STN-OCTAGON',  'Octagon Station',            'Octagon',        22, 'Academic',    10.7601, 78.8163, 596, 446),
  ('STN-LECTURE',  'Lecture Hall Station',       'Lecture Halls',  18, 'Academic',    10.7607, 78.8159, 560, 322),
  ('STN-RUBY',     'Ruby Cycle Parking',         'Ruby Parking',   30, 'Transit Hub', 10.7614, 78.8178, 850, 358),
  ('STN-ZIRCON',   'Zircon Hostels Station',     'Zircon Hostels', 26, 'Residential', 10.7633, 78.8174, 770, 198),
  ('STN-GARNET',   'Garnet Hostels Station',     'Garnet Hostels', 22, 'Residential', 10.7637, 78.8129, 184, 108),
  ('STN-MEGAMESS', 'Mega Mess Station',          'Mega Mess',      16, 'Amenity',     10.7625, 78.8152, 556, 150),
  ('STN-ARCH',     'Architecture Block Station', 'Architecture',   18, 'Academic',    10.7598, 78.8141, 232, 398),
  ('STN-CSE',      'CSE & Applications Station', 'CSE & CA',       20, 'Academic',    10.7589, 78.8170, 700, 600)
on conflict (id) do update set
  name = excluded.name,
  short_name = excluded.short_name,
  capacity = excluded.capacity,
  zone = excluded.zone,
  lat = excluded.lat,
  lng = excluded.lng,
  map_x = excluded.map_x,
  map_y = excluded.map_y;

-- ── Bicycle fleet: 112 bikes distributed across stations ─────────────────────
-- Deterministic distribution; a handful flagged for maintenance.
insert into public.bikes (id, qr, status, station_id, model, condition, usage_count, last_service_date)
select
  bike_id,
  'NITTBIKE:' || bike_id,
  case when n % 17 = 0 then 'maintenance'::public.bike_status
       else 'available'::public.bike_status end,
  (array['STN-GATE','STN-LIB','STN-OCTAGON','STN-LECTURE','STN-RUBY',
         'STN-ZIRCON','STN-GARNET','STN-MEGAMESS','STN-ARCH','STN-CSE'])[(n % 10) + 1],
  (array['NITT Cruiser','Campus Sprint','EcoRide City','TrailMate Lite','UrbanGlide'])[(n % 5) + 1],
  55 + (n * 7) % 45,                            -- condition 55–99
  18 + (n * 13) % 222,                          -- usage 18–239
  now() - ((n % 90) + 1) * interval '1 day'     -- last service 1–90 days ago
from (
  select n, 'NITT-' || lpad(n::text, 4, '0') as bike_id
  from generate_series(1, 112) as n
) t
on conflict (id) do nothing;

-- ── A few service history records for realism ───────────────────────────────
insert into public.service_records (bike_id, type, notes, created_at)
select
  b.id,
  (array['Brake adjustment','Tyre replacement','Chain lube','Gear tuning','Full inspection','Seat repair'])[(row_number() over ()) % 6 + 1],
  'Routine maintenance completed.',
  b.last_service_date
from public.bikes b
where not exists (select 1 from public.service_records s where s.bike_id = b.id);
