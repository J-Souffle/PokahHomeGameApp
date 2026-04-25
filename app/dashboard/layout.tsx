import BottomNav from '@/components/BottomNav'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="pb-24 md:pb-0"> {/* Padding bottom so content doesn't get hidden by Nav */}
      {children}
      <BottomNav />
    </div>
  )
}