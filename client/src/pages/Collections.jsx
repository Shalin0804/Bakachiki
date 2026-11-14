import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { api, asset } from '../lib/api.js';
import { useSeo } from '../lib/seo.js';
import { Page, MaskText, Reveal, PageLoader, Empty } from '../components/ui.jsx';

export default function Collections() {
  const [list, setList] = useState(null);
  useEffect(() => { api.get('/collections').then(({ data }) => setList(data.collections)).catch(() => setList([])); }, []);
  useSeo({ title: 'Collections', description: 'Every BAKACHIKI drop and series in one place.' });

  return (
    <Page className="mx-auto max-w-[1600px] px-4 pt-32 sm:px-8 lg:px-10">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-8">
        <MaskText as="h1" lines={['Collections']} className="display text-6xl sm:text-9xl" inView={false} />
        <p className="hindi text-6xl text-green sm:text-8xl" aria-hidden="true">बाकाचिकी</p>
      </div>
      {!list ? <PageLoader /> : !list.length ? <div className="mt-10"><Empty title="No collections yet" hindi="बाकाचिकी" /></div> : (
        <ol className="mt-4">
          {list.map((c, i) => (
            <Reveal key={c.id} delay={i * 0.05}>
              <li className="border-b border-line">
                <Link to={`/collections/${c.slug}`} className="group grid items-center gap-6 py-8 md:grid-cols-12">
                  <span className="font-mono text-sm text-mute md:col-span-1">{String(i + 1).padStart(2, '0')}</span>
                  <div className="md:col-span-6">
                    <h2 className="display text-5xl transition group-hover:translate-x-2 group-hover:text-neon sm:text-7xl">{c.name}</h2>
                    {c.tagline && <p className="mt-2 text-mute">{c.tagline}</p>}
                  </div>
                  <div className="relative aspect-[3/2] overflow-hidden border border-line md:col-span-4">
                    {c.image_url && <img src={asset(c.image_url)} alt="" loading="lazy" className="size-full object-cover grayscale transition duration-700 group-hover:scale-105 group-hover:grayscale-0" />}
                  </div>
                  <ArrowUpRight className="hidden size-10 text-mute transition group-hover:rotate-45 group-hover:text-neon md:col-span-1 md:block" />
                </Link>
              </li>
            </Reveal>
          ))}
        </ol>
      )}
    </Page>
  );
}
