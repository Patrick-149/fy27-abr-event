import { useEffect, useState } from 'react';

export default function EditableList({ items, fields, onChange, idField = 'id' }) {
  const [data, setData] = useState(items);

  useEffect(() => {
    setData(items);
  }, [items]);

  const update = (index, key, value) => {
    const next = data.map((item, i) =>
      i === index ? { ...item, [key]: value } : item
    );
    setData(next);
    onChange(next);
  };

  const add = () => {
    const item = { [idField]: `${Date.now()}` };
    fields.forEach((f) => {
      item[f.key] = f.default !== undefined ? f.default : '';
    });
    const next = [...data, item];
    setData(next);
    onChange(next);
  };

  const remove = (index) => {
    const next = data.filter((_, i) => i !== index);
    setData(next);
    onChange(next);
  };

  return (
    <div className="space-y-3">
      {data.map((item, index) => (
        <div
          key={item[idField] || index}
          className="bg-white border rounded-lg p-3 grid gap-2"
        >
          {fields.map((f) => (
            <div key={f.key}>
              <label className="text-xs font-semibold text-gray-500 uppercase">
                {f.label}
              </label>
              <input
                type={f.type || 'text'}
                value={item[f.key] ?? ''}
                onChange={(e) => update(index, f.key, e.target.value)}
                className="w-full border rounded px-2 py-1"
              />
            </div>
          ))}
          <div className="text-right">
            <button
              type="button"
              onClick={() => remove(index)}
              className="text-red-600 text-sm hover:underline"
            >
              Remove
            </button>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="w-full py-2 border-2 border-dashed border-brand text-brand rounded-lg"
      >
        + Add
      </button>
    </div>
  );
}
