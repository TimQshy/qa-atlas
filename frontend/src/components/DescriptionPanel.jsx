import { useState } from 'react';
import { addCommentToFolder, addCommentToItem } from '../api/atlas';
import './DescriptionPanel.css';

function CommentSection({ comments, entityType, entityId, onCommentAdded }) {
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    try {
      if (entityType === 'folder') {
        await addCommentToFolder(entityId, trimmed);
      } else {
        await addCommentToItem(entityId, trimmed);
      }
      setText('');
      onCommentAdded?.();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="description-panel-section description-panel-comments">
      <h4>Комментарии {comments.length > 0 && `(${comments.length})`}</h4>
      {comments.length > 0 && (
        <ul className="description-panel-comment-list">
          {comments.map((c) => (
            <li key={c.id} className="description-panel-comment">
              <p className="description-panel-comment-text">{c.text}</p>
              <span className="description-panel-comment-date">
                {c.createdAt ? new Date(c.createdAt).toLocaleString() : ''}
              </span>
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
        <button type="submit" className="btn-add-comment" disabled={!text.trim() || submitting}>
          {submitting ? 'Сохранение…' : 'Сохранить'}
        </button>
      </form>
    </section>
  );
}

export default function DescriptionPanel({ selection, folderData, itemData, onCommentAdded }) {
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
          <h4>Items ({items.length})</h4>
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

        <CommentSection
          comments={comments}
          entityType="folder"
          entityId={id}
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

        <CommentSection
          comments={comments}
          entityType="item"
          entityId={id}
          onCommentAdded={onCommentAdded}
        />
      </div>
    );
  }

  return null;
}
