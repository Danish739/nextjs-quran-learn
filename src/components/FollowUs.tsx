import type { ReactNode } from 'react';
import { Facebook, Instagram, Linkedin, X as XIcon, ArrowUpRight } from 'lucide-react';
import './FollowUs.css';

interface Social {
  name: string;
  blurb: string;
  /** leave empty until the account exists: the card shows as "Coming soon" instead of linking nowhere */
  href: string;
  from: string;
  to: string;
  icon: ReactNode;
}

const WhatsAppGlyph = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
  </svg>
);

const SOCIALS: Social[] = [
  { name: 'WhatsApp', blurb: 'Weekly Quranic reminders', href: 'https://wa.me/916204130133?text=Assalamu%20Alaikum!%20I%20would%20like%20to%20receive%20weekly%20Quranic%20insights', from: '#25d366', to: '#128c7e', icon: <WhatsAppGlyph /> },
  { name: 'WhatsApp Channel', blurb: 'Updates and new features', href: '', from: '#34d399', to: '#059669', icon: <span className="material-symbols-outlined" aria-hidden="true">campaign</span> },
  { name: 'Facebook', blurb: 'Community and announcements', href: 'https://www.facebook.com/learnquranapp', from: '#4c8bf5', to: '#1459c7', icon: <Facebook size={22} /> },
  { name: 'Instagram', blurb: 'Daily ayahs and reflections', href: 'https://www.instagram.com/learnquranapp_/', from: '#f9a03f', to: '#c0267e', icon: <Instagram size={22} /> },
  { name: 'X', blurb: 'Short updates and tips', href: 'https://x.com/learnquranapp_', from: '#4b5563', to: '#111827', icon: <XIcon size={22} /> },
  { name: 'LinkedIn', blurb: 'Our story and team', href: '', from: '#2f86d6', to: '#0a58a8', icon: <Linkedin size={22} /> },
];

/** "Follow us everywhere": one card per platform, brand-tinted on hover. */
export default function FollowUs() {
  return (
    <section className="fu" aria-labelledby="fu-title">
      <header className="fu-head">
        <p className="fu-kicker">Stay connected</p>
        <h2 id="fu-title">Follow us everywhere</h2>
        <p className="fu-sub">Reminders, new features and learning tips, on the platforms you already use.</p>
      </header>

      <ul className="fu-grid">
        {SOCIALS.map((s, i) => {
          const live = !!s.href;
          const style = { ['--from' as string]: s.from, ['--to' as string]: s.to, ['--i' as string]: i };
          const inner = (
            <>
              <span className="fu-icon">{s.icon}</span>
              <span className="fu-name">{s.name}</span>
              <span className="fu-blurb">{s.blurb}</span>
              <span className="fu-go">
                {live ? <>Follow <ArrowUpRight size={15} /></> : 'Coming soon'}
              </span>
            </>
          );
          return (
            <li key={s.name}>
              {live ? (
                <a className="fu-card" href={s.href} target="_blank" rel="noopener noreferrer" style={style} aria-label={`Follow Learn Quran on ${s.name}`}>
                  {inner}
                </a>
              ) : (
                <div className="fu-card is-soon" style={style} aria-disabled="true">{inner}</div>
              )}
            </li>
          );
        })}
      </ul>

      <div className="fu-apps">
        <span className="fu-app" aria-disabled="true">App Store</span>
        <span className="fu-app" aria-disabled="true">Google Play</span>
        <span className="fu-apps-note">Our app is coming soon, in sha Allah.</span>
      </div>
    </section>
  );
}
