import { useState, useRef, useEffect } from "react";

interface SearchableSelectProps {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
}

/**
 * A Bootstrap-compatible searchable dropdown.
 * Renders a text input that filters options as the user types,
 * displayed in a floating list below the input.
 */
export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Search or select...",
  disabled = false,
  id,
}: SearchableSelectProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync display text when controlled value changes externally
  const displayValue = value
    ? options.includes(value)
      ? value
      : value
    : "";

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered =
    query.trim() === ""
      ? options
      : options.filter((opt) =>
          opt.toLowerCase().includes(query.toLowerCase())
        );

  const handleSelect = (opt: string) => {
    onChange(opt);
    setOpen(false);
    setQuery("");
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
    setOpen(false);
    setQuery("");
  };

  return (
    <div ref={containerRef} style={{ position: "relative" }} id={id}>
      {/* Trigger input */}
      <div
        className={`form-control d-flex align-items-center justify-content-between ${
          disabled ? "bg-light text-muted" : ""
        }`}
        style={{
          cursor: disabled ? "not-allowed" : "pointer",
          minHeight: "38px",
          userSelect: "none",
        }}
        onClick={() => {
          if (!disabled) setOpen((prev) => !prev);
        }}
      >
        <span
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            flex: 1,
            color: displayValue ? "inherit" : "#6c757d",
          }}
        >
          {displayValue || placeholder}
        </span>
        <div className="d-flex align-items-center gap-1 ms-2">
          {value && !disabled && (
            <i
              className="bi bi-x text-muted"
              style={{ fontSize: "1rem", lineHeight: 1, cursor: "pointer" }}
              onClick={handleClear}
              title="Clear selection"
            />
          )}
          <i
            className={`bi bi-chevron-${open ? "up" : "down"} text-muted`}
            style={{ fontSize: "0.75rem" }}
          />
        </div>
      </div>

      {/* Dropdown panel */}
      {open && (
        <div
          className="border rounded shadow-sm bg-white"
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            zIndex: 1050,
            maxHeight: "280px",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Search input */}
          <div className="p-2 border-bottom">
            <div className="input-group input-group-sm">
              <span className="input-group-text bg-white border-end-0">
                <i className="bi bi-search text-muted" />
              </span>
              <input
                autoFocus
                type="text"
                className="form-control border-start-0 ps-0"
                placeholder="Type to search..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onClick={(e) => e.stopPropagation()}
              />
              {query && (
                <button
                  className="btn btn-outline-secondary border-start-0"
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setQuery("");
                  }}
                >
                  <i className="bi bi-x" />
                </button>
              )}
            </div>
          </div>

          {/* Options list */}
          <div style={{ overflowY: "auto", flex: 1 }}>
            {filtered.length === 0 ? (
              <div className="text-muted text-center py-3 small">
                <i className="bi bi-search me-1" />
                No results for "{query}"
              </div>
            ) : (
              filtered.map((opt) => (
                <div
                  key={opt}
                  className={`px-3 py-2 small ${
                    opt === value
                      ? "bg-primary text-white"
                      : "text-dark"
                  }`}
                  style={{
                    cursor: "pointer",
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={(e) => {
                    if (opt !== value)
                      (e.currentTarget as HTMLDivElement).style.background =
                        "#f0f4ff";
                  }}
                  onMouseLeave={(e) => {
                    if (opt !== value)
                      (e.currentTarget as HTMLDivElement).style.background = "";
                  }}
                  onClick={() => handleSelect(opt)}
                >
                  {query.trim() ? (
                    <HighlightMatch text={opt} query={query} active={opt === value} />
                  ) : (
                    opt
                  )}
                  {opt === value && (
                    <i className="bi bi-check2 ms-2" />
                  )}
                </div>
              ))
            )}
          </div>

          {/* Footer count */}
          {options.length > 0 && (
            <div
              className="px-3 py-1 border-top text-muted"
              style={{ fontSize: "0.7rem" }}
            >
              {filtered.length} of {options.length} options
              {query && ` matching "${query}"`}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Bolds the matched portion of text */
function HighlightMatch({
  text,
  query,
  active,
}: {
  text: string;
  query: string;
  active: boolean;
}) {
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark
        style={{
          background: active ? "rgba(255,255,255,0.35)" : "#fff3cd",
          color: "inherit",
          padding: "0 1px",
          borderRadius: "2px",
        }}
      >
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}