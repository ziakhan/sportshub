import { LegalDoc, PolicySections, type PolicySection } from "@/components/legal/legal-doc"
import { LEGAL } from "@/lib/legal"

export const metadata = {
  title: "Acceptable Use Policy",
  description: "The conduct rules that keep SportsHub One safe for families, players, and organizers.",
}

const N = LEGAL.productName

const SECTIONS: PolicySection[] = [
  {
    heading: "1. Purpose",
    body: [
      `This Acceptable Use Policy sets out how you may and may not use ${N}. It exists to keep the platform safe for families, players, coaches, and organizers, and it forms part of our Terms of Service. Because the platform serves youth sports and involves minors, we take these rules seriously.`,
    ],
  },
  {
    heading: "2. Respect and safety",
    body: [
      "You agree to treat others with respect. Do not use the platform to:",
      {
        list: [
          "Harass, bully, threaten, demean, or discriminate against any person.",
          "Endanger a child or share a minor's personal information or images in a way that is inappropriate or without the right to do so.",
          "Impersonate another person or organization, or misrepresent your role or affiliation.",
          "Post content that is unlawful, hateful, sexually explicit, violent, or otherwise harmful.",
        ],
      },
    ],
  },
  {
    heading: "3. Lawful use",
    body: [
      "Do not use the platform for any unlawful purpose, to facilitate illegal activity, to infringe intellectual property or privacy rights, or to send spam or unsolicited messages in violation of anti-spam law.",
    ],
  },
  {
    heading: "4. Security and integrity",
    body: [
      "Keep the platform and its data safe. Do not:",
      {
        list: [
          "Access accounts, teams, clubs, leagues, or data you are not authorized to access.",
          "Probe, scan, or test the vulnerability of the platform, or breach or circumvent security or authentication.",
          "Scrape, harvest, or bulk-collect data, or use bots or automated means except through interfaces we provide.",
          "Introduce malware, disrupt or overload the service, or interfere with other users.",
          "Reverse engineer or copy the platform except as permitted by law.",
        ],
      },
    ],
  },
  {
    heading: "5. Accurate information and appropriate use of roles",
    body: [
      "Provide accurate information and keep it current. Operators (club and league staff) must use their access only for the teams and programs they are responsible for, and must handle the personal information of families and players responsibly and in line with our Privacy Policy.",
    ],
  },
  {
    heading: "6. Reporting and enforcement",
    body: [
      `If you see conduct that violates this Policy, or a safety concern involving a minor, contact ${LEGAL.supportEmail}. We may investigate suspected violations and may remove content, restrict features, or suspend or terminate accounts. Serious matters, including threats to a child's safety, may be reported to the appropriate authorities.`,
    ],
  },
  {
    heading: "7. Changes",
    body: [
      "We may update this Policy from time to time. Continued use of the platform after an update means you accept the revised Policy.",
    ],
  },
]

export default function AcceptableUsePage() {
  return (
    <LegalDoc title="Acceptable Use Policy" effectiveDate={LEGAL.effectiveDate}>
      <PolicySections sections={SECTIONS} />
    </LegalDoc>
  )
}
