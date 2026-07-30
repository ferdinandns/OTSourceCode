import { useState, useEffect } from "react";

// ─── INVENTORY DATA ────────────────────────────────────────────────────────────

const INVENTORY_DATA = {
  F1: {
    label: "INVENTORY F NO.1",
    color: "#1a3a8f",
    shelves: [
      {
        id: 1,
        items: [
          "SPMTSE0119","SPMTSE0093","SPMTSE0100","SPMTSE0116","SPMTSE0133","SPMTFB0058","SPMTFB0102",
          "SPMTSE0062","SPMTSE0092","SPMTSE0095","SPMTSE0101","SPMTSE0114","SPMTSE0132","SPMTFB0074","SPMTFB0101","SPMTSE0109",
          "SPMTSE0061","SPMTSE0091","SPMTSE0097","SPMTSE0102","SPMTSE0110","SPMTSE0130","SPMTFB0064","SPMTFB0027","SPMTSE0094",
          "SPMTSE0060","SPMTSE0090","SPMTSE0098","SPMTSE0103","SPMTSE0108","SPMTSE0131","SPMTFB0055","SPMTFB0079","SPMTFB0076",
          "SPMTSE0056","SPMTSE0089","SPMTSE0096","SPMTSE0104","SPMTSE0107","SPMTSE0123","SPMTFB0056","SPMTFB0080",
          "SPMTSE0048","SPMTSE0088","SPMTSE0099","SPMTSE0105","SPMTSE0106","SPMTSE0124","SPMTFB0057","SPMTFB0104",
        ],
      },
      {
        id: 2,
        items: [
          "SPMTVE0001","SPMTSH0019","SPMTFB0075","SPMTFB0145","SPMTFB0011","SPMTFB0013",
          "SPMTFB0095","SPMTFB0140","SPMTSW0005","SPMTSE0137","SPMTFB0009","SPMTFB0015",
          "SPMTCY0011","SPMTFB0088","SPMTSE0111","SPMTCO0031","SPMTFB0010","SPMTFB0016",
        ],
      },
      {
        id: 3,
        items: [
          "SPMTFB0089","SPMTSH0012","SPMTFB0128","SPMTFB0129","SPMTF10003","SPMTGE0006",
          "SPMTVA0006","SPMTTR0001","SPMTFB0081","SPMTFB0042","SPMTGE0005",
          "SPMTFI0011","SPMTGE0003","SPMTFB0082","SPMTFB0043","SPMTGE0004",
        ],
      },
      { id: 4, items: ["SPMTSE0039","SPMTSE0063","SPMTSE0120"] },
    ],
  },
  F2: {
    label: "INVENTORY F NO.2",
    color: "#1a3a8f",
    shelves: [
      {
        id: 1,
        items: [
          "SPMTVA0005","SPUTBL0001","SPMTVA0008","SPMTEL0046",
          "SPMTVA0007","SPMTSE0126","SPUTCO0006","SPMTCO0008",
          "SPMTFB0087","SPMTFB0086","SPMTHO0001","SPMTCO0009",
        ],
      },
      {
        id: 2,
        items: [
          "SPMTBL006","SPMTBL0005","SPMTBL0007","SMPTBL0026","SPMTBL0014",
          "SPMTBL0024","SPMTBL0019","SPMTBL0008","SMPTBL0015","SMPTBL0011",
          "SPMTBL0017","SPMTBL0018","SPMTBL0004","SMPTBL0013","SMPTBL0009","SMPTBL0012",
        ],
      },
      { id: 3, items: ["SMPTSE0032","SMPTSE0017","SMPTSE0045","SMPTSE0046"] },
      { id: 4, items: ["SMPTSE0054","SMPTBL0016","SMPTSE0038","SMPTBL0003"] },
      { id: 5, items: ["SMPTSE0037"] },
    ],
  },
  G1: {
    label: "INVENTORY G NO.1",
    color: "#1a3a8f",
    shelves: [
      {
        id: 1,
        items: [
          "SPMTSE0122","SPMTJC0003","SPMTJC0006","SPMTJC0009","SPMTJC0011",
          "SPMTSE0124","SPMTJC0004","SPMTJC0007","SPMTJC0010",
          "SPMTJC0002","SPMTJC0005","SPMTJC0008","SPMTJC0013",
        ],
      },
      {
        id: 2,
        items: [
          "SPMTFI0033","SPMTCY0009","SPMTSH0009","SPMTVC0007","SPMTBE0040","SPMTBE0006",
          "SPMTCY0003","SPMTCY0004","SPMTCY0005","SPMTVA0003","SPMTBE0035","SPMTBE0019","SPMTBE0027",
          "SPMTCY0008","SPMTCY0006","SPMTFI0005","SPMTSH0007","SPMTBE0003","SPMTBE0020","SPMTBE0026",
          "SPMTBE0029","SPMTBE0021","SPMTBE0025","SPMTBE0039","SPMTBE0023","SPMTBE0007",
        ],
      },
      {
        id: 3,
        items: [
          "SPMTCA0009","SPMTFB0143","SPMTSE0004","SPMTSH0011",
          "SPMTCA0006","SPUTFB0144","SPMTBE0036","SPMTSH0003","SPMTSE0043","SPMTSE0138","SPUTGE0043",
          "SPMTCN0002","SPMTSH0013","SPMTSE0052","SPMTSH0004","SPMTSE0044","SPUTGE0010","SPUTGE0048",
          "SPMTVA0004","SPMTFI0004","SPMTSE0055","SPMTSH0005","SPMTSE0057","SPUTGE0011","SPUTGE0042",
          "SPMTCO0024","SPMTSH0006",
        ],
      },
      { id: 4, items: ["SPMTFB0072"] },
    ],
  },
  G2: {
    label: "INVENTORY G NO.2",
    color: "#1a3a8f",
    shelves: [
      { id: 1, items: ["SPUTGE0051"] },
      {
        id: 2,
        items: [
          "SPMTBE0034","SPMTBE0018","SPMTBE0012","SPMTBE0031","SPMTBE0011","SPMTBE0015",
          "SPMTBE0024","SPMTBE0022","SPMTBE0013","SPMTBE0032","SPMTBE0010","SPMTBE0016",
          "SPMTBE0005","SPMTBE0037","SPMTBE0014","SPMTBE0028","SPMTBE0009","SPMTBE0017",
        ],
      },
      {
        id: 3,
        items: [
          "SPMTSE0042","SPMTSE0041","SPMTSE0047",
          // GEA contents (both units)
          "SPMTSE0020","SPMTSE0004","SPMTSE0018","SPMTSE0003","SPMTSE0072","SPMTSE0007","SPMTSE0070",
          "SPMTSE0077","SPMTSE0065","SPMTSE0002","SPMTSE0079","SPMTSE0081","SPMTSE0080","SPMTSE0023",
          "SPMTSE0015","SPMTSE0001","SPMTSE0019","SPMTSE0031","SPMTSE0012","SPMTSE0024","SPMTSE0005",
          "SPMTSE0064","SPMTSE0074","SPMTSE0014","SPMTSE0069","SPMTSE0073","SPMTSE0083","SPMTSE0068",
          "SPMTSE0066","SPMTSE0025","SPMTSE0071","SPMTSE0067","SPMTSE0078",
          "SPMTSE0128","SPMTSE0139","SPMTSE0113","SPMTSE0085","SPMTSE0118","SPMTSE0084","SPMTSE0009",
          "SPMTSE0112","SPMTSE0034","SPMTSE0123","SPMTSE0087","SPMTSE0082","SPMTSE0115","SPMTSE0117",
          "SPMTFB0112",
          "SPMTCA0003","SPMTBE0002","SPMTBE0008","SPMTBE0001","SPMTBE0030",
        ],
      },
      { id: 4, items: ["SPMTFI0012"] },
    ],
  },
  H1: {
    label: "INVENTORY H NO.1",
    color: "#1a3a8f",
    shelves: [
      {
        id: 1,
        items: [
          "SPUTFI0029","SPMTFI0025","SPMTEL0092","SPMTEL0093",
          "SPMTEL0081","SPMTEL0073","SPMTEL0075","SPMTSH0017",
          "SPMTFI0018","SPMTEL0084","SPMTEL0100",
        ],
      },
      {
        id: 2,
        items: [
          "SPMTFB0059","SPMTCO0018","SPMTCO0021","SPMTCO0023","SPMTCO0011",
          "SPUTFI0027","SPMTCO0014","SPUTCO0017","SPMTCO0016","SPMTCO0012",
          "SPUTFI0028","SPMTCO0013","SPUTCO0018","SPMTCO0015","SPMTCO0017",
        ],
      },
      {
        id: 3,
        items: [
          "SPMTCY0014","SPUTCO0004","SPMTEL0048","SPMTCO0010","SPEMTEL0064","SPMTEL0067",
          "SPMTCY0015","SPUTCO0005","SPMTEL0044","SPUTEL0077","SPMTEL0108","SPMTEL0107",
          "SPUTCO0013","SPUTCO0003","SPMTCO0029","SPUTCO0001","SPMTCO0027","SPMTEL0066",
        ],
      },
      {
        id: 4,
        items: ["SPMTSE0033","SPMTEL0058","SPMTSE0006","SPUTFI0021","SPMTEL0069","SPUTFI0020"],
      },
    ],
  },
  H2: {
    label: "INVENTORY H NO.2",
    color: "#1a3a8f",
    shelves: [
      { id: 1, items: ["SPMTFI0034"] },
      {
        id: 2,
        items: [
          "SPMTEL0014","SPMTEL0052","SPMTEL0011","SPMTEL0031",
          "SPMTEL0032","SPMTEL0022","SPMTEL0025","SPMTEL0010","SPMTEL0035",
          "SPUTEL0078","SPMTEL0041","SPMTEL0042","SPMTEL0019","SPMTEL0036",
        ],
      },
      {
        id: 3,
        items: [
          "SPUTEL0095","SPMTCO0026","SPMTEL0047","SPMTEL0043",
          "SPUTEL0072","SPMTEL0055","SPMTEL0045","SPMTEL0053",
          "SPMTEL0063","SPMTEL0054","SPMTEL0056","SPUTFI0022",
        ],
      },
      {
        id: 4,
        items: [
          "SPMTGE0009","SPMTGE0011","SPMTEI0094",
          "SPMTGE0012","SPMTMO0011","SPUTCO0014",
          "SPMTGE0010","SPMTMO0006",
        ],
      },
    ],
  },
  I1: {
    label: "INVENTORY I NO.1",
    color: "#1a3a8f",
    shelves: [
      {
        id: 1,
        items: [
          "SPUTGE0027","SPUTEL0075","SPUTPE0033","SPUTGE0018","SPUTPE0056",
          "SPUTGE0049","SPUTEL0074","SPMTSC0015","SPUTPE0149","SPUTPE0046",
          "SPUTPE0155","SPUTEL0076","SPUTEL0066","SPUTPE0058","SPUTPE0050",
        ],
      },
      {
        id: 2,
        items: [
          "SPUTPE0070","SPUTPE0038","SPUTPE0042","SPMTCO0030","SPUTPE0116","SPUTPE0119",
          "SPUTPE0069","SPUTPE0049","SPUTPE0064","SPUTPE0150","SPUTPE0030","SPUTP0118",
          "SPUTPE0068","SPUTPE0051","SPUTPE0044","SPUTPE0151","SPUTPE0106","SPUTP0115",
        ],
      },
      {
        id: 3,
        items: [
          "SPUTPE0107","SPUTPE0059","SPMTBL0022","SPUTPE0071",
          "SPUTPE0110","SPUTPE0059","SPMTSE0011","SPUTPE0113",
          "SPUTPE0052","SPMTSE0008","SPUTPE0039",
        ],
      },
      {
        id: 4,
        items: ["SMPTBL0023","SPUTPE0061","SPUTPE0105","SPUTPE0154","SPTPUE0141","SPUTPE0117"],
      },
    ],
  },
  I2: {
    label: "INVENTORY I NO.2",
    color: "#1a3a8f",
    shelves: [
      {
        id: 1,
        items: [
          "SPUTEL0051","SPUTPE0128","SPUTPE0021","SPUTEL0013","SPMTEL0161","SPUTEL0003",
          "SPUTEL0032","SPUTPE0136","SPUTPE0122","SPUTEL0091","SPMTEL0086","SPUTGE0052",
          "SSPUTEL0027","SPUTPE0126","SPUTPE0121","SPUTEL0038","SPUTEL0010",
        ],
      },
      {
        id: 2,
        items: [
          "SPUTPE0081","SPUTPE0103","SPUTPE0130","SPUTPE0137","SPUTPE0144","SPUTPE0158","SPUTPE0167","SPUTFI0031","SPMTEL0061",
          "SPUTPE0097","SPUTPE0104","SPUTPE0131","SPTUPE0138","SPUTPE0145","SPUTPE0159","SPUTPE0168","SPMTCO0028","SPMTEL0062",
          "SPUTPE0099","SPUTPE0123","SPUTPE0132","SPUTPE0139","SPUTPE0146","SPUTPE0162","SPUTPE0169","SPUTCA0014","SPMTEL0006",
          "SPUTPE0100","SPUTPE0124","SPUTPE0133","SPUPE0140","SPUTPE0147","SPUTPE0163","SPUTPE0170","SPUTCA0013","SPMTEL0030",
          "SPUTPE0101","SPUTPE0127","SPUTPE0134","SPUTPE0142","SPUTPE0149","SPUTPE0164","SPUTPU0001","SPUTEL0011","SPMTEL0020",
          "SPUTPE0102","SPUTPE0129","SPUTPE0135","SPUTPE0143","SPUTPE0157","SPUTPE0165","SPUTEL0029","SPUTEL0044","SPMTEL0039",
        ],
      },
      {
        id: 3,
        items: [
          "SPUTFI10032","SPUTEL0073","SPUTEL0035","SPUTPE0114",
          "SPMTEL0068","SPUTEL0033","SPUTEL0061",
          "SPUTPE0071","SPUTEL0034",
        ],
      },
      {
        id: 4,
        items: [
          "SPUTPE0152","SPMTEL0017","SPUTPE0060","SPUTPE0108",
          "SPUTCH0013","SPUTPE0040","SPUTPE0109",
          "SPUTPE0072","SPUTEL0059","SPUTGE0022",
        ],
      },
    ],
  },
};

