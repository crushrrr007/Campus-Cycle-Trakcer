import type { StationStats } from "./store"

// These are station search aliases, not surveyed building coordinates or entrances.
const CAMPUS_AREAS: Record<string, string[]> = {
  "STN-GATE": ["Main entrance", "NITT gate", "Bus stop"],
  "STN-LIB": ["Central Library", "Library", "Sports Complex", "Physical Education", "Swimming pool"],
  "STN-OCTAGON": ["Octagon", "Computer centre", "CEESAT", "Barn Hall", "Electrical and Electronics", "EEE", "Workshop", "Mechanical"],
  "STN-LECTURE": ["Lecture Hall Complex", "LHC", "Management Studies", "DoMS", "Silver Jubilee"],
  "STN-RUBY": ["Ruby Hostel", "Ruby Cycle Parking", "Jade Hostel", "Hospital", "CPWD"],
  "STN-ZIRCON": ["Zircon A Hostel", "Zircon B Hostel", "Zircon C Hostel"],
  "STN-GARNET": ["Garnet A Hostel", "Garnet C Hostel", "Kailash Mess"],
  "STN-MEGAMESS": ["Mega Mess", "Dining", "Food court"],
  "STN-ARCH": ["Architecture", "Orion Lecture Hall", "Chemistry", "Physics", "Golden Jubilee", "MIG Plaza", "NSO Ground"],
  "STN-CSE": ["Computer Science", "CSE", "Computer Applications", "Space Technology", "Instrumentation", "Powder Metallurgy"],
}

export function searchCampusStations(stations: StationStats[], query: string) {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  return stations.flatMap((station) => {
    if (!words.length) return [{ station, landmark: null as string | null }]
    const matches = (value: string) => words.every((word) => value.toLowerCase().includes(word))
    if (matches(`${station.name} ${station.shortName} ${station.zone}`)) return [{ station, landmark: null as string | null }]
    const landmark = CAMPUS_AREAS[station.id]?.find(matches)
    return landmark ? [{ station, landmark }] : []
  })
}
