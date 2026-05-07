import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — AfterFivePH",
  description: "Terms and conditions for using AfterFivePH.",
};

const LAST_UPDATED = "May 7, 2026";
const CONTACT_EMAIL = "ollective.afterfive@gmail.com";

export default function TermsPage() {
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
          <h1 className="font-black text-5xl md:text-7xl uppercase tracking-tighter leading-none mb-4">TERMS OF SERVICE</h1>
          <p className="font-mono text-xs text-[#6E6E73] uppercase tracking-widest">Last updated: {LAST_UPDATED}</p>
        </div>

        <div className="space-y-10 text-[#B3B3B8] leading-relaxed">
          <Section title="1. Acceptance of Terms">
            <p>
              By accessing or using AfterFivePH ("the Platform"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree, you must not use the Platform.
            </p>
            <p>
              These Terms apply to all visitors, users, and anyone who accesses or submits content to the Platform.
            </p>
          </Section>

          <Section title="2. About the Platform">
            <p>
              AfterFivePH is an independent event discovery platform that aggregates and displays nightlife events in Metro Manila, Philippines. We are not an event organizer, ticketing agent, or venue operator. We are not responsible for the accuracy, completeness, or outcome of any listed event.
            </p>
          </Section>

          <Section title="3. Eligibility">
            <p>
              The Platform features nightlife events that may involve venues serving alcohol. By using the Platform, you confirm that you are of legal age in your jurisdiction to consume alcohol or attend nightlife events. We reserve the right to restrict access without notice.
            </p>
          </Section>

          <Section title="4. User-Submitted Content">
            <SubHeading>4.1 Submissions</SubHeading>
            <p>
              You may submit events via our submission form. By submitting content, you represent and warrant that:
            </p>
            <ul className="list-none space-y-2 pl-4 border-l border-[#1A1A1E]">
              <Li>You have the right to submit the content and any associated images.</Li>
              <Li>The content is accurate, not misleading, and relates to a real event.</Li>
              <Li>You are not impersonating any venue, promoter, or artist.</Li>
              <Li>The content does not violate any applicable law or third-party rights.</Li>
            </ul>

            <SubHeading>4.2 License</SubHeading>
            <p>
              By submitting content, you grant AfterFivePH a non-exclusive, royalty-free, worldwide license to display, reproduce, and distribute the content on the Platform for the purpose of event discovery.
            </p>

            <SubHeading>4.3 Moderation</SubHeading>
            <p>
              We reserve the right to review, edit, reject, or remove any submitted content at our sole discretion, without notice or liability.
            </p>
          </Section>

          <Section title="5. Intellectual Property">
            <p>
              All original content, branding, logos, and design of the Platform are the property of AfterFivePH. Event posters and promotional imagery remain the property of their respective creators and venues. We display this content for informational and discovery purposes under fair use or with attribution to the original Instagram source.
            </p>
            <p>
              If you are a rights holder and believe content on the Platform infringes your intellectual property, contact us at <a href={`mailto:${CONTACT_EMAIL}`} className="text-[#F53D04] hover:underline">{CONTACT_EMAIL}</a> and we will promptly review and address the matter.
            </p>
          </Section>

          <Section title="6. Third-Party Links and Content">
            <p>
              The Platform may link to external websites and Instagram posts. We have no control over, and assume no responsibility for, the content, privacy practices, or terms of any third-party sites. Links do not constitute an endorsement.
            </p>
          </Section>

          <Section title="7. Disclaimers">
            <ul className="list-none space-y-2 pl-4 border-l border-[#1A1A1E]">
              <Li>Event listings are provided for informational purposes only. We do not guarantee the accuracy, completeness, or timeliness of any event information.</Li>
              <Li>Events may be cancelled, rescheduled, or altered by the organizer without notice to us. Always verify event details with the venue or organizer directly.</Li>
              <Li>The Platform is provided "as is" without warranty of any kind, express or implied.</Li>
            </ul>
          </Section>

          <Section title="8. Limitation of Liability">
            <p>
              To the fullest extent permitted by law, AfterFivePH and its operators shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of or reliance on the Platform or any listed event.
            </p>
            <p>
              Our total liability to you for any claim arising from these Terms or the Platform shall not exceed PHP 1,000.
            </p>
          </Section>

          <Section title="9. Prohibited Conduct">
            <p>You must not:</p>
            <ul className="list-none space-y-2 pl-4 border-l border-[#1A1A1E]">
              <Li>Submit false, misleading, or duplicate event listings.</Li>
              <Li>Use the Platform for commercial spam, advertising, or solicitation.</Li>
              <Li>Attempt to scrape, crawl, or extract data from the Platform at scale without permission.</Li>
              <Li>Impersonate any person, venue, or organization.</Li>
              <Li>Use the Platform in any way that violates applicable Philippine law or regulation.</Li>
            </ul>
          </Section>

          <Section title="10. Governing Law">
            <p>
              These Terms are governed by the laws of the Republic of the Philippines. Any disputes arising from these Terms or your use of the Platform shall be subject to the exclusive jurisdiction of the courts of Metro Manila, Philippines.
            </p>
          </Section>

          <Section title="11. Changes to These Terms">
            <p>
              We may revise these Terms at any time. Changes take effect when posted, with the "Last updated" date reflecting the revision. Continued use of the Platform after changes constitutes your acceptance of the updated Terms.
            </p>
          </Section>

          <Section title="12. Contact">
            <p>
              Questions about these Terms? Contact us at{" "}
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
          <Link href="/privacy" className="font-mono text-[10px] uppercase tracking-widest text-[#6E6E73] hover:text-[#F53D04] transition-colors">
            Privacy Policy →
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
