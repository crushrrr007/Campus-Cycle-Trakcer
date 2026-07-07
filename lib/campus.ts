import type { Station } from "./types"

// Coordinate space for the campus map SVG (10:7 to match the map card aspect).
export const MAP_W = 1000
export const MAP_H = 700

export type BuildingShape = "rect" | "octagon" | "circle" | "cross"

export interface Building {
  id: string
  name: string
  short: string
  x: number
  y: number
  w: number
  h: number
  kind: "academic" | "residential" | "admin" | "amenity" | "sports" | "gate"
  shape?: BuildingShape
  /** hide label for tiny structures */
  noLabel?: boolean
}

// Layout modelled on the real NIT Trichy campus (Tiruchirappalli).
export const BUILDINGS: Building[] = [
  // ── Residential — gem-named hostels (north + east) ──
  { id: "garnet-a", name: "Garnet A Hostel", short: "Garnet A", x: 40, y: 54, w: 122, h: 58, kind: "residential" },
  { id: "garnet-c", name: "Garnet C Hostel", short: "Garnet C", x: 44, y: 138, w: 110, h: 52, kind: "residential" },
  { id: "zircon-c", name: "Zircon C Hostel", short: "Zircon C", x: 658, y: 42, w: 120, h: 62, kind: "residential" },
  { id: "zircon-b", name: "Zircon B Hostel", short: "Zircon B", x: 800, y: 42, w: 110, h: 62, kind: "residential" },
  { id: "zircon-a", name: "Zircon A Hostel", short: "Zircon A", x: 740, y: 138, w: 122, h: 52, kind: "residential" },
  { id: "jade", name: "Jade Hostel", short: "Jade", x: 868, y: 210, w: 106, h: 56, kind: "residential" },

  // ── Messes & food courts ──
  { id: "mega-mess", name: "Mega Mess", short: "Mega Mess", x: 408, y: 90, w: 112, h: 64, kind: "amenity" },
  { id: "kailash", name: "Kailash Mess", short: "Kailash Mess", x: 198, y: 64, w: 92, h: 46, kind: "amenity" },

  // ── Admin & health (north-east) ──
  { id: "hospital", name: "NITT Hospital", short: "Hospital", x: 864, y: 82, w: 110, h: 58, kind: "admin" },
  { id: "cpwd", name: "CPWD Office", short: "CPWD", x: 718, y: 212, w: 88, h: 42, kind: "admin" },

  // ── Academic west ──
  { id: "chemistry", name: "Department of Chemistry", short: "Chemistry", x: 40, y: 268, w: 92, h: 56, kind: "academic" },
  { id: "physics", name: "Physics Department", short: "Physics", x: 40, y: 344, w: 82, h: 48, kind: "academic" },
  { id: "architecture", name: "Department of Architecture", short: "Architecture", x: 116, y: 318, w: 90, h: 90, kind: "academic", shape: "circle" },
  { id: "orion", name: "Orion Lecture Hall", short: "Orion Hall", x: 74, y: 422, w: 104, h: 80, kind: "academic", shape: "octagon" },
  { id: "golden-jubilee", name: "Golden Jubilee Convention Hall", short: "Golden Jubilee Hall", x: 274, y: 304, w: 54, h: 162, kind: "academic" },
  { id: "mig-plaza", name: "MIG Plaza", short: "MIG Plaza", x: 196, y: 476, w: 66, h: 36, kind: "amenity" },

  // ── Center ──
  { id: "ceesat-bldg", name: "CEESAT Building", short: "CEESAT", x: 402, y: 414, w: 104, h: 54, kind: "academic" },
  { id: "barn-hall", name: "Barn Hall", short: "Barn Hall", x: 452, y: 490, w: 92, h: 48, kind: "academic" },

  // ── Academic core (center-east) ──
  { id: "management", name: "Department of Management Studies", short: "Management", x: 598, y: 288, w: 116, h: 54, kind: "academic" },
  { id: "silver-jubilee", name: "Silver Jubilee Building", short: "Silver Jubilee", x: 734, y: 288, w: 88, h: 54, kind: "academic" },
  { id: "lecture-complex", name: "Lecture Hall Complex", short: "Lecture Halls", x: 518, y: 350, w: 108, h: 60, kind: "academic" },
  { id: "octagon", name: "Octagon", short: "Octagon", x: 610, y: 384, w: 94, h: 94, kind: "academic", shape: "octagon" },
  { id: "powder-met", name: "Powder Metallurgy", short: "Powder Met.", x: 722, y: 380, w: 88, h: 46, kind: "academic" },
  { id: "instrumentation", name: "Instrumentation Dept.", short: "Instrumentation", x: 742, y: 450, w: 98, h: 50, kind: "academic" },
  { id: "cse", name: "Computer Science & Applications", short: "CSE & CA", x: 648, y: 520, w: 126, h: 52, kind: "academic" },
  { id: "eee", name: "Electrical & Electronics Engg.", short: "EEE", x: 430, y: 548, w: 96, h: 46, kind: "academic" },
  { id: "workshop", name: "Workshop & Mechanical Block", short: "Workshop", x: 404, y: 596, w: 118, h: 44, kind: "academic" },
  { id: "space-tech", name: "Space Technology Incubation", short: "Space Tech", x: 792, y: 528, w: 108, h: 52, kind: "amenity" },

  // ── South: library & sports ──
  { id: "library", name: "Central Library", short: "Central Library", x: 540, y: 540, w: 96, h: 96, kind: "academic", shape: "cross" },
  { id: "sports-complex", name: "Sports Complex", short: "Sports Complex", x: 676, y: 498, w: 90, h: 44, kind: "sports" },
  { id: "phys-edu", name: "Department of Physical Education", short: "Phys. Edu", x: 40, y: 544, w: 84, h: 42, kind: "sports" },

  // ── Gate ──
  { id: "gate", name: "NITT Main Gate", short: "Main Gate", x: 30, y: 624, w: 104, h: 42, kind: "gate" },
]

