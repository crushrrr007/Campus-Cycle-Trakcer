import {
  Bike,
  LayoutDashboard,
  Map,
  QrCode,
  Route,
  FileBarChart,
  MapPin,
  UserRound,
  Wrench,
  type LucideIcon,
} from "lucide-react"
import type { UserRole } from "./types"

export interface NavItem {
  title: string
  href: string
  icon: LucideIcon
  roles: UserRole[]
  group: "Overview" | "Operations" | "Personal"
}

export const NAV_ITEMS: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ["student", "admin"], group: "Overview" },
  { title: "Campus Map", href: "/map", icon: Map, roles: ["student", "admin"], group: "Overview" },
  { title: "Scan & Ride", href: "/scan", icon: QrCode, roles: ["student"], group: "Personal" },
  { title: "My Rides", href: "/rides", icon: Route, roles: ["student"], group: "Personal" },
  { title: "Report Issue", href: "/report", icon: Wrench, roles: ["student"], group: "Personal" },
  { title: "Profile", href: "/profile", icon: UserRound, roles: ["student"], group: "Personal" },
  { title: "Bicycles", href: "/bikes", icon: Bike, roles: ["admin"], group: "Operations" },
  { title: "Stations", href: "/stations", icon: MapPin, roles: ["admin"], group: "Operations" },
  { title: "Ride History", href: "/rides", icon: Route, roles: ["admin"], group: "Operations" },
  { title: "Issues", href: "/issues", icon: Wrench, roles: ["admin"], group: "Operations" },
  { title: "Reports", href: "/reports", icon: FileBarChart, roles: ["admin"], group: "Operations" },
]

export const GROUP_ORDER: NavItem["group"][] = ["Overview", "Operations", "Personal"]
