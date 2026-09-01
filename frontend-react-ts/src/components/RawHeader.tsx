import { LiveDataResponse } from "../types/instrument";

export default function RawReader({ data }: { data?: LiveDataResponse }) {
  return (
    <div className="card p-3">
      <h5>Live Data</h5>

      <div className="mt-2">
        <strong>Raw:</strong>
        <div className="bg-dark text-white p-2 rounded mt-1">
          {data?.raw || "<no data>"}
        </div>
      </div>

      <div className="mt-3">
        <strong>Parsed:</strong>
        <pre>{JSON.stringify(data?.parsed || {}, null, 2)}</pre>
      </div>
    </div>
  );
}
