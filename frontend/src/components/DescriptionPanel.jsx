import { useEffect, useMemo, useState } from 'react';
import {
  addCommentToFolder,
  addCommentToItem,
  deleteFolderComment,
  deleteItemComment,
  updateFolderComment,
  updateItemComment
} from '../api/atlas';
import './DescriptionPanel.css';

function buildScopeOptions(selectedReleaseId, releases) {
  const options = [
    {
      key: 'global',
      scopeType: null,
      scopeId: null,
      label: 'Общий (без привязки)'
    }
  ];
  if (selectedReleaseId) {
    const release = releases.find((r) => r.id === selectedReleaseId);
    options.push({
      key: `release:${selectedReleaseId}`,
      scopeType: 'release',
      scopeId: selectedReleaseId,
      label: `Release: ${release?.name ?? selectedReleaseId}`
    });
  }
  return options;
}

function resolveScopeLabel(comment, releases) {
  if (comment.scopeType === 'release') {
    const release = releases.find((r) => r.id === comment.scopeId);
    return `Release: ${release?.name ?? comment.scopeId}`;
  }
  return 'Общий';
}

function getDefaultScopeKey(scopeOptions, selectedReleaseId) {
  if (selectedReleaseId) {
    const releaseKey = `release:${selectedReleaseId}`;
    if (scopeOptions.some((opt) => opt.key === releaseKey)) return releaseKey;
  }
  return scopeOptions[0]?.key ?? '';
}

