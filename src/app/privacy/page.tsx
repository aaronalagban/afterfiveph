import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — AfterFivePH",
  description: "How AfterFivePH collects and uses your information.",
};

const LAST_UPDATED = "May 7, 2026";
const CONTACT_EMAIL = "collective.afterfive@gmail.com";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#0B0B0D] text-[#FFFFFF] font-sans">
      <nav className="border-b border-[#1A1A1E] px-6 py-4 flex items-center justify-between">
        <Link href="/" className="font-black text-sm uppercase tracking-widest text-[#FFFFFF] hover:text-[#F53D04] transition-colors">
          ← AfterFivePH
        </Link>
        <span className="font-mono text-[10px] uppercase tracking-widest text-[#6E6E73]">Legal</span>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-16 md:py-24">
        <div className="mb-12">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#F53D04] mb-4">Legal</p>
          <h1 className="font-black text-5xl md:text-7xl uppercase tracking-tighter leading-none mb-4">PRIVACY POLICY</h1>
          <p className="font-mono text-xs text-[#6E6E73] uppercase tracking-widest">Last updated: {LAST_UPDATED}</p>
        </div>

        <div className="space-y-10 text-[#B3B3B8] leading-relaxed">
          <Section title="1. Introduction">
            <p>
              AfterFivePH ("we," "us," or "our") operates an event discovery platform for Manila's nightlife scene at afterfiveph.vercel.app (the "Platform"). This Privacy Policy explains how we collect, use, and protect information when you use our Platform.
            </p>
            <p>
              By accessing or using the Platform, you acknowledge that you have read and understood this policy.
            </p>
          </Section>

          <Section title="2. Information We Collect">
            <SubHeading>Information You Provide</SubHeading>
            <ul className="list-none space-y-2 pl-4 border-l border-[#1A1A1E]">
              <Li>Event submissions, including event name, venue, date, and promotional images.</Li>
              <Li>Any contact information you voluntarily provide when submitting events or reaching out to us.</Li>
            </ul>

            <SubHeading>Information Collected Automatically</SubHeading>
            <ul className="list-none space-y-2 pl-4 border-l border-[#1A1A1E]">
              <Li>Usage data such as pages visited, time spent on the Platform, and interactions (via standard web analytics).</Li>
              <Li>Device and browser information, including IP address, browser type, and operating system.</Li>
              <Li>Local storage data for preferences such as theme (light/dark mode) and whether you have seen our intro screen.</Li>
            </ul>
          </Section>

          <Section title="3. How We Use Your Information">
            <ul className="list-none space-y-2 pl-4 border-l border-[#1A1A1E]">
              <Li>To display event listings and operate the Platform.</Li>
              <Li>To review and approve user-submitted events.</Li>
              <Li>To improve and optimize the Platform's features and performance.</Li>
              <Li>To respond to inquiries or support requests.</Li>
              <Li>To detect and prevent abuse or fraudulent submissions.</Li>
            </ul>
          </Section>

          <Section title="4. Information Sharing">
            <p>
              We do not sell, rent, or trade your personal information to third parties. We may share information only in the following limited circumstances:
            </p>
            <ul className="list-none space-y-2 pl-4 border-l border-[#1A1A1E]">
              <Li><strong className="text-[#FFFFFF]">Service providers:</strong> We use Supabase for database hosting. Data is processed under their respective privacy and security terms.</Li>
              <Li><strong className="text-[#FFFFFF]">Legal requirements:</strong> We may disclose information if required to do so by law or in response to valid legal process.</Li>
              <Li><strong className="text-[#FFFFFF]">Event attribution:</strong> Submitted events and associated Instagram post URLs are displayed publicly on the Platform as part of the listing.</Li>
            </ul>
          </Section>

          <Section title="5. Third-Party Services">
            <p>The Platform integrates the following third-party services, each governed by their own privacy policies:</p>
            <ul className="list-none space-y-2 pl-4 border-l border-[#1A1A1E]">
              <Li><strong className="text-[#FFFFFF]">Supabase</strong> — database and backend infrastructure.</Li>
              <Li><strong className="text-[#FFFFFF]">Google Maps</strong> — venue map functionality. Google may collect data per their Privacy Policy.</Li>
              <Li><strong className="text-[#FFFFFF]">Instagram / Meta</strong> — event posters and post links are sourced from public Instagram content. We do not collect your Instagram credentials or data.</Li>
            </ul>
          </Section>

          <Section title="6. Data Retention">
            <p>
              Event data is retained for as long as it is relevant to the Platform's listings. We periodically remove outdated or inaccurate event records. Local storage preferences are retained on your device until you clear your browser data.
            </p>
          </Section>

          <Section title="7. Your Rights">
            <p>Depending on your jurisdiction, you may have the right to:</p>
            <ul className="list-none space-y-2 pl-4 border-l border-[#1A1A1E]">
              <Li>Request access to the personal data we hold about you.</Li>
              <Li>Request correction or deletion of inaccurate data.</Li>
              <Li>Object to or restrict certain processing activities.</Li>
            </ul>
            <p>To exercise these rights, contact us at <a href={`mailto:${CONTACT_EMAIL}`} className="text-[#F53D04] hover:underline">{CONTACT_EMAIL}</a>.</p>
          </Section>

          <Section title="8. Children's Privacy">
            <p>
              The Platform is intended for users who are of legal drinking age in their jurisdiction. We do not knowingly collect personal information from minors. If you believe we have inadvertently collected such information, please contact us immediately.
            </p>
          </Section>

          <Section title="9. Security">
            <p>
              We implement reasonable technical and organizational measures to protect your data. However, no internet transmission is fully secure. You use the Platform at your own risk.
            </p>
          </Section>

          <Section title="10. Changes to This Policy">
            <p>
              We may update this Privacy Policy from time to time. Changes will be reflected by updating the "Last updated" date above. Continued use of the Platform after changes constitutes acceptance of the revised policy.
            </p>
          </Section>

          <Section title="11. Contact">
            <p>
              Questions or concerns about this Privacy Policy? Reach us at{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-[#F53D04] hover:underline">{CONTACT_EMAIL}</a>{" "}
              or via Instagram{" "}
              <a href="https://instagram.com/aaronalagbann" target="_blank" rel="noreferrer" className="text-[#F53D04] hover:underline">@aaronalagbann</a>.
            </p>
          </Section>
        </div>

        <div className="mt-16 pt-8 border-t border-[#1A1A1E] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <p className="font-mono text-[10px] uppercase tracking-widest text-[#6E6E73]">
            AfterFivePH — Where Manila Goes After Five
          </p>
          <Link href="/terms" className="font-mono text-[10px] uppercase tracking-widest text-[#6E6E73] hover:text-[#F53D04] transition-colors">
            Terms of Service →
          </Link>
        </div>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="font-black text-lg uppercase tracking-wide text-[#FFFFFF] mb-4 pb-2 border-b border-[#1A1A1E]">
        {title}
      </h2>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-black text-sm uppercase tracking-wider text-[#FFFFFF] mt-4 mb-2">{children}</h3>
  );
}

function Li({ children }: { children: React.ReactNode }) {
  return (
    <li className="text-sm flex gap-2">
      <span className="text-[#F53D04] shrink-0 mt-[3px]">—</span>
      <span>{children}</span>
    </li>
  );
}
