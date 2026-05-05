"use client";

import { useEffect, useState, useCallback } from "react";
import { MessageSquare, AlertCircle, RefreshCw, Brain, ChevronDown, ChevronUp, Users } from "lucide-react";
import type { MonitorMessage } from "@/app/api/monitor/messages/route";
import type { AttendanceReport, AttendanceEntry } from "@/app/api/monitor/attendance/route";

export default function MonitorPesanPage() {
  const [messages, setMessages] = useState<MonitorMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "telegram" | "kirimi">("all");
  const [autoRefresh, setAutoRefresh] = useState(true);

  // AI Absensi states
  const [analyzing, setAnalyzing] = useState(false);
  const [report, setReport] = useState<AttendanceReport | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [showReport, setShowReport] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);

  const fetchMessages = useCallback(async () => {
    try {
      setError(null);
      const sourceParam = filter === "all" ? "" : `&source=${filter}`;
      const res = await fetch(`/api/monitor/messages?limit=100${sourceParam}`);
      const data = await res.json();
      if (data.ok) setMessages(data.messages);
      else setError(data.error || "Failed to fetch messages");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchMessages();
    if (!autoRefresh) return;
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
  }, [fetchMessages, autoRefresh]);

  const analyzeAttendance = async () => {
    const toAnalyze = selectMode && selectedIds.size > 0
      ? messages.filter((m) => selectedIds.has(m.id))
      : messages.filter((m) => m.text && !m.text.startsWith("["));

    if (toAnalyze.length === 0) {
      setAiError("Tidak ada pesan teks untuk dianalisa.");
      return;
    }

    setAnalyzing(true);
    setAiError(null);
    try {
      const today = new Date().toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta", weekday: "long", year: "numeric", month: "long", day: "numeric" });
      const res = await fetch("/api/monitor/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: toAnalyze, dateLabel: today })
      });
      const data = await res.json();
      if (data.ok) {
        setReport(data.report);
        setShowReport(true);
        setSelectMode(false);
        setSelectedIds(new Set());
      } else {
        setAiError(data.error || "Analisa gagal");
      }
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setAnalyzing(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const telegramCount = messages.filter((m) => m.source === "telegram").length;
  const kirimiCount = messages.filter((m) => m.source === "kirimi").length;
  const aiRequestCount = messages.filter((m) => m.isAiRequest).length;

  const statusColor: Record<string, string> = {
    hadir: "#10b981", absen: "#ef4444", izin: "#f59e0b", sakit: "#3b82f6", terlambat: "#f97316"
  };
  const statusIcon: Record<string, string> = {
    hadir: "âœ…", absen: "âŒ", izin: "ðŸŸ¡", sakit: "ðŸ¤’", terlambat: "â°"
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f5f5f5", padding: "20px" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: "24px" }}>
          <h1 style={{ fontSize: "28px", fontWeight: "bold", marginBottom: "6px", color: "#333" }}>Monitor Pesan Masuk</h1>
          <p style={{ color: "#666", fontSize: "14px" }}>Real-time monitoring pesan dari Telegram dan WhatsApp</p>
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px", marginBottom: "20px" }}>
          <StatCard label="Total Pesan" value={messages.length} icon="ðŸ“Š" color="#3b82f6" />
          <StatCard label="Telegram" value={telegramCount} icon="ðŸ“±" color="#0088cc" />
          <StatCard label="WhatsApp" value={kirimiCount} icon="ðŸ’¬" color="#25d366" />
          <StatCard label="AI Request" value={aiRequestCount} icon="ðŸ¤–" color="#f59e0b" />
        </div>

        {/* === PANEL ANALISA AI ABSENSI === */}
        <div style={{ backgroundColor: "white", borderRadius: "8px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)", marginBottom: "20px", overflow: "hidden" }}>
          <div style={{ padding: "16px", borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <Brain size={20} style={{ color: "#7c3aed" }} />
              <div>
                <strong style={{ color: "#333" }}>Analisa Absensi AI</strong>
                <p style={{ margin: 0, fontSize: "12px", color: "#999" }}>
                  Baca pesan masuk dan buat laporan hadir/absen/izin/sakit/terlambat
                </p>
              </div>
            </div>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <button
                onClick={() => { setSelectMode(!selectMode); setSelectedIds(new Set()); }}
                style={{ padding: "6px 12px", border: "1px solid #ddd", borderRadius: "4px", backgroundColor: selectMode ? "#ede9fe" : "white", color: selectMode ? "#7c3aed" : "#555", cursor: "pointer", fontSize: "13px" }}
              >
                {selectMode ? `âœ“ ${selectedIds.size} dipilih` : "Pilih Pesan"}
              </button>
              <button
                onClick={analyzeAttendance}
                disabled={analyzing}
                style={{ padding: "8px 18px", backgroundColor: analyzing ? "#c4b5fd" : "#7c3aed", color: "white", border: "none", borderRadius: "4px", cursor: analyzing ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: "6px", fontWeight: "500", fontSize: "14px" }}
              >
                <Brain size={15} style={{ animation: analyzing ? "spin 1s linear infinite" : "none" }} />
                {analyzing ? "Menganalisa..." : "Analisa Sekarang"}
              </button>
            </div>
          </div>

          {aiError && (
            <div style={{ padding: "12px 16px", backgroundColor: "#fee2e2", color: "#991b1b", fontSize: "13px", display: "flex", gap: "8px" }}>
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: "1px" }} />
              {aiError}
            </div>
          )}

          {report && (
            <div style={{ padding: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <div>
                  <div style={{ fontSize: "13px", color: "#666" }}>Laporan: <strong style={{ color: "#333" }}>{report.date_label}</strong></div>
                  <div style={{ fontSize: "13px", color: "#555", marginTop: "4px" }}>{report.summary}</div>
                </div>
                <button onClick={() => setShowReport(!showReport)} style={{ border: "none", background: "none", cursor: "pointer", color: "#666" }}>
                  {showReport ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>
              </div>

              {/* Stat pills */}
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: showReport ? "16px" : "0" }}>
                {(["hadir", "terlambat", "izin", "sakit", "absen"] as const).map((s) => (
                  <span key={s} style={{ padding: "4px 12px", borderRadius: "999px", backgroundColor: statusColor[s] + "20", color: statusColor[s], fontSize: "13px", fontWeight: "600", border: `1px solid ${statusColor[s]}40` }}>
                    {statusIcon[s]} {s.charAt(0).toUpperCase() + s.slice(1)}: {(report as Record<string, unknown>)[s] as number}
                  </span>
                ))}
              </div>

              {showReport && report.entries.length > 0 && (
                <div style={{ borderTop: "1px solid #eee", paddingTop: "12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "10px" }}>
                    <Users size={14} style={{ color: "#666" }} />
                    <span style={{ fontSize: "13px", color: "#666", fontWeight: "600" }}>Detail per Karyawan ({report.entries.length} orang)</span>
                  </div>
                  <div style={{ display: "grid", gap: "8px" }}>
                    {report.entries.map((entry, i) => (
                      <AttendanceRow key={i} entry={entry} statusColor={statusColor} statusIcon={statusIcon} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Controls */}
        <div style={{ backgroundColor: "white", padding: "12px 16px", borderRadius: "8px", marginBottom: "16px", display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: "6px" }}>
            {(["all", "telegram", "kirimi"] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)} style={{ padding: "6px 14px", border: "1px solid #ddd", borderRadius: "4px", backgroundColor: filter === f ? "#3b82f6" : "white", color: filter === f ? "white" : "#333", cursor: "pointer", fontSize: "13px", fontWeight: "500" }}>
                {f === "all" ? "Semua" : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: "8px", alignItems: "center" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "13px" }}>
              <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />
              Auto-refresh
            </label>
            <button onClick={fetchMessages} disabled={loading} style={{ padding: "6px 14px", backgroundColor: "#10b981", color: "white", border: "none", borderRadius: "4px", cursor: loading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: "5px", opacity: loading ? 0.6 : 1, fontSize: "13px" }}>
              <RefreshCw size={14} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
              Refresh
            </button>
          </div>
        </div>

        {error && (
          <div style={{ backgroundColor: "#fee2e2", border: "1px solid #fca5a5", borderRadius: "8px", padding: "12px 16px", marginBottom: "16px", display: "flex", gap: "8px", fontSize: "13px" }}>
            <AlertCircle size={16} style={{ color: "#dc2626", flexShrink: 0, marginTop: "2px" }} />
            <div style={{ color: "#991b1b" }}><strong>Error:</strong> {error}</div>
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
            <div style={{ maxHeight: "calc(100vh - 500px)", overflowY: "auto" }}>
              {messages.map((msg, idx) => (
                <MessageRow
                  key={msg.id || idx}
                  message={msg}
                  selectable={selectMode}
                  selected={selectedIds.has(msg.id)}
                  onSelect={() => toggleSelect(msg.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

function AttendanceRow({ entry, statusColor, statusIcon }: { entry: AttendanceEntry; statusColor: Record<string, string>; statusIcon: Record<string, string> }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", padding: "8px 10px", borderRadius: "6px", backgroundColor: statusColor[entry.status] + "10", border: `1px solid ${statusColor[entry.status]}25` }}>
      <span style={{ fontSize: "16px", flexShrink: 0 }}>{statusIcon[entry.status]}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
          <strong style={{ fontSize: "13px", color: "#333" }}>{entry.name}</strong>
          {entry.phone && <span style={{ fontSize: "11px", color: "#999" }}>{entry.phone}</span>}
          {entry.time && <span style={{ fontSize: "11px", color: "#666", backgroundColor: "#f3f4f6", padding: "1px 6px", borderRadius: "3px" }}>â° {entry.time}</span>}
          <span style={{ fontSize: "11px", fontWeight: "600", color: statusColor[entry.status], textTransform: "capitalize" }}>{entry.status}</span>
        </div>
        {entry.note && <p style={{ margin: "3px 0 0", fontSize: "12px", color: "#666" }}>{entry.note}</p>}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: number; icon: string; color: string }) {
  return (
    <div style={{ backgroundColor: "white", padding: "16px 20px", borderRadius: "8px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)", borderLeft: `4px solid ${color}` }}>
      <div style={{ fontSize: "20px", marginBottom: "6px" }}>{icon}</div>
      <div style={{ fontSize: "11px", color: "#999", marginBottom: "3px" }}>{label}</div>
      <div style={{ fontSize: "26px", fontWeight: "bold", color }}>{value}</div>
    </div>
  );
}

function MessageRow({ message, selectable, selected, onSelect }: { message: MonitorMessage; selectable?: boolean; selected?: boolean; onSelect?: () => void }) {
  const time = new Date(message.timestamp).toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit"
  });
  const sourceColor = message.source === "telegram" ? "#0088cc" : "#25d366";
  const sourceLabel = message.source === "telegram" ? "Telegram" : "WhatsApp";
  const sourceIcon = message.source === "telegram" ? "ðŸ“±" : "ðŸ’¬";
  const displayName = message.senderName || message.sender;
  const isMedia = message.messageType && !["text", "chat", "extendedtext", ""].includes(message.messageType.toLowerCase());

  return (
    <div
      onClick={selectable ? onSelect : undefined}
      style={{ borderBottom: "1px solid #eee", padding: "12px 15px", display: "flex", gap: "10px", alignItems: "flex-start", backgroundColor: selected ? "#ede9fe" : message.isAiRequest ? "#fef3c7" : "white", cursor: selectable ? "pointer" : "default", transition: "background-color 0.1s" }}
    >
      {selectable && (
        <input type="checkbox" checked={!!selected} onChange={onSelect} onClick={(e) => e.stopPropagation()} style={{ marginTop: "4px", flexShrink: 0, accentColor: "#7c3aed" }} />
      )}
      <div style={{ fontSize: "16px", marginTop: "3px" }}>{sourceIcon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "4px", gap: "8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
            <strong style={{ color: "#333", fontSize: "13px" }}>{displayName}</strong>
            {message.senderName && message.senderPhone && <span style={{ fontSize: "11px", color: "#bbb" }}>{message.senderPhone}</span>}
            <span style={{ fontSize: "11px", padding: "1px 7px", backgroundColor: sourceColor, color: "white", borderRadius: "3px" }}>{sourceLabel}</span>
            {message.isFromGroup && <span style={{ fontSize: "11px", padding: "1px 7px", backgroundColor: "#6366f1", color: "white", borderRadius: "3px" }}>Grup {message.groupId ? `Â· ${message.groupId}` : ""}</span>}
            {isMedia && <span style={{ fontSize: "11px", padding: "1px 7px", backgroundColor: "#64748b", color: "white", borderRadius: "3px" }}>{message.messageType}</span>}
            {message.isAiRequest && <span style={{ fontSize: "11px", padding: "1px 7px", backgroundColor: "#f59e0b", color: "white", borderRadius: "3px" }}>AI Request</span>}
          </div>
          <span style={{ fontSize: "11px", color: "#bbb", whiteSpace: "nowrap" }}>{time}</span>
        </div>
        <div style={{ color: "#444", wordBreak: "break-word", lineHeight: "1.5", fontSize: "13px" }}>{message.text}</div>
      </div>
    </div>
  );
}
