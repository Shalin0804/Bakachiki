import { Link } from 'react-router-dom';
import { useSeo } from '../lib/seo.js';
import { Page } from '../components/ui.jsx';

export default function NotFound() {
  useSeo({ title: 'Page not found', noindex: true });
  return (
    <Page className="grid min-h-[80vh] place-items-center px-4 pt-24 text-center">
      <div>
        <p className="display outline-text text-[40vw] leading-none sm:text-[20rem]">404</p>
        <p className="hindi text-5xl text-green">रास्ता भटक गए?</p>
        <p className="mt-3 text-mute">This page went off-grid. The drop didn’t.</p>
        <Link to="/shop" className="btn btn-solid mt-8">Back to the shop</Link>
      </div>
    </Page>
  );
}