// ─── SEARCH UTIL ───────────────────────────────────────────────────────────────

function searchInventory(query) {
  if (!query.trim()) return [];
  const q = query.trim().toUpperCase();
  const results = [];
  for (const [rackId, rack] of Object.entries(INVENTORY_DATA)) {
    for (const shelf of rack.shelves) {
      for (const item of shelf.items) {
        if (item.includes(q)) {
          results.push({ rackId, rackLabel: rack.label, shelfId: shelf.id, item });
        }
      }
    }
  }
  return results;
}

// ─── RACK MODAL ────────────────────────────────────────────────────────────────

function RackModal({ rackId, onClose, onSearch }) {
  const [search, setSearch] = useState("");
  const rack = INVENTORY_DATA[rackId];
  if (!rack) return null;

  const filtered = search.trim()
    ? rack.shelves.map((s) => ({
        ...s,
        items: s.items.filter((i) => i.includes(search.toUpperCase())),
      })).filter((s) => s.items.length > 0)
    : rack.shelves;

  const totalItems = rack.shelves.reduce((a, s) => a + s.items.length, 0);

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.modalHeader}>
          <div>
            <div style={styles.rackBadge}>{rackId}</div>
            <h2 style={styles.modalTitle}>{rack.label}</h2>
            <p style={styles.modalSubtitle}>{totalItems} items · {rack.shelves.length} shelves</p>
          </div>
          <button style={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* Search within rack */}
        <div style={styles.searchBar}>
          <span style={styles.searchIcon}>⌕</span>
          <input
            style={styles.searchInput}
            placeholder="Search part code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
          {search && (
            <button style={styles.clearBtn} onClick={() => setSearch("")}>✕</button>
          )}
        </div>

        {/* Shelves */}
        <div style={styles.shelvesContainer}>
          {filtered.length === 0 && (
            <div style={styles.noResult}>No items match "{search}"</div>
          )}
          {filtered.map((shelf) => (
            <div key={shelf.id} style={styles.shelfSection}>
              <div style={styles.shelfHeader}>
                <div style={styles.shelfNumber}>SHELF {shelf.id}</div>
                <span style={styles.shelfCount}>{shelf.items.length} items</span>
              </div>
              <div style={styles.itemsGrid}>
                {shelf.items.map((item) => {
                  const highlight = search.trim() && item.includes(search.toUpperCase());
                  return (
                    <div
                      key={item}
                      style={{
                        ...styles.itemChip,
                        ...(highlight ? styles.itemChipHighlight : {}),
                      }}
                    >
                      {item}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── FLOOR PLAN SVG ────────────────────────────────────────────────────────────

function FloorPlan({ onRackClick, activeRack }) {
  const [hovered, setHovered] = useState(null);

  const rackStyle = (id) => ({
    cursor: "pointer",
    transition: "all 0.15s ease",
  });

  const getRackFill = (id) => {
    if (activeRack === id) return "#f59e0b";
    if (hovered === id) return "#3b82f6";
    return "#1d4ed8";
  };

  const getRackStroke = (id) => {
    if (activeRack === id) return "#d97706";
    if (hovered === id) return "#60a5fa";
    return "#1a3a8f";
  };

  return (
    <svg
      viewBox="0 0 900 680"
      style={{ width: "100%", height: "100%", display: "block" }}
      fontFamily="'Courier New', monospace"
    >
      {/* ── Background ── */}
      <rect width="900" height="680" fill="#f8fafc" rx="4" />

      {/* ── Room border ── */}
      <rect x="10" y="10" width="880" height="660" fill="none" stroke="#334155" strokeWidth="3" rx="4" />

      {/* ── Entrance notch (top right) ── */}
      <rect x="590" y="6" width="120" height="14" fill="#94a3b8" rx="2" />
      <text x="650" y="16" textAnchor="middle" fontSize="9" fill="white" fontWeight="bold">PINTU MASUK</text>

      {/* ══════════════════════════════════════════════════════
          NON-INVENTORY SECTION — Racks A–E (left area)
          Each rack: 3 columns (1,2,3) + letter label
         ══════════════════════════════════════════════════════ */}

      {/* NON INVENTORY label top */}
      <text x="280" y="235" textAnchor="middle" fontSize="20" fill="#94a3b8" fontWeight="bold" letterSpacing="4">NON INVENTORY</text>

      {/* NON INVENTORY label bottom */}
      <text x="280" y="460" textAnchor="middle" fontSize="20" fill="#94a3b8" fontWeight="bold" letterSpacing="4">NON INVENTORY</text>

      {/* Rack A */}
      {["1","2","3"].map((n, i) => (
        <rect key={n} x={30 + i * 108} y={30} width={96} height={55} fill="#94a3b8" rx="4" />
      ))}
      {["1","2","3"].map((n, i) => (
        <text key={n} x={78 + i * 108} y={63} textAnchor="middle" fontSize="22" fill="white" fontWeight="bold">{n}</text>
      ))}
      <rect x="360" y="30" width="36" height="55" fill="#1e293b" rx="4" />
      <text x="378" y="63" textAnchor="middle" fontSize="20" fill="white" fontWeight="bold">A</text>

      {/* Rack B */}
      {["1","2","3"].map((n, i) => (
        <rect key={n} x={30 + i * 108} y={100} width={96} height={55} fill="#94a3b8" rx="4" />
      ))}
      {["1","2","3"].map((n, i) => (
        <text key={n} x={78 + i * 108} y={133} textAnchor="middle" fontSize="22" fill="white" fontWeight="bold">{n}</text>
      ))}
      <rect x="360" y="100" width="36" height="55" fill="#1e293b" rx="4" />
      <text x="378" y="133" textAnchor="middle" fontSize="20" fill="white" fontWeight="bold">B</text>

      {/* Rack C */}
      {["1","2","3"].map((n, i) => (
        <rect key={n} x={30 + i * 108} y={270} width={96} height={55} fill="#94a3b8" rx="4" />
      ))}
      {["1","2","3"].map((n, i) => (
        <text key={n} x={78 + i * 108} y={303} textAnchor="middle" fontSize="22" fill="white" fontWeight="bold">{n}</text>
      ))}
      <rect x="360" y="270" width="36" height="55" fill="#1e293b" rx="4" />
      <text x="378" y="303" textAnchor="middle" fontSize="20" fill="white" fontWeight="bold">C</text>

      {/* Rack D */}
      {["1","2","3"].map((n, i) => (
        <rect key={n} x={30 + i * 108} y={340} width={96} height={55} fill="#94a3b8" rx="4" />
      ))}
      {["1","2","3"].map((n, i) => (
        <text key={n} x={78 + i * 108} y={373} textAnchor="middle" fontSize="22" fill="white" fontWeight="bold">{n}</text>
      ))}
      <rect x="360" y="340" width="36" height="55" fill="#1e293b" rx="4" />
      <text x="378" y="373" textAnchor="middle" fontSize="20" fill="white" fontWeight="bold">D</text>

      {/* Rack E (2 rows) */}
      {["1","2","3"].map((n, i) => (
        <rect key={n} x={30 + i * 108} y={510} width={96} height={55} fill="#94a3b8" rx="4" />
      ))}
      {["1","2","3"].map((n, i) => (
        <text key={n} x={78 + i * 108} y={543} textAnchor="middle" fontSize="22" fill="white" fontWeight="bold">{n}</text>
      ))}
      <rect x="360" y="510" width="36" height="55" fill="#1e293b" rx="4" />
      <text x="378" y="543" textAnchor="middle" fontSize="20" fill="white" fontWeight="bold">E</text>

      {/* E second row (partial) */}
      <rect x={138} y={580} width={96} height={55} fill="#94a3b8" rx="4" />
      <text x={186} y={613} textAnchor="middle" fontSize="22" fill="white" fontWeight="bold">2</text>
      <rect x={246} y={580} width={96} height={55} fill="#94a3b8" rx="4" />
      <text x={294} y={613} textAnchor="middle" fontSize="22" fill="white" fontWeight="bold">3</text>
      <rect x="360" y="580" width="36" height="36" fill="#1e293b" rx="4" />
      <text x="378" y="604" textAnchor="middle" fontSize="18" fill="white" fontWeight="bold">E</text>

      {/* ══════════════════════════════════════════════════════
          ADMIN DESK AREA (top right)
         ══════════════════════════════════════════════════════ */}
      <rect x="590" y="30" width="190" height="130" fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="1.5" rx="6" />
      <text x="685" y="100" textAnchor="middle" fontSize="11" fill="#64748b" fontWeight="bold">MEJA ADMIN</text>
      {/* desk icon */}
      <rect x="630" y="50" width="110" height="40" fill="#cbd5e1" rx="4" />
      <circle cx="685" cy="70" r="14" fill="#94a3b8" />

      {/* ══════════════════════════════════════════════════════
          INVENTORY SECTION — label
         ══════════════════════════════════════════════════════ */}
      <text
        x="808" y="420"
        textAnchor="middle"
        fontSize="16"
        fill="#1e293b"
        fontWeight="bold"
        letterSpacing="3"
        transform="rotate(-90,808,420)"
      >
        INVENTORY
      </text>

      {/* Lemari Kaca */}
      <rect x="30" y="625" width="310" height="42" fill="#cbd5e1" stroke="#94a3b8" strokeWidth="1.5" rx="4" />
      <text x="185" y="650" textAnchor="middle" fontSize="12" fill="#475569" fontWeight="bold">LEMARI KACA | TOOLS | APD</text>

      {/* ══════════════════════════════════════════════════════
          CLICKABLE INVENTORY RACKS  F · G · H · I
         ══════════════════════════════════════════════════════ */}

      {/* ─── RACK F (far right, vertical) ─── */}
      {/* F1 */}
      <g
        style={rackStyle("F1")}
        onClick={() => onRackClick("F1")}
        onMouseEnter={() => setHovered("F1")}
        onMouseLeave={() => setHovered(null)}
      >
        <rect x="840" y="30" width="46" height="160" fill={getRackFill("F1")} stroke={getRackStroke("F1")} strokeWidth="2" rx="4"
          style={{ filter: hovered === "F1" ? "drop-shadow(0 0 8px rgba(59,130,246,0.6))" : activeRack === "F1" ? "drop-shadow(0 0 10px rgba(245,158,11,0.7))" : "none" }} />
        <text x="863" y="88" textAnchor="middle" fontSize="11" fill="white" fontWeight="bold" transform="rotate(-90,863,88)">F1</text>
        <text x="863" y="110" textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.8)" transform="rotate(-90,863,110)">
          {INVENTORY_DATA.F1.shelves.reduce((a,s)=>a+s.items.length,0)} items
        </text>
        <rect x="840" y="30" width="46" height="160" fill="transparent" rx="4" />
      </g>

      {/* F label divider */}
      <rect x="840" y="190" width="46" height="6" fill="#334155" />
      <rect x="836" y="186" width="54" height="14" fill="#0f172a" rx="2" />
      <text x="863" y="197" textAnchor="middle" fontSize="11" fill="#f59e0b" fontWeight="bold">F</text>

      {/* F2 */}
      <g
        style={rackStyle("F2")}
        onClick={() => onRackClick("F2")}
        onMouseEnter={() => setHovered("F2")}
        onMouseLeave={() => setHovered(null)}
      >
        <rect x="840" y="200" width="46" height="200" fill={getRackFill("F2")} stroke={getRackStroke("F2")} strokeWidth="2" rx="4"
          style={{ filter: hovered === "F2" ? "drop-shadow(0 0 8px rgba(59,130,246,0.6))" : activeRack === "F2" ? "drop-shadow(0 0 10px rgba(245,158,11,0.7))" : "none" }} />
        <text x="863" y="308" textAnchor="middle" fontSize="11" fill="white" fontWeight="bold" transform="rotate(-90,863,308)">F2</text>
        <text x="863" y="330" textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.8)" transform="rotate(-90,863,330)">
          {INVENTORY_DATA.F2.shelves.reduce((a,s)=>a+s.items.length,0)} items
        </text>
        <rect x="840" y="200" width="46" height="200" fill="transparent" rx="4" />
      </g>

      {/* ─── RACK G ─── */}
      {/* G1 */}
      <g
        style={rackStyle("G1")}
        onClick={() => onRackClick("G1")}
        onMouseEnter={() => setHovered("G1")}
        onMouseLeave={() => setHovered(null)}
      >
        <rect x="610" y="300" width="80" height="140" fill={getRackFill("G1")} stroke={getRackStroke("G1")} strokeWidth="2" rx="6"
          style={{ filter: hovered === "G1" ? "drop-shadow(0 4px 8px rgba(59,130,246,0.5))" : activeRack === "G1" ? "drop-shadow(0 0 10px rgba(245,158,11,0.7))" : "none" }} />
        
        {/* Rotate the group around the exact center: X=650, Y=370 */}
        <g transform="rotate(-90, 650, 370)">
          <text x="650" y="365" textAnchor="middle" fontSize="14" fill="white" fontWeight="bold">G1</text>
          <text x="650" y="382" textAnchor="middle" fontSize="10" fill="rgba(255,255,255,0.8)">
            {INVENTORY_DATA.G1.shelves.reduce((a,s)=>a+s.items.length,0)} items
          </text>
        </g>
        
        <rect x="610" y="300" width="80" height="140" fill="transparent" rx="6" />
      </g>

      {/* G label */}
      <rect x="610" y="446" width="80" height="18" fill="#1e293b" rx="4" />
      <text x="650" y="459" textAnchor="middle" fontSize="11" fill="#f59e0b" fontWeight="bold">G</text>

      {/* G2 */}
      <g
        style={rackStyle("G2")}
        onClick={() => onRackClick("G2")}
        onMouseEnter={() => setHovered("G2")}
        onMouseLeave={() => setHovered(null)}
      >
        <rect x="610" y="470" width="80" height="160" fill={getRackFill("G2")} stroke={getRackStroke("G2")} strokeWidth="2" rx="6"
          style={{ filter: hovered === "G2" ? "drop-shadow(0 4px 8px rgba(59,130,246,0.5))" : activeRack === "G2" ? "drop-shadow(0 0 10px rgba(245,158,11,0.7))" : "none" }} />
        
        <g transform="rotate(-90, 650, 550)">
          <text x="650" y="545" textAnchor="middle" fontSize="14" fill="white" fontWeight="bold">G2</text>
          <text x="650" y="562" textAnchor="middle" fontSize="10" fill="rgba(255,255,255,0.8)">
            {INVENTORY_DATA.G2.shelves.reduce((a,s)=>a+s.items.length,0)} items
          </text>
        </g>

        <rect x="610" y="470" width="80" height="160" fill="transparent" rx="6" />
      </g>

      {/* ─── RACK H ─── */}
      {/* H1 */}
      <g
        style={rackStyle("H1")}
        onClick={() => onRackClick("H1")}
        onMouseEnter={() => setHovered("H1")}
        onMouseLeave={() => setHovered(null)}
      >
        <rect x="710" y="300" width="80" height="140" fill={getRackFill("H1")} stroke={getRackStroke("H1")} strokeWidth="2" rx="6"
          style={{ filter: hovered === "H1" ? "drop-shadow(0 4px 8px rgba(59,130,246,0.5))" : activeRack === "H1" ? "drop-shadow(0 0 10px rgba(245,158,11,0.7))" : "none" }} />
        
        <g transform="rotate(-90, 750, 370)">
          <text x="750" y="365" textAnchor="middle" fontSize="14" fill="white" fontWeight="bold">H1</text>
          <text x="750" y="382" textAnchor="middle" fontSize="10" fill="rgba(255,255,255,0.8)">
            {INVENTORY_DATA.H1.shelves.reduce((a,s)=>a+s.items.length,0)} items
          </text>
        </g>

        <rect x="710" y="300" width="80" height="140" fill="transparent" rx="6" />
      </g>

      {/* H label */}
      <rect x="710" y="446" width="80" height="18" fill="#1e293b" rx="4" />
      <text x="750" y="459" textAnchor="middle" fontSize="11" fill="#f59e0b" fontWeight="bold">H</text>

      {/* H2 */}
      <g
        style={rackStyle("H2")}
        onClick={() => onRackClick("H2")}
        onMouseEnter={() => setHovered("H2")}
        onMouseLeave={() => setHovered(null)}
      >
        <rect x="710" y="470" width="80" height="160" fill={getRackFill("H2")} stroke={getRackStroke("H2")} strokeWidth="2" rx="6"
          style={{ filter: hovered === "H2" ? "drop-shadow(0 4px 8px rgba(59,130,246,0.5))" : activeRack === "H2" ? "drop-shadow(0 0 10px rgba(245,158,11,0.7))" : "none" }} />
        
        <g transform="rotate(-90, 750, 550)">
          <text x="750" y="545" textAnchor="middle" fontSize="14" fill="white" fontWeight="bold">H2</text>
          <text x="750" y="562" textAnchor="middle" fontSize="10" fill="rgba(255,255,255,0.8)">
            {INVENTORY_DATA.H2.shelves.reduce((a,s)=>a+s.items.length,0)} items
          </text>
        </g>

        <rect x="710" y="470" width="80" height="160" fill="transparent" rx="6" />
      </g>


      {/* ─── RIGHT WALL: RACK F & I ─── */}
      
      {/* F1 */}
      <g
        style={rackStyle("F1")}
        onClick={() => onRackClick("F1")}
        onMouseEnter={() => setHovered("F1")}
        onMouseLeave={() => setHovered(null)}
      >
        <rect x="840" y="30" width="50" height="130" fill={getRackFill("F1")} stroke={getRackStroke("F1")} strokeWidth="2" rx="6"
          style={{ filter: hovered === "F1" ? "drop-shadow(0 4px 8px rgba(59,130,246,0.5))" : activeRack === "F1" ? "drop-shadow(0 0 10px rgba(245,158,11,0.7))" : "none" }} />
        
        <g transform="rotate(-90, 865, 95)">
          <text x="865" y="90" textAnchor="middle" fontSize="13" fill="white" fontWeight="bold">F1</text>
          <text x="865" y="106" textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.8)">
            {INVENTORY_DATA.F1.shelves.reduce((a,s)=>a+s.items.length,0)} items
          </text>
        </g>

        <rect x="840" y="30" width="50" height="130" fill="transparent" rx="6" />
      </g>

      {/* F label divider */}
      <rect x="840" y="166" width="50" height="18" fill="#1e293b" rx="4" />
      <text x="865" y="179" textAnchor="middle" fontSize="11" fill="#f59e0b" fontWeight="bold">F</text>

      {/* F2 */}
      <g
        style={rackStyle("F2")}
        onClick={() => onRackClick("F2")}
        onMouseEnter={() => setHovered("F2")}
        onMouseLeave={() => setHovered(null)}
      >
        <rect x="840" y="190" width="50" height="130" fill={getRackFill("F2")} stroke={getRackStroke("F2")} strokeWidth="2" rx="6"
          style={{ filter: hovered === "F2" ? "drop-shadow(0 4px 8px rgba(59,130,246,0.5))" : activeRack === "F2" ? "drop-shadow(0 0 10px rgba(245,158,11,0.7))" : "none" }} />
        
        <g transform="rotate(-90, 865, 255)">
          <text x="865" y="250" textAnchor="middle" fontSize="13" fill="white" fontWeight="bold">F2</text>
          <text x="865" y="266" textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.8)">
            {INVENTORY_DATA.F2.shelves.reduce((a,s)=>a+s.items.length,0)} items
          </text>
        </g>

        <rect x="840" y="190" width="50" height="130" fill="transparent" rx="6" />
      </g>

      {/* I1 */}
      <g
        style={rackStyle("I1")}
        onClick={() => onRackClick("I1")}
        onMouseEnter={() => setHovered("I1")}
        onMouseLeave={() => setHovered(null)}
      >
        <rect x="840" y="330" width="50" height="110" fill={getRackFill("I1")} stroke={getRackStroke("I1")} strokeWidth="2" rx="6"
          style={{ filter: hovered === "I1" ? "drop-shadow(0 4px 8px rgba(59,130,246,0.5))" : activeRack === "I1" ? "drop-shadow(0 0 10px rgba(245,158,11,0.7))" : "none" }} />
        
        <g transform="rotate(-90, 865, 385)">
          <text x="865" y="380" textAnchor="middle" fontSize="13" fill="white" fontWeight="bold">I1</text>
          <text x="865" y="396" textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.8)">
            {INVENTORY_DATA.I1.shelves.reduce((a,s)=>a+s.items.length,0)} items
          </text>
        </g>

        <rect x="840" y="330" width="50" height="110" fill="transparent" rx="6" />
      </g>

      {/* I label divider */}
      <rect x="840" y="446" width="50" height="18" fill="#1e293b" rx="4" />
      <text x="865" y="459" textAnchor="middle" fontSize="11" fill="#f59e0b" fontWeight="bold">I</text>

      {/* I2 */}
      <g
        style={rackStyle("I2")}
        onClick={() => onRackClick("I2")}
        onMouseEnter={() => setHovered("I2")}
        onMouseLeave={() => setHovered(null)}
      >
        <rect x="840" y="470" width="50" height="160" fill={getRackFill("I2")} stroke={getRackStroke("I2")} strokeWidth="2" rx="6"
          style={{ filter: hovered === "I2" ? "drop-shadow(0 4px 8px rgba(59,130,246,0.5))" : activeRack === "I2" ? "drop-shadow(0 0 10px rgba(245,158,11,0.7))" : "none" }} />
        
        <g transform="rotate(-90, 865, 550)">
          <text x="865" y="545" textAnchor="middle" fontSize="13" fill="white" fontWeight="bold">I2</text>
          <text x="865" y="561" textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.8)">
            {INVENTORY_DATA.I2.shelves.reduce((a,s)=>a+s.items.length,0)} items
          </text>
        </g>

        <rect x="840" y="470" width="50" height="160" fill="transparent" rx="6" />
      </g>

      {/* ── Legend ── */}
      <g transform="translate(0, 5)">
        <rect x="320" y="650" width="14" height="14" fill="#1d4ed8" rx="3" />
        <text x="342" y="662" fontSize="11" fill="#475569" fontWeight="500">Inventory Rack (clickable)</text>
        
        <rect x="530" y="650" width="14" height="14" fill="#94a3b8" rx="3" />
        <text x="552" y="662" fontSize="11" fill="#475569" fontWeight="500">Non-Inventory</text>
        
        <rect x="690" y="650" width="14" height="14" fill="#f59e0b" rx="3" />
        <text x="712" y="662" fontSize="11" fill="#475569" fontWeight="500">Selected</text>
      </g>
    </svg>
  );
}

// ─── STYLES ────────────────────────────────────────────────────────────────────

const styles = {
  container: {
    minHeight: "100vh",
    backgroundColor: "#0f172a",
    fontFamily: "'Courier New', 'Consolas', monospace",
    padding: "20px",
    boxSizing: "border-box",
  },
  header: {
    textAlign: "center",
    marginBottom: "20px",
  },
  title: {
    fontSize: "28px",
    fontWeight: "900",
    color: "#f8fafc",
    letterSpacing: "6px",
    margin: 0,
    textTransform: "uppercase",
  },
  subtitle: {
    fontSize: "12px",
    color: "#64748b",
    letterSpacing: "3px",
    marginTop: "4px",
  },
  globalSearch: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    maxWidth: "500px",
    margin: "0 auto 20px auto",
    background: "#1e293b",
    border: "1px solid #334155",
    borderRadius: "8px",
    padding: "10px 14px",
  },
  globalSearchIcon: { color: "#64748b", fontSize: "18px" },
  globalSearchInput: {
    flex: 1,
    background: "transparent",
    border: "none",
    outline: "none",
    color: "#f1f5f9",
    fontSize: "14px",
    fontFamily: "'Courier New', monospace",
  },
  mapContainer: {
    background: "#f8fafc",
    borderRadius: "12px",
    border: "2px solid #334155",
    overflow: "hidden",
    maxWidth: "900px",
    margin: "0 auto",
    boxShadow: "0 25px 50px rgba(0,0,0,0.5)",
  },
  searchResults: {
    maxWidth: "900px",
    margin: "16px auto 0 auto",
    background: "#1e293b",
    border: "1px solid #334155",
    borderRadius: "8px",
    padding: "16px",
    maxHeight: "250px",
    overflowY: "auto",
  },
  searchResultsTitle: {
    fontSize: "11px",
    color: "#64748b",
    letterSpacing: "2px",
    marginBottom: "10px",
  },
  resultItem: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "6px 10px",
    borderRadius: "4px",
    marginBottom: "4px",
    background: "#0f172a",
    cursor: "pointer",
    transition: "background 0.1s",
  },
  resultBadge: {
    background: "#f59e0b",
    color: "#0f172a",
    fontSize: "10px",
    fontWeight: "bold",
    padding: "2px 6px",
    borderRadius: "3px",
    minWidth: "28px",
    textAlign: "center",
  },
  resultShelf: { color: "#64748b", fontSize: "11px", minWidth: "55px" },
  resultCode: { color: "#f1f5f9", fontSize: "12px", fontWeight: "bold" },
  // Modal
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.75)",
    zIndex: 100,
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "flex-end",
    padding: "16px",
    backdropFilter: "blur(4px)",
  },
  modal: {
    width: "min(520px, 95vw)",
    height: "calc(100vh - 32px)",
    background: "#0f172a",
    border: "1px solid #334155",
    borderRadius: "12px",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    boxShadow: "0 25px 50px rgba(0,0,0,0.8)",
    animation: "slideIn 0.2s ease",
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: "20px",
    borderBottom: "1px solid #1e293b",
    background: "#1e293b",
  },
  rackBadge: {
    display: "inline-block",
    background: "#f59e0b",
    color: "#0f172a",
    fontSize: "12px",
    fontWeight: "900",
    padding: "3px 10px",
    borderRadius: "4px",
    letterSpacing: "2px",
    marginBottom: "6px",
  },
  modalTitle: {
    color: "#f8fafc",
    fontSize: "18px",
    fontWeight: "800",
    margin: 0,
    letterSpacing: "1px",
  },
  modalSubtitle: {
    color: "#64748b",
    fontSize: "11px",
    margin: "4px 0 0 0",
    letterSpacing: "1px",
  },
  closeBtn: {
    background: "transparent",
    border: "1px solid #334155",
    color: "#94a3b8",
    borderRadius: "6px",
    width: "32px",
    height: "32px",
    cursor: "pointer",
    fontSize: "14px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  searchBar: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "12px 20px",
    borderBottom: "1px solid #1e293b",
  },
  searchIcon: { color: "#64748b", fontSize: "18px" },
  searchInput: {
    flex: 1,
    background: "#1e293b",
    border: "1px solid #334155",
    borderRadius: "6px",
    padding: "8px 12px",
    color: "#f1f5f9",
    fontSize: "13px",
    fontFamily: "'Courier New', monospace",
    outline: "none",
  },
  clearBtn: {
    background: "transparent",
    border: "none",
    color: "#64748b",
    cursor: "pointer",
    fontSize: "12px",
  },
  shelvesContainer: {
    flex: 1,
    overflowY: "auto",
    padding: "16px 20px",
  },
  shelfSection: {
    marginBottom: "20px",
  },
  shelfHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "10px",
  },
  shelfNumber: {
    fontSize: "11px",
    fontWeight: "800",
    color: "#f59e0b",
    letterSpacing: "3px",
    borderLeft: "3px solid #f59e0b",
    paddingLeft: "8px",
  },
  shelfCount: {
    fontSize: "10px",
    color: "#475569",
    background: "#1e293b",
    padding: "2px 8px",
    borderRadius: "10px",
  },
  itemsGrid: {
    display: "flex",
    flexWrap: "wrap",
    gap: "6px",
  },
  itemChip: {
    background: "#1d4ed8",
    color: "#e0eaff",
    fontSize: "10px",
    fontWeight: "bold",
    padding: "4px 8px",
    borderRadius: "4px",
    letterSpacing: "0.5px",
    border: "1px solid #2563eb",
    transition: "all 0.1s",
  },
  itemChipHighlight: {
    background: "#f59e0b",
    color: "#0f172a",
    border: "1px solid #d97706",
  },
  noResult: {
    color: "#64748b",
    fontSize: "13px",
    textAlign: "center",
    padding: "40px 0",
  },
};

