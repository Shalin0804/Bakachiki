import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useUi } from '../context/store.jsx';
import { api, asset } from '../lib/api.js';
import { Modal, Price, Spinner } from './ui.jsx';
import PurchasePanel, { useVariantPicker } from './PurchasePanel.jsx';

export default function QuickView() {
  const { quickView: slug, closeQuickView } = useUi();
  const [product, setProduct] = useState(null);
  const [error, setError] = useState('');
  const imgRef = useRef(null);
  const picker = useVariantPicker(product);

  useEffect(() => {
    if (!slug) return;
    setProduct(null); setError('');
    api.get(`/products/${slug}`).then(({ data }) => setProduct(data.product)).catch((e) => setError(e.message));
  }, [slug]);

  const front = product && (product.images.find((i) => i.kind === 'front' && i.color === picker.color) || product.images.find((i) => i.kind === 'front') || product.images[0]);
  const back = product && product.images.find((i) => i.kind === 'back' && i.color === picker.color);

  return (
    <Modal open={Boolean(slug)} onClose={closeQuickView} title="Quick view" wide>
      {!product && !error && <div className="grid h-80 place-items-center"><Spinner /></div>}
      {error && <p className="text-danger">{error}</p>}
      {product && (
        <div className="grid gap-6 md:grid-cols-2">
          <div className="group relative aspect-[5/6] overflow-hidden border border-line bg-ink">
            <img ref={imgRef} src={asset(front?.url)} alt={product.name} className="absolute inset-0 size-full object-contain transition duration-500 group-hover:opacity-0" />
            {back && <img src={asset(back.url)} alt="" aria-hidden="true" className="absolute inset-0 size-full object-contain opacity-0 transition duration-500 group-hover:opacity-100" />}
          </div>
          <div>
            <h3 className="display text-4xl">{product.name}</h3>
            <Price price={product.price} sale={product.sale_price} className="mt-3 text-lg" />
            <p className="mt-4 line-clamp-3 text-sm text-mute">{product.description}</p>
            <div className="mt-6">
              <PurchasePanel product={product} picker={picker} getImageEl={() => imgRef.current} compact onAdded={closeQuickView} />
            </div>
            <Link to={`/product/${product.slug}`} onClick={closeQuickView} className="label mt-6 inline-flex items-center gap-2 text-neon hover:underline">
              Full details & 360° view <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      )}
    </Modal>
  );
}
