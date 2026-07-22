"use client"

import { useParams } from "next/navigation"
import { TrainingSessionForm, EMPTY_TRAINING_FORM } from "../training-session-form"

export default function CreateTrainingSessionPage() {
  const params = useParams()
  const clubId = params?.id as string

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h2 className="text-ink-900 text-2xl font-semibold">New Training Program</h2>
        <p className="text-ink-500 mt-1 text-sm">
          It starts as a draft — publish it from the Training tab when it&apos;s ready.
        </p>
      </div>
      <TrainingSessionForm clubId={clubId} initial={EMPTY_TRAINING_FORM} />
    </div>
  )
}
