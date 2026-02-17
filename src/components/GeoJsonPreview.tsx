export function GeoJsonPreview({ preview }: { preview: string }) {
  return (
    <div className="mt-3.5 border border-gray-300 rounded-xl p-3.5">
      <details>
        <summary className="font-bold">Tinjau GeoJSON</summary>
        <pre className="text-black whitespace-pre-wrap bg-gray-100 p-2.5 rounded-lg overflow-auto mt-4">
          {preview}
        </pre>
      </details>
    </div>
  );
}
