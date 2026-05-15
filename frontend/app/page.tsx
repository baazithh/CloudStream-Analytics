"use client";

import { useEffect, useState, useRef } from "react";
import { Activity, ShoppingCart, CreditCard, Eye, Server, RefreshCw } from "lucide-react";

type ActionType = "view" | "add_to_cart" | "purchase";

interface EventPayload {
  event_id: string;
  user_id: string;
  action: ActionType;
  amount: number;
  timestamp: string;
}

interface KPIMetrics {
  revenue: number;
  views: number;
  additions: number;
  purchases: number;
}

export default function Dashboard() {
  const [metrics, setMetrics] = useState<KPIMetrics>({
    revenue: 0,
    views: 0,
    additions: 0,
    purchases: 0,
  });
  
  const [events, setEvents] = useState<EventPayload[]>([]);
  const [status, setStatus] = useState<"connecting" | "connected" | "disconnected">("connecting");
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const connectWs = () => {
      setStatus("connecting");
      const ws = new WebSocket("ws://localhost:8000/ws");
      
      ws.onopen = () => {
        setStatus("connected");
      };
      
      ws.onmessage = (event) => {
        try {
          const payload: EventPayload = JSON.parse(event.data);
          
          setEvents((prev) => {
            const newEvents = [payload, ...prev];
            return newEvents.slice(0, 10);
          });
          
          setMetrics((prev) => {
            const newMetrics = { ...prev };
            if (payload.action === "view") newMetrics.views++;
            if (payload.action === "add_to_cart") newMetrics.additions++;
            if (payload.action === "purchase") {
              newMetrics.purchases++;
              newMetrics.revenue += payload.amount;
            }
            return newMetrics;
          });
        } catch (err) {
          console.error("Failed to parse event", err);
        }
      };
      
      ws.onclose = () => {
        setStatus("disconnected");
        // Reconnect after 3 seconds
        setTimeout(connectWs, 3000);
      };
      
      ws.onerror = () => {
        ws.close();
      };
      
      wsRef.current = ws;
    };
    
    connectWs();
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const getActionColor = (action: ActionType) => {
    switch (action) {
      case "view": return "text-blue-400 bg-blue-500/10 border-blue-500/20";
      case "add_to_cart": return "text-indigo-400 bg-indigo-500/10 border-indigo-500/20";
      case "purchase": return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
      default: return "text-gray-400 bg-gray-500/10 border-gray-500/20";
    }
  };

  const formatTimestamp = (ts: string) => {
    const d = new Date(ts);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}.${d.getMilliseconds().toString().padStart(3, '0')}`;
  };

  return (
    <div className="min-h-screen bg-[var(--color-background)]text-[var(--color-foreground)] p-4 md:p-8 font-sans">
      
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 border-b border-[var(--color-border)] pb-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white flex items-center gap-2">
            <Activity className="h-5 w-5 text-blue-500" />
            CloudStream Platform
          </h1>
          <p className="text-sm text-gray-400 mt-1">Real-time Telemetry & Intelligence</p>
        </div>
        
        <div className="mt-4 md:mt-0 flex items-center gap-3 bg-[var(--color-card)] px-3 py-1.5 rounded-md border border-[var(--color-border)]">
          <Server className="h-4 w-4 text-gray-400" />
          <span className="text-xs font-mono">Stream Status:</span>
          <div className="flex items-center gap-1.5">
            <span className={`relative flex h-2.5 w-2.5`}>
              {status === "connected" && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              )}
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                status === "connected" ? "bg-emerald-500" : 
                status === "connecting" ? "bg-yellow-500" : "bg-red-500"
              }`}></span>
            </span>
            <span className="text-xs uppercase tracking-wider font-semibold text-gray-300">
              {status}
            </span>
          </div>
        </div>
      </header>
      
      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        
        <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">Live Revenue</h3>
            <div className="p-2 bg-emerald-500/10 rounded-md">
              <CreditCard className="h-4 w-4 text-emerald-500" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-light tabular-nums tracking-tight text-white">
              ${metrics.revenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-xs text-emerald-500 font-medium">+ Realtime</span>
          </div>
        </div>

        <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">Active Views</h3>
            <div className="p-2 bg-blue-500/10 rounded-md">
              <Eye className="h-4 w-4 text-blue-500" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-light tabular-nums tracking-tight text-white">{metrics.views.toLocaleString()}</span>
          </div>
        </div>

        <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">Cart Adds</h3>
            <div className="p-2 bg-indigo-500/10 rounded-md">
              <ShoppingCart className="h-4 w-4 text-indigo-500" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-light tabular-nums tracking-tight text-white">{metrics.additions.toLocaleString()}</span>
          </div>
        </div>
        
        <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">Purchases</h3>
            <div className="p-2 bg-purple-500/10 rounded-md">
              <Activity className="h-4 w-4 text-purple-500" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-light tabular-nums tracking-tight text-white">{metrics.purchases.toLocaleString()}</span>
          </div>
        </div>

      </div>

      {/* Live Stream Ticker */}
      <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--color-border)] flex items-center justify-between">
          <h2 className="text-sm font-medium text-gray-200">Live Streaming Ingestion Ticker</h2>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <RefreshCw className={`h-3 w-3 ${status === 'connected' ? 'animate-spin text-blue-500' : ''}`} />
            Polling Kinesis
          </div>
        </div>
        
        <div className="p-0 overflow-x-auto">
          {events.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-sm font-mono flex flex-col items-center">
              <Activity className="h-8 w-8 mb-2 opacity-20" />
              Waiting for incoming events...
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[var(--color-border)]/50 bg-[#1A2235]">
                  <th className="px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Timestamp</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Event ID</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">User</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Action</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider text-right">Value</th>
                </tr>
              </thead>
              <tbody className="font-mono text-xs">
                {events.map((evt, idx) => (
                  <tr key={evt.event_id} className={`border-b border-[var(--color-border)]/30 hover:bg-white/[0.02] transition-colors ${idx === 0 ? 'bg-white/[0.03]' : ''}`}>
                    <td className="px-5 py-3 text-gray-500 whitespace-nowrap">
                      {formatTimestamp(evt.timestamp)}
                    </td>
                    <td className="px-5 py-3 text-gray-400 truncate max-w-[120px]" title={evt.event_id}>
                      {evt.event_id.substring(0,8)}...
                    </td>
                    <td className="px-5 py-3 text-blue-400/80">
                      {evt.user_id}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-0.5 rounded border text-[10px] uppercase font-bold tracking-widest ${getActionColor(evt.action)}`}>
                        {evt.action.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums text-gray-300">
                      {evt.amount > 0 ? `$${evt.amount.toFixed(2)}` : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