// ─── MAIN APP ─────────────────────────────────────────────────────────────────

export default function SparepartMapping2() {
  const [activeRack, setActiveRack] = useState(null);
  const [globalSearch, setGlobalSearch] = useState("");
  const [searchResults, setSearchResults] = useState([]);

  useEffect(() => {
    if (globalSearch.trim().length >= 3) {
      setSearchResults(searchInventory(globalSearch));
    } else {
      setSearchResults([]);
    }
  }, [globalSearch]);

  const handleRackClick = (id) => setActiveRack(id);
  const handleClose = () => setActiveRack(null);

  return (
    <div style={styles.container}>
      <style>{`
        @keyframes slideIn {
          from { transform: translateX(30px); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #0f172a; }
        ::-webkit-scrollbar-thumb { background: #334155; border-radius: 3px; }
        input::placeholder { color: #475569; }
      `}</style>

      <div style={styles.header}>
        <h1 style={styles.title}>Warehouse Layout</h1>
        <p style={styles.subtitle}>R. SPAREPART · INVENTORY MAP</p>
      </div>

      {/* Global search */}
      <div style={styles.globalSearch}>
        <span style={styles.globalSearchIcon}>⌕</span>
        <input
          style={styles.globalSearchInput}
          placeholder="Search any part code across all racks..."
          value={globalSearch}
          onChange={(e) => setGlobalSearch(e.target.value)}
        />
        {globalSearch && (
          <button style={{ background:"transparent",border:"none",color:"#64748b",cursor:"pointer" }} onClick={() => setGlobalSearch("")}>✕</button>
        )}
      </div>

      {/* Search results */}
      {searchResults.length > 0 && (
        <div style={styles.searchResults}>
          <div style={styles.searchResultsTitle}>
            FOUND {searchResults.length} RESULT{searchResults.length !== 1 ? "S" : ""}
          </div>
          {searchResults.map((r, i) => (
            <div
              key={i}
              style={styles.resultItem}
              onClick={() => { setActiveRack(r.rackId); setGlobalSearch(""); }}
              onMouseEnter={(e) => e.currentTarget.style.background = "#1e293b"}
              onMouseLeave={(e) => e.currentTarget.style.background = "#0f172a"}
            >
              <span style={styles.resultBadge}>{r.rackId}</span>
              <span style={styles.resultShelf}>Shelf {r.shelfId}</span>
              <span style={styles.resultCode}>{r.item}</span>
              <span style={{ color:"#334155", fontSize:"10px", marginLeft:"auto" }}>→ open rack</span>
            </div>
          ))}
        </div>
      )}

      {/* Floor plan */}
      <div style={styles.mapContainer}>
        <FloorPlan onRackClick={handleRackClick} activeRack={activeRack} />
      </div>

      {/* Tip */}
      <p style={{ textAlign:"center", color:"#334155", fontSize:"11px", marginTop:"12px", letterSpacing:"2px" }}>
        CLICK ANY BLUE RACK TO VIEW CONTENTS · SEARCH ABOVE TO LOCATE PARTS
      </p>

      {/* Rack modal */}
      {activeRack && (
        <RackModal rackId={activeRack} onClose={handleClose} />
      )}
    </div>
  );
}