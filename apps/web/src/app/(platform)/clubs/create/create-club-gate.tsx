"use client"

import { useState } from "react"
import { SearchFirst } from "./search-first"
import { CreateClubForm } from "./create-club-form"

/** Search + claim comes BEFORE create (owner 2026-07-18) — never create-first. */
export function CreateClubGate() {
  const [proceed, setProceed] = useState(false)
  return proceed ? <CreateClubForm /> : <SearchFirst onProceed={() => setProceed(true)} />
}
