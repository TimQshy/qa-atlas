import { useState, useEffect } from 'react';
import './AddDataForm.css';

export default function AddDataForm({ mode, folders, selectedFolderId, onSubmit, onCancel }) {
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState('');
  const [folderId, setFolderId] = useState(selectedFolderId || '');

  useEffect(() => {
    if (selectedFolderId) setFolderId(selectedFolderId);
  }, [selectedFolderId]);
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('To Do');
  const [tags, setTags] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) {
      setError('Название обязательно');
      return;
    }
    if (mode === 'item' && !folderId) {
      setError('Выберите папку');
      return;
    }
    try {
      if (mode === 'folder') {
        onSubmit({ name: name.trim(), parentId: parentId || null, tags: parseTags(tags) });
      } else {
        onSubmit({
          name: name.trim(),
          folderId,
          description: description.trim(),
          status,
          tags: parseTags(tags)
        });
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const parseTags = (s) => (s ? s.split(/[\s,]+/).filter(Boolean) : []);

  return (
    <form className="add-data-form" onSubmit={handleSubmit}>
      <h4>{mode === 'folder' ? 'Новая папка' : 'Новый тест-кейс'}</h4>
      {error && <p className="add-data-form-error">{error}</p>}

      <label>
        Название *
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={mode === 'folder' ? 'Например: Event' : 'Например: P1-APPLY-01 Submit form'}
        />
      </label>

      {mode === 'item' && (
        <>
          <label>
            Папка *
            <select value={folderId} onChange={(e) => setFolderId(e.target.value)} required>
              <option value="">— Выберите —</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Описание
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Шаги и ожидаемый результат"
              rows={3}
            />
          </label>
          <label>
            Статус
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="To Do">To Do</option>
              <option value="In Progress">In Progress</option>
              <option value="Done">Done</option>
            </select>
          </label>
        </>
      )}

      {mode === 'folder' && (
        <label>
          Родительская папка
          <select value={parentId} onChange={(e) => setParentId(e.target.value)}>
            <option value="">— Корень —</option>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <label>
        Теги (через запятую)
        <input
          type="text"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="APPLY, SMOKE, P1"
        />
      </label>

      <div className="add-data-form-actions">
        <button type="submit" className="btn-add">
          Добавить
        </button>
        <button type="button" className="btn-cancel" onClick={onCancel}>
          Отмена
        </button>
      </div>
    </form>
  );
}
