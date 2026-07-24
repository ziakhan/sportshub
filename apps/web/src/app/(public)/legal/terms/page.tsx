import { LegalDoc, PolicySections, type PolicySection } from "@/components/legal/legal-doc"
import { LEGAL } from "@/lib/legal"

export const metadata = {
  title: "Terms of Service",
  description: "The terms and conditions for using the SportsHub One platform.",
}

const N = LEGAL.productName

const SECTIONS: PolicySection[] = [
  {
    heading: "1. Agreement to these Terms",
    body: [
      `These Terms of Service ("Terms") are an agreement between you and ${LEGAL.entity} ("${N}", "we", "us") governing your use of our websites, apps, and services (the "platform"). By creating an account or using the platform, you agree to these Terms and to our Privacy Policy and Acceptable Use Policy, which are incorporated by reference. If you do not agree, do not use the platform.`,
    ],
  },
  {
    heading: "2. Who may use the platform",
    body: [
      `You must be able to form a binding contract to hold an account. A parent or guardian must create and manage the account and information for any child under ${LEGAL.minorAge}, and is responsible for that child's use of the platform. Clubs and leagues that use the platform confirm they are authorized to act for their organization.`,
    ],
  },
  {
    heading: "3. Your account",
    body: [
      "You are responsible for the accuracy of the information you provide, for keeping your login credentials secure, and for activity under your account. Notify us promptly of any unauthorized use. We may suspend or terminate accounts that violate these Terms or that create risk to others.",
    ],
  },
  {
    heading: "4. The platform is a tool; clubs and leagues run the programs",
    body: [
      `${N} provides software that clubs, leagues, camps, and tournaments use to run their own programs. We are not the organizer, operator, coach, or supervisor of any team, tryout, camp, game, or event, and we do not control how organizations run them. Registration, eligibility, refunds, safety, staffing, background checks, and the conduct of programs are the responsibility of the organization you engage with. Any agreements, waivers, or codes of conduct you sign are between you and that organization.`,
    ],
  },
  {
    heading: "5. Payments and fees",
    body: [
      "Payments made through the platform are processed by our payment provider (Stripe). When you register or pay, you authorize the applicable charge. Program fees, taxes, payment methods, installment plans, and refund policies are set by the club or league, not by us. Refund and cancellation requests are handled according to that organization's policy. Any platform or processing fees will be disclosed at the time of payment.",
    ],
  },
  {
    heading: "6. Offline payments",
    body: [
      `Some organizations collect payment directly from families outside the platform — cash, e-transfer, cheque, or similar arrangements ("offline payments"). Offline payments are a private arrangement strictly between the family and the organization; ${N} is not a party to that arrangement.`,
      `We accept no responsibility or liability for offline payments, including their collection, accuracy, refunds, or any dispute arising from them. An organization that chooses to collect offline is solely responsible for issuing its own refunds and resolving disputes with the families who paid it directly. The platform may record that an offline payment occurred (as reported by the organization), but that record is not a guarantee, receipt, or proof of payment from ${N}.`,
    ],
  },
  {
    heading: "7. Your content",
    body: [
      "You retain your rights in the information and content you submit (such as profiles, photos, and messages). You grant us a limited licence to host, process, and display that content as needed to operate the platform and provide the service to you and the organizations you engage with. You are responsible for the content you submit and confirm you have the right to share it, including any photo of a minor.",
    ],
  },
  {
    heading: "8. Acceptable use",
    body: [
      "You agree to use the platform lawfully and respectfully, and to follow our Acceptable Use Policy. Do not misuse the platform, interfere with its security, access data you are not authorized to access, or use it to harm others.",
    ],
  },
  {
    heading: "9. Service availability and changes",
    body: [
      "We work to keep the platform available and reliable, but we provide it on an as-is basis and may modify, suspend, or discontinue features. We are not responsible for interruptions, data entered by organizations or users, or third-party services the platform relies on.",
    ],
  },
  {
    heading: "10. Disclaimers",
    body: [
      "To the fullest extent permitted by law, the platform is provided without warranties of any kind, whether express or implied, including fitness for a particular purpose, merchantability, and non-infringement. We do not warrant that the platform will be uninterrupted, error-free, or secure, or that content entered by organizations or users is accurate.",
    ],
  },
  {
    heading: "11. Limitation of liability",
    body: [
      `To the fullest extent permitted by law, ${N} and its suppliers will not be liable for any indirect, incidental, special, consequential, or punitive damages, or for lost profits, data, or goodwill, arising from your use of the platform. Our total liability for any claim relating to the platform will not exceed the greater of the amount you paid us in the twelve months before the claim or CAD 100. Nothing in these Terms limits liability that cannot be limited by law.`,
    ],
  },
  {
    heading: "12. Indemnity",
    body: [
      "You agree to indemnify and hold us harmless from claims, damages, and expenses (including reasonable legal fees) arising from your use of the platform, your content, or your violation of these Terms, except to the extent caused by our own negligence or misconduct.",
    ],
  },
  {
    heading: "13. Termination",
    body: [
      "You may stop using the platform and request deletion of your account at any time. We may suspend or terminate access if you violate these Terms or create risk to others. Some provisions survive termination, including those on content licences, disclaimers, limitation of liability, and indemnity.",
    ],
  },
  {
    heading: "14. Governing law",
    body: [
      `These Terms are governed by the laws of ${LEGAL.jurisdiction}, without regard to conflict-of-laws rules. You agree to the exclusive jurisdiction of the courts located in ${LEGAL.governingProvince} for any dispute, unless applicable law requires otherwise.`,
    ],
  },
  {
    heading: "15. Changes to these Terms",
    body: [
      "We may update these Terms from time to time. If we make a material change, we will update the effective date and, where appropriate, provide additional notice. Your continued use after an update means you accept the revised Terms.",
    ],
  },
  {
    heading: "16. Contact us",
    body: [`Questions about these Terms? Contact ${LEGAL.legalEmail}.`],
  },
]

export default function TermsPage() {
  return (
    <LegalDoc title="Terms of Service" effectiveDate={LEGAL.effectiveDate}>
      <PolicySections sections={SECTIONS} />
    </LegalDoc>
  )
}
