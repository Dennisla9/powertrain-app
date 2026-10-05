import React, { useEffect, useState, useMemo } from "react";
import { db } from "@/lib/db";
import { Plus, Cpu, ShieldCheck, Activity, AlertTriangle } from "lucide-react";
import EquipmentForm from "@/components/EquipmentForm";
import EquipmentHealthCard from "@/components/EquipmentHealthCard";
import { getEquipmentStatus } from "@/lib/status";

export default function Dashboard() {
  const [equipment, setEquipment] = useState([]);
  const [readings, setReadings] = useState([]);
  const [captures, setCaptures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [eqs, rds, caps] = await Promise.all([
        db.Equipment.list("-created_date", 100),
        db.Reading.list("-created_date", 1000),
        db.Capture.list("-created_date", 500),
      ]);
      setEquipment(eqs);
      setReadings(rds);
      setCaptures(caps);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const readingsByEq = useMemo(() => {
    const m = {};
    for (const r of readings) (m[r.equipment_id] ||= []).push(r);
    return m;
  }, [readings]);

  const captureCountByEq = useMemo(() => {
    const m = {};
    for (const c of captures) m[c.equipment_id] = (m[c.equipment_id] || 0) + 1;
    return m;
  }, [captures]);

  const stats = useMemo(() => {
    const c = { healthy: 0, warning: 0, critical: 0, unknown: 0 };
    for (const eq of equipment) c[getEquipmentStatus(readingsByEq[eq.id] || [])]++;
    return c;
  }, [equipment, readingsByEq]);

  const createEquipment = async (form) => {
    setSaving(true);
    try {
      const created = await db.Equipment.create(form);
      setEquipment((prev) => [created, ...prev]);
      setShowForm(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800">Home · Estado de la flota</h1>
          <p className="text-sm text-slate-500">Resumen de condición de equipos monitoreados · estilo ABB Knowledge Manager</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-cyan-700"
        >
          <Plus className="h-4 w-4" /> Nuevo equipo
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi icon={Cpu} label="Equipos totales" value={equipment.length} color="text-slate-700" />
        <Kpi icon={ShieldCheck} label="Bueno" value={stats.healthy} color="text-emerald-600" />
        <Kpi icon={Activity} label="Tolerable" value={stats.warning} color="text-amber-600" />
        <Kpi icon={AlertTriangle} label="Pobre" value={stats.critical} color="text-rose-600" />
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-cyan-600" />
        </div>
      ) : equipment.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center">
          <Cpu className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-3 text-sm text-slate-500">No hay equipos registrados todavía.</p>
          <button onClick={() => setShowForm(true)} className="mt-4 text-sm font-medium text-cyan-600 hover:text-cyan-700">
            Registrar el primer equipo
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {equipment.map((eq) => (
            <EquipmentHealthCard
              key={eq.id}
              equipment={eq}
              readings={readingsByEq[eq.id] || []}
              captureCount={captureCountByEq[eq.id] || 0}
            />
          ))}
        </div>
      )}

      {showForm && <EquipmentForm onSubmit={createEquipment} onClose={() => setShowForm(false)} saving={saving} />}
    </div>
  );
}

function Kpi({ icon: Icon, label, value, color }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <Icon className={`h-5 w-5 ${color}`} />
      </div>
      <p className="mt-3 text-2xl font-bold text-slate-800">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}
