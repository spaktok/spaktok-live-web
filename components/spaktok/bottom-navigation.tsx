'use client'

import { Home, Compass, Plus, MessageCircle, User } from 'lucide-react'
import type { TabType } from '@/lib/types'
import { cn } from '@/lib/utils'

interface BottomNavigationProps {
  activeTab: TabType
  onTabChange: (tab: TabType) => void
}

const tabs = [
  { id: 'home' as TabType, icon: Home, label: 'Startseite' },
  { id: 'discover' as TabType, icon: Compass, label: 'Entdecken' },
  { id: 'create' as TabType, icon: Plus, label: 'Erstellen', isCreate: true },
  { id: 'chat' as TabType, icon: MessageCircle, label: 'Chats' },
  { id: 'profile' as TabType, icon: User, label: 'Profil' },
]

export function BottomNavigation({ activeTab, onTabChange }: BottomNavigationProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 px-3 safe-bottom">
      <div className="spak-content-width glass rounded-[1.35rem] border border-white/10 mb-2 overflow-hidden">
        <div className="flex items-center justify-around px-1 py-1.5">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            
            if (tab.isCreate) {
              return (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  aria-label={tab.label}
                  className="relative flex items-center justify-center -mt-6 press-effect"
                >
                  <div className="absolute inset-0 rounded-2xl bg-[#ffffff]/20 blur-lg opacity-70" />
                  <div className="relative flex items-center justify-center w-12 h-12 rounded-2xl bg-[#ffffff] text-[#0d1b2a] shadow-[0_10px_24px_rgba(115,228,255,0.3)] ring-4 ring-[#0d1b2a]/80">
                    <Icon className="w-7 h-7 text-white" strokeWidth={2.5} />
                  </div>
                </button>
              )
            }
            
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                aria-label={tab.label}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  "flex min-w-[3.5rem] flex-col items-center gap-1 px-2 py-2 rounded-xl transition-all press-effect",
                  isActive ? "bg-white/[0.08] text-white" : "text-white/50 hover:bg-white/[0.05] hover:text-white/80"
                )}
              >
                <div className="relative">
                  <Icon 
                    className={cn(
                      "w-6 h-6 transition-all",
                      isActive && "text-[#ffffff]"
                    )} 
                    strokeWidth={isActive ? 2.5 : 2}
                  />
                  {isActive && (
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#ffffff] neon-cyan" />
                  )}
                  {tab.id === 'chat' && (
                    <span className="absolute -top-1 -right-1 flex items-center justify-center w-4 h-4 text-[10px] font-bold bg-[#3155ff] rounded-full">
                      3
                    </span>
                  )}
                </div>
                <span className={cn(
                  "text-[10px] font-medium",
                  isActive && "text-glow-cyan"
                )}>
                  {tab.label}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
