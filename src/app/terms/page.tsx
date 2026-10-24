import type { Metadata } from 'next';
import LegalPage, { type LegalSection } from '@/components/LegalPage';

export const metadata: Metadata = {
  title: 'Terms of Use — Learn Quran',
  description: 'The simple ground rules for using Learn Quran.',
};

const sections: LegalSection[] = [
  {
    id: 'free',
    title: 'Free to use',
    body: <p>Learn Quran is provided free of charge, for personal and non-commercial learning, teaching and reflection.</p>,
  },
  {
    id: 'accuracy',
    title: 'Accuracy and religious guidance',
    body: (
      <>
        <p>We work to display the Quran text, translations, hadith and tafseer accurately. Translations and explanations are human interpretations, and mistakes can happen. If you find one, please tell us.</p>
        <p>Learn Quran is a learning aid, not a source of religious rulings. For fatwa or personal religious questions, please consult qualified scholars.</p>
      </>
    ),
  },
  {
    id: 'prayer',
    title: 'Prayer times',
    body: <p>Prayer times are calculated estimates and can differ by method and location. Please check them against your local mosque.</p>,
  },
  {
    id: 'account',
    title: 'Your account',
    body: <p>You’re responsible for keeping your login details secure. Please don’t share your account or misuse the service.</p>,
  },
  {
    id: 'acceptable',
    title: 'Acceptable use',
    body: (
      <>
        <p>Please use the site with respect. Don’t:</p>
        <ul>
          <li>try to disrupt, overload or break into the site;</li>
          <li>scrape it in bulk or copy it as a whole;</li>
          <li>use it for anything unlawful, or in a way that disrespects the Quran or other users.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'content',
    title: 'Content and sources',
    body: (
      <p>
        The site’s design, code and original content belong to Learn Quran. Quran text, translations, tafseer, hadith and recitations are credited to their respective authors and providers, and remain theirs. You may share links and short excerpts for personal and educational use.
      </p>
    ),
  },
  {
    id: 'availability',
    title: 'Availability and no warranty',
    body: (
      <p>
        The service is provided “as is”. Some content comes from outside services that we don’t control, so it may occasionally be slow or unavailable. We may change, pause or discontinue features at any time, and we are not liable for losses from using the site, to the extent the law allows.
      </p>
    ),
  },
  {
    id: 'changes',
    title: 'Changes to these terms',
    body: <p>We may update these terms and will change the date above when we do. Continuing to use the site means you accept the updated version.</p>,
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Use"
      updated="24 October 2026"
      intro="By using Learn Quran, you agree to these terms. If you don’t agree, please don’t use the site."
      sections={sections}
      other={{ href: '/privacy', label: 'Privacy Policy' }}
    />
  );
}
