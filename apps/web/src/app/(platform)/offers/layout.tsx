// K-005: guards every route under /offers — the (platform) layout cannot hold this
// guard because it also wraps /onboarding, which would redirect-loop.
export { default } from "@/lib/onboarding/section-guard"
