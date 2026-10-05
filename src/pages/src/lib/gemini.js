// Integración directa con Google Gemini (Flash con visión).
// Reemplaza la función de backend analyzeCapture de Base44.
// Requiere la variable de entorno VITE_GEMINI_API_KEY en tu archivo .env

const GEMINI_MODEL = "gemini-2.0-flash";

function apiKey() {
  const key = import.meta.env.VITE_GEMINI_API_KEY;
  if (!key) {
    throw new Error("Falta VITE_GEMINI_API_KEY. Configúrala en tu archivo .env (ej. VITE_GEMINI_API_KEY=tu_clave)");
  }
  return key;
}

function parseImage(dataUrl) {
  const m = /^data:([^;]+);base64,(.*)$/s.exec(dataUrl || "");
  if (m) return { mimeType: m[1], data: m[2] };
  return { mimeType: "image/png", data: dataUrl };
}

const PROMPT_TEMPLATE = (eqContext) => `Analiza esta captura de pantalla de un sistema de monitoreo de condición de equipos industriales (estilo ABB Digital PowerTrain / HMI de planta). El equipo monitoreado es: ${eqContext}.

Extrae TODOS los parámetros o lecturas medibles que sean claramente visibles en la imagen (por ejemplo: temperatura, vibración, corriente, RPM, presión, carga, voltaje, frecuencia, desplazamiento, etc.).

Para cada lectura devuelve exactamente:
- parameter: nombre del parámetro (en español, ej. "Temperatura", "Vibración", "Corriente")
- value: valor numérico tal como aparece (sin unidades en el número)
- unit: unidad de medida (ej. "°C", "mm/s", "A", "rpm", "bar", "%", "V", "Hz")
- min: límite inferior razonable de operación segura para ese parámetro
- max: límite superior razonable de operación segura para ese parámetro

Reglas:
- Solo incluye valores que sean números claros y legibles en la imagen.
- No inventes valores que no estén visibles.
- Devuelve entre 1 y 10 lecturas.
- Si no hay ningún valor numérico claro, devuelve un arreglo vacío.

Responde SOLO con un JSON con esta forma: { "readings": [ { "parameter": "...", "value": 0, "unit": "...", "min": 0, "max": 0 } ] }`;

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    readings: {
      type: "array",
      items: {
        type: "object",
        properties: {
          parameter: { type: "string" },
          value: { type: "number" },
          unit: { type: "string" },
          min: { type: "number" },
          max: { type: "number" },
        },
        required: ["parameter", "value", "unit", "min", "max"],
      },
    },
  },
  required: ["readings"],
};

export async function analyzeImageWithGemini({ imageDataUrl, equipmentContext }) {
  const key = apiKey();
  const { mimeType, data } = parseImage(imageDataUrl);

  const body = {
    contents: [
      {
        parts: [
          { text: PROMPT_TEMPLATE(equipmentContext) },
          { inline_data: { mime_type: mimeType, data } },
        ],
      },
    ],
    generationConfig: {
      response_mime_type: "application/json",
      response_schema: RESPONSE_SCHEMA,
    },
  };

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Gemini API error ${res.status}: ${detail.slice(0, 300)}`);
  }

  const json = await res.json();
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text || "";

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = { readings: [] };
  }

  if (Array.isArray(parsed?.readings)) return parsed.readings;
  if (Array.isArray(parsed)) return parsed;
  return [];
}
