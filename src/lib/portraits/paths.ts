// BFS over undirected contact edges to find simple paths from src to dst.
// Bounded by maxHops (default 3, max 5). Returns paths as arrays of edge steps
// with contact details for each node along the way. Admin-only callers.

import type { D1Database } from "@cloudflare/workers-types";

export interface PathNode {
  id: string;
  full_name: string;
  company: string | null;
  prestige_tier: string;
}

export interface PathEdge {
  id: string;
  kind: string;
  direction: "outgoing" | "incoming";
  from_id: string;
  to_id: string;
}

export interface IntroPath {
  nodes: PathNode[];
  edges: PathEdge[];
}

export async function findIntroPaths(
  db: D1Database,
  from: string,
  to: string,
  maxHops = 3,
): Promise<IntroPath[]> {
  if (from === to) return [];
  const cap = Math.min(Math.max(maxHops, 1), 5);

  // Load all edges + contact metadata in two queries (not per-node).
  const edgesRs = await db
    .prepare("SELECT id, src_id, dst_id, kind FROM contact_edges")
    .all<{ id: string; src_id: string; dst_id: string; kind: string }>();
  const allEdges = (edgesRs.results ?? []) as Array<{ id: string; src_id: string; dst_id: string; kind: string }>;

  // Adjacency as Map<contact_id, Array<{neighbor, edge_id, kind, direction}>>
  type Adj = Array<{ neighbor: string; edge_id: string; kind: string; direction: "outgoing" | "incoming" }>;
  const adj = new Map<string, Adj>();
  for (const e of allEdges) {
    const fwd = adj.get(e.src_id) ?? []; fwd.push({ neighbor: e.dst_id, edge_id: e.id, kind: e.kind, direction: "outgoing" }); adj.set(e.src_id, fwd);
    const rev = adj.get(e.dst_id) ?? []; rev.push({ neighbor: e.src_id, edge_id: e.id, kind: e.kind, direction: "incoming" }); adj.set(e.dst_id, rev);
  }

  // BFS collecting all simple paths up to `cap` hops.
  interface Frame { path: string[]; edgeIds: string[]; edgeKinds: string[]; directions: Array<"outgoing" | "incoming"> }
  const found: Frame[] = [];
  const queue: Frame[] = [{ path: [from], edgeIds: [], edgeKinds: [], directions: [] }];

  while (queue.length > 0) {
    const f = queue.shift()!;
    const tail = f.path[f.path.length - 1];
    if (tail === to) { found.push(f); continue; }
    if (f.path.length - 1 >= cap) continue;
    const visited = new Set(f.path);
    for (const step of adj.get(tail) ?? []) {
      if (visited.has(step.neighbor)) continue;
      queue.push({
        path: [...f.path, step.neighbor],
        edgeIds: [...f.edgeIds, step.edge_id],
        edgeKinds: [...f.edgeKinds, step.kind],
        directions: [...f.directions, step.direction],
      });
    }
    // Soft cap on work: bail if we're exploring way too much
    if (found.length + queue.length > 10000) break;
  }

  if (found.length === 0) return [];

  // Fetch node details for every id that appears in any path.
  const nodeIds = new Set<string>();
  for (const f of found) for (const id of f.path) nodeIds.add(id);
  const ids = Array.from(nodeIds);
  const placeholders = ids.map(() => "?").join(",");
  const nodesRs = await db
    .prepare(`SELECT id, full_name, company, prestige_tier FROM contacts WHERE id IN (${placeholders}) AND deleted_at IS NULL`)
    .bind(...ids)
    .all<PathNode>();
  const nodesById = new Map((nodesRs.results ?? []).map((n) => [n.id, n as PathNode]));

  // Shape output
  const paths: IntroPath[] = [];
  for (const f of found) {
    const nodes: PathNode[] = f.path.map((id) => nodesById.get(id)).filter((n): n is PathNode => !!n);
    if (nodes.length !== f.path.length) continue; // one of the intermediate contacts was soft-deleted
    const edges: PathEdge[] = f.edgeIds.map((eid, i) => ({
      id: eid,
      kind: f.edgeKinds[i],
      direction: f.directions[i],
      from_id: f.path[i],
      to_id: f.path[i + 1],
    }));
    paths.push({ nodes, edges });
  }
  // Shortest first, then count of outgoing-only (friendlier intros)
  paths.sort((a, b) => a.nodes.length - b.nodes.length || b.edges.filter((e) => e.direction === "outgoing").length - a.edges.filter((e) => e.direction === "outgoing").length);
  return paths.slice(0, 25);
}
