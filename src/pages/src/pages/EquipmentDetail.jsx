import React, { useEffect, useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { db } from "@/lib/db";
import { extractReadingsFromCapture } from "@/lib/analysis";
import { ArrowLeft, MapPin, Calendar, Cog, Image as ImageIcon, LineChart, ClipboardList, Trash2, Sparkles } from "lucide-react";
import StatusDot, { StatusBadge } from "@/components/StatusDot";
import CaptureUploader from "@/components/CaptureUploader";
import ReadingForm from "@/components/ReadingForm";
import TrendChart from "@/components/TrendChart";
import { STATUS, getReadingStatus, getEquipmentStatus } from "@/lib/status";

export default function EquipmentDetail() {
  const { id } = useParams();
  const [equipment, setEquipment] = useState(null);
  const [captures, setCaptures] = useState([]);
  const [readings, setReadings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCapture, setSelectedCapture] = useState(null);
  const [savingReading, setSavingReading] = useState(false);
  const [analyzingId, setAnalyzingId] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const eq = await db.Equipment.get(id);
      setEquipment(eq);
      const [caps, rds] = await Promise.all([
        db.Capture.filter({ equipment_id: id }, "-capture_date", 200),
        db.Reading.filter({ equipment_id: id }, "-timestamp", 500),
      ]);
      setCaptures(caps);
      setReadings(rds);
      if (caps[0]) setSelectedCapture(caps[0].id);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const parameters = useMemo(() => Array.from(new Set(readings.map((r) => r.parameter))), [readings]);

  const captureReadings = useMemo(
    () => readings.filter((r) => selectedCapture && r.capture_id === selectedCapture),
    [readings, selectedCapture]
  );

  const captureReadingCount = useMemo(() => {
    const map = {};
    for (const r of readings) if (r.capture_id) map[r.capture_id] = (map[r.capture_id] || 0) + 1;
    return map;
  }, [readings]);

  const status = useMemo(() => getEquipmentStatus(readings), [readings]);

  const addReading = async (payload) => {
    setSavingReading(true);
    try {
      const created = await db.Reading.create(payload);
      setReadings((prev) => [created, ...prev]);
    } finally {
      setSavingReading(false);
    }
  };

  const deleteReading = async (rid) => {
    await db.Reading.delete(rid);
    setReadings((prev) => prev.filter((r) => r.id !== rid));
  };

  const analyzeCapture = async (cid) => {
    setAnalyzingId(cid);
    try {
      const cap = captures.find((c) => c.id === cid) || (await db.Capture.get(cid));
      const newReadings = await extractReadingsFromCapture(cap, equipment);
      if (newReadings.length > 0) await db.Reading.bulkCreate(newReadings);
      await load();
    } catch (err) {
      console.error("Error analizando captura", err);
    } finally {
      setAnalyzingId(null);
    }
  };

  const deleteCapture = async (cid) => {
    await db.Capture.delete(cid);
    setCaptures((prev) => prev.filter((c) => c.id !== cid));
    if (selectedCapture === cid) setSelectedCapture(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-cyan-600" />
      </div>
    );
  }

  if (!equipment) {
    return (
      <div className="py-20 text-center">
        <p className="text-slate-500">Equipo no encontrado.</p>
        <Link to="/" className="mt-3 inline-block text-sm text-cyan-600">Volver al tablero</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" /> Tablero
      </Link>

      {/* Header */}
      <div className={`relative overflow-hidden rounded-xl border border-slate-200 bg-white p-6 shadow-sm`}>
        <div className={`absolute inset-x-0 top-0 h-1 ${STATUS[status].dot}`} />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ring-1 ${STATUS[status].bg} ${STATUS[status].ring}`}>
              <Cog className={`h-7 w-7 ${STATUS[status].text}`} />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-800">{equipment.name}</h1>
              <p className="text-sm font-medium text-cyan-600">{equipment.tag}</p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{equipment.location || "—"}</span>
                <span className="inline-flex items-center gap-1"><Cog className="h-3.5 w-3.5" />{equipment.type}</span>
                {equipment.installation_date && (
                  <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{new Date(equipment.installation_date).toLocaleDateString()}</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <StatusDot status={status} size="lg" />
            <StatusBadge status={status} />
          </div>
        </div>
      </div>

      {/* Captures gallery */}
      <section>
        <SectionTitle icon={ImageIcon} title="Capturas de pantalla" subtitle={`${captures.length} captura(s) · puedes subir varias a la vez`} />
        <CaptureUploader equipmentId={id} equipment={equipment} onUploaded={(created) => {
          setCaptures((prev) => [...created, ...prev]);
          if (!selectedCapture && created[0]) setSelectedCapture(created[0].id);
          load();
        }} />
        {captures.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white py-10 text-center text-sm text-slate-500">
            Sin capturas aún. Sube la primera tanda arriba.
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
            {captures.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedCapture(c.id)}
                className={`group relative aspect-video overflow-hidden rounded-xl border transition ${
                  selectedCapture === c.id ? "border-cyan-500 ring-2 ring-cyan-200" : "border-slate-200 hover:border-slate-300"
                }`}
              >
                {c.image_uri ? (
                  <img src={c.image_uri} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center bg-slate-100">
                    <ImageIcon className="h-5 w-5 text-slate-300" />
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 flex items-center gap-1 bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5 text-left text-[10px] text-white">
                  {new Date(c.capture_date).toLocaleDateString()}
                  {captureReadingCount[c.id] > 0 && (
                    <span className="rounded bg-cyan-500/40 px-1 text-cyan-100">{captureReadingCount[c.id]} lect.</span>
                  )}
                </div>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => { e.stopPropagation(); analyzeCapture(c.id); }}
                  title="Analizar con IA"
                  className="absolute left-1 top-1 rounded-full bg-black/60 p-1 text-cyan-300 opacity-0 transition hover:bg-cyan-600 hover:text-white group-hover:opacity-100"
                >
                  {analyzingId === c.id ? (
                    <div className="h-3 w-3 animate-spin rounded-full border border-cyan-300 border-t-transparent" />
                  ) : (
                    <Sparkles className="h-3 w-3" />
                  )}
                </span>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => { e.stopPropagation(); deleteCapture(c.id); }}
                  className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition hover:bg-rose-600 group-hover:opacity-100"
                >
                  <Trash2 className="h-3 w-3" />
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Readings for selected capture */}
      <section>
        <SectionTitle
          icon={ClipboardList}
          title="Lecturas / parámetros"
          subtitle={selectedCapture ? "Registra lecturas asociadas a la captura seleccionada" : "Selecciona una captura para registrar lecturas"}
        />
        {selectedCapture ? (
          <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <ReadingForm equipmentId={id} captureId={selectedCapture} onSubmit={addReading} saving={savingReading} />
            <div className="space-y-2">
              {captureReadings.length === 0 ? (
                <p className="py-4 text-center text-xs text-slate-400">Sin lecturas registradas para esta captura.</p>
              ) : (
                captureReadings.map((r) => {
                  const st = STATUS[getReadingStatus(r.value, r.min, r.max)];
                  return (
                    <div key={r.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                      <div className="flex items-center gap-3">
                        <span className={`h-2 w-2 rounded-full ${st.dot}`} />
                        <div>
                          <p className="text-sm font-medium text-slate-700">{r.parameter}</p>
                          <p className="text-[11px] text-slate-400">Rango {r.min}–{r.max} {r.unit}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-sm font-semibold ${st.text}`}>{r.value} {r.unit}</span>
                        <span className="text-[11px] text-slate-400">{new Date(r.timestamp).toLocaleString()}</span>
                        <button onClick={() => deleteReading(r.id)} className="text-slate-400 hover:text-rose-500">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white py-8 text-center text-sm text-slate-500">
            Selecciona una captura de la galería para registrar sus lecturas.
          </div>
        )}
      </section>

      {/* Trends */}
      <section>
        <SectionTitle icon={LineChart} title="Tendencias por parámetro" subtitle="Evolución de lecturas con bandas de rango aceptable" />
        {parameters.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white py-10 text-center text-sm text-slate-500">
            Sin lecturas suficientes para graficar tendencias.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {parameters.map((p) => (
              <TrendChart key={p} parameter={p} readings={readings} />
            ))}
          </div>
        )}
      </section>

      {/* History */}
      <section>
        <SectionTitle icon={ClipboardList} title="Historial de lecturas" subtitle={`${readings.length} registro(s) ordenados por fecha`} />
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Parámetro</th>
                  <th className="px-4 py-3">Valor</th>
                  <th className="px-4 py-3">Rango</th>
                  <th className="px-4 py-3">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[...readings]
                  .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                  .slice(0, 50)
                  .map((r) => {
                    const st = STATUS[getReadingStatus(r.value, r.min, r.max)];
                    return (
                      <tr key={r.id} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5 text-slate-500">{new Date(r.timestamp).toLocaleString()}</td>
                        <td className="px-4 py-2.5 font-medium text-slate-700">{r.parameter}</td>
                        <td className={`px-4 py-2.5 font-semibold ${st.text}`}>{r.value} {r.unit}</td>
                        <td className="px-4 py-2.5 text-slate-400">{r.min}–{r.max} {r.unit}</td>
                        <td className="px-4 py-2.5">
                          <span className={`inline-flex items-center gap-1.5 text-xs ${st.text}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
                            {st.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}

function SectionTitle({ icon: Icon, title, subtitle }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <Icon className="h-4 w-4 text-cyan-600" />
      <div>
        <h2 className="text-base font-semibold text-slate-800">{title}</h2>
        <p className="text-xs text-slate-400">{subtitle}</p>
      </div>
    </div>
  );
}
