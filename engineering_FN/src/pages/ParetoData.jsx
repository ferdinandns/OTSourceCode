import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import axios from "axios";
import {
  BarChart,
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

function Pareto({ width = "100%", height = 400, className = "" }) {
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [yAxisMax, setYAxisMax] = useState(0);
  const date = useSelector((state) => state.part.date);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch data for all lines
      const [line1Response, line2Response, line3Response] = await Promise.all([
        axios.get("http://10.126.15.197:8002/part/line1", { params: { date } }),
        axios.get("http://10.126.15.197:8002/part/line2", { params: { date } }),
        axios.get("http://10.126.15.197:8002/part/line3", { params: { date } })
      ]);

      // Process and combine data
      const combinedData = {};
      
      // ini Line 1 data
      line1Response.data.forEach(item => {
        if (!combinedData[item.Mesin]) {
          combinedData[item.Mesin] = { name: item.Mesin, Line1: 0, Line2: 0, Line3: 0, total: 0 };
        }
        combinedData[item.Mesin].Line1 = Number(item.Line1);
        combinedData[item.Mesin].total += Number(item.Line1);
      });
      
      // ini Line 2 data
      line2Response.data.forEach(item => {
        if (!combinedData[item.Mesin]) {
          combinedData[item.Mesin] = { name: item.Mesin, Line1: 0, Line2: 0, Line3: 0, total: 0 };
        }
        combinedData[item.Mesin].Line2 = Number(item.Line2);
        combinedData[item.Mesin].total += Number(item.Line2);
      });
      
      // ini Line 3 data
      line3Response.data.forEach(item => {
        if (!combinedData[item.Mesin]) {
          combinedData[item.Mesin] = { name: item.Mesin, Line1: 0, Line2: 0, Line3: 0, total: 0 };
        }
        combinedData[item.Mesin].Line3 = Number(item.Line3);
        combinedData[item.Mesin].total += Number(item.Line3);
      });
      
      // Convert to array and sort by total in descending order
      let dataArray = Object.values(combinedData).sort((a, b) => b.total - a.total);
      
      // Calculate cumulative values and percentages
      let runningTotal = 0;
      const grandTotal = dataArray.reduce((sum, item) => sum + item.total, 0);
      
      dataArray = dataArray.map(item => {
        runningTotal += item.total;
        return {
          ...item,
          cumulativeTotal: runningTotal,
          cumulativePercentage: (runningTotal / grandTotal) * 100
        };
      });
      
      // Ambil 10 item teratas saja untuk ditampilkan
      const topItems = dataArray.slice(0, 10);

      // Hitung total untuk semua line dari items yang ditampilkan saja
      const totalDisplayedItems = topItems.reduce((sum, item) => sum + item.total, 0);
      
      // Set nilai maksimum Y-axis berdasarkan total nilai yang ditampilkan
      // Tambahkan margin 10% untuk kejelasan visual
      setYAxisMax(Math.ceil(totalDisplayedItems));
            
      setChartData(topItems);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [date]);

  return (
    <div className={`p-4 ${className}`}>
      <h2 className="text-xl font-semibold mb-4 text-center">Pareto Chart Machine Breakdown</h2>
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
        <div style={{ width: width, height: height, minWidth: "600px" }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={chartData}
              margin={{ top: 20, right: 40, left: 20, bottom: 60 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="name" 
                angle={-45} 
                textAnchor="end" 
                height={70}
                interval={0}
                tick={{ fontSize: 12 }}
              />
              <YAxis 
                yAxisId="left" 
                domain={[0, yAxisMax]}
                label={{ value: 'Jumlah', angle: -90, position: 'insideLeft' }} 
              />
              <YAxis 
                yAxisId="right" 
                orientation="right" 
                domain={[0, 100]} 
                label={{ value: 'Persentase Kumulatif (%)', angle: 90,   position: 'insideRight', offset: 20, dy: 90  }} 
              />
              <Tooltip 
                formatter={(value, name) => {
                  if (name === "cumulativePercentage") {
                    return [`${value.toFixed(2)}%`, "Persentase Kumulatif"];
                  }
                  return [value, name];
                }}
                labelFormatter={(label) => `Mesin: ${label}`}
              />
              <Legend wrapperStyle={{ paddingTop: 10 }}/>
              <Bar yAxisId="left" dataKey="Line1" name="Line 1" fill="#8884d8" stackId="a" />
              <Bar yAxisId="left" dataKey="Line2" name="Line 2" fill="#82ca9d" stackId="a" />
              <Bar yAxisId="left" dataKey="Line3" name="Line 3" fill="#ffc658" stackId="a" />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="cumulativePercentage"
                name="Persentase Kumulatif"
                stroke="#ff7300"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
      )}
    </div>
  );
}

export default Pareto;