import type { Metadata } from 'next';
import LegalPage, { type LegalSection } from '@/components/LegalPage';

export const metadata: Metadata = {
  title: 'Privacy Policy — Learn Quran',
  description: 'What Learn Quran collects, what stays on your device, and the choices you have.',
};

const sections: LegalSection[] = [
  {
    id: 'collect',
    title: 'What we collect',
    body: (
      <ul>
        <li><strong>Account details.</strong> If you sign up, we store your name and email address so you can log in and keep your progress in sync.</li>
        <li><strong>Learning progress.</strong> Streaks, daily goal time, recently opened surahs, bookmarks, liked tracks, memorization progress and Tasbeeh counts. Most of this is kept in your browser’s local storage, on your own device.</li>
        <li><strong>Preferences.</strong> Settings such as reading theme, text size, reciter, translation language and playback speed, also kept on your device.</li>
        <li><strong>Location (optional).</strong> Only if you tap “Use my location”, your device’s location is used to calculate prayer times. We do not store or share it.</li>
        <li><strong>Basic technical data.</strong> Our host, Vercel, may log things like browser type and pages visited to keep the site secure and working.</li>
      </ul>
    ),
  },
  {
    id: 'use',
    title: 'How we use it',
    body: (
      <p>
        Only to run Learn Quran: to sign you in, remember where you stopped reading, show your progress, calculate prayer times and keep the service secure. We do not use your information for advertising or profiling.
      </p>
    ),
  },
  {
    id: 'never',
    title: 'What we don’t do',
    body: (
      <ul>
        <li>We don’t sell or rent your data.</li>
        <li>We don’t show third-party ads.</li>
        <li>We don’t track you across other websites.</li>
      </ul>
    ),
  },
  {
    id: 'third-party',
    title: 'Third-party services',
    body: (
      <>
        <p>
          To keep the site free, Quran text, translations, hadith, fonts and audio are loaded from public services such as Quran.com, EveryAyah, MP3Quran, Islamic Network (AlQuran Cloud), jsDelivr and Google Fonts. When you read or listen, your browser connects to these services directly, so they can see your IP address and the request, as with any website. Their own privacy policies apply.
        </p>
        <p>Links to WhatsApp, Facebook, X, Instagram and YouTube take you to those services, where their policies apply.</p>
      </>
    ),
  },
  {
    id: 'storage',
    title: 'Storage and security',
    body: (
      <p>
        Account data is stored with our hosting providers and protected in transit with HTTPS. No online service can promise perfect security, so please use a strong, unique password and keep it private.
      </p>
    ),
  },
  {
    id: 'choices',
    title: 'Your choices',
    body: (
      <ul>
        <li>Clear your saved progress and preferences at any time by clearing this site’s data in your browser.</li>
        <li>Turn off location access in your browser or device settings whenever you like. Prayer times can still be set by choosing a city.</li>
        <li>Ask us to delete your account and the data tied to it by contacting us below.</li>
      </ul>
    ),
  },
  {
    id: 'children',
    title: 'Children',
    body: (
      <p>
        Learn Quran is suitable for learners of all ages. We don’t knowingly collect personal information from young children, and we encourage parents and teachers to supervise account creation.
      </p>
    ),
  },
  {
    id: 'changes',
    title: 'Changes to this policy',
    body: (
      <p>
        If we change how we handle data, we will update this page and the date above. Continuing to use the site means you accept the updated policy.
      </p>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      updated="24 October 2026"
      intro="Learn Quran is a free platform for reading, listening to and memorizing the Quran. We collect as little information as possible, and only what we need to make the site work for you."
      sections={sections}
      other={{ href: '/terms', label: 'Terms of Use' }}
    />
  );
}
