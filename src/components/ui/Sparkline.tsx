import React from "react";
import { LineChart, Line, ResponsiveContainer, Tooltip } from "recharts";

interface SparklineProps {
  data: number[];
  color?: string;
  height?: number;
  showTooltip?: boolean;
}

export function Sparkline({ data, color = "#1E3A5F", height = 40, showTooltip = false }: SparklineProps) {
  const chartData = data.map((v, i) => ({ i, v }));
  const min = Math.min(...data);
  const max = Math.max(...data);
  const trend = data.length > 1 ? data[data.length - 1] - data[0] : 0;
  const trendColor = trend >= 0 ? "#10b981" : "#ef4444";
  const activeColor = trend >= 0 ? trendColor : trendColor;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={chartData} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
        {showTooltip && (
          <Tooltip
            contentStyle={{ fontSize: 11, padding: "4px 8px", borderRadius: 6, border: "none", boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }}
            formatter={(v: number) => [v.toLocaleString("es-CL"), ""]}
            labelFormatter={() => ""}
          />
        )}
        <Line
          type="monotone"
          dataKey="v"
          stroke={activeColor}
          strokeWidth={1.5}
          dot={false}
          activeDot={{ r: 3, strokeWidth: 0 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
