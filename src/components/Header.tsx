import React, { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'

const Header: React.FC = () => {
    const { user } = useAuth()
    const [agora, setAgora] = useState<Date>(new Date())

    useEffect(() => {
        const id = setInterval(() => setAgora(new Date()), 1000)
        return () => clearInterval(id)
    }, [])

    const tz = 'America/Sao_Paulo'

    const fmtWeekday = new Intl.DateTimeFormat('pt-BR', {
        weekday: 'long',
        timeZone: tz,
    })
    const fmtDate = new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        timeZone: tz,
    })
    const fmtTime = new Intl.DateTimeFormat('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        timeZone: tz,
    })

    const weekday = fmtWeekday.format(agora)
    const weekdayCap = weekday.charAt(0).toUpperCase() + weekday.slice(1)
    const dataHoraBR = `${weekdayCap}, ${fmtDate.format(agora)} ${fmtTime.format(agora)}`

    return (
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 sticky top-0 z-10 gap-3">
            {/* Data e hora (mais compacto) */}
            <div className="text-sm font-medium text-gray-800 truncate max-w-[60%]">
                {dataHoraBR}
            </div>

            <div className="text-xs md:text-sm text-gray-600 whitespace-nowrap">
                Logado como <span className="font-medium">{user?.email}</span>
            </div>
        </header>
    )
}

export default Header
