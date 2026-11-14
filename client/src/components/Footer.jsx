import { Link } from 'react-router-dom';
import { ArrowUpRight, Mail, Phone, MapPin } from 'lucide-react';
import { useSettings } from '../context/store.jsx';
import { Marquee } from './ui.jsx';

export default function Footer() {
  const { settings } = useSettings();
  const c = settings?.contact || {};
  const year = new Date().getFullYear();
  return (
    <footer className="relative mt-24 overflow-hidden border-t border-line bg-ink">
      <Marquee items={['STAY LOUD', 'बाकाचिकी', 'WEAR HINDI', 'PUFF PRINT ONLY']} speed={34} className="border-b border-line py-4" itemClass="display text-3xl sm:text-5xl text-paper/90" />
      <div className="mx-auto grid max-w-[1600px] gap-12 px-5 py-16 sm:px-8 md:grid-cols-12 lg:px-10">
        <div className="md:col-span-5">
          <p className="hindi text-6xl text-green sm:text-7xl">बाकाचिकी</p>
          <p className="mt-4 max-w-sm text-mute">Funky, unconventional streetwear from India. Oversized tees with loud Hindi type and raised puff print.</p>
          <ul className="mt-8 space-y-3 text-sm">
            {c.email && <li><a className="inline-flex items-center gap-3 hover:text-neon" href={`mailto:${c.email}`}><Mail size={16} />{c.email}</a></li>}
            {c.phone && <li><a className="inline-flex items-center gap-3 hover:text-neon" href={`tel:${c.phone.replace(/\s/g, '')}`}><Phone size={16} />{c.phone}</a></li>}
            {c.address && <li className="inline-flex items-center gap-3 text-mute"><MapPin size={16} />{c.address}</li>}
          </ul>
        </div>
        <FooterCol title="Shop" links={[['/shop', 'All products'], ['/shop/oversized-t-shirts', 'Oversized tees'], ['/shop/graphic-tees', 'Graphic tees'], ['/new-drops', 'New drops'], ['/shop?badge=bestseller', 'Best sellers']]} />
        <FooterCol title="Brand" links={[['/about', 'About'], ['/collections', 'Collections'], ['/contact', 'Contact'], ...(c.instagram ? [[c.instagram, 'Instagram']] : [])]} />
        <FooterCol title="Help" links={[['/account/orders', 'Track order'], ['/account', 'My account'], ['/cart', 'Bag'], ['/contact', 'Returns & exchanges']]} />
      </div>
      <div className="relative select-none px-2" aria-hidden="true">
        <p className="display outline-text-mute text-center text-[24vw] leading-[0.8]">BAKACHIKI</p>
      </div>
      <div className="flex flex-col items-center justify-between gap-3 border-t border-line px-5 py-6 text-xs text-mute sm:flex-row sm:px-10">
        <p>© {year} BAKACHIKI. Made loud in India.</p>
        <p className="label">Puff print · 240 GSM · Drop shoulder</p>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }) {
  return (
    <div className="md:col-span-2">
      <h3 className="label mb-5 text-neon">{title}</h3>
      <ul className="space-y-3">
        {links.map(([href, label]) => (
          <li key={label}>
            {href.startsWith('http')
              ? <a href={href} target="_blank" rel="noreferrer" className="group inline-flex items-center gap-1 hover:text-neon">{label}<ArrowUpRight size={14} className="opacity-0 transition group-hover:opacity-100" /></a>
              : <Link to={href} className="hover:text-neon">{label}</Link>}
          </li>
        ))}
      </ul>
    </div>
  );
}
