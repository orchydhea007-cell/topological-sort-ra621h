# Topological Sort — Honda RA621H F1 Assembly

> **Step-by-step visualization of Kahn's BFS-based Topological Sort**  
> Penjadwalan Perakitan F1 Honda RA621H · Proyek SDA 2025

![Algorithm](https://img.shields.io/badge/Algorithm-Kahn's%20Topological%20Sort-red?style=for-the-badge)
![Complexity](https://img.shields.io/badge/Complexity-O(V%2BE)-green?style=for-the-badge)
![Language](https://img.shields.io/badge/Algorithm-Python%20via%20Pyodide-blue?style=for-the-badge)
![GitHub Pages Ready](https://img.shields.io/badge/GitHub%20Pages-Ready-black?style=for-the-badge)

---

## 🎯 Tentang Proyek

Visualisasi **interaktif step-by-step** algoritma Kahn untuk Topological Sort pada dataset perakitan mesin Honda RA621H — mesin yang mengantarkan Max Verstappen meraih WDC 2021.

**103 komponen** dengan **216 dependency edges** divisualisasikan sebagai DAG. Kahn's Algorithm memproses dependency tersebut untuk menghasilkan urutan assembly yang valid, dengan kemampuan melihat tiap langkah eksekusi secara detail.

---

## ⚡ Quick Start

### GitHub Pages (Recommended)
Push ke GitHub → Settings → Pages → Deploy from `main` / `root`

> ℹ️ **Python via Pyodide**: Algoritma Kahn (`js/kahn.py`) ditulis dalam Python murni dan dieksekusi langsung di browser menggunakan [Pyodide](https://pyodide.org) (CPython compiled to WebAssembly). Tidak ada server backend diperlukan.

### Local Server
```bash
git clone https://github.com/<username>/topological-sort-ra621h.git
cd topological-sort-ra621h

# Python
python3 -m http.server 8080

# Node
npx serve .

# kemudian buka http://localhost:8080
```

> ⚠️ Jangan buka `index.html` langsung via `file://` — `fetch()` akan diblokir CORS. Gunakan local server.

---

## 🗂️ Struktur Folder

```
topological-sort-ra621h/
│
├── index.html          # Entry point — one file to open
├── README.md
├── .gitignore
│
├── css/
│   └── style.css       # F1 dark theme — Barlow Condensed + JetBrains Mono
│
├── js/
│   ├── kahn.py         # Kahn's algorithm in PYTHON: buildGraph + run (step recorder) + stats
│   │                   # Loaded and executed in-browser via Pyodide (WebAssembly)
│   └── main.js         # UI controller + Pyodide bridge: step navigation, wave grid, in-degree tracker
│
└── data/
    └── components.json # 103 komponen RA621H (id, name, subsystem, deps, duration)
```

---

## 🧠 Algoritma — Kahn's Topological Sort

### Konsep

Topological Sort menghasilkan urutan linear node dalam DAG sehingga untuk setiap edge `(u → v)`, node `u` selalu muncul sebelum `v`. Dalam konteks assembly: **komponen A harus selesai sebelum komponen B bisa dimulai**.

### Pseudocode

```
function kahnSort(graph):
  degree = computeInDegree(graph)          // hitung in-degree tiap node
  queue  = [n for n in nodes if degree[n] == 0]  // root nodes
  order  = []
  waves  = []                              // tiap wave = 1 batch paralel

  while queue not empty:
    wave = snapshot(queue)                 // semua node di queue = 1 wave
    waves.append(wave)
    queue = []

    for node in wave:
      order.append(node)                   // tambah ke urutan output
      for succ in adj[node]:
        degree[succ] -= 1                  // kurangi in-degree successor
        if degree[succ] == 0:
          queue.add(succ)                  // successor siap diproses

  if len(order) < len(nodes):
    raise CycleDetectedError              // siklus terdeteksi
  
  return order, waves
```

### Step-by-Step yang Divisualisasikan

| Phase | Keterangan |
|-------|-----------|
| `INIT` | Hitung in-degree semua node, seed queue dengan root nodes |
| `WAVE` | Wave baru dimulai — semua node di queue bisa dikerjakan paralel |
| `PROCESS` | Satu node diproses: tambah ke order, kurangi in-degree semua successornya |
| `DONE` | Semua node selesai, output final |

### Mengapa Kahn's (BFS) vs DFS?

| | Kahn's (BFS) | DFS-based |
|---|---|---|
| **Wave/parallelism** | Natural — setiap BFS level = 1 wave | Tidak natural |
| **Cycle detection** | Eksplisit: `len(order) < len(nodes)` | Via back-edge detection |
| **Implementasi** | Queue-based, mudah di-trace | Rekursif, stack-based |
| **Relevance ke assembly** | Langsung mapping ke "berapa tim bisa kerja paralel" | — |
| **Complexity** | O(V+E) | O(V+E) |

### Complexity

```
V = 103 nodes
E = 216 edges

Build graph:   O(V + E) = O(319)
Kahn's sort:   O(V + E) = O(319)
─────────────────────────────────
Total:         O(V + E)  ← linear
```

---

## 🎮 Cara Pakai

| Aksi | Cara |
|------|------|
| Step maju | Tombol `Next ›` atau `→` |
| Step mundur | Tombol `‹ Prev` atau `←` |
| Auto-play | Tombol `▶ Play` atau `Space` |
| Jump to step | Klik item di Step Log (kiri) |
| Atur kecepatan | Slider Speed di atas |
| First / Last | `⏮` / `⏭` atau `Home` / `End` |

### Warna Node Card

| Warna | Arti |
|-------|------|
| ⬛ Abu (redup) | Pending — predecessor belum selesai |
| 🟡 Amber | Di queue — siap diproses (semua predecessor selesai) |
| 🔴 Merah | Sedang diproses sekarang |
| 🟢 Hijau | Selesai — masuk sorted order |

---

## 📊 Dataset Stats

| Metrik | Nilai |
|--------|-------|
| Nodes | 103 |
| Edges | 216 |
| Root Nodes (in-degree 0) | 16 |
| Total Waves | ~38 |
| Max Parallel Wave | ~16 |
| Final Node | C103 — Full Car Sign-Off |

---

## 📚 Referensi

1. **Activity Networks Determine Project Performance** — *2023*
2. **A Multi-Object Genetic Algorithm for Assembly Line Balance Optimization** — *2024*  
3. Kahn, A.B. (1962). *Topological sorting of large networks*. Communications of the ACM.

---

## 📄 License

MIT
