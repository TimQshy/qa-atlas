import { useState } from 'react';
import './FolderTree.css';

function FolderNode({ node, depth, onSelect, selectedId }) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children?.length > 0;
  const isFolder = node.type === 'folder';
  const isSelected = selectedId === node.id;

  const handleClick = (e) => {
    e.stopPropagation();
    if (hasChildren && isFolder) {
      setExpanded((v) => !v);
    }
    onSelect?.(node);
  };

  const count = node.count ?? 0;
  const countDisplay = isFolder ? ` (${count}/${count})` : '';

  return (
    <div className="folder-tree-node" style={{ paddingLeft: `${depth * 16 + 8}px` }}>
      <div
        className={`folder-tree-row ${node.affectedByRelease ? 'folder-tree-row--affected' : ''} ${isSelected ? 'folder-tree-row--selected' : ''}`}
        onClick={handleClick}
      >
        <span className="folder-tree-icon">
          {isFolder ? (
            <span className="folder-tree-chevron">{expanded ? '▼' : '▶'}</span>
          ) : (
            <span className="folder-tree-item-dot">•</span>
          )}
        </span>
        <span className="folder-tree-name">
          {node.name}
          {countDisplay}
        </span>
      </div>
      {hasChildren && expanded && (
        <div className="folder-tree-children">
          {node.children.map((child) => (
            <FolderNode
              key={child.id}
              node={child}
              depth={depth + 1}
              onSelect={onSelect}
              selectedId={selectedId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function FolderTree({ treeData, onNodeSelect, selectedId }) {
  if (!treeData) {
    return (
      <div className="folder-tree folder-tree--empty">
        <p>Load folders</p>
      </div>
    );
  }

  const children = treeData.children ?? [];
  if (!children.length) {
    return (
      <div className="folder-tree folder-tree--empty">
        <p>No folders yet. Seed data to get started.</p>
      </div>
    );
  }

  return (
    <div className="folder-tree">
      <div className="folder-tree-header">
        <span className="folder-tree-root-name">{treeData.name ?? 'Test Repository'}</span>
        {treeData.totalCount != null && (
          <span className="folder-tree-root-count">({treeData.totalCount})</span>
        )}
      </div>
      <div className="folder-tree-list">
        {children.map((node) => (
          <FolderNode
            key={node.id}
            node={node}
            depth={0}
            onSelect={onNodeSelect}
            selectedId={selectedId}
          />
        ))}
      </div>
    </div>
  );
}
