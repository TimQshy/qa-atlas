import { useState } from 'react';
import './AddReleaseForm.css';

export default function AddReleaseForm({ onSubmit, onCancel }) {
  const [name, setName] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [error, setError] = useState('');

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
        date: date || null
      });
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <form className="add-release-form" onSubmit={handleSubmit}>
      <h4>Новый релиз</h4>
      {error && <p className="add-release-form-error">{error}</p>}

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

      <div className="add-release-form-actions">
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
