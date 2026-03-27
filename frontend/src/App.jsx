import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  getFoldersTree,
  getFolders,
  getFolder,
  getItem,
  getReleases,
  createFolder,
  createItem,
  updateFolder,
  updateItem,
  deleteFolder,
  createRelease,
  updateRelease,
  deleteRelease
} from './api/atlas';
import FolderTree from './components/FolderTree';
import DescriptionPanel from './components/DescriptionPanel';
import AddDataForm from './components/AddDataForm';
import AddReleaseForm from './components/AddReleaseForm';
import './App.css';

function normalizeTag(value) {
  return String(value ?? '')
    .trim()
    .toUpperCase();
}

function buildTagFilterSet(rawValue) {
  return new Set(
    String(rawValue ?? '')
      .split(',')
      .map((part) => normalizeTag(part))
      .filter(Boolean)
  );
}

function collectTagsFromTree(tree) {
  const tags = new Set();
  const visit = (node) => {
    if (!node) return;
    for (const tag of node.tags ?? []) {
      const normalized = normalizeTag(tag);
      if (normalized) tags.add(normalized);
    }
    for (const child of node.children ?? []) visit(child);
  };
  visit(tree);
  return [...tags].sort((a, b) => a.localeCompare(b));
}

function filterTreeByTags(tree, requiredTags) {
  if (!tree) return null;
  if (!requiredTags || requiredTags.size === 0) return tree;

  const nodeHasRequiredTag = (node) =>
    (node.tags ?? []).some((tag) => requiredTags.has(normalizeTag(tag)));

  const walk = (node) => {
    if (!node) return null;
    const filteredChildren = (node.children ?? []).map(walk).filter(Boolean);

    if (node.type === 'root') {
      return { ...node, children: filteredChildren };
    }

    if (!nodeHasRequiredTag(node) && filteredChildren.length === 0) return null;
    return {
      ...node,
      children: filteredChildren.length > 0 ? filteredChildren : undefined
    };
  };

  return walk(tree);
}

