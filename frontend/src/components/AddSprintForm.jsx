import { useState } from 'react';
import './AddSprintForm.css';

export default function AddSprintForm({ onSubmit, onCancel }) {
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState('');
  const [goal, setGoal] = useState('');
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
        startDate: startDate || null,
        endDate: endDate || null,
        goal: goal.trim()
      });
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <form className="add-sprint-form" onSubmit={handleSubmit}>
      <h4>Новый спринт</h4>
      {error && <p className="add-sprint-form-error">{error}</p>}

      <label>
        Название *
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Sprint 1, Sprint 2025-01..."
        />
      </label>

      <label>
        Дата начала
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
        />
      </label>

      <label>
        Дата окончания
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
        />
      </label>

      <label>
        Цель
        <input
          type="text"
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          placeholder="Опционально"
        />
      </label>

      <div className="add-sprint-form-actions">
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
