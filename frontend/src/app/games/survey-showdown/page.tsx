import { Suspense } from 'react'
import SurveyShowdownApp from '@/components/survey-showdown/SurveyShowdownApp'

export default function SurveyShowdownPage() {
  return (
    <Suspense fallback={null}>
      <SurveyShowdownApp />
    </Suspense>
  )
}