function CommentSection({
  comments,
  entityType,
  entityId,
  selectedReleaseId,
  releases,
  onCommentAdded
}) {
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingText, setEditingText] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const scopeOptions = useMemo(
    () => buildScopeOptions(selectedReleaseId, releases),
    [selectedReleaseId, releases]
  );
  const [selectedScopeKey, setSelectedScopeKey] = useState(
    getDefaultScopeKey(scopeOptions, selectedReleaseId)
  );

  const selectedScope = scopeOptions.find((opt) => opt.key === selectedScopeKey) ?? scopeOptions[0] ?? null;

  useEffect(() => {
    if (!scopeOptions.length) {
      setSelectedScopeKey('');
      return;
    }
    const preferredKey = getDefaultScopeKey(scopeOptions, selectedReleaseId);
    if (!scopeOptions.some((opt) => opt.key === selectedScopeKey)) {
      setSelectedScopeKey(preferredKey);
      return;
    }
    if (selectedScopeKey === 'global' && preferredKey !== 'global') {
      setSelectedScopeKey(preferredKey);
    }
  }, [scopeOptions, selectedScopeKey, selectedReleaseId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    try {
      const payload = {
        text: trimmed,
        scopeType: selectedScope.scopeType,
        scopeId: selectedScope.scopeId,
        releaseId: selectedReleaseId || null
      };
      if (entityType === 'folder') {
        await addCommentToFolder(entityId, payload);
      } else {
        await addCommentToItem(entityId, payload);
      }
      setText('');
      onCommentAdded?.();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (comment) => {
    setEditingId(comment.id);
    setEditingText(comment.text);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingText('');
  };

  const saveEdit = async (comment) => {
    const trimmed = editingText.trim();
    if (!trimmed || savingEdit) return;
    setSavingEdit(true);
    try {
      if (entityType === 'folder') {
        await updateFolderComment(entityId, comment.id, { text: trimmed });
      } else {
        await updateItemComment(entityId, comment.id, { text: trimmed });
      }
      cancelEdit();
      onCommentAdded?.();
    } catch (err) {
      console.error(err);
    } finally {
      setSavingEdit(false);
    }
  };

  const removeComment = async (comment) => {
    try {
      if (entityType === 'folder') {
        await deleteFolderComment(entityId, comment.id);
      } else {
        await deleteItemComment(entityId, comment.id);
      }
      onCommentAdded?.();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <section className="description-panel-section description-panel-comments">
      <h4>Комментарии {comments.length > 0 && `(${comments.length})`}</h4>

      {comments.length > 0 && (
        <ul className="description-panel-comment-list">
          {comments.map((c) => (
            <li key={c.id} className="description-panel-comment">
              {editingId === c.id ? (
                <>
                  <textarea
                    className="description-panel-comment-edit"
                    value={editingText}
                    onChange={(e) => setEditingText(e.target.value)}
                    rows={2}
                  />
                  <div className="description-panel-comment-actions">
                    <button type="button" className="btn-add-comment" onClick={() => saveEdit(c)} disabled={!editingText.trim() || savingEdit}>
                      {savingEdit ? 'Сохранение…' : 'Сохранить'}
                    </button>
                    <button type="button" className="btn-comment-secondary" onClick={cancelEdit}>
                      Отмена
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="description-panel-comment-text">{c.text}</p>
                  <div className="description-panel-comment-meta">
                    <span className="description-panel-comment-date">
                      {c.createdAt ? new Date(c.createdAt).toLocaleString() : ''}
                    </span>
                    <span className="description-panel-comment-scope">
                      {resolveScopeLabel(c, releases)}
                    </span>
                    <button type="button" className="btn-comment-secondary" onClick={() => startEdit(c)}>
                      Изменить
                    </button>
                    <button type="button" className="btn-comment-secondary btn-comment-danger" onClick={() => removeComment(c)}>
                      Удалить
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <form className="description-panel-comment-form" onSubmit={handleSubmit}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Добавить комментарий..."
          rows={2}
          disabled={submitting}
        />
        <div className="description-panel-comment-actions">
          <select
            value={selectedScope?.key ?? ''}
            onChange={(e) => setSelectedScopeKey(e.target.value)}
            disabled={submitting}
          >
            {scopeOptions.map((opt) => (
              <option key={opt.key} value={opt.key}>
                {opt.label}
              </option>
            ))}
          </select>
          <button type="submit" className="btn-add-comment" disabled={!text.trim() || submitting}>
            {submitting ? 'Сохранение…' : 'Сохранить'}
          </button>
        </div>
      </form>
    </section>
  );
}

function parseTags(value) {
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function FolderEditorSection({ folder, allFolders, onFolderUpdated, onFolderDeleted }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(folder.name ?? '');
  const [parentId, setParentId] = useState(folder.parentId ?? '');
  const [tagsText, setTagsText] = useState((folder.tags ?? []).join(', '));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setEditing(false);
    setName(folder.name ?? '');
    setParentId(folder.parentId ?? '');
    setTagsText((folder.tags ?? []).join(', '));
    setError('');
  }, [folder.id, folder.name, folder.parentId, folder.tags]);

  const availableParents = (allFolders ?? []).filter((candidate) => candidate.id !== folder.id);

  const submitEdit = async (event) => {
    event.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      await onFolderUpdated?.(folder.id, {
        name: name.trim(),
        parentId: parentId || null,
        tags: parseTags(tagsText)
      });
      setEditing(false);
    } catch (err) {
      setError(err.message || 'Не удалось сохранить изменения');
    } finally {
      setBusy(false);
    }
  };

  const removeFolder = async () => {
    if (busy) return;
    const ok = window.confirm(`Удалить папку "${folder.name}" и все вложенные элементы?`);
    if (!ok) return;
    setBusy(true);
    setError('');
    try {
      await onFolderDeleted?.(folder.id);
    } catch (err) {
      setError(err.message || 'Не удалось удалить папку');
      setBusy(false);
    }
  };

  if (!editing) {
    return (
      <section className="description-panel-section">
        <div className="description-panel-folder-actions">
          <button type="button" className="btn-comment-secondary" onClick={() => setEditing(true)}>
            Изменить папку
          </button>
          <button type="button" className="btn-comment-secondary btn-comment-danger" onClick={removeFolder} disabled={busy}>
            {busy ? 'Удаление…' : 'Удалить папку'}
          </button>
        </div>
        {error && <p className="description-panel-error">{error}</p>}
      </section>
    );
  }

  return (
    <section className="description-panel-section">
      <h4>Редактировать папку</h4>
      <form className="description-panel-folder-form" onSubmit={submitEdit}>
        <label>
          Название
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label>
          Родительская папка
          <select value={parentId} onChange={(e) => setParentId(e.target.value)}>
            <option value="">— Корень —</option>
            {availableParents.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Теги (через запятую)
          <input type="text" value={tagsText} onChange={(e) => setTagsText(e.target.value)} />
        </label>
        {error && <p className="description-panel-error">{error}</p>}
        <div className="description-panel-folder-actions">
          <button type="submit" className="btn-add-comment" disabled={busy || !name.trim()}>
            {busy ? 'Сохранение…' : 'Сохранить'}
          </button>
          <button
            type="button"
            className="btn-comment-secondary"
            onClick={() => {
              setEditing(false);
              setError('');
              setName(folder.name ?? '');
              setParentId(folder.parentId ?? '');
              setTagsText((folder.tags ?? []).join(', '));
            }}
            disabled={busy}
          >
            Отмена
          </button>
        </div>
      </form>
    </section>
  );
}

function ItemEditorSection({ item, selectedReleaseId, onItemUpdated }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.name ?? '');
  const [description, setDescription] = useState(item.description ?? '');
  const [status, setStatus] = useState(item.status ?? 'To Do');
  const [tagsText, setTagsText] = useState((item.tags ?? []).join(', '));
  const [isStable, setIsStable] = useState(Boolean(item.isStable));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setEditing(false);
    setName(item.name ?? '');
    setDescription(item.description ?? '');
    setStatus(item.status ?? 'To Do');
    setTagsText((item.tags ?? []).join(', '));
    setIsStable(Boolean(item.isStable));
    setError('');
  }, [item.id, item.name, item.description, item.status, item.tags, item.isStable]);

  const submitEdit = async (event) => {
    event.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      await onItemUpdated?.(item.id, {
        name: name.trim(),
        description: description.trim(),
        status,
        tags: parseTags(tagsText),
        isStable
      });
      setEditing(false);
    } catch (err) {
      setError(err.message || 'Не удалось сохранить блок');
    } finally {
      setBusy(false);
    }
  };

  if (!editing) {
    return (
      <section className="description-panel-section">
        <div className="description-panel-folder-actions">
          <button type="button" className="btn-comment-secondary" onClick={() => setEditing(true)}>
            Изменить блок
          </button>
        </div>
        {error && <p className="description-panel-error">{error}</p>}
      </section>
    );
  }

  return (
    <section className="description-panel-section">
      <h4>Редактировать блок</h4>
      <form className="description-panel-folder-form" onSubmit={submitEdit}>
        <label>
          Название
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label>
          Описание
          <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <label>
          Статус
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="To Do">To Do</option>
            <option value="In Progress">In Progress</option>
            <option value="Done">Done</option>
          </select>
        </label>
        <label>
          Теги (через запятую)
          <input type="text" value={tagsText} onChange={(e) => setTagsText(e.target.value)} />
        </label>
        {selectedReleaseId && (
          <label>
            <input type="checkbox" checked={isStable} onChange={(e) => setIsStable(e.target.checked)} />
            Stable блок (копируется при duplicate release)
          </label>
        )}
        {error && <p className="description-panel-error">{error}</p>}
        <div className="description-panel-folder-actions">
          <button type="submit" className="btn-add-comment" disabled={busy || !name.trim()}>
            {busy ? 'Сохранение…' : 'Сохранить'}
          </button>
          <button
            type="button"
            className="btn-comment-secondary"
            onClick={() => {
              setEditing(false);
              setError('');
              setName(item.name ?? '');
              setDescription(item.description ?? '');
              setStatus(item.status ?? 'To Do');
              setTagsText((item.tags ?? []).join(', '));
              setIsStable(Boolean(item.isStable));
            }}
            disabled={busy}
          >
            Отмена
          </button>
        </div>
      </form>
    </section>
  );
}

function HighlightToggleSection({ entityType, entityId, selectedReleaseId, isHighlighted, onToggleHighlight }) {
  if (!selectedReleaseId) return null;
  return (
    <section className="description-panel-section">
      <div className="description-panel-folder-actions">
        <button
          type="button"
          className="btn-comment-secondary"
          onClick={() => onToggleHighlight?.(entityType, entityId)}
        >
          {isHighlighted ? 'Highlight: ON (выключить)' : 'Highlight: OFF (включить)'}
        </button>
      </div>
    </section>
  );
}

export default function DescriptionPanel({
  selection,
  folderData,
  itemData,
  allFolders,
  selectedReleaseId,
  releases,
  highlightedFolderIds,
  highlightedItemIds,
  onCommentAdded,
  onFolderUpdated,
  onFolderDeleted,
  onItemUpdated,
  onToggleHighlight
}) {
  if (!selection) {
    return (
      <div className="description-panel description-panel--empty">
        <p>Select a folder or item</p>
        <span className="description-panel-hint">Click a folder or test case to see details.</span>
      </div>
    );
  }

  const { type, id } = selection;

  if (type === 'folder') {
    const folder = folderData?.folder ?? selection;
    const items = folderData?.items ?? [];
    const tags = folder.tags ?? [];
    const comments = folder.comments ?? [];
    const isHighlighted = highlightedFolderIds?.has(folder.id) ?? false;

    return (
      <div className="description-panel">
        <h3 className="description-panel-title">{folder.name}</h3>
        <p className="description-panel-type">Folder</p>

        {tags.length > 0 && (
          <section className="description-panel-section">
            <h4>Tags</h4>
            <div className="description-panel-tags">
              {tags.map((t, i) => (
                <span key={i} className="badge badge-tag">
                  {t}
                </span>
              ))}
            </div>
          </section>
        )}

        <section className="description-panel-section">
          <h4>Блоки ({items.length})</h4>
          {items.length ? (
            <ul className="description-panel-list">
              {items.map((item) => (
                <li key={item.id}>{item.name}</li>
              ))}
            </ul>
          ) : (
            <p className="description-panel-empty">No items in this folder</p>
          )}
        </section>

        <FolderEditorSection
          folder={folder}
          allFolders={allFolders}
          onFolderUpdated={onFolderUpdated}
          onFolderDeleted={onFolderDeleted}
        />
        <HighlightToggleSection
          entityType="folder"
          entityId={folder.id}
          selectedReleaseId={selectedReleaseId}
          isHighlighted={isHighlighted}
          onToggleHighlight={onToggleHighlight}
        />

        <CommentSection
          comments={comments}
          entityType="folder"
          entityId={id}
          selectedReleaseId={selectedReleaseId}
          releases={releases}
          onCommentAdded={onCommentAdded}
        />
      </div>
    );
  }

  if (type === 'item') {
    const item = itemData ?? selection;
    const tags = item.tags ?? [];
    const tickets = item.tickets ?? [];
    const bugs = item.bugs ?? [];
    const comments = item.comments ?? [];
    const isHighlighted = highlightedItemIds?.has(item.id) ?? false;

    return (
      <div className="description-panel">
        <h3 className="description-panel-title">{item.name}</h3>
        <p className="description-panel-status">Status: {item.status ?? 'To Do'}</p>

        {item.description && (
          <section className="description-panel-section">
            <h4>Description</h4>
            <p className="description-panel-description">{item.description}</p>
          </section>
        )}

        {tags.length > 0 && (
          <section className="description-panel-section">
            <h4>Tags</h4>
            <div className="description-panel-tags">
              {tags.map((t, i) => (
                <span key={i} className="badge badge-tag">
                  {t}
                </span>
              ))}
            </div>
          </section>
        )}

        {tickets.length > 0 && (
          <section className="description-panel-section">
            <h4>Tickets</h4>
            <ul className="description-panel-list">
              {tickets.map((t, i) => (
                <li key={i}>{typeof t === 'string' ? t : t.key}</li>
              ))}
            </ul>
          </section>
        )}

        {bugs.length > 0 && (
          <section className="description-panel-section">
            <h4>Bugs</h4>
            <ul className="description-panel-list">
              {bugs.map((b, i) => (
                <li key={i}>{typeof b === 'string' ? b : b.title ?? b.key}</li>
              ))}
            </ul>
          </section>
        )}

        {!item.description && tags.length === 0 && tickets.length === 0 && bugs.length === 0 && comments.length === 0 && (
          <p className="description-panel-empty">No additional details</p>
        )}

        <ItemEditorSection item={item} selectedReleaseId={selectedReleaseId} onItemUpdated={onItemUpdated} />
        <HighlightToggleSection
          entityType="item"
          entityId={item.id}
          selectedReleaseId={selectedReleaseId}
          isHighlighted={isHighlighted}
          onToggleHighlight={onToggleHighlight}
        />

        <CommentSection
          comments={comments}
          entityType="item"
          entityId={id}
          selectedReleaseId={selectedReleaseId}
          releases={releases}
          onCommentAdded={onCommentAdded}
        />
      </div>
    );
  }

  return null;
}
