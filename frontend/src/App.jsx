import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  getFoldersTree,
  getFolders,
  getFolder,
  getItem,
  getReleases,
  getSprints,
  createFolder,
  createItem,
  updateFolder,
  updateItem,
  deleteFolder,
  createSprint,
  updateSprint,
  deleteSprint,
  createRelease,
  updateRelease,
  deleteRelease
} from './api/atlas';
import FolderTree from './components/FolderTree';
import DescriptionPanel from './components/DescriptionPanel';
import AddDataForm from './components/AddDataForm';
import AddSprintForm from './components/AddSprintForm';
import AddReleaseForm from './components/AddReleaseForm';
import './App.css';

function getDescendantReleaseIds(releases, rootId) {
  if (!rootId) return [];
  const out = [];
  const queue = [rootId];
  const seen = new Set();

  while (queue.length) {
    const current = queue.shift();
    if (seen.has(current)) continue;
    seen.add(current);
    out.push(current);
    for (const release of releases) {
      if ((release.parentId ?? null) === current) {
        queue.push(release.id);
      }
    }
  }

  return out;
}

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
  const [sprints, setSprints] = useState([]);
  const [selectedReleaseId, setSelectedReleaseId] = useState('');
  const [selectedSprintId, setSelectedSprintId] = useState('');
  const [selection, setSelection] = useState(null);
  const [folderData, setFolderData] = useState(null);
  const [itemData, setItemData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [addMode, setAddMode] = useState(null);
  const [showSprintForm, setShowSprintForm] = useState(false);
  const [showReleaseForm, setShowReleaseForm] = useState(false);
  const [editingReleaseId, setEditingReleaseId] = useState('');
  const [editingSprintId, setEditingSprintId] = useState('');
  const [tagFilterInput, setTagFilterInput] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [tree, foldersList, releasesList, sprintsList] = await Promise.all([
        getFoldersTree(selectedReleaseId || null, selectedSprintId || null),
        getFolders(selectedReleaseId || null),
        getReleases(),
        getSprints()
      ]);
      setTreeData(tree);
      setFolders(foldersList);
      setReleases(releasesList);
      setSprints(sprintsList);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedReleaseId, selectedSprintId]);

  const handleAddFolder = useCallback(
    async (body) => {
      await createFolder({
        ...body,
        releaseId: selectedReleaseId || null,
        sprintId: selectedSprintId || null
      });
      setAddMode(null);
      refresh();
    },
    [refresh, selectedReleaseId, selectedSprintId]
  );

  const handleAddItem = useCallback(
    async (body) => {
      await createItem({
        ...body,
        releaseId: selectedReleaseId || null,
        sprintId: selectedSprintId || null
      });
      setAddMode(null);
      refresh();
    },
    [refresh, selectedReleaseId, selectedSprintId]
  );

  const handleUpdateFolder = useCallback(
    async (id, patch) => {
      await updateFolder(id, patch, selectedReleaseId || null, selectedSprintId || null);
      refresh();
    },
    [refresh, selectedReleaseId, selectedSprintId]
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
      await updateItem(id, patch, selectedReleaseId || null, selectedSprintId || null);
      refresh();
    },
    [refresh, selectedReleaseId, selectedSprintId]
  );

  const handleAddSprint = useCallback(
    async (body) => {
      if (editingSprintId) {
        await updateSprint(editingSprintId, body);
      } else {
        await createSprint(body);
      }
      setEditingSprintId('');
      setShowSprintForm(false);
      refresh();
    },
    [editingSprintId, refresh]
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
    const ok = window.confirm(`Удалить релиз "${release?.name ?? selectedReleaseId}" и его дочерние релизы/спринты?`);
    if (!ok) return;
    await deleteRelease(selectedReleaseId);
    setSelectedReleaseId('');
    setSelectedSprintId('');
    setShowReleaseForm(false);
    setEditingReleaseId('');
    refresh();
  }, [refresh, releases, selectedReleaseId]);

  const handleDeleteSprint = useCallback(async () => {
    if (!selectedSprintId) return;
    const sprint = sprints.find((s) => s.id === selectedSprintId);
    const ok = window.confirm(`Удалить спринт "${sprint?.name ?? selectedSprintId}" и вложенные спринты?`);
    if (!ok) return;
    await deleteSprint(selectedSprintId);
    setSelectedSprintId('');
    setShowSprintForm(false);
    setEditingSprintId('');
    refresh();
  }, [refresh, selectedSprintId, sprints]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const visibleSprintIds = selectedReleaseId
    ? new Set(getDescendantReleaseIds(releases, selectedReleaseId))
    : null;
  const visibleSprints = visibleSprintIds
    ? sprints.filter((s) => s.releaseId && visibleSprintIds.has(s.releaseId))
    : sprints;
  const activeTagFilter = useMemo(() => buildTagFilterSet(tagFilterInput), [tagFilterInput]);
  const availableTreeTags = useMemo(() => collectTagsFromTree(treeData), [treeData]);
  const filteredTreeData = useMemo(
    () => filterTreeByTags(treeData, activeTagFilter),
    [treeData, activeTagFilter]
  );
  const selectedRelease = releases.find((r) => r.id === selectedReleaseId) ?? null;
  const selectedSprint = sprints.find((s) => s.id === selectedSprintId) ?? null;

  useEffect(() => {
    if (!selectedSprintId) return;
    if (!visibleSprints.some((s) => s.id === selectedSprintId)) {
      setSelectedSprintId('');
    }
  }, [selectedSprintId, visibleSprints]);

  useEffect(() => {
    if (!selection) {
      setFolderData(null);
      setItemData(null);
      return;
    }
    if (selection.type === 'folder') {
      getFolder(selection.id, selectedReleaseId || null, selectedSprintId || null)
        .then(setFolderData)
        .catch(() => setFolderData(null));
      setItemData(null);
    } else if (selection.type === 'item') {
      getItem(selection.id, selectedReleaseId || null, selectedSprintId || null)
        .then(setItemData)
        .catch(() => setItemData(null));
      setFolderData(null);
    }
  }, [selection, selectedReleaseId, selectedSprintId]);

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
            <div className="app-sprint-form-wrap">
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
          <select
            className="app-release-select"
            value={selectedSprintId}
            onChange={(e) => setSelectedSprintId(e.target.value)}
          >
            <option value="">No sprint</option>
            {visibleSprints.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} {s.startDate ? `(${s.startDate})` : ''}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn-add-action"
            onClick={() => {
              setEditingSprintId('');
              setShowSprintForm(!showSprintForm);
            }}
            title="Добавить спринт"
          >
            + Sprint
          </button>
          {selectedSprintId && (
            <>
              <button
                type="button"
                className="btn-add-action"
                onClick={() => {
                  setEditingSprintId(selectedSprintId);
                  setShowSprintForm(true);
                }}
                title="Изменить спринт"
              >
                Edit Sprint
              </button>
              <button
                type="button"
                className="btn-add-action"
                onClick={handleDeleteSprint}
                title="Удалить спринт"
              >
                Delete Sprint
              </button>
            </>
          )}
          {showSprintForm && (
            <div className="app-sprint-form-wrap">
              <AddSprintForm
                releases={releases}
                sprints={sprints}
                selectedReleaseId={selectedReleaseId || null}
                mode={editingSprintId ? 'edit' : 'create'}
                initialValues={editingSprintId ? selectedSprint : null}
                onSubmit={handleAddSprint}
                onCancel={() => {
                  setShowSprintForm(false);
                  setEditingSprintId('');
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
            selectedSprintId={selectedSprintId || null}
            releases={releases}
            sprints={sprints}
            onCommentAdded={refresh}
            onFolderUpdated={handleUpdateFolder}
            onFolderDeleted={handleDeleteFolder}
            onItemUpdated={handleUpdateItem}
          />
        </aside>
      </main>
    </div>
  );
}

export default App;
