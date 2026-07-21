// Waiver template library (docs/roadmap/waivers-esign.md, owner spec 2026-07-20).
// Ontario-structured starters. Province differences live HERE, not in the
// schema: adding another province later means adding template entries, nothing
// else changes. Bodies are starting points for the org to customize; the UI
// tells operators to have a lawyer review before use.
//
// Legal shape (Ontario research 2026-07-20): parent-signed liability waivers
// for minors are widely expected to be unenforceable, so the liability
// template is structured as ACKNOWLEDGMENT OF RISK + PARENT INDEMNITY rather
// than a naive "you cannot sue" release. Rowan's Law (2018) makes the annual
// concussion code acknowledgment mandatory for Ontario youth sports.

export type WaiverTemplateType =
  | "ACKNOWLEDGMENT_INDEMNITY"
  | "CONCUSSION_CODE"
  | "MEDIA_CONSENT"
  | "CUSTOM"

export interface WaiverTemplate {
  key: string
  title: string
  type: WaiverTemplateType
  province: string
  annualRenewal: boolean
  description: string
  body: (orgName: string) => string
}

export const WAIVER_TEMPLATES: WaiverTemplate[] = [
  {
    key: "ack-indemnity-on",
    title: "Acknowledgment of Risk and Indemnity Agreement",
    type: "ACKNOWLEDGMENT_INDEMNITY",
    province: "ON",
    annualRenewal: false,
    description:
      "The core participation agreement: informed acknowledgment of the risks of basketball plus a parent indemnity. Structured for Ontario, where courts are not expected to enforce liability releases signed on behalf of minors.",
    body: (orgName: string) => `ACKNOWLEDGMENT OF RISK AND INDEMNITY AGREEMENT

Organization: ${orgName}

1. ACKNOWLEDGMENT OF RISK
I understand that participation in basketball activities, including practices, games, tryouts, tournaments and related events, involves inherent risks. These risks include, but are not limited to: collisions with other participants, falls, contact with equipment or playing surfaces, muscle and joint injuries, fractures, concussion and other head injuries, and, in rare circumstances, serious or permanent injury. I acknowledge that these risks cannot be fully eliminated even when the activity is run with reasonable care.

2. VOLUNTARY PARTICIPATION
I confirm that my child's participation is voluntary and that I have had the opportunity to ask questions about the activities and how they are supervised.

3. FITNESS TO PARTICIPATE
I confirm that, to the best of my knowledge, my child has no medical condition that would make participation unsafe, and I agree to inform ${orgName} of any relevant medical conditions or changes.

4. ASSUMPTION OF RISK
I freely accept and assume the inherent risks described above as a condition of my child's participation.

5. INDEMNITY
I agree to indemnify and hold harmless ${orgName}, its directors, officers, employees, coaches and volunteers from claims, costs and expenses (including reasonable legal fees) arising from my child's participation, except to the extent caused by the negligence or willful misconduct of ${orgName} or those for whom it is responsible.

6. EMERGENCY MEDICAL TREATMENT
I authorize ${orgName} to obtain emergency medical treatment for my child if I cannot be reached in an emergency.

7. ACKNOWLEDGMENT
I confirm that I have read and understood this agreement, that I am the parent or legal guardian of the participant, and that I sign it voluntarily.`,
  },
  {
    key: "concussion-code-on",
    title: "Concussion Code of Conduct (Rowan's Law)",
    type: "CONCUSSION_CODE",
    province: "ON",
    annualRenewal: true,
    description:
      "Mandatory in Ontario under Rowan's Law (Concussion Safety), 2018: athletes and, for athletes under 18, their parent or guardian must review concussion awareness resources and acknowledge the code of conduct every year, within 12 months before registration.",
    body: (orgName: string) => `CONCUSSION CODE OF CONDUCT

Organization: ${orgName}

Under Rowan's Law (Concussion Safety), 2018, all athletes under 26, and the parents or guardians of athletes under 18, must review Ontario's Concussion Awareness Resources and confirm this Code of Conduct every year.

I confirm that I have reviewed the Ontario Concussion Awareness Resource for my child's age group (available at ontario.ca/concussions) and I commit to the following:

1. I will help create a culture where concussions are taken seriously. Fair play and respect for all participants come first.

2. I understand the signs and symptoms of concussion, and I will encourage my child to report any symptoms to a coach, official, trainer, parent or guardian right away, whether the injury happened during this sport or anywhere else.

3. I understand that if my child is suspected of having sustained a concussion, they will be removed from play immediately and will not return to practice or competition until permitted under the organization's Removal-from-Sport and Return-to-Sport protocols.

4. I understand that returning to sport after a concussion is a gradual process that must follow the Return-to-Sport protocol, and that medical clearance may be required.

5. I will respect the decisions of coaches, officials and trainers regarding removal from play, and I will not pressure my child, their coaches, or ${orgName} for an early return.

6. I understand that repeated concussions, and returning to play before recovery is complete, can significantly worsen outcomes.`,
  },
  {
    key: "media-consent",
    title: "Photo and Media Consent",
    type: "MEDIA_CONSENT",
    province: "ON",
    annualRenewal: false,
    description:
      "Optional consent for photos and video taken at games and events to be used on the organization's website, social media and promotional material.",
    body: (orgName: string) => `PHOTO AND MEDIA CONSENT

Organization: ${orgName}

I understand that photographs and video may be taken at games, practices and events organized by ${orgName}.

I consent to images and recordings that include my child being used by ${orgName} for its website, team and league pages, social media accounts, and reasonable promotional material, without compensation.

I understand that:

1. My child's full name will not be published alongside their image without separate consent.
2. I may withdraw this consent at any time by written notice to ${orgName}, which applies to future use.
3. ${orgName} cannot control photography by spectators or other attendees at public events.`,
  },
]

export function getWaiverTemplate(key: string): WaiverTemplate | undefined {
  return WAIVER_TEMPLATES.find((t) => t.key === key)
}
