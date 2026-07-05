'use client'

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  BarChart, Bar, ResponsiveContainer, Cell
} from 'recharts'
import { format, parseISO } from 'date-fns'
import { id } from 'date-fns/locale'

// ─── LINE CHART: Progres Harian ──────────────────────────────────────────────
interface DailyChartProps {
  data: { date: string; approved: number; retake: number }[]
}

export function DailyProgressChart({ data }: DailyChartProps) {
  const formatted = data.map(d => ({
    ...d,
    label: format(parseISO(d.date), 'dd MMM', { locale: id })
  }))

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={formatted} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: '#94a3b8' }}
          axisLine={false}
          tickLine={false}
          interval={Math.floor(formatted.length / 7)}
        />
        <YAxis
          tick={{ fontSize: 11, fill: '#94a3b8' }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{ borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: 12 }}
          labelStyle={{ fontWeight: 600, color: '#334155' }}
        />
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
        />
        <Line
          type="monotone"
          dataKey="approved"
          name="Titik Approved"
          stroke="#059669"
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 5, fill: '#059669' }}
        />
        <Line
          type="monotone"
          dataKey="retake"
          name="Retake"
          stroke="#ef4444"
          strokeWidth={2}
          dot={false}
          strokeDasharray="4 3"
          activeDot={{ r: 4, fill: '#ef4444' }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

// ─── BAR CHART: Perbandingan Surveyor ────────────────────────────────────────
interface SurveyorChartProps {
  data: {
    name: string
    approved: number
    progress: number
    review: number
    retake: number
    total: number
  }[]
}

export function SurveyorBarChart({ data }: SurveyorChartProps) {
  // Shorten names if too long
  const formatted = data.map(d => ({
    ...d,
    shortName: d.name.length > 12 ? d.name.slice(0, 12) + '…' : d.name
  }))

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={formatted} margin={{ top: 5, right: 20, left: 0, bottom: 5 }} barCategoryGap="30%">
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis
          dataKey="shortName"
          tick={{ fontSize: 11, fill: '#94a3b8' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: '#94a3b8' }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{ borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: 12 }}
          labelStyle={{ fontWeight: 600, color: '#334155' }}
          formatter={(value: any, name: string) => [value, name]}
        />
        <Legend
          iconType="square"
          iconSize={10}
          wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
        />
        <Bar dataKey="approved" name="Approved" fill="#059669" radius={[4, 4, 0, 0]} />
        <Bar dataKey="review" name="Under Review" fill="#3b82f6" radius={[4, 4, 0, 0]} />
        <Bar dataKey="retake" name="Retake" fill="#ef4444" radius={[4, 4, 0, 0]} />
        <Bar dataKey="progress" name="In Progress" fill="#f59e0b" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
