import React, { useState } from 'react';

export default function TransactionChart({ data = [] }) {
  const [hoveredPoint, setHoveredPoint] = useState(null);

  if (!data || data.length === 0) {
    return <div className="w-full h-full flex items-center justify-center text-xs text-neutral-500">Tidak ada data.</div>;
  }

  // Dimensions
  const width = 500;
  const height = 220;
  const paddingLeft = 45;
  const paddingRight = 15;
  const paddingTop = 20;
  const paddingBottom = 30;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  // Max value to scale Y axis
  const maxVal = Math.max(
    ...data.map(d => Math.max(d.Penjualan, d.Pengeluaran, 10000))
  );
  
  // Format Y-axis labels
  const formatYLabel = (val) => {
    if (val >= 1000000) return `${(val / 1000000).toFixed(1).replace('.0', '')}M`;
    if (val >= 1000) return `${(val / 1000).toFixed(0)}k`;
    return val;
  };

  // Get X, Y coordinates for a data point
  const getCoords = (index, value) => {
    const x = paddingLeft + (index / (data.length - 1)) * chartWidth;
    const y = paddingTop + chartHeight - (value / maxVal) * chartHeight;
    return { x, y };
  };

  // Build path strings for line charts
  let penjualanPath = '';
  let pengeluaranPath = '';

  data.forEach((d, idx) => {
    const coordsPenjualan = getCoords(idx, d.Penjualan);
    const coordsPengeluaran = getCoords(idx, d.Pengeluaran);

    if (idx === 0) {
      penjualanPath = `M ${coordsPenjualan.x} ${coordsPenjualan.y}`;
      pengeluaranPath = `M ${coordsPengeluaran.x} ${coordsPengeluaran.y}`;
    } else {
      // Use smooth Bezier curve
      const prevCoordsPenjualan = getCoords(idx - 1, data[idx - 1].Penjualan);
      const cpX1 = prevCoordsPenjualan.x + (coordsPenjualan.x - prevCoordsPenjualan.x) / 2;
      penjualanPath += ` C ${cpX1} ${prevCoordsPenjualan.y}, ${cpX1} ${coordsPenjualan.y}, ${coordsPenjualan.x} ${coordsPenjualan.y}`;

      const prevCoordsPengeluaran = getCoords(idx - 1, data[idx - 1].Pengeluaran);
      const cpX2 = prevCoordsPengeluaran.x + (coordsPengeluaran.x - prevCoordsPengeluaran.x) / 2;
      pengeluaranPath += ` C ${cpX2} ${prevCoordsPengeluaran.y}, ${cpX2} ${coordsPengeluaran.y}, ${coordsPengeluaran.x} ${coordsPengeluaran.y}`;
    }
  });

  // Y-axis grid ticks (4 divisions)
  const yTicks = [0, maxVal * 0.33, maxVal * 0.66, maxVal];

  return (
    <div className="relative w-full h-full flex flex-col justify-between select-none">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
        {/* Grid Lines */}
        {yTicks.map((tickVal, idx) => {
          const y = paddingTop + chartHeight - (tickVal / maxVal) * chartHeight;
          return (
            <g key={idx} className="opacity-40">
              <line
                x1={paddingLeft}
                y1={y}
                x2={width - paddingRight}
                y2={y}
                stroke="#262626"
                strokeWidth={1}
                strokeDasharray="4 4"
              />
              <text
                x={paddingLeft - 8}
                y={y + 3}
                fill="#737373"
                fontSize={9}
                textAnchor="end"
                className="font-medium"
              >
                {formatYLabel(tickVal)}
              </text>
            </g>
          );
        })}

        {/* X-axis labels */}
        {data.map((d, idx) => {
          const x = paddingLeft + (idx / (data.length - 1)) * chartWidth;
          return (
            <text
              key={idx}
              x={x}
              y={height - 8}
              fill="#737373"
              fontSize={9}
              textAnchor="middle"
              className="font-bold uppercase tracking-wider"
            >
              {d.day}
            </text>
          );
        })}

        {/* Penjualan Line (Green) */}
        {data.length > 1 && (
          <path
            d={penjualanPath}
            fill="none"
            stroke="#10b981"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="drop-shadow-[0_2px_8px_rgba(16,185,129,0.2)]"
          />
        )}

        {/* Pengeluaran Line (Red) */}
        {data.length > 1 && (
          <path
            d={pengeluaranPath}
            fill="none"
            stroke="#f43f5e"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="drop-shadow-[0_2px_8px_rgba(244,63,94,0.2)]"
          />
        )}

        {/* Interactive hover points */}
        {data.map((d, idx) => {
          const coordsPenjualan = getCoords(idx, d.Penjualan);
          const coordsPengeluaran = getCoords(idx, d.Pengeluaran);
          const xVal = paddingLeft + (idx / (data.length - 1)) * chartWidth;

          return (
            <g
              key={idx}
              className="cursor-pointer"
              onMouseEnter={(e) => {
                setHoveredPoint({
                  index: idx,
                  x: coordsPenjualan.x,
                  y: (coordsPenjualan.y + coordsPengeluaran.y) / 2,
                  valPenjualan: d.Penjualan,
                  valPengeluaran: d.Pengeluaran,
                  label: d.day
                });
              }}
              onMouseLeave={() => setHoveredPoint(null)}
            >
              {/* Vertical hover guide line */}
              {hoveredPoint && hoveredPoint.index === idx && (
                <line
                  x1={xVal}
                  y1={paddingTop}
                  x2={xVal}
                  y2={paddingTop + chartHeight}
                  stroke="#404040"
                  strokeWidth={1.5}
                  strokeDasharray="2 2"
                />
              )}

              {/* Penjualan point dot */}
              <circle
                cx={coordsPenjualan.x}
                cy={coordsPenjualan.y}
                r={hoveredPoint && hoveredPoint.index === idx ? 6 : 3.5}
                fill="#0a0a0a"
                stroke="#10b981"
                strokeWidth={2}
                className="transition-all duration-150"
              />

              {/* Pengeluaran point dot */}
              <circle
                cx={coordsPengeluaran.x}
                cy={coordsPengeluaran.y}
                r={hoveredPoint && hoveredPoint.index === idx ? 6 : 3.5}
                fill="#0a0a0a"
                stroke="#f43f5e"
                strokeWidth={2}
                className="transition-all duration-150"
              />

              {/* Invisible interactive hover zone */}
              <rect
                x={xVal - (chartWidth / (data.length - 1)) / 2}
                y={paddingTop}
                width={chartWidth / (data.length - 1)}
                height={chartHeight}
                fill="transparent"
              />
            </g>
          );
        })}
      </svg>

      {/* Tooltip Overlay */}
      {hoveredPoint && (
        <div
          className="absolute bg-neutral-900/95 border border-neutral-800 text-[10px] rounded-xl p-2.5 shadow-xl backdrop-blur-md flex flex-col gap-1 pointer-events-none transition-all duration-150"
          style={{
            left: `${(hoveredPoint.x / width) * 100}%`,
            top: `${(hoveredPoint.y / height) * 100 - 30}%`,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <div className="font-bold text-neutral-300 border-b border-neutral-800 pb-1 mb-1">
            Hari: {hoveredPoint.label}
          </div>
          <div className="flex items-center gap-2 text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>Penjualan: Rp {hoveredPoint.valPenjualan.toLocaleString('id-ID')}</span>
          </div>
          <div className="flex items-center gap-2 text-red-400">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
            <span>Pengeluaran: Rp {hoveredPoint.valPengeluaran.toLocaleString('id-ID')}</span>
          </div>
        </div>
      )}
    </div>
  );
}