function App() {
  const [treeData, setTreeData] = useState(null);
  const [folders, setFolders] = useState([]);
  const [releases, setReleases] = useState([]);
  const [selectedReleaseId, setSelectedReleaseId] = useState('');
  const [selection, setSelection] = useState(null);
  const [folderData, setFolderData] = useState(null);
  const [itemData, setItemData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [addMode, setAddMode] = useState(null);
  const [showReleaseForm, setShowReleaseForm] = useState(false);
  const [editingReleaseId, setEditingReleaseId] = useState('');
  const [tagFilterInput, setTagFilterInput] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [tree, foldersList, releasesList] = await Promise.all([
        getFoldersTree(selectedReleaseId || null),
        getFolders(selectedReleaseId || null),
        getReleases()
      ]);
      setTreeData(tree);
      setFolders(foldersList);
      setReleases(releasesList);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedReleaseId]);

  const handleAddFolder = useCallback(
    async (body) => {
      await createFolder({
        ...body,
        releaseId: selectedReleaseId || null
      });
      setAddMode(null);
      refresh();
    },
    [refresh, selectedReleaseId]
  );

  const handleAddItem = useCallback(
    async (body) => {
      await createItem({
        ...body,
        releaseId: selectedReleaseId || null
      });
      setAddMode(null);
      refresh();
    },
    [refresh, selectedReleaseId]
  );

  const handleUpdateFolder = useCallback(
    async (id, patch) => {
      await updateFolder(id, patch, selectedReleaseId || null);
      refresh();
    },
    [refresh, selectedReleaseId]
  );

  const handleDeleteFolder = useCallback(
    async (id) => {
      await deleteFolder(id, selectedReleaseId || null);
      setSelection(null);
      setFolderData(null);
      setItemData(null);
      refresh();
    },
    [refresh, selectedReleaseId]
  );

  const handleUpdateItem = useCallback(
    async (id, patch) => {
      await updateItem(id, patch, selectedReleaseId || null);
      refresh();
    },
    [refresh, selectedReleaseId]
  );

  const handleAddRelease = useCallback(
    async (body) => {
      if (editingReleaseId) {
        await updateRelease(editingReleaseId, body);
      } else {
        await createRelease(body);
      }
      setEditingReleaseId('');
      setShowReleaseForm(false);
      refresh();
    },
    [editingReleaseId, refresh]
  );

  const handleDeleteRelease = useCallback(async () => {
    if (!selectedReleaseId) return;
    const release = releases.find((r) => r.id === selectedReleaseId);
    const ok = window.confirm(`Удалить релиз "${release?.name ?? selectedReleaseId}" и его дочерние релизы?`);
    if (!ok) return;
    await deleteRelease(selectedReleaseId);
    setSelectedReleaseId('');
    setShowReleaseForm(false);
    setEditingReleaseId('');
    refresh();
  }, [refresh, releases, selectedReleaseId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const activeTagFilter = useMemo(() => buildTagFilterSet(tagFilterInput), [tagFilterInput]);
  const availableTreeTags = useMemo(() => collectTagsFromTree(treeData), [treeData]);
  const filteredTreeData = useMemo(
    () => filterTreeByTags(treeData, activeTagFilter),
    [treeData, activeTagFilter]
  );
  const selectedRelease = releases.find((r) => r.id === selectedReleaseId) ?? null;
  const highlightedFolderIds = useMemo(
    () => new Set(selectedRelease?.affectedFolderIds ?? []),
    [selectedRelease]
  );
  const highlightedItemIds = useMemo(
    () => new Set(selectedRelease?.affectedItemIds ?? []),
    [selectedRelease]
  );

  const handleToggleHighlight = useCallback(
    async (entityType, entityId) => {
      if (!selectedReleaseId || !entityId) return;
      const currentRelease = releases.find((r) => r.id === selectedReleaseId);
      if (!currentRelease) return;

      const folderIds = new Set(currentRelease.affectedFolderIds ?? []);
      const itemIds = new Set(currentRelease.affectedItemIds ?? []);

      if (entityType === 'folder') {
        if (folderIds.has(entityId)) folderIds.delete(entityId);
        else folderIds.add(entityId);
      } else if (entityType === 'item') {
        if (itemIds.has(entityId)) itemIds.delete(entityId);
        else itemIds.add(entityId);
      }

      await updateRelease(selectedReleaseId, {
        affectedFolderIds: [...folderIds],
        affectedItemIds: [...itemIds]
      });
      refresh();
    },
    [refresh, releases, selectedReleaseId]
  );

  useEffect(() => {
    if (!selection) {
      setFolderData(null);
      setItemData(null);
      return;
    }
    if (selection.type === 'folder') {
      getFolder(selection.id, selectedReleaseId || null)
        .then(setFolderData)
        .catch(() => setFolderData(null));
      setItemData(null);
    } else if (selection.type === 'item') {
      getItem(selection.id, selectedReleaseId || null)
        .then(setItemData)
        .catch(() => setItemData(null));
      setFolderData(null);
    }
  }, [selection, selectedReleaseId]);

  const handleNodeSelect = useCallback((node) => {
    if (!node || !node.type) return;
    setSelection({ type: node.type, id: node.id, ...node });
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <h1>QA Atlas</h1>
        <div className="app-header-actions">
          <select
            className="app-release-select"
            value={selectedReleaseId}
            onChange={(e) => setSelectedReleaseId(e.target.value)}
          >
            <option value="">No release</option>
            {releases.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} {r.date ? `(${r.date})` : ''}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn-add-action"
            onClick={() => {
              setEditingReleaseId('');
              setShowReleaseForm(!showReleaseForm);
            }}
            title="Добавить релиз"
          >
            + Release
          </button>
          {selectedReleaseId && (
            <>
              <button
                type="button"
                className="btn-add-action"
                onClick={() => {
                  setEditingReleaseId(selectedReleaseId);
                  setShowReleaseForm(true);
                }}
                title="Изменить релиз"
              >
                Edit Release
              </button>
              <button
                type="button"
                className="btn-add-action"
                onClick={handleDeleteRelease}
                title="Удалить релиз"
              >
                Delete Release
              </button>
            </>
          )}
          {showReleaseForm && (
            <div className="app-release-form-wrap">
              <AddReleaseForm
                releases={releases}
                mode={editingReleaseId ? 'edit' : 'create'}
                initialValues={editingReleaseId ? selectedRelease : null}
                onSubmit={handleAddRelease}
                onCancel={() => {
                  setShowReleaseForm(false);
                  setEditingReleaseId('');
                }}
              />
            </div>
          )}
          <button className="btn-refresh" onClick={refresh} disabled={loading}>
            {loading ? 'Loading…' : 'Refresh'}
          </button>
          <input
            className="app-release-select app-tag-filter-input"
            list="app-tag-filter-options"
            value={tagFilterInput}
            onChange={(e) => setTagFilterInput(e.target.value)}
            placeholder="Фильтр по лейблам: SMOKE, P1"
          />
          <datalist id="app-tag-filter-options">
            {availableTreeTags.map((tag) => (
              <option key={tag} value={tag} />
            ))}
          </datalist>
        </div>
      </header>

      {error && (
        <div className="app-error">
          {error} — Make sure the backend is running on port 4000.
        </div>
      )}

      <main className="app-main">
        <div className="app-map">
          <div className="app-add-section">
            <button
              type="button"
              className="btn-add-action"
              onClick={() => setAddMode(addMode === 'folder' ? null : 'folder')}
            >
              + Папка
            </button>
            <button
              type="button"
              className="btn-add-action"
              onClick={() => setAddMode(addMode === 'item' ? null : 'item')}
            >
              + Блок
            </button>
            {addMode && (
              <div className="app-add-form-wrap">
                <AddDataForm
                  mode={addMode}
                  folders={folders}
                  selectedReleaseId={selectedReleaseId || null}
                  selectedFolderId={selection?.type === 'folder' ? selection?.id : null}
                  onSubmit={addMode === 'folder' ? handleAddFolder : handleAddItem}
                  onCancel={() => setAddMode(null)}
                />
              </div>
            )}
          </div>
          <FolderTree
            treeData={filteredTreeData}
            onNodeSelect={handleNodeSelect}
            selectedId={selection?.id}
          />
          <p className="app-hint">
            Клик по папке или блоку — детали. Кнопки «+ Папка» и «+ Блок» — добавить вручную.
          </p>
        </div>
        <aside className="app-panel">
          <DescriptionPanel
            selection={selection}
            folderData={folderData}
            itemData={itemData}
            allFolders={folders}
            selectedReleaseId={selectedReleaseId || null}
            releases={releases}
            highlightedFolderIds={highlightedFolderIds}
            highlightedItemIds={highlightedItemIds}
            onCommentAdded={refresh}
            onFolderUpdated={handleUpdateFolder}
            onFolderDeleted={handleDeleteFolder}
            onItemUpdated={handleUpdateItem}
            onToggleHighlight={handleToggleHighlight}
          />
        </aside>
      </main>
    </div>
  );
}

export default App;