// Large open grounds. tone: "dirt" for bare ground, "turf" for fields.
export const FIELDS: { id: string; x: number; y: number; w: number; h: number; tone: "dirt" | "turf"; label?: string }[] = [
  { id: "ceesat-ground", x: 398, y: 298, w: 162, h: 98, tone: "dirt", label: "Ceesat Ground" },
]

// NSO oval running track (outer ring + inner turf).
export const TRACK = { cx: 260, cy: 602, rx: 122, ry: 60, innerRx: 90, innerRy: 36, label: "NSO Ground" }

// Swimming pool & courts (south sports cluster).
export const WATER: { x: number; y: number; w: number; h: number }[] = [{ x: 688, y: 590, w: 62, h: 28 }]
export const COURTS: { x: number; y: number; w: number; h: number }[] = [
  { x: 760, y: 584, w: 38, h: 30 },
  { x: 804, y: 584, w: 38, h: 30 },
]

// Highway: NH-83 (Thanjavur Rd) skirting the campus along the south-west.
export const HIGHWAY = "M -30 654 L 300 696 L 720 686 L 1030 696"

// Main internal roads.
export const ROADS: string[] = [
  // Gate → south-west junction
  "M 84 624 L 160 600 L 300 560",
  // West loop up to academic west
  "M 300 560 L 220 470 L 180 360 L 162 300",
  // SW junction → central junction
  "M 300 560 L 392 482 L 470 440",
  // Central spine south→north
  "M 470 440 L 470 200",
  // North hostel road (Amethyst Hostel Rd)
  "M 160 200 L 470 200 L 658 176 L 980 152",
  // Mega Mess spur
  "M 470 200 L 470 156",
  // Central junction → east junction
  "M 480 432 L 620 350 L 768 300",
  // East junction → east hostels
  "M 768 300 L 850 220 L 904 152",
  // East academic ring
  "M 478 440 L 560 520 L 660 548 L 732 556",
  // East ring → CSE / space tech
  "M 732 556 L 852 560 L 944 576",
  // East ring → octagon / powder met
  "M 732 556 L 700 460 L 690 430",
  // South road → library & sports
  "M 300 560 L 470 600 L 588 600 L 676 580",
  // Library → pool
  "M 638 588 L 692 592",
]

// Roundabouts at major junctions.
export const ROUNDABOUTS: { x: number; y: number; r: number }[] = [
  { x: 300, y: 560, r: 17 },
  { x: 470, y: 434, r: 15 },
  { x: 470, y: 200, r: 15 },
  { x: 768, y: 300, r: 15 },
  { x: 732, y: 556, r: 15 },
]

