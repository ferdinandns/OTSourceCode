import React from 'react';

// A reusable component to render the standard 5-column tables
const ProcessTable = ({ title, dataRows }) => {
  return (
    <div className="mb-8 border p-4 rounded-lg shadow-sm bg-white">
      <h3 className="text-lg font-bold mb-4 border-b pb-2">{title}</h3>
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-gray-100">
            <th className="p-2 border">PARAMETER</th>
            <th className="p-2 border">SET VALUE</th>
            <th className="p-2 border">MIN</th>
            <th className="p-2 border">MAX</th>
            <th className="p-2 border">AVERAGE</th>
          </tr>
        </thead>
        <tbody>
          {dataRows.map((row, index) => (
            <tr key={index} className="hover:bg-gray-50">
              <td className="p-2 border font-medium">{row.label}</td>
              <td className="p-2 border">{row.set || '-'}</td>
              <td className="p-2 border">{row.min || '-'}</td>
              <td className="p-2 border">{row.max || '-'}</td>
              <td className="p-2 border">{row.avg || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ProcessTable;