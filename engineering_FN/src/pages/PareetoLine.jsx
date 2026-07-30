import React, { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import axios from "axios";
import {
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Line,
  ComposedChart,
  ResponsiveContainer
} from "recharts";

function ParetoLine({ width, height, className }) {
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [yAxisMax, setYAxisMax] = useState(0);
  const date = useSelector((state) => state.part.date);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await axios.get("http://10.126.15.197:8002/part/pareto", {
        params: { date: date }
      });
      
      // Transformasi data untuk format yang dibutuhkan Recharts
      const line1 = Number(response.data[0].y);
      const line2 = Number(response.data[1].y);
      const line3 = Number(response.data[2].y);
      const line4 = Number(response.data[3].y || 0);
      
      // Menyiapkan data untuk chart
      const formattedData = [
        { name: "Line 1", value: line1, percentage: 0, cumulativePercentage: 0 },
        { name: "Line 2", value: line2, percentage: 0, cumulativePercentage: 0 },
        { name: "Line 3", value: line3, percentage: 0, cumulativePercentage: 0 }
      ];
      
      if (line4 > 0) {
        formattedData.push({ name: "Line 4", value: line4, percentage: 0, cumulativePercentage: 0 });
      }
      
      // Urutkan data berdasarkan nilai (dari besar ke kecil)
      formattedData.sort((a, b) => b.value - a.value);
      
      // Hitung total untuk persentase
      const total = formattedData.reduce((sum, item) => sum + item.value, 0);
      
      // Set nilai maksimum untuk Y-axis
      // Tambahkan margin 10% untuk kejelasan visual
      setYAxisMax(Math.ceil(total));
      
      // Hitung persentase dan persentase kumulatif
      let cumulativeTotal = 0;
      formattedData.forEach(item => {
        item.percentage = (item.value / total) * 100;
        cumulativeTotal += item.value;
        item.cumulativeTotal = cumulativeTotal;
        item.cumulativePercentage = (cumulativeTotal / total) * 100;
      });
      
      setChartData(formattedData);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching pareto data:", error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [date]);

  return (
    <div className={`p-4 ${className}`}>
      <h2 className="text-xl font-semibold mb-4 text-center">Pareto Chart Saka Farma Plant</h2>
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <p>Loading chart data...</p>
        </div>
      ) : chartData.length === 0 ? (
        <div className="flex justify-center items-center h-64">
          <p>No data available</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div style={{ width: width, height: height, minWidth: "500px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={chartData}
                margin={{ top: 20, right: 20, left: 20, bottom: 40 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="name" 
                  textAnchor="middle"
                  height={60}
                  interval={0}
                  tick={{ fontSize: 12 }}
                />
                <YAxis 
                  yAxisId="left"
                  domain={[0, yAxisMax]} 
                  label={{ value: 'Jumlah', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle' } }} 
                />
                <YAxis 
                  yAxisId="right" 
                  orientation="right" 
                  domain={[0, 100]} 
                  label={{ value: 'Persentase Kumulatif (%)', angle: 90, position: 'insideRight', style: { textAnchor: 'middle' } }} 
                />
                <Tooltip 
                  formatter={(value, name) => {
                    if (name === "cumulativePercentage") {
                      return [`${value.toFixed(2)}%`, "Persentase Kumulatif"];
                    }
                    if (name === "percentage") {
                      return [`${value.toFixed(2)}%`, "Persentase"];
                    }
                    return [value, name];
                  }}
                />
                <Legend />
                <Bar yAxisId="left" dataKey="value" name="Jumlah" fill="#8884d8" />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="cumulativePercentage"
                  name="Persentase Kumulatif"
                  stroke="#ff7300"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}

export default ParetoLine;