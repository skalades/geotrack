import { SurveyorShell } from '@/components/layout/surveyor-shell'

export default function SurveyorLayout({ children }: { children: React.ReactNode }) {
  return <SurveyorShell>{children}</SurveyorShell>
}
