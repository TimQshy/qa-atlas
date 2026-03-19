import { useEffect, useState } from 'react';
import './AddSprintForm.css';

export default function AddSprintForm({
  releases = [],
  sprints = [],
  selectedReleaseId = null,
  onSubmit,
  onCancel,
  initialValues = null,
  mode = 'create'
}) {
  const isEdit = mode === 'edit';
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState('');
  const [goal, setGoal] = useState('');
  const [releaseId, setReleaseId] = useState(selectedReleaseId || '');
  const [parentId, setParentId] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!initialValues) return;
    setName(initialValues.name ?? '');
    setStartDate(initialValues.startDate ?? new Date().toISOString().slice(0, 10));
    setEndDate(initialValues.endDate ?? '');
    setGoal(initialValues.goal ?? '');
    setReleaseId(initialValues.releaseId ?? selectedReleaseId ?? '');
    setParentId(initialValues.parentId ?? '');
  }, [initialValues, selectedReleaseId]);

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
        goal: goal.trim(),
        releaseId: releaseId || null,
        parentId: parentId || null
      });
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <form className="add-sprint-form" onSubmit={handleSubmit}>
      <h4>{isEdit ? 'Изменить спринт' : 'Новый спринт'}</h4>
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

      <label>
        Релиз
        <select value={releaseId} onChange={(e) => setReleaseId(e.target.value)}>
          <option value="">— Нет —</option>
          {releases.map((release) => (
            <option key={release.id} value={release.id}>
              {release.name}
            </option>
          ))}
        </select>
      </label>

      <label>
        Родительский спринт
        <select value={parentId} onChange={(e) => setParentId(e.target.value)}>
          <option value="">— Нет —</option>
          {sprints.map((sprint) => (
            <option key={sprint.id} value={sprint.id}>
              {sprint.name}
            </option>
          ))}
        </select>
      </label>

      <div className="add-sprint-form-actions">
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
