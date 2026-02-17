export function GeoJsonPreview({ preview }: { preview: string }) {
  return (
    <div className="mt-3.5 border border-gray-300 rounded-xl p-3.5">
      <h2 className="font-bold mb-1.5">
        Tinjau GeoJSON
      </h2>
      <pre className="text-black whitespace-pre-wrap bg-gray-100 p-2.5 rounded-lg overflow-auto">
        {preview}
      </pre>
    </div>
  );
}
