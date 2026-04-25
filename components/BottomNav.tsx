
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function BottomNav() {
  const pathname = usePathname()
  
  const navItems = [
    { name: 'Join', path: '/dashboard/join', icon: '♣️' },
    { name: 'Live', path: '/dashboard/live', icon: '📊' },
    { name: 'Profile', path: '/dashboard', icon: '👤' },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-zinc-900/80 backdrop-blur-md border-t border-zinc-800 px-6 py-3 pb-8 md:hidden flex justify-between items-center z-50">
      {navItems.map((item) => (
        <Link 
          key={item.path} 
          href={item.path}
          className={`flex flex-col items-center gap-1 transition-all ${
            pathname === item.path ? 'text-yellow-500' : 'text-zinc-500'
          }`}
        >
          <span className="text-xl">{item.icon}</span>
          <span className="text-[10px] font-black uppercase tracking-tighter">{item.name}</span>
        </Link>
      ))}
    </nav>
  )
}