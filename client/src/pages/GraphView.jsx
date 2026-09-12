import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as api from '../api/client.js';
import { getPageColor } from '../lib/pageColor.js';

const WIDTH = 800;
const HEIGHT = 560;
const CENTER = { x: WIDTH / 2, y: HEIGHT / 2 };

// A simple, dependency-free layout: nodes placed on a circle sized to their
// count, isolated nodes (no edges at all) pulled into a smaller inner ring so
// a workspace with a few heavily-linked pages and a few standalone ones
// doesn't read as one undifferentiated ring. No physics simulation — good
// enough at the scale a real workspace here reaches, and it never jitters.
function layoutNodes(nodes, edges) {
  const linkedIds = new Set();
  edges.forEach((e) => {
    linkedIds.add(e.source);
    linkedIds.add(e.target);
  });
  const linked = nodes.filter((n) => linkedIds.has(n.id));
  const isolated = nodes.filter((n) => !linkedIds.has(n.id));

  const positions = {};
  const place = (list, radius) => {
    list.forEach((n, i) => {
      const angle = (i / Math.max(list.length, 1)) * 2 * Math.PI - Math.PI / 2;
      positions[n.id] = {
        x: CENTER.x + radius * Math.cos(angle),
        y: CENTER.y + radius * Math.sin(angle),
      };
    });
  };

  place(linked, Math.min(WIDTH, HEIGHT) / 2 - 100);
  place(isolated, Math.min(WIDTH, HEIGHT) / 2 - 40);

  return positions;
}

function degreeMap(nodes, edges) {
  const degrees = {};
  nodes.forEach((n) => {
    degrees[n.id] = 0;
  });
  edges.forEach((e) => {
    degrees[e.source] = (degrees[e.source] || 0) + 1;
    degrees[e.target] = (degrees[e.target] || 0) + 1;
  });
  return degrees;
}

// Obsidian-style graph view: every page in the workspace as a node, an edge
// wherever one page links to another (see docs/decisions.md — a link is
// just another page's id appearing inside a block's content). Click a node
// to open that page. Styled as its own dark "space" — deliberately breaking
// from the app's light theme here, the same way Obsidian's own graph view
// reads as a distinct canvas rather than another page in the UI.
export default function GraphView() {
  const navigate = useNavigate();
  const [graph, setGraph] = useState(null);
  const [hoveredId, setHoveredId] = useState(null);

  useEffect(() => {
    api.getWorkspaceGraph().then(setGraph);
  }, []);

  const positions = useMemo(() => {
    if (!graph) return {};
    return layoutNodes(graph.nodes, graph.edges);
  }, [graph]);

  const degrees = useMemo(() => {
    if (!graph) return {};
    return degreeMap(graph.nodes, graph.edges);
  }, [graph]);

  if (!graph) {
    return <div className="p-10 text-sm text-gray-400">Loading graph…</div>;
  }

  if (graph.nodes.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-10 py-12 text-center">
        <p className="text-sm text-gray-400">No pages yet, so there's nothing to graph.</p>
      </div>
    );
  }

  const connectedIds = new Set();
  if (hoveredId) {
    connectedIds.add(hoveredId);
    graph.edges.forEach((e) => {
      if (e.source === hoveredId) connectedIds.add(e.target);
      if (e.target === hoveredId) connectedIds.add(e.source);
    });
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <h1 className="text-2xl font-semibold text-gray-900">Graph</h1>
      <p className="mt-1 mb-4 text-sm text-gray-500">
        Every page in your workspace, connected wherever one links to another. Hover a node to
        see its connections, click to open it.
      </p>
      <div
        className="relative overflow-hidden rounded-xl border border-gray-200 shadow-sm"
        style={{ background: 'radial-gradient(ellipse at center, #ffffff 0%, #f8f9fb 70%, #f1f2f5 100%)' }}
      >
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-[560px] w-full">
          <defs>
            <filter id="node-glow" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            {graph.edges.map((e, i) => {
              const sourceColor = getPageColor(e.source).hex;
              const targetColor = getPageColor(e.target).hex;
              const a = positions[e.source];
              const b = positions[e.target];
              if (!a || !b) return null;
              return (
                <linearGradient key={i} id={`edge-${i}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor={sourceColor} />
                  <stop offset="100%" stopColor={targetColor} />
                </linearGradient>
              );
            })}
          </defs>

          {graph.edges.map((e, i) => {
            const a = positions[e.source];
            const b = positions[e.target];
            if (!a || !b) return null;
            const active = hoveredId && (e.source === hoveredId || e.target === hoveredId);
            const dim = hoveredId && !active;
            return (
              <line
                key={i}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={`url(#edge-${i})`}
                strokeWidth={active ? 2.5 : 1.5}
                opacity={dim ? 0.08 : active ? 0.9 : 0.5}
                style={{ transition: 'opacity 150ms ease, stroke-width 150ms ease' }}
              />
            );
          })}

          {graph.nodes.map((n) => {
            const pos = positions[n.id];
            if (!pos) return null;
            const color = getPageColor(n.id);
            const isHovered = hoveredId === n.id;
            const dim = hoveredId && !connectedIds.has(n.id);
            const radius = 5 + Math.min(degrees[n.id] || 0, 6) * 1.1 + (isHovered ? 2 : 0);
            return (
              <g
                key={n.id}
                transform={`translate(${pos.x}, ${pos.y})`}
                onMouseEnter={() => setHoveredId(n.id)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={() => navigate(`/app/pages/${n.id}`)}
                className="cursor-pointer"
                data-testid="graph-node"
                style={{ transition: 'opacity 150ms ease' }}
                opacity={dim ? 0.25 : 1}
              >
                <circle
                  r={radius}
                  fill={color.hex}
                  filter={isHovered || connectedIds.has(n.id) ? 'url(#node-glow)' : undefined}
                  style={{ transition: 'r 150ms ease' }}
                />
                <circle r={radius} fill="none" stroke="rgba(0,0,0,0.1)" strokeWidth={1} />
                <text
                  y={-radius - 8}
                  textAnchor="middle"
                  className="select-none"
                  fontSize={11}
                  fill={dim ? '#d1d5db' : isHovered ? '#111827' : '#4b5563'}
                  fontWeight={isHovered ? 600 : 400}
                  style={{ transition: 'fill 150ms ease' }}
                >
                  {(n.title || 'Untitled').slice(0, 22)}
                </text>
              </g>
            );
          })}
        </svg>
        <div className="pointer-events-none absolute bottom-3 left-4 text-xs text-gray-500">
          {graph.nodes.length} page{graph.nodes.length === 1 ? '' : 's'} · {graph.edges.length} connection
          {graph.edges.length === 1 ? '' : 's'}
        </div>
      </div>
    </div>
  );
}
