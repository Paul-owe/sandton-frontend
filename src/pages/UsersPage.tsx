import { useEffect, useState, type FormEvent } from 'react'
import { getBranches } from '../api/branchApi'
import { createUser, getUsers } from '../api/userApi'
import type { Branch } from '../types/branch'
import type { User } from '../types/user'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Input } from '../components/ui/Input'
import { Modal } from '../components/ui/Modal'
import { Select } from '../components/ui/Select'

export function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
    role: 'FRONT_DESK',
    branchId: '',
  })

  const load = async () => {
    const [u, b] = await Promise.all([getUsers().catch(() => []), getBranches().catch(() => [])])
    setUsers(u)
    setBranches(b)
  }
  useEffect(() => {
    load()
  }, [])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    await createUser(form)
    setOpen(false)
    setForm({ fullName: '', email: '', password: '', role: 'FRONT_DESK', branchId: '' })
    load()
  }

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-900">Users</h2>
        <Button onClick={() => setOpen(true)}>Create User</Button>
      </div>
      <div className="grid gap-3 xl:grid-cols-2">
        {users.map((u) => (
          <div key={String(u.id)} className="rounded-xl border border-slate-200 p-3 text-sm">
            <p className="font-semibold text-slate-900">{u.fullName}</p>
            <p className="text-slate-500">{u.email}</p>
            <p className="text-slate-500">
              {u.role} | {u.branchName || u.branchId || 'No branch'}
            </p>
            <p className="text-slate-500">Active: {u.active ? 'Yes' : 'No'}</p>
          </div>
        ))}
      </div>
      <Modal title="Create User" open={open} onClose={() => setOpen(false)}>
        <form className="space-y-3" onSubmit={submit}>
          <Input placeholder="Full Name" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
          <Input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Input type="password" placeholder="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            <option value="ADMIN">ADMIN</option>
            <option value="FRONT_DESK">FRONT_DESK</option>
          </Select>
          <Select value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}>
            <option value="">Select Branch</option>
            {branches.map((b) => (
              <option key={String(b.id)} value={String(b.id)}>
                {b.name}
              </option>
            ))}
          </Select>
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
