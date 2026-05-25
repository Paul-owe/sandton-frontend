import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getDashboardSummary, type DashboardSummary } from '../api/dashboardApi'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'

export function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null)

  useEffect(() => {
    let cancelled = false

    const loadSummary = async () => {
      try {
        const nextSummary = await getDashboardSummary()
        if (!cancelled) setSummary(nextSummary)
      } catch {
        if (!cancelled) setSummary(null)
      }
    }

    void loadSummary()

    return () => {
      cancelled = true
    }
  }, [])

  const cards = [
    { label: 'Patients Visible', value: formatDashboardValue(summary?.patientsVisible) },
    { label: 'Documents Uploaded', value: formatDashboardValue(summary?.documentsUploaded) },
    { label: "Doctor's Notes", value: formatDashboardValue(summary?.doctorsNotes) },
    { label: 'Branch Access', value: summary?.branchAccess || '-' },
  ]

  return (
    <div className="space-y-5">
      <Card className="bg-gradient-to-r from-brand-900 to-brand-700 text-white">
        <h2 className="text-2xl font-semibold">Today&apos;s file command center</h2>
        <p className="mt-2 max-w-2xl text-sm text-brand-100">
          Find patient file numbers, register new patients, and keep scanned clinical documents organised.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link to="/patients">
            <Button variant="secondary">Register Patient</Button>
          </Link>
          <Link to="/patients">
            <Button variant="secondary">Search Patient</Button>
          </Link>
          <Link to="/patients?intent=doctor-notes">
            <Button variant="secondary">Upload Doctors Notes</Button>
          </Link>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.label}>
            <p className="text-sm text-slate-500">{card.label}</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{card.value}</p>
          </Card>
        ))}
      </div>

      <Card>
        <div className="flex items-center justify-between">
          <p className="font-semibold text-slate-900">Quick status</p>
          <Badge tone="green">System online</Badge>
        </div>
        <p className="mt-2 text-sm text-slate-500">
          Use Patients to retrieve file numbers fast and upload Patient Details or Doctor&apos;s Notes.
        </p>
      </Card>
    </div>
  )
}

function formatDashboardValue(value?: number) {
  return typeof value === 'number' ? value.toLocaleString() : '-'
}
