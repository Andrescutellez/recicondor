import React, { useState, useCallback } from 'react'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { BottomNav } from './BottomNav'

interface LayoutProps {
  children: React.ReactNode
}

export function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const closeSidebar = useCallback(() => setSidebarOpen(false), [])

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar — fixed on desktop, overlay on mobile */}
      <Sidebar open={sidebarOpen} onClose={closeSidebar} />

      {/* Mobile overlay backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* Main content — full width on mobile, offset on desktop */}
      <div className="lg:ml-64 flex flex-col min-h-screen">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 p-4 lg:p-6 pb-24 lg:pb-6">
          {children}
        </main>
      </div>

      {/* Bottom nav for mobile */}
      <BottomNav />
    </div>
  )
}
