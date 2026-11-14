import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';
import { ArrowRight } from 'lucide-react';
import { useSettings } from '../context/store.jsx';
import { asset } from '../lib/api.js';
import { useSeo } from '../lib/seo.js';
import { Page, MaskText, Reveal, Marquee } from '../components/ui.jsx';

export default function About() {
  const { settings } = useSettings();
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], ['-10%', '10%']);
  const about = settings?.about;
  useSeo({ title: 'About', description: about?.body?.slice(0, 160) });
  if (!about) return null;

  return (
    <Page className="pt-28 lg:pt-32">
      <section className="mx-auto max-w-[1600px] px-4 sm:px-8 lg:px-10">
        <p className="label text-neon">[About]</p>
        <MaskText as="h1" lines={about.title.split(' ').reduce((a, w, i) => (i % 2 ? (a[a.length - 1] += ` ${w}`, a) : [...a, w]), [])} className="display mt-4 text-6xl sm:text-8xl lg:text-[10rem]" inView={false} />
        <p className="hindi mt-2 text-6xl text-green sm:text-8xl" aria-hidden="true">{about.hindi}</p>
      </section>

      <section ref={ref} className="mx-auto mt-20 grid max-w-[1600px] gap-12 px-4 sm:px-8 lg:grid-cols-12 lg:px-10">
        <div className="relative aspect-[5/6] overflow-hidden border border-line lg:col-span-6">
          <motion.img style={{ y }} src={asset(about.image_url)} alt="BAKACHIKI oversized tee" className="absolute inset-0 h-[120%] w-full object-cover" loading="lazy" />
        </div>
        <div className="space-y-6 text-lg leading-relaxed text-paper/85 lg:col-span-5 lg:col-start-8 lg:self-center">
          {about.body.split(/\n+/).map((p, i) => <Reveal key={i} delay={i * 0.1}><p>{p}</p></Reveal>)}
          <Reveal delay={0.3}><Link to="/shop" className="btn btn-solid">Shop the drop<ArrowRight size={16} /></Link></Reveal>
        </div>
      </section>

      <Marquee items={['WEAR HINDI', 'हिंदी पहनो', 'STAY LOUD']} className="mt-28 border-y border-line py-5" itemClass="display text-5xl sm:text-7xl" speed={30} />

      <section className="mx-auto mt-24 grid max-w-[1600px] gap-px border border-line bg-line px-0 sm:grid-cols-3" aria-label="What we stand for">
        {about.pillars?.map((p, i) => (
          <Reveal key={p.title} delay={i * 0.1} className="bg-ink p-8 sm:p-10">
            <p className="font-mono text-sm text-mute">0{i + 1}</p>
            <h2 className="display mt-6 text-5xl text-neon">{p.title}</h2>
            <p className="mt-3 text-mute">{p.body}</p>
          </Reveal>
        ))}
      </section>
    </Page>
  );
}
