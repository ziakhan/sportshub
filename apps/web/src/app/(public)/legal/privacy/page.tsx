import { LegalDoc, PolicySections, type PolicySection } from "@/components/legal/legal-doc"
import { LEGAL } from "@/lib/legal"

export const metadata = {
  title: "Privacy Policy",
  description: "How SportsHub One collects, uses, shares, and protects personal information, including children's data.",
}

const N = LEGAL.productName

const SECTIONS: PolicySection[] = [
  {
    heading: "1. Introduction",
    body: [
      `${N} ("we", "us", "our") operates a platform that helps youth basketball families, clubs, and league organizers run registrations, payments, schedules, communications, and live scoring. This Privacy Policy explains what personal information we collect, how we use and share it, and the choices and rights you have. It is written to align with Canada's Personal Information Protection and Electronic Documents Act (PIPEDA) and applicable provincial privacy law.`,
      "By creating an account or using the platform, you acknowledge the practices described here. If you do not agree, please do not use the platform.",
    ],
  },
  {
    heading: "2. Who is responsible for your information",
    body: [
      `${N} is responsible for personal information under its control. Clubs and leagues that use the platform to run their programs are separately responsible for the information they collect and how they communicate with their members. When you register with a club or league, that organization is the sender of its own communications; we provide the tools.`,
      `You may contact our privacy contact at ${LEGAL.privacyEmail} for any question, access request, or concern.`,
    ],
  },
  {
    heading: "3. Information we collect",
    body: [
      "We collect information you provide, information created as you use the platform, and a limited amount from third parties (such as sign-in providers). This includes:",
      {
        list: [
          "Account information: name, email address, phone number, password (stored only as a secure hash), and your role (family, coach, club or league operator).",
          "Player information: a player's name, date of birth, gender, and, where a family provides it, jersey size, position, and photos. Much of this concerns minors and is provided by a parent or guardian.",
          "Registration and participation: the programs, teams, tryouts, camps, and leagues you register for, rosters, attendance, waivers and agreements you sign, and evaluation or scoring data.",
          "Payment information: payments are processed by our payment provider (Stripe). We receive limited details such as the amount, status, and a payment reference; we do not store full card numbers.",
          "Communications: messages, chats, announcements, and your communication preferences and consents.",
          "Technical and usage data: device and browser information, IP address, log data, and cookies or similar technologies used to keep you signed in and to operate and improve the service.",
        ],
      },
    ],
  },
  {
    heading: "4. Children's and minors' information",
    body: [
      `Youth sports involve minors, so protecting their information is central to how we operate. A parent or guardian must create and control the account for any child under ${LEGAL.minorAge}; children under ${LEGAL.minorAge} do not create their own accounts. A parent or guardian provides and manages their child's information and can review, update, or remove it.`,
      "We collect only the information reasonably needed to run youth programs (for example, age group eligibility and roster management). A player's full name is not shown publicly alongside their image without the additional media consent a parent controls. Parents and guardians may contact us to access or delete a child's information at any time.",
    ],
  },
  {
    heading: "5. How we use information",
    body: [
      "We use personal information to:",
      {
        list: [
          "Provide the platform: create accounts, run registrations and payments, build rosters and schedules, deliver live scores, and enable communications.",
          "Operate programs on behalf of the clubs and leagues you engage with.",
          "Send transactional messages you need, such as receipts, registration confirmations, schedule and game changes, waiver requests, and reminders.",
          "Send marketing messages only where we have consent (see Communications and consent below).",
          "Keep the platform safe and secure, prevent fraud and abuse, and enforce our terms.",
          "Understand usage and improve the service.",
          "Comply with legal obligations.",
        ],
      },
    ],
  },
  {
    heading: "6. Communications and consent",
    body: [
      "Transactional and operational messages (for example, a cancelled game, a waiver to sign, a payment receipt, or a safety notice) are part of the service and are sent without a separate marketing consent.",
      "Marketing messages are governed by Canada's Anti-Spam Legislation (CASL). We send them only where we have a valid basis: implied consent that arises from your registration or purchase relationship with a club or league (valid for a limited period and refreshed by continued activity), or express consent that you give by opting in. You can withdraw consent at any time using the unsubscribe link in any marketing message or from your communication preferences.",
    ],
  },
  {
    heading: "7. How we share information",
    body: [
      "We do not sell personal information. We share it only as needed to run the platform:",
      {
        list: [
          "With the clubs, leagues, and teams you register or interact with, so they can run their programs.",
          "With service providers who process data on our behalf under contract, such as payment processing (Stripe), cloud hosting and databases, email and text-message delivery, mapping and address lookup (Google), and error and analytics tooling. They may only use the information to provide their service to us.",
          "For safety and legal reasons: to comply with the law, respond to lawful requests, enforce our terms, or protect the rights, safety, and property of users and the public.",
          "In a business transfer, such as a merger or acquisition, subject to this Policy.",
        ],
      },
    ],
  },
  {
    heading: "8. Cookies and similar technologies",
    body: [
      "We use cookies and similar technologies to keep you signed in, remember preferences, secure the service, and understand and improve usage. You can control cookies through your browser settings; disabling some cookies may affect how the platform works (for example, staying signed in).",
    ],
  },
  {
    heading: "9. Data security",
    body: [
      "We use administrative, technical, and physical safeguards designed to protect personal information, including encryption in transit, hashed passwords, access controls, and role-based permissions that limit what club and league staff can see to their own teams and programs. No method of transmission or storage is completely secure, so we cannot guarantee absolute security.",
    ],
  },
  {
    heading: "10. Data retention",
    body: [
      "We keep personal information for as long as your account is active and as needed to provide the service, and afterward as required to meet legal, accounting, dispute-resolution, and safety obligations (for example, records of signed waivers and payment history). When information is no longer needed, we delete or de-identify it.",
    ],
  },
  {
    heading: "11. Your rights and choices",
    body: [
      "Subject to applicable law, you may:",
      {
        list: [
          "Access the personal information we hold about you and request a copy.",
          "Correct or update inaccurate information from your profile or by contacting us.",
          "Withdraw marketing consent at any time.",
          "Request deletion of your account and associated information, subject to records we must keep by law.",
          "Ask questions or make a complaint to our privacy contact; you also have the right to contact the Office of the Privacy Commissioner of Canada.",
        ],
      },
      `To exercise any of these, contact ${LEGAL.privacyEmail}. We may need to verify your identity before acting on a request.`,
    ],
  },
  {
    heading: "12. Where your information is processed",
    body: [
      "We operate the platform primarily using infrastructure located in Canada. Some service providers may process limited information outside Canada, in which case the information may be subject to the laws of those jurisdictions. We take steps to require appropriate protection for personal information handled on our behalf.",
    ],
  },
  {
    heading: "13. Changes to this Policy",
    body: [
      "We may update this Policy from time to time. If we make a material change, we will update the effective date and, where appropriate, provide additional notice. Your continued use of the platform after an update means you accept the revised Policy.",
    ],
  },
  {
    heading: "14. Contact us",
    body: [
      `For privacy questions, access requests, or complaints, contact ${LEGAL.privacyEmail}. For general support, contact ${LEGAL.supportEmail}.`,
    ],
  },
]

export default function PrivacyPage() {
  return (
    <LegalDoc title="Privacy Policy" effectiveDate={LEGAL.effectiveDate}>
      <PolicySections sections={SECTIONS} />
    </LegalDoc>
  )
}
