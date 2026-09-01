import { UISchemaField } from "../types/instrument";

export default function DynamicForm({
  schema,
  values,
  setValues,
}: {
  schema: UISchemaField[];
  values: Record<string, any>;
  setValues: (v: Record<string, any>) => void;
}) {
  const update = (field: string, value: any) => {
    setValues({ ...values, [field]: value });
  };

  return (
    <div className="card p-3 mt-3">
      <h5>Input Form</h5>

      {schema.map((s) => {
        return (
          <div className="mb-3" key={s.field}>
            <label className="form-label">{s.label}</label>

            {s.input === "text" && (
              <input
                type="text"
                className="form-control"
                value={values[s.field] || ""}
                onChange={(e) => update(s.field, e.target.value)}
              />
            )}

            {s.input === "number" && (
              <input
                type="number"
                step={s.decimal ? `0.${"0".repeat(s.decimal - 1)}1` : "1"}
                className="form-control"
                value={values[s.field] || ""}
                onChange={(e) => update(s.field, Number(e.target.value))}
              />
            )}

            {s.input === "select" && (
              <select
                className="form-select"
                value={values[s.field] || ""}
                onChange={(e) => update(s.field, e.target.value)}
              >
                <option value="">-- choose --</option>
                {s.options?.map((op) => (
                  <option key={op} value={op}>
                    {op}
                  </option>
                ))}
              </select>
            )}
          </div>
        );
      })}
    </div>
  );
}
