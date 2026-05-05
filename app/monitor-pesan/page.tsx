"use client";

import { useEffect, useState } from "react";
import { MessageCircle, MessageSquare, AlertCircle, RefreshCw } from "lucide-react";
import type { MonitorMessage } from "@/app/api/monitor/messages/route";

export default function MonitorPesanPage() {
  const [messages, setMessages] = useState<MonitorMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "telegram" | "kirimi">("all");
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchMessages = async () => {
    try {
      setError(null);
      const sourceParam = filter === "all" ? "" : `&source=${filter}`;
      const res = await fetch(`/api/monitor/messages?limit=100${sourceParam}`);
      const data = await res.json();

      if (data.ok) {
        setMessages(data.messages);
      } else {
        setError(data.error || "Failed to fetch messages");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();

    if (!autoRefresh) return;

    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
  }, [filter, autoRefresh]);

  const telegramCount = messages.filter((m) => m.source === "telegram").length;
  const kirimiCount = messages.filter((m) => m.source === "kirimi").length;
  const aiRequestCount = messages.filter((m) => m.isAiRequest).length;

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f5f5f5", padding: "20px" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: "30px" }}>
          <h1 style={{ fontSize: "32px", fontWeight: "bold", marginBottom: "10px", color: "#333" }}>
            Monitor Pesan Masuk
          </h1>
          <p style={{ color: "#666" }}>Real-time monitoring pesan dari Telegram dan WhatsApp</p>
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "15px", marginBottom: "25px" }}>
          <StatCard label="Total Pesan" value={messages.length} icon="📊" color="#3b82f6" />
          <StatCard label="Telegram" value={telegramCount} icon="📱" color="#0088cc" />
          <StatCard label="WhatsApp" value={kirimiCount} icon="💬" color="#25d366" />
          <StatCard label="AI Request" value={aiRequestCount} icon="🤖" color="#f59e0b" />
        </div>

        {/* Controls */}
        <div style={{ backgroundColor: "white", padding: "15px", borderRadius: "8px", marginBottom: "20px", display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: "8px" }}>
            {(["all", "telegram", "kirimi"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  padding: "8px 16px",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                  backgroundColor: filter === f ? "#3b82f6" : "white",
                  color: filter === f ? "white" : "#333",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: "500",
                  transition: "all 0.2s"
                }}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>

          <div style={{ marginLeft: "auto", display: "flex", gap: "8px", alignItems: "center" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "14px" }}>
              <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />
              Auto-refresh
            </label>
            <button
              onClick={fetchMessages}
              disabled={loading}
              style={{
                padding: "8px 16px",
                backgroundColor: "#10b981",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: loading ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                opacity: loading ? 0.6 : 1
              }}
            >
              <RefreshCw size={16} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
              Refresh
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{ backgroundColor: "#fee2e2", border: "1px solid #fca5a5", borderRadius: "8px", padding: "15px", marginBottom: "20px", display: "flex", gap: "10px" }}>
            <AlertCircle size={20} style={{ color: "#dc2626", flexShrink: 0, marginTop: "2px" }} />
            <div style={{ color: "#991b1b" }}>
              <strong>Error:</strong> {error}
            </div>
          </div>
        )}

        {/* Messages List */}
        <div style={{ backgroundColor: "white", borderRadius: "8px", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
          {messages.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center", color: "#999" }}>
              <MessageSquare size={48} style={{ margin: "0 auto 10px", opacity: 0.5 }} />
              <p>Belum ada pesan masuk</p>
            </div>
          ) : (
            <div style={{ maxHeight: "calc(100vh - 400px)", overflowY: "auto" }}>
              {messages.map((msg, idx) => (
                <MessageRow key={msg.id || idx} message={msg} />
              ))}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: number; icon: string; color: string }) {
  return (
    <div style={{ backgroundColor: "white", padding: "20px", borderRadius: "8px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)", borderLeft: `4px solid ${color}` }}>
      <div style={{ fontSize: "24px", marginBottom: "8px" }}>{icon}</div>
      <div style={{ fontSize: "12px", color: "#999", marginBottom: "4px" }}>{label}</div>
      <div style={{ fontSize: "28px", fontWeight: "bold", color }}>
        {value}
      </div>
    </div>
  );
}

function MessageRow({ message }: { message: MonitorMessage }) {
  const time = new Date(message.timestamp).toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });

  const sourceColor = message.source === "telegram" ? "#0088cc" : "#25d366";
  const sourceLabel = message.source === "telegram" ? "Telegram" : "WhatsApp";
  const sourceIcon = message.source === "telegram" ? "📱" : "💬";

  return (
    <div
      style={{
        borderBottom: "1px solid #eee",
        padding: "15px",
        display: "flex",
        gap: "12px",
        alignItems: "flex-start",
        backgroundColor: message.isAiRequest ? "#fef3c7" : "white",
        transition: "background-color 0.2s"
      }}
    >
      <div style={{ fontSize: "18px", marginTop: "4px" }}>{sourceIcon}</div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "6px", gap: "10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <strong style={{ color: "#333" }}>{message.sender}</strong>
            <span
              style={{
                fontSize: "11px",
                padding: "2px 8px",
                backgroundColor: sourceColor,
                color: "white",
                borderRadius: "3px"
              }}
            >
              {sourceLabel}
            </span>
            {message.isAiRequest && (
              <span
                style={{
                  fontSize: "11px",
                  padding: "2px 8px",
                  backgroundColor: "#f59e0b",
                  color: "white",
                  borderRadius: "3px"
                }}
              >
                AI Request
              </span>
            )}
          </div>
          <span style={{ fontSize: "12px", color: "#999", whiteSpace: "nowrap" }}>{time}</span>
        </div>

        <div style={{ color: "#333", wordBreak: "break-word", lineHeight: "1.5", fontSize: "14px" }}>
          {message.text}
        </div>
      </div>
    </div>
  );
}
