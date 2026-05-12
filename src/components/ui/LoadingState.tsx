export function LoadingState({ label = 'Loading...' }: { label?: string }) {
  return <p className="rounded-xl bg-slate-100 p-4 text-sm text-slate-500">{label}</p>
}
