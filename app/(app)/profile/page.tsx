import { PageHeader } from "@/components/page-header"
import { ProfileView } from "@/components/profile/profile-view"

export default function ProfilePage() {
  return (
    <>
      <PageHeader
        title="Profile"
        description="Your account, riding stats, and recent activity at a glance."
      />
      <ProfileView />
    </>
  )
}
