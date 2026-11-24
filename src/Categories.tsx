import { useState } from 'react';
import type { FormEvent } from 'react';
import { useApp } from '../store';
import type { Category } from '../types';
import { ConfirmDelete, Field, Icon, ImagePicker, Modal, ProductArt } from '../components/ui';
import { uid } from '../utils';

function CategoryForm({ initial, isNew, onClose }: { initial: Category; isNew: boolean; onClose: () => void }) {
  const { saveCategory } = useApp();
  const [c, setC] = useState<Category>(initial);
  const [error, setError] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (c.name.trim().length < 2) {
      setError('Enter a category name.');
      return;
    }
    if (saveCategory(c)) onClose();
  };

  return (
    <Modal title={isNew ? 'Add category' : 'Edit category'} onClose={onClose}>
      <form className="space-y-4" onSubmit={submit} noValidate>
        <Field label="Category name" htmlFor="cat-name" error={error}>
          <input id="cat-name" className="field" value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} />
        </Field>
        <ImagePicker
          id="cat-image"
          label="Thumbnail image"
          value={c.image}
          onChange={(v) => setC({ ...c, image: v })}
          maxDim={500}
          mime="image/jpeg"
          maxChars={150_000}
          previewClass="h-24 w-32"
          hint="Shown on the store page. A wide, clear picture works best."
        />
        {!isNew ? <p className="text-xs text-ink-500">Renaming a category moves all of its products to the new name automatically.</p> : null}
        <div className="flex justify-end gap-2 border-t border-steel-200 pt-4">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary">
            Save category
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function AdminCategories() {
  const { categories, products, deleteCategory } = useApp();
  const [editing, setEditing] = useState<{ cat: Category; isNew: boolean } | null>(null);
  const count = (name: string) => products.filter((p) => p.category === name).length;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-ink-700">Categories group the store. Deleting one never deletes products: they move to “Uncategorised”.</p>
        <button type="button" className="btn-primary" onClick={() => setEditing({ cat: { id: uid('cat'), name: '', image: '' }, isNew: true })}>
          <Icon name="plus" className="h-4 w-4" /> Add category
        </button>
      </div>
      <ul className="panel divide-y divide-steel-200">
        {categories.map((c) => (
          <li key={c.id} className="flex flex-wrap items-center gap-4 p-3">
            <ProductArt seed={c.name} image={c.image} className="h-14 w-20 shrink-0 border border-steel-200" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{c.name}</p>
              <p className="font-mono text-xs text-ink-500">
                {count(c.name)} product{count(c.name) === 1 ? '' : 's'} (including hidden)
              </p>
            </div>
            <div className="flex items-center gap-4">
              <button type="button" className="inline-flex items-center gap-1 text-sm font-semibold hover:underline" onClick={() => setEditing({ cat: c, isNew: false })} aria-label={`Edit ${c.name}`}>
                <Icon name="edit" className="h-4 w-4" /> Edit
              </button>
              <ConfirmDelete name={c.name} onConfirm={() => deleteCategory(c.id)} />
            </div>
          </li>
        ))}
        {categories.length === 0 ? <li className="p-6 text-center text-ink-500">No categories yet. Add the first one.</li> : null}
      </ul>
      {editing ? <CategoryForm initial={editing.cat} isNew={editing.isNew} onClose={() => setEditing(null)} /> : null}
    </div>
  );
}
