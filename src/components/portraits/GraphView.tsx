import { useEffect, useMemo, useState } from "react";
import ReactFlow, {
  type Node,
  type Edge,
  Background,
  Controls,
  MiniMap,
  MarkerType,
} from "reactflow";
import "reactflow/dist/style.css";

interface GraphContact {
  id: string;
  full_name: string;
  company: string | null;
  prestige_tier: "S" | "A" | "B" | "C" | "D";
}
interface GraphEdgeRow {
  id: string;
  src_id: string;
  dst_id: string;
  kind: string;
}
interface PathEdge { id: string; kind: string; direction: "outgoing" | "incoming"; from_id: string; to_id: string; }
interface IntroPath { nodes: GraphContact[]; edges: PathEdge[]; }

interface Props {
  contacts: GraphContact[];
  edges: GraphEdgeRow[];
}

const TIER_COLOR: Record<string, string> = {
  S: "#f8e08c",
  A: "#e6e8ea",
  B: "#cd8a4e",
  C: "#9a968c",
  D: "#6a665e",
};
const TIER_RADIUS: Record<string, number> = { S: 28, A: 22, B: 18, C: 14, D: 12 };

function circleLayout(contacts: GraphContact[]): Map<string, { x: number; y: number }> {
  // Group by tier, outward rings.
  const byTier: Record<string, GraphContact[]> = { S: [], A: [], B: [], C: [], D: [] };
  for (const c of contacts) byTier[c.prestige_tier].push(c);

  const center = { x: 0, y: 0 };
  const ringRadius = { S: 0, A: 220, B: 400, C: 580, D: 760 };
  const out = new Map<string, { x: number; y: number }>();

  for (const tier of ["S", "A", "B", "C", "D"] as const) {
    const list = byTier[tier];
    if (tier === "S" && list.length <= 1) {
      if (list[0]) out.set(list[0].id, center);
      continue;
    }
    const n = list.length;
    const r = ringRadius[tier];
    for (let i = 0; i < n; i++) {
      const angle = (i / Math.max(n, 1)) * Math.PI * 2 - Math.PI / 2;
      out.set(list[i].id, { x: r * Math.cos(angle), y: r * Math.sin(angle) });
    }
  }
  return out;
}

