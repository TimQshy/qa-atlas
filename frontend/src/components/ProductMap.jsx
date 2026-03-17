import { useCallback } from 'react';
import Tree from 'react-d3-tree';
import './ProductMap.css';

const COVERAGE_GREEN = '#22c55e';
const COVERAGE_YELLOW = '#eab308';
const COVERAGE_RED = '#ef4444';
const BUG_HOT = '#dc2626';

function getNodeColor(nodeDatum) {
  const attrs = nodeDatum.attributes ?? {};
  const type = attrs.type;
  const coverage = attrs.coverage ?? 0;
  const bugCount = attrs.bugCount ?? 0;

  if (type === 'feature') {
    let fill = '#e5e7eb';
    if (coverage >= 80) fill = COVERAGE_GREEN;
    else if (coverage >= 40) fill = COVERAGE_YELLOW;
    else fill = COVERAGE_RED;

    const stroke = bugCount > 5 ? BUG_HOT : '#374151';
    const strokeWidth = bugCount > 5 ? 3 : 1;
    return { fill, stroke, strokeWidth };
  }
  if (type === 'module') return { fill: '#93c5fd', stroke: '#2563eb', strokeWidth: 1 };
  if (type === 'product') return { fill: '#c7d2fe', stroke: '#4f46e5', strokeWidth: 1 };
  return { fill: '#f3f4f6', stroke: '#9ca3af', strokeWidth: 1 };
}

function CustomNode({ nodeDatum, toggleNode, onNodeClick, selectedFeatureId }) {
  const colors = getNodeColor(nodeDatum);
  const attrs = nodeDatum.attributes ?? {};
  const isSelected = attrs.featureId === selectedFeatureId;
  const bugCount = attrs.bugCount ?? 0;

  return (
    <g
      onClick={(e) => {
        e.stopPropagation();
        onNodeClick?.(nodeDatum);
        toggleNode?.();
      }}
      style={{ cursor: 'pointer' }}
    >
      <rect
        x={-60}
        y={-12}
        width={120}
        height={24}
        rx={4}
        fill={colors.fill}
        stroke={isSelected ? '#4f46e5' : colors.stroke}
        strokeWidth={isSelected ? 3 : colors.strokeWidth}
      />
      <text
        x={0}
        y={4}
        textAnchor="middle"
        fill="#1f2937"
        fontSize={12}
        fontWeight={attrs.type === 'feature' ? 600 : 500}
      >
        {nodeDatum.name}
      </text>
      {bugCount > 0 && attrs.type === 'feature' && (
        <text x={55} y={4} textAnchor="start" fill={BUG_HOT} fontSize={10}>
          🐛{bugCount}
        </text>
      )}
    </g>
  );
}

export default function ProductMap({ treeData, onNodeClick, selectedFeatureId }) {
  const renderCustomNode = useCallback(
    (rd3tProps) => (
      <CustomNode
        {...rd3tProps}
        onNodeClick={onNodeClick}
        selectedFeatureId={selectedFeatureId}
      />
    ),
    [onNodeClick, selectedFeatureId]
  );

  if (!treeData) {
    return (
      <div className="product-map product-map--empty">
        <p>Load product tree</p>
      </div>
    );
  }

  if (!treeData.children?.length) {
    return (
      <div className="product-map product-map--empty">
        <p>No modules yet</p>
      </div>
    );
  }

  return (
    <div className="product-map">
      <Tree
        data={treeData}
        orientation="vertical"
        pathFunc="step"
        renderCustomNodeElement={renderCustomNode}
        onNodeClick={(node) => onNodeClick?.(node?.data)}
        collapsible={true}
        zoomable={true}
        draggable={true}
      />
    </div>
  );
}
