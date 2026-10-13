'use client';

import { useState } from 'react';
import { Camera, X } from 'lucide-react';

const MAX_SIDE = 720;

// Achica la foto en el aparato (lado mayor 720 px, JPEG) para guardarla liviana junto con el registro.
async function shrink(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  let quality = 0.75;
  let url = canvas.toDataURL('image/jpeg', quality);
  while (url.length > 280_000 && quality > 0.3) {
    quality -= 0.15;
    url = canvas.toDataURL('image/jpeg', quality);
  }
  return url;
}

export function PhotoInput({ name = 'photo', defaultValue }: { name?: string; defaultValue?: string | null }) {
  const [value, setValue] = useState(defaultValue ?? '');
  const [error, setError] = useState('');
  return (
    <div className="grid gap-2 text-sm">
      <input type="hidden" name={name} value={value} />
      {value ? (
        <div className="relative w-fit">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="Foto elegida" className="h-32 w-32 rounded-2xl object-cover" />
          <button type="button" onClick={() => setValue('')} aria-label="Quitar la foto" className="absolute -right-2 -top-2 grid h-7 w-7 place-items-center rounded-full bg-neutral-900 text-white"><X size={14} aria-hidden="true" /></button>
        </div>
      ) : (
        <label className="flex w-fit cursor-pointer items-center gap-2 rounded-xl border border-dashed border-neutral-300 px-4 py-3 font-medium dark:border-neutral-700">
          <Camera size={18} aria-hidden="true" />Sumar una foto (opcional)
          <input type="file" accept="image/*" className="sr-only" onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setError('');
            try { setValue(await shrink(file)); } catch { setError('No se pudo usar esa foto. Probá con otra.'); }
          }} />
        </label>
      )}
      {error && <p className="text-xs text-red-700 dark:text-red-300">{error}</p>}
    </div>
  );
}
