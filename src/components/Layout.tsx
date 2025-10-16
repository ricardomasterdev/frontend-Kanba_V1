import React from 'react'
import Sidebar from './Sidebar'
import Header from './Header'

const Layout: React.FC<{children: React.ReactNode}> = ({ children }) => {
    return (
        <div className="h-screen w-full flex bg-gray-50">
            {/* Lateral fixa */}
            <Sidebar />
            {/* Coluna principal */}
            <div className="flex-1 flex min-w-0">
                <div className="flex-1 flex flex-col min-w-0">
                    <Header />
                    <main className="flex-1 overflow-auto p-6">
                        <div className="max-w-7xl mx-auto">{children}</div>
                    </main>
                </div>
            </div>
        </div>
    )
}
export default Layout