export default function GraphView({ contacts, edges }: Props) {
  const [fromId, setFromId] = useState<string>("");
  const [toId, setToId] = useState<string>("");
  const [paths, setPaths] = useState<IntroPath[] | null>(null);
  const [loading, setLoading] = useState(false);

  const positions = useMemo(() => circleLayout(contacts), [contacts]);

  const highlightedEdgeIds = useMemo(() => {
    if (!paths || paths.length === 0) return new Set<string>();
    const s = new Set<string>();
    for (const p of paths.slice(0, 3)) for (const e of p.edges) s.add(e.id);
    return s;
  }, [paths]);

  const highlightedNodeIds = useMemo(() => {
    if (!paths || paths.length === 0) return new Set<string>();
    const s = new Set<string>();
    for (const p of paths.slice(0, 3)) for (const n of p.nodes) s.add(n.id);
    return s;
  }, [paths]);

  const rfNodes: Node[] = useMemo(() => contacts.map((c) => {
    const pos = positions.get(c.id) ?? { x: 0, y: 0 };
    const tierColor = TIER_COLOR[c.prestige_tier];
    const size = TIER_RADIUS[c.prestige_tier] * 2;
    const highlighted = highlightedNodeIds.has(c.id);
    return {
      id: c.id,
      position: pos,
      data: { label: c.full_name },
      style: {
        borderRadius: "50%",
        width: size,
        height: size,
        background: "#101010",
        border: `2px solid ${highlighted ? "#d4a89a" : tierColor}`,
        color: "#e8e6e0",
        fontSize: c.prestige_tier === "S" ? 12 : 10,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: 2,
        boxShadow: highlighted ? "0 0 12px rgba(212,168,154,0.5)" : "none",
      },
    };
  }), [contacts, positions, highlightedNodeIds]);

  const rfEdges: Edge[] = useMemo(() => edges.map((e) => {
    const hi = highlightedEdgeIds.has(e.id);
    return {
      id: e.id,
      source: e.src_id,
      target: e.dst_id,
      label: hi ? e.kind.replace(/_/g, " ") : undefined,
      labelStyle: { fill: "#d4a89a", fontSize: 10 },
      labelBgPadding: [4, 2] as [number, number],
      labelBgStyle: { fill: "#0a0a0a" },
      style: { stroke: hi ? "#d4a89a" : "#333", strokeWidth: hi ? 2 : 1 },
      markerEnd: { type: MarkerType.ArrowClosed, color: hi ? "#d4a89a" : "#333" },
    };
  }), [edges, highlightedEdgeIds]);

  async function findPath() {
    if (!fromId || !toId) return;
    setLoading(true);
    setPaths(null);
    try {
      const res = await fetch(`/api/portraits/paths?from=${encodeURIComponent(fromId)}&to=${encodeURIComponent(toId)}&maxHops=4`);
      if (!res.ok) { setPaths([]); return; }
      const data = await res.json() as { paths: IntroPath[] };
      setPaths(data.paths);
    } finally {
      setLoading(false);
    }
  }

  const onNodeClick = (_: unknown, node: Node) => {
    if (!fromId) { setFromId(node.id); return; }
    if (!toId && node.id !== fromId) { setToId(node.id); return; }
    // Reset on a 3rd click
    setFromId(node.id);
    setToId("");
    setPaths(null);
  };

  return (
    <div className="graph-root">
      <div className="graph-controls">
        <label>
          From:
          <select value={fromId} onChange={(e) => setFromId(e.target.value)}>
            <option value="">— pick —</option>
            {contacts.map((c) => (<option key={c.id} value={c.id}>{c.full_name}</option>))}
          </select>
        </label>
        <label>
          To:
          <select value={toId} onChange={(e) => setToId(e.target.value)}>
            <option value="">— pick —</option>
            {contacts.map((c) => (<option key={c.id} value={c.id}>{c.full_name}</option>))}
          </select>
        </label>
        <button onClick={findPath} disabled={!fromId || !toId || loading}>
          {loading ? "Searching…" : "Find paths"}
        </button>
        {paths !== null && (
          <span className="graph-result">
            {paths.length === 0 ? "No path found" : `${paths.length} path${paths.length === 1 ? "" : "s"} found (showing top 3)`}
          </span>
        )}
        <span className="graph-hint">Click any two nodes to pick them.</span>
      </div>

      <div className="graph-canvas">
        <ReactFlow
          nodes={rfNodes}
          edges={rfEdges}
          onNodeClick={onNodeClick}
          fitView
          minZoom={0.2}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#1a1a1a" gap={24} />
          <MiniMap
            nodeColor={(n) => {
              const id = n.id;
              const c = contacts.find((x) => x.id === id);
              return c ? TIER_COLOR[c.prestige_tier] : "#333";
            }}
            maskColor="rgba(0,0,0,0.6)"
            style={{ background: "#0a0a0a", border: "1px solid #2a2a2a" }}
          />
          <Controls />
        </ReactFlow>
      </div>

      {paths && paths.length > 0 && (
        <div className="graph-paths">
          {paths.slice(0, 3).map((p, i) => (
            <div key={i} className="path-row">
              <span className="path-rank">#{i + 1}</span>
              {p.nodes.map((n, ni) => (
                <span key={ni} className="path-chain">
                  <a href={`/room-of-requirement/portraits/${n.id}`}>{n.full_name}</a>
                  {ni < p.edges.length && (
                    <span className="path-step"> —{p.edges[ni].kind.replace(/_/g, " ")}→ </span>
                  )}
                </span>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
