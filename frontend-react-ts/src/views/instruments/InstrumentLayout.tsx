import { Outlet } from "react-router-dom";

export default function InstrumentLayout() {
  return (
    <div className="p-3">
      <Outlet />
    </div>
  );
}
