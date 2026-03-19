import { useEffect, useState } from 'react';
import './AddReleaseForm.css';

export default function AddReleaseForm({
  releases = [],
  onSubmit,
  onCancel,
  initialValues = null,
  mode = 'create'
}) {
  const isEdit = mode === 'edit';
  const [name, setName] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [parentId, setParentId] = useState('');
  const [duplicateFromReleaseId, setDuplicateFromReleaseId] = useState('');
  const [copyOnlyStableItems, setCopyOnlyStableItems] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!initialValues) return;
    setName(initialValues.name ?? '');
    setDate(initialValues.date ?? new Date().toISOString().slice(0, 10));
    setParentId(initialValues.parentId ?? '');
    setDuplicateFromReleaseId('');
    setCopyOnlyStableItems(true);
  }, [initialValues]);

  useEffect(() => {
    if (isEdit || !duplicateFromReleaseId) return;
    const source = releases.find((release) => release.id === duplicateFromReleaseId);
    if (!source) return;
    setName(source.name ? `${source.name} (copy)` : '');
    setDate(source.date ?? new Date().toISOString().slice(0, 10));
    setParentId(source.parentId ?? '');
  }, [duplicateFromReleaseId, isEdit, releases]);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) {
      setError('Название обязательно');
      return;
    }
    try {
      onSubmit({
        name: name.trim(),
        date: date || null,
        parentId: parentId || null,
        duplicateFromReleaseId: !isEdit ? duplicateFromReleaseId || null : null,
        copyOnlyStableItems: !isEdit ? copyOnlyStableItems : null
      });
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <form className="add-release-form" onSubmit={handleSubmit}>
      <h4>{isEdit ? 'Изменить релиз' : 'Новый релиз'}</h4>
      {error && <p className="add-release-form-error">{error}</p>}

      {!isEdit && (
        <>
          <label>
            Duplicate from
            <select value={duplicateFromReleaseId} onChange={(e) => setDuplicateFromReleaseId(e.target.value)}>
              <option value="">— Нет —</option>
              {releases.map((release) => (
                <option key={release.id} value={release.id}>
                  {release.name}
                </option>
              ))}
            </select>
          </label>
          {duplicateFromReleaseId && (
            <label>
              <input
                type="checkbox"
                checked={copyOnlyStableItems}
                onChange={(e) => setCopyOnlyStableItems(e.target.checked)}
              />
              Копировать только stable блоки
            </label>
          )}
        </>
      )}

      <label>
        Название *
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="v26.1.0, Release 2025-01..."
        />
      </label>

      <label>
        Дата
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </label>

      <label>
        Родительский релиз
        <select value={parentId} onChange={(e) => setParentId(e.target.value)}>
          <option value="">— Нет —</option>
          {releases.map((release) => (
            <option key={release.id} value={release.id}>
              {release.name}
            </option>
          ))}
        </select>
      </label>

      <div className="add-release-form-actions">
        <button type="submit" className="btn-add">
          {isEdit ? 'Сохранить' : 'Добавить'}
        </button>
        <button type="button" className="btn-cancel" onClick={onCancel}>
          Отмена
        </button>
      </div>
    </form>
  );
}