// Eastern staff-residential street grid.
export const GRID_STREETS: string[] = [
  "M 904 356 L 904 624",
  "M 950 356 L 950 624",
  "M 996 356 L 996 624",
  "M 880 420 L 1016 420",
  "M 880 500 L 1016 500",
  "M 880 580 L 1016 580",
]

export const PEDESTRIAN_PATHS: string[] = [
  "M 470 434 L 588 540",
  "M 162 363 L 126 462",
  "M 657 431 L 588 540",
  "M 260 540 L 228 494",
]

// Forest / green land (NIT Trichy is heavily wooded). Drawn behind everything.
export const FOREST: { x: number; y: number; w: number; h: number }[] = [
  { x: -40, y: 20, w: 150, h: 660 },
  { x: 150, y: 196, w: 120, h: 86 },
  { x: 296, y: 188, w: 100, h: 96 },
  { x: 540, y: 188, w: 120, h: 86 },
  { x: 560, y: 420, w: 120, h: 70 },
  { x: 836, y: 360, w: 200, h: 300 },
  { x: 540, y: 56, w: 110, h: 72 },
]

// Scattered tree canopy dots.
export const TREES: { x: number; y: number }[] = [
  { x: 30, y: 120 }, { x: 60, y: 220 }, { x: 90, y: 320 }, { x: 40, y: 460 },
  { x: 70, y: 560 }, { x: 200, y: 230 }, { x: 250, y: 250 }, { x: 320, y: 220 },
  { x: 350, y: 250 }, { x: 580, y: 220 }, { x: 620, y: 240 }, { x: 600, y: 130 },
  { x: 560, y: 90 }, { x: 600, y: 450 }, { x: 640, y: 470 }, { x: 870, y: 320 },
  { x: 920, y: 400 }, { x: 970, y: 460 }, { x: 900, y: 540 }, { x: 960, y: 600 },
  { x: 200, y: 620 }, { x: 320, y: 650 }, { x: 560, y: 660 }, { x: 690, y: 650 },
  { x: 820, y: 640 }, { x: 360, y: 540 }, { x: 168, y: 540 },
]

// Base station definitions. Live availability is computed in the store.
export const STATION_DEFS: Omit<Station, "status">[] = [
  { id: "STN-GATE", name: "Main Gate Station", shortName: "Main Gate", capacity: 24, x: 160, y: 520, lat: 10.7572, lng: 78.8139, zone: "Entrance" },
  { id: "STN-LIB", name: "Central Library Station", shortName: "Library", capacity: 20, x: 588, y: 662, lat: 10.7585, lng: 78.8166, zone: "Academic" },
  { id: "STN-OCTAGON", name: "Octagon Station", shortName: "Octagon", capacity: 22, x: 596, y: 446, lat: 10.7601, lng: 78.8163, zone: "Academic" },
  { id: "STN-LECTURE", name: "Lecture Hall Station", shortName: "Lecture Halls", capacity: 18, x: 560, y: 322, lat: 10.7607, lng: 78.8159, zone: "Academic" },
  { id: "STN-RUBY", name: "Ruby Cycle Parking", shortName: "Ruby Parking", capacity: 30, x: 850, y: 358, lat: 10.7614, lng: 78.8178, zone: "Transit Hub" },
  { id: "STN-ZIRCON", name: "Zircon Hostels Station", shortName: "Zircon Hostels", capacity: 26, x: 770, y: 198, lat: 10.7633, lng: 78.8174, zone: "Residential" },
  { id: "STN-GARNET", name: "Garnet Hostels Station", shortName: "Garnet Hostels", capacity: 22, x: 184, y: 108, lat: 10.7637, lng: 78.8129, zone: "Residential" },
  { id: "STN-MEGAMESS", name: "Mega Mess Station", shortName: "Mega Mess", capacity: 16, x: 556, y: 150, lat: 10.7625, lng: 78.8152, zone: "Amenity" },
  { id: "STN-ARCH", name: "Architecture Block Station", shortName: "Architecture", capacity: 18, x: 232, y: 398, lat: 10.7598, lng: 78.8141, zone: "Academic" },
  { id: "STN-CSE", name: "CSE & Applications Station", shortName: "CSE & CA", capacity: 20, x: 700, y: 600, lat: 10.7589, lng: 78.8170, zone: "Academic" },
]
