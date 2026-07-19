import { redirect } from "next/navigation"

// The nav has always pointed referees at /referee, but only /referee/requests
// and /referee/profile ever existed, so the My Games tab 404ed (found in the
// 2026-07-19 prod audit). Until a referee dashboard exists, land on requests.
export default function RefereeHome() {
  redirect("/referee/requests")
}
