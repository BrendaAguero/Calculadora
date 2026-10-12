'use client';

// Plantillas: completan el formulario con un material común para no empezar de cero.
const TEMPLATES = [
  { name: 'Yeso', unit: 'g', quantity: '1', purchaseUnit: 'kg' },
  { name: 'Resina epoxi', unit: 'g', quantity: '1', purchaseUnit: 'kg' },
  { name: 'Cera de soja', unit: 'g', quantity: '1', purchaseUnit: 'kg' },
  { name: 'Cemento', unit: 'g', quantity: '1', purchaseUnit: 'kg' },
  { name: 'Pigmento', unit: 'g', quantity: '100', purchaseUnit: 'g' },
  { name: 'Esencia', unit: 'ml', quantity: '100', purchaseUnit: 'ml' },
  { name: 'Mecha', unit: 'unidad', quantity: '10', purchaseUnit: 'unidad' },
  { name: 'Caja o bolsa', unit: 'unidad', quantity: '10', purchaseUnit: 'unidad' },
];

export function MaterialTemplates({ formId }: { formId: string }) {
  const fill = (t: (typeof TEMPLATES)[number]) => {
    const form = document.getElementById(formId) as HTMLFormElement | null;
    if (!form) return;
    const set = (name: string, value: string) => {
      const el = form.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement | null;
      if (el) el.value = value;
    };
    set('name', t.name);
    set('default_unit', t.unit);
    set('purchase_quantity', t.quantity);
    set('purchase_unit', t.purchaseUnit);
    (form.elements.namedItem('purchase_price') as HTMLInputElement | null)?.focus();
  };
  return (
    <section aria-label="Materiales comunes" className="rounded-3xl bg-white p-5 dark:bg-neutral-900">
      <h2 className="font-semibold">¿Es uno de estos?</h2>
      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">Tocá uno y solo te queda poner cuánto pagaste.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {TEMPLATES.map((t) => <button key={t.name} type="button" onClick={() => fill(t)} className="rounded-full bg-orange-100 px-4 py-2 text-sm font-semibold text-orange-900 hover:bg-orange-200 dark:bg-orange-950 dark:text-orange-200">{t.name}</button>)}
      </div>
    </section>
  );
}
