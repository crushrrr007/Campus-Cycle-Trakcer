export type BikeStatus = "available" | "in-use" | "maintenance"
export type StationStatus = "active" | "low" | "full" | "offline"
export type UserRole = "student" | "admin"

export interface ServiceRecord {
  id: string
  date: string // ISO
  type: string
  notes: string
}

export interface Bike {
  id: string // e.g. NITT-0001
  qr: string // payload encoded in QR
  status: BikeStatus
  stationId: string | null // null when in-use
  usageCount: number
  lastServiceDate: string // ISO
  serviceHistory: ServiceRecord[]
  model: string
  condition: number // 0-100
}

export interface Station {
  id: string // e.g. STN-LIB
  name: string
  shortName: string
  capacity: number
  status: StationStatus
  // map coordinates within a 1000 x 700 viewBox
  x: number
  y: number
  // real-world coordinates (NIT Trichy campus) for the interactive map
  lat: number
  lng: number
  zone: string
}

export interface Ride {
  id: string // RIDE-XXXX
  bikeId: string
  userId: string
  userName: string
  sourceStationId: string
  destStationId: string | null // null while active
  borrowTime: string // ISO
  returnTime: string | null // ISO
  durationMin: number | null
  status: "active" | "completed"
}

export interface AppNotification {
  id: string
  type: "borrow" | "return" | "low-stock" | "full" | "maintenance" | "announcement"
  title: string
  message: string
  time: string // ISO
  read: boolean
}

export type IssueCategory = "brakes" | "tyres" | "chain" | "seat" | "dock" | "other"
export type IssueStatus = "open" | "in-review" | "resolved"

export interface IssueReport {
  id: string // ISS-XXXX
  userId: string
  userName: string
  userEmail: string // rollnumber@nitt.edu for students
  bikeId: string | null
  stationId: string | null
  category: IssueCategory
  description: string
  status: IssueStatus
  createdAt: string // ISO
}

export interface AppUser {
  id: string
  name: string
  email: string
  role: UserRole
  department: string
  avatarFallback: string
}
