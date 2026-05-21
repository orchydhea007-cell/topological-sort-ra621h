"""
kahn.py
Kahn's Algorithm — BFS-based Topological Sort
Honda RA621H Assembly Scheduling
Complexity: O(V + E)

This Python module is loaded by Pyodide and exposed to the browser
via js.globals so index.html can call it exactly like the old kahn.js.
"""

import json
from collections import defaultdict


def build_graph(components):
    """
    Input  : list of component dicts
    Output : dict with nodes, adj, radj, in_degree
    """
    nodes     = {}          # id -> component
    adj       = defaultdict(set)   # id -> set of successors
    radj      = defaultdict(set)   # id -> set of predecessors
    in_degree = {}          # id -> int

    for c in components:
        cid = c["id"]
        nodes[cid] = c
        in_degree[cid] = 0

    for c in components:
        cid = c["id"]
        for dep in c.get("deps", []):
            if dep not in nodes:
                continue
            adj[dep].add(cid)
            radj[cid].add(dep)
            in_degree[cid] += 1

    return {"nodes": nodes, "adj": adj, "radj": radj, "in_degree": in_degree}


def run(components):
    """
    Kahn's Algorithm with full step recording for UI replay.
    Returns dict: graph, steps, order, waves, valid
    """
    graph = build_graph(components)
    nodes     = graph["nodes"]
    adj       = graph["adj"]
    in_degree = graph["in_degree"]

    # Working copy (mutated during algorithm)
    degree = dict(in_degree)

    steps = []   # every iteration snapshot
    order = []   # final sorted order
    waves = []   # each BFS level = one wave

    # ── STEP 0: Initial state ──
    initial_queue = [cid for cid, d in degree.items() if d == 0]
    steps.append({
        "phase":       "init",
        "description": "Hitung in-degree tiap node. Masukkan semua node dengan in-degree = 0 ke queue awal.",
        "queue":       list(initial_queue),
        "processed":   [],
        "justDone":    [],
        "justQueued":  list(initial_queue),
        "waveIndex":   -1,
        "degree":      dict(degree),
        "order":       [],
    })

    queue    = list(initial_queue)
    wave_idx = 0

    while queue:
        wave      = list(queue)
        new_queue = []
        just_queued = []

        waves.append(wave)

        # ── STEP: Wave starts ──
        steps.append({
            "phase":       "wave-start",
            "description": f"Wave {wave_idx + 1}: {len(wave)} node siap diproses (semua predecessor sudah selesai).",
            "queue":       list(wave),
            "processed":   list(order),
            "justDone":    [],
            "justQueued":  [],
            "waveIndex":   wave_idx,
            "degree":      dict(degree),
            "order":       list(order),
            "wave":        wave,
        })

        for cid in wave:
            order.append(cid)
            freed = []

            for succ in adj[cid]:
                degree[succ] -= 1
                if degree[succ] == 0:
                    new_queue.append(succ)
                    freed.append(succ)
                    just_queued.append(succ)

            # ── STEP: Process single node ──
            name = nodes[cid].get("name", cid)
            freed_str = f" Node baru masuk queue: {', '.join(freed)}." if freed else " Tidak ada successor baru yang siap."
            steps.append({
                "phase":       "process",
                "description": f'Proses {cid} — "{name}". Kurangi in-degree semua successor.{freed_str}',
                "queue":       list(new_queue),
                "processed":   list(order),
                "justDone":    [cid],
                "justQueued":  freed,
                "waveIndex":   wave_idx,
                "degree":      dict(degree),
                "order":       list(order),
                "activeNode":  cid,
                "wave":        wave,
            })

        queue = new_queue
        wave_idx += 1

    valid = len(order) == len(nodes)

    # ── STEP: Final ──
    if valid:
        done_desc = f"✓ Topological sort selesai. {len(order)} node diurutkan dalam {len(waves)} wave. Graph valid — tidak ada siklus."
    else:
        done_desc = f"⚠ Siklus terdeteksi! Hanya {len(order)}/{len(nodes)} node yang bisa diurutkan."

    steps.append({
        "phase":       "done",
        "description": done_desc,
        "queue":       [],
        "processed":   list(order),
        "justDone":    [],
        "justQueued":  [],
        "waveIndex":   wave_idx - 1,
        "degree":      dict(degree),
        "order":       list(order),
        "valid":       valid,
    })

    return {"graph": graph, "steps": steps, "order": order, "waves": waves, "valid": valid}


def stats(graph, waves):
    """Compute summary statistics for display in the header."""
    nodes     = graph["nodes"]
    adj       = graph["adj"]
    in_degree = graph["in_degree"]

    roots  = [cid for cid, d in in_degree.items() if d == 0]
    leaves = [cid for cid in nodes if len(adj[cid]) == 0]
    edge_count = sum(len(s) for s in adj.values())
    wave_sizes = [len(w) for w in waves]

    return {
        "nodeCount":   len(nodes),
        "edgeCount":   edge_count,
        "rootCount":   len(roots),
        "leafCount":   len(leaves),
        "waveCount":   len(waves),
        "maxWaveSize": max(wave_sizes) if wave_sizes else 0,
        "avgWaveSize": f"{len(nodes) / len(waves):.1f}" if waves else "0",
    }


# ── Entry point called from JavaScript ──
def run_from_json(components_json: str) -> str:
    """
    Accepts components as JSON string, returns full result as JSON string.
    This is the bridge called by the browser via Pyodide.
    """
    components = json.loads(components_json)
    result     = run(components)
    graph      = result["graph"]

    # Convert sets to lists so JSON can serialize them
    serializable_graph = {
        "nodes":     graph["nodes"],
        "adj":       {k: list(v) for k, v in graph["adj"].items()},
        "radj":      {k: list(v) for k, v in graph["radj"].items()},
        "in_degree": graph["in_degree"],
    }

    # degree dicts inside steps are plain dicts already
    serializable_result = {
        "graph":  serializable_graph,
        "steps":  result["steps"],
        "order":  result["order"],
        "waves":  result["waves"],
        "valid":  result["valid"],
        "stats":  stats(graph, result["waves"]),
    }

    return json.dumps(serializable_result)
