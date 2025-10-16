import React, { useEffect, useState } from 'react'
import api from '../services/api'
import { BarChart3, AlertTriangle, CheckCircle2, PlayCircle } from 'lucide-react'

type Metrics = {
  total: number
  aIniciar: number
  emAndamento: number
  atrasado: number
  concluido: number
}

const Card: React.FC<{ title: string, value: number, icon: React.ReactNode, color: string }> = ({ title, value, icon, color }) => (
  <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
    <div className="flex items-center justify-between">
      <div>
        <div className="text-sm text-gray-500">{title}</div>
        <div className="text-2xl font-bold text-gray-800">{value}</div>
      </div>
      <div className={`p-3 rounded-xl ${color}`}>{icon}</div>
    </div>
  </div>
)

const DashboardPage: React.FC = () => {
  const [metrics, setMetrics] = useState<Metrics>({ total:0, aIniciar:0, emAndamento:0, atrasado:0, concluido:0 })

  useEffect(() => {
    const fetchData = async () => {
      const res = await api.get('/api/v1/kanban')
      const data = res.data as Record<string, any[]>
      const aIniciar = data['A_INICIAR']?.length ?? 0
      const emAndamento = data['EM_ANDAMENTO']?.length ?? 0
      const atrasado = data['ATRASADO']?.length ?? 0
      const concluido = data['CONCLUIDO']?.length ?? 0
      setMetrics({ total: aIniciar+emAndamento+atrasado+concluido, aIniciar, emAndamento, atrasado, concluido })
    }
    fetchData()
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-800">Visão Geral</h2>
        <p className="text-sm text-gray-500">Resumo rápido dos projetos</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card title="Total" value={metrics.total} icon={<BarChart3 />} color="bg-primary-100 text-primary-700" />
        <Card title="A iniciar" value={metrics.aIniciar} icon={<PlayCircle />} color="bg-blue-100 text-blue-700" />
        <Card title="Em andamento" value={metrics.emAndamento} icon={<BarChart3 />} color="bg-amber-100 text-amber-700" />
        <Card title="Atrasados" value={metrics.atrasado} icon={<AlertTriangle />} color="bg-red-100 text-red-700" />
      </div>
      <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
      </div>
    </div>
  )
}
export default DashboardPage
