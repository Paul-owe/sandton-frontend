import { Card } from '../components/ui/Card'

export function DocumentsPage() {
  return (
    <Card>
      <h2 className="text-xl font-semibold text-slate-900">Documents</h2>
      <p className="mt-2 text-sm text-slate-500">
        Upload and view documents from each patient profile to keep records organized by file number.
      </p>
    </Card>
  )
}
