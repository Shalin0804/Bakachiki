import { Mail, Phone, MapPin, Clock, MessageCircle, ArrowUpRight } from 'lucide-react';
import { useSettings } from '../context/store.jsx';
import { useSeo } from '../lib/seo.js';
import { Page, MaskText, Reveal } from '../components/ui.jsx';

export default function Contact() {
  const { settings } = useSettings();
  const c = settings?.contact || {};
  useSeo({ title: 'Contact', description: 'Get in touch with BAKACHIKI for orders, returns, exchanges and collaborations.' });
  const rows = [
    c.email && { icon: Mail, label: 'Email', value: c.email, href: `mailto:${c.email}` },
    c.phone && { icon: Phone, label: 'Phone', value: c.phone, href: `tel:${c.phone.replace(/\s/g, '')}` },
    c.whatsapp && { icon: MessageCircle, label: 'WhatsApp', value: c.whatsapp, href: `https://wa.me/${c.whatsapp.replace(/\D/g, '')}` },
    c.instagram && { icon: ArrowUpRight, label: 'Instagram', value: c.instagram.replace(/^https?:\/\/(www\.)?/, ''), href: c.instagram },
    c.address && { icon: MapPin, label: 'Studio', value: c.address },
    c.hours && { icon: Clock, label: 'Hours', value: c.hours },
  ].filter(Boolean);

  return (
    <Page className="mx-auto max-w-[1600px] px-4 pt-28 sm:px-8 lg:px-10 lg:pt-32">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-8">
        <MaskText as="h1" lines={['Holla at us']} className="display text-6xl sm:text-9xl" inView={false} />
        <p className="hindi text-6xl text-green sm:text-8xl" aria-hidden="true">बाकाचिकी</p>
      </div>
      <p className="mt-8 max-w-xl text-lg text-mute">Orders, returns, size exchanges or a collab idea — reach out and a real human from the BAKACHIKI crew will reply.</p>
      <ul className="mt-12 grid gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((r, i) => (
          <Reveal key={r.label} delay={i * 0.06} className="bg-ink">
            <li className="h-full">
              {r.href ? (
                <a href={r.href} target={r.href.startsWith('http') ? '_blank' : undefined} rel="noreferrer" className="group flex h-full flex-col gap-6 p-8 transition hover:bg-panel">
                  <r.icon className="text-neon" /><span><span className="label block text-mute">{r.label}</span><span className="mt-1 block break-words text-xl font-bold group-hover:text-neon">{r.value}</span></span>
                </a>
              ) : (
                <div className="flex h-full flex-col gap-6 p-8"><r.icon className="text-neon" /><span><span className="label block text-mute">{r.label}</span><span className="mt-1 block text-xl font-bold">{r.value}</span></span></div>
              )}
            </li>
          </Reveal>
        ))}
      </ul>
    </Page>
  );
}
