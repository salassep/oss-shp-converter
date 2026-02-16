export function GeoJsonPreview({ preview }: { preview: string }) {
  return (
    <div style={{ marginTop: 14, border: "1px solid #ddd", borderRadius: 12, padding: 14 }}>
      <h2 style={{ marginTop: 0 }}>GeoJSON Preview (first 2 features)</h2>
      <pre style={{ color: "black", whiteSpace: "pre-wrap", background: "#f5f5f5", padding: 10, borderRadius: 10, overflow: "auto" }}>
        {preview}
      </pre>
    </div>
  );
}
