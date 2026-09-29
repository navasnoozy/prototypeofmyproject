import { useRef, useState } from 'react';
import { CameraIcon, XIcon } from 'lucide-react';
import { cn } from '@/lib/cn.js';
import { newId } from '@/lib/ids.js';
import { Button } from './Button.jsx';
import { Modal } from './Overlay.jsx';

// A picture from the phone's camera can be several megabytes; the prototype
// keeps only a small JPEG, so a few photos fit in the browser's storage.
function shrink(file, longest = 560) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const k = Math.min(1, longest / Math.max(image.width, image.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.width * k));
      canvas.height = Math.max(1, Math.round(image.height * k));
      canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.6));
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('This file is not a picture.'));
    };
    image.src = url;
  });
}

// The photos of a job or a deficiency. On a phone "Add photo" opens the camera;
// on a computer it opens the file picker.
//   photos     [{ id, name, url, at, by }]
//   onChange   called with the new list (when `editable`)
export function PhotoStrip({ photos = [], onChange, editable = false, by = '', className }) {
  const input = useRef(null);
  const [big, setBig] = useState(null);
  const [busy, setBusy] = useState(false);

  const add = async (files) => {
    setBusy(true);
    const made = [];
    for (const file of files) {
      try {
        made.push({ id: newId('pho'), name: file.name, url: await shrink(file), at: new Date().toISOString(), by });
      } catch {
        // Not a picture: skipped.
      }
    }
    setBusy(false);
    if (made.length > 0) onChange([...photos, ...made]);
  };

  if (!editable && photos.length === 0) return <p className={cn('text-sm text-slate-500', className)}>No photos.</p>;

  return (
    <div className={className}>
      <ul className="flex flex-wrap gap-2">
        {photos.map((p, i) => (
          <li key={p.id} className="relative">
            <button type="button" onClick={() => setBig(p)} className="block overflow-hidden rounded-xl border border-slate-200" aria-label={`Open photo ${i + 1}`}>
              <img src={p.url} alt={`Photo ${i + 1}`} className="size-20 object-cover" />
            </button>
            {editable && (
              <button
                type="button"
                aria-label={`Remove photo ${i + 1}`}
                onClick={() => onChange(photos.filter((x) => x.id !== p.id))}
                className="absolute -right-1.5 -top-1.5 grid size-6 place-items-center rounded-full bg-slate-900 text-white shadow-float"
              >
                <XIcon className="size-3.5" aria-hidden="true" />
              </button>
            )}
          </li>
        ))}
        {editable && (
          <li>
            <button
              type="button"
              onClick={() => input.current?.click()}
              disabled={busy}
              className="grid size-20 place-items-center rounded-xl border border-dashed border-slate-400 text-slate-600 transition-colors duration-150 hover:bg-slate-50 disabled:opacity-50"
            >
              <span className="grid justify-items-center gap-1 text-xs font-medium">
                <CameraIcon className="size-5" aria-hidden="true" />
                {busy ? 'Adding…' : 'Add photo'}
              </span>
            </button>
            <input
              ref={input}
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              hidden
              aria-label="Add photo"
              onChange={(e) => {
                add([...e.target.files]);
                e.target.value = '';
              }}
            />
          </li>
        )}
      </ul>
      <Modal open={Boolean(big)} onClose={() => setBig(null)} title="Photo" width="max-w-lg" footer={<Button onClick={() => setBig(null)}>Close</Button>}>
        {big && <img src={big.url} alt="Photo, larger" className="mt-1 w-full rounded-xl" />}
      </Modal>
    </div>
  );
}
