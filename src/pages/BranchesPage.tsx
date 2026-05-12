import { useEffect, useState, type FormEvent } from 'react'
import { createBranch, getBranches, updateBranch } from '../api/branchApi'
import type { Branch } from '../types/branch'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Input } from '../components/ui/Input'
import { Modal } from '../components/ui/Modal'

export function BranchesPage() {
  const [branches, setBranches] = useState<Branch[]>([])
  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<string | number | null>(null)
  const [form, setForm] = useState<Partial<Branch>>({ name: '', address: '', phone: '', active: true })

  const load = () => getBranches().then(setBranches).catch(() => setBranches([]))
  useEffect(() => {
    load()
  }, [])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (editId) await updateBranch(editId, form)
    else await createBranch(form)
    setOpen(false)
    setEditId(null)
    setForm({ name: '', address: '', phone: '', active: true })
    load()
  }

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-900">Branches</h2>
        <Button onClick={() => setOpen(true)}>Create Branch</Button>
      </div>
      <div className="grid gap-3 xl:grid-cols-2">
        {branches.map((b) => (
          <div key={String(b.id)} className="rounded-xl border border-slate-200 p-3 text-sm">
            <p className="font-semibold text-slate-900">{b.name}</p>
            <p className="text-slate-500">{b.address}</p>
            <p className="text-slate-500">{b.phone}</p>
            <p className="text-slate-500">Active: {b.active ? 'Yes' : 'No'}</p>
            <Button
              className="mt-2"
              variant="secondary"
              onClick={() => {
                setEditId(b.id || null)
                setForm(b)
                setOpen(true)
              }}
            >
              Edit
            </Button>
          </div>
        ))}
      </div>
      <Modal title={editId ? 'Edit Branch' : 'Create Branch'} open={open} onClose={() => setOpen(false)}>
        <form className="space-y-3" onSubmit={submit}>
          <Input placeholder="Branch name" value={String(form.name || '')} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input placeholder="Address" value={String(form.address || '')} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          <Input placeholder="Phone" value={String(form.phone || '')} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Save</Button>
          </div>
        </form>
      </Modal>
    </Card>
  )
}
