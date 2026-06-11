import { useMemo } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js'
import { Line } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend)

export default function SensorChart({ sensorData, type = 'temperature', hours = 6 }) {
  const chartData = useMemo(() => {
    if (!sensorData || sensorData.length === 0) return null

    const cutoff = Date.now() - hours * 60 * 60 * 1000
    const filtered = sensorData.filter((d) => new Date(d.timestamp).getTime() > cutoff)

    // Sample every Nth point for performance
    const step = Math.max(1, Math.floor(filtered.length / 72))
    const sampled = filtered.filter((_, i) => i % step === 0)

    const labels = sampled.map((d) =>
      new Date(d.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    )

    const configs = {
      temperature: {
        label: 'Temperature (°C)',
        data: sampled.map((d) => d.temperature),
        borderColor: 'rgba(239, 68, 68, 1)',
        backgroundColor: 'rgba(239, 68, 68, 0.08)',
        gradientStart: 'rgba(239, 68, 68, 0.2)',
        gradientEnd: 'rgba(239, 68, 68, 0)',
      },
      humidity: {
        label: 'Humidity (%)',
        data: sampled.map((d) => d.humidity),
        borderColor: 'rgba(14, 165, 233, 1)',
        backgroundColor: 'rgba(14, 165, 233, 0.08)',
        gradientStart: 'rgba(14, 165, 233, 0.2)',
        gradientEnd: 'rgba(14, 165, 233, 0)',
      },
      vibration: {
        label: 'Vibration (g)',
        data: sampled.map((d) => d.vibration),
        borderColor: 'rgba(245, 158, 11, 1)',
        backgroundColor: 'rgba(245, 158, 11, 0.08)',
        gradientStart: 'rgba(245, 158, 11, 0.2)',
        gradientEnd: 'rgba(245, 158, 11, 0)',
      },
    }

    const cfg = configs[type]

    return {
      labels,
      datasets: [
        {
          label: cfg.label,
          data: cfg.data,
          borderColor: cfg.borderColor,
          backgroundColor: cfg.backgroundColor,
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointRadius: 0,
          pointHoverRadius: 4,
          pointHoverBackgroundColor: cfg.borderColor,
          pointHoverBorderColor: '#fff',
          pointHoverBorderWidth: 2,
        },
      ],
    }
  }, [sensorData, type, hours])

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.9)',
          borderColor: 'rgba(148, 163, 184, 0.2)',
          borderWidth: 1,
          titleColor: '#e2e8f0',
          bodyColor: '#94a3b8',
          padding: 10,
          cornerRadius: 8,
          titleFont: { weight: '600', size: 12 },
          bodyFont: { size: 11 },
          displayColors: true,
          boxPadding: 4,
        },
      },
      scales: {
        x: {
          grid: { color: 'rgba(148, 163, 184, 0.06)', drawBorder: false },
          ticks: {
            color: '#64748b',
            font: { size: 10 },
            maxTicksLimit: 8,
            maxRotation: 0,
          },
          border: { display: false },
        },
        y: {
          grid: { color: 'rgba(148, 163, 184, 0.06)', drawBorder: false },
          ticks: {
            color: '#64748b',
            font: { size: 10 },
            padding: 8,
          },
          border: { display: false },
        },
      },
    }),
    []
  )

  if (!chartData) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-surface-500">
        No data available
      </div>
    )
  }

  return <Line data={chartData} options={options} />
}
