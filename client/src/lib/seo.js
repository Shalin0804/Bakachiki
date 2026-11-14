import { useEffect } from 'react';

const setMeta = (attr, key, content) => {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) { el = document.createElement('meta'); el.setAttribute(attr, key); document.head.appendChild(el); }
  el.setAttribute('content', content);
};

/** Sets title, description, Open Graph tags and optional JSON-LD for the current page. */
export function useSeo({ title, description, image, jsonLd, noindex } = {}) {
  useEffect(() => {
    const full = title ? `${title} | BAKACHIKI` : 'BAKACHIKI — Hindi Streetwear, Oversized Puff Print Tees';
    document.title = full;
    setMeta('property', 'og:title', full);
    setMeta('property', 'og:url', window.location.href);
    if (description) { setMeta('name', 'description', description); setMeta('property', 'og:description', description); }
    if (image) setMeta('property', 'og:image', new URL(image, window.location.origin).href);
    setMeta('name', 'robots', noindex ? 'noindex,nofollow' : 'index,follow');
    let script;
    if (jsonLd) {
      script = document.createElement('script');
      script.type = 'application/ld+json';
      script.text = JSON.stringify(jsonLd);
      document.head.appendChild(script);
    }
    return () => script?.remove();
  }, [title, description, image, noindex, JSON.stringify(jsonLd)]); // eslint-disable-line react-hooks/exhaustive-deps
}
