import { useState, useEffect, useCallback } from 'react';
import {
  getFoldersTree,
  getFolders,
  getFolder,
  getItem,
  getReleases,
  getSprints,
  createFolder,
  createItem,
  createSprint,
  createRelease
} from './api/atlas';
import FolderTree from './components/FolderTree';
import DescriptionPanel from './components/DescriptionPanel';
import AddDataForm from './components/AddDataForm';
import AddSprintForm from './components/AddSprintForm';
import AddReleaseForm from './components/AddReleaseForm';
import './App.css';

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

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [tree, foldersList, releasesList, sprintsList] = await Promise.all([
        getFoldersTree(selectedReleaseId || null, selectedSprintId || null),
        getFolders(),
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
      await createFolder(body);
      setAddMode(null);
      refresh();
    },
    [refresh]
  );

  const handleAddItem = useCallback(
    async (body) => {
      await createItem(body);
      setAddMode(null);
      refresh();
    },
    [refresh]
  );

  const handleAddSprint = useCallback(
    async (body) => {
      await createSprint(body);
      setShowSprintForm(false);
      refresh();
    },
    [refresh]
  );

  const handleAddRelease = useCallback(
    async (body) => {
      await createRelease(body);
      setShowReleaseForm(false);
      refresh();
    },
    [refresh]
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!selection) {
      setFolderData(null);
      setItemData(null);
      return;
    }
    if (selection.type === 'folder') {
      getFolder(selection.id)
        .then(setFolderData)
        .catch(() => setFolderData(null));
      setItemData(null);
    } else if (selection.type === 'item') {
      getItem(selection.id)
        .then(setItemData)
        .catch(() => setItemData(null));
      setFolderData(null);
    }
  }, [selection?.id, selection?.type]);

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
            onClick={() => setShowReleaseForm(!showReleaseForm)}
            title="Добавить релиз"
          >
            + Release
          </button>
          {showReleaseForm && (
            <div className="app-sprint-form-wrap">
              <AddReleaseForm
                onSubmit={handleAddRelease}
                onCancel={() => setShowReleaseForm(false)}
              />
            </div>
          )}
          <select
            className="app-release-select"
            value={selectedSprintId}
            onChange={(e) => setSelectedSprintId(e.target.value)}
          >
            <option value="">No sprint</option>
            {sprints.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} {s.startDate ? `(${s.startDate})` : ''}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn-add-action"
            onClick={() => setShowSprintForm(!showSprintForm)}
            title="Добавить спринт"
          >
            + Sprint
          </button>
          {showSprintForm && (
            <div className="app-sprint-form-wrap">
              <AddSprintForm
                onSubmit={handleAddSprint}
                onCancel={() => setShowSprintForm(false)}
              />
            </div>
          )}
          <button className="btn-refresh" onClick={refresh} disabled={loading}>
            {loading ? 'Loading…' : 'Refresh'}
          </button>
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
              + Тест-кейс
            </button>
            {addMode && (
              <div className="app-add-form-wrap">
                <AddDataForm
                  mode={addMode}
                  folders={folders}
                  selectedFolderId={selection?.type === 'folder' ? selection?.id : null}
                  onSubmit={addMode === 'folder' ? handleAddFolder : handleAddItem}
                  onCancel={() => setAddMode(null)}
                />
              </div>
            )}
          </div>
          <FolderTree
            treeData={treeData}
            onNodeSelect={handleNodeSelect}
            selectedId={selection?.id}
          />
          <p className="app-hint">
            Клик по папке или тесту — детали. Кнопки «+ Папка» и «+ Тест-кейс» — добавить вручную.
          </p>
        </div>
        <aside className="app-panel">
          <DescriptionPanel
            selection={selection}
            folderData={folderData}
            itemData={itemData}
            onCommentAdded={refresh}
          />
        </aside>
      </main>
    </div>
  );
}

export default App;
