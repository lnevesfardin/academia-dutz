import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

const KEY = "ficha-treino:v4";
const OLD_KEYS = ["ficha-treino:v3", "ficha-treino:v2", "ficha-treino:v1"];
const uid = () => Math.random().toString(36).slice(2, 9);

/* Camada de armazenamento: usa window.storage dentro do artefato do Claude
   e localStorage quando roda como site normal. O resto do app não muda. */
const store = {
  async get(k) {
    try {
      if (typeof window !== "undefined" && window.storage) {
        const r = await window.storage.get(k, false);
        return r && r.value ? r.value : null;
      }
      return localStorage.getItem(k);
    } catch (e) {
      return null;
    }
  },
  async set(k, v) {
    if (typeof window !== "undefined" && window.storage) {
      await window.storage.set(k, v, false);
      return;
    }
    localStorage.setItem(k, v);
  },
};

const WEEKDAYS = [
  { idx: 1, short: "Seg", long: "Segunda" },
  { idx: 2, short: "Ter", long: "Terça" },
  { idx: 3, short: "Qua", long: "Quarta" },
  { idx: 4, short: "Qui", long: "Quinta" },
  { idx: 5, short: "Sex", long: "Sexta" },
  { idx: 6, short: "Sáb", long: "Sábado" },
  { idx: 0, short: "Dom", long: "Domingo" },
];

const EQUIP = [
  { id: "barra", label: "Barra" },
  { id: "halteres", label: "Halteres" },
  { id: "maquina", label: "Máquinas" },
  { id: "polia", label: "Polia" },
  { id: "corpo", label: "Peso do corpo" },
];

const MUSCLE = {
  peito_sup: "Peitoral clavicular (superior)",
  peito_med: "Peitoral esternal (médio)",
  peito_inf: "Peitoral inferior",
  delt_ant: "Deltoide anterior",
  delt_lat: "Deltoide lateral",
  delt_post: "Deltoide posterior",
  trap_sup: "Trapézio superior",
  trap_med: "Trapézio médio e romboides",
  trap_inf: "Trapézio inferior",
  lat: "Latíssimo do dorso",
  redondo: "Redondo maior",
  lombar: "Eretores da espinha",
  bic_longa: "Bíceps, cabeça longa",
  bic_curta: "Bíceps, cabeça curta",
  braquial: "Braquial e braquiorradial",
  antebraco: "Antebraço",
  tri_longa: "Tríceps, cabeça longa",
  tri_lat: "Tríceps, cabeça lateral",
  tri_med: "Tríceps, cabeça medial",
  reto_sup: "Reto abdominal superior",
  reto_inf: "Reto abdominal inferior",
  obliquo: "Oblíquos",
  glut_max: "Glúteo máximo",
  glut_med: "Glúteo médio",
  adutor: "Adutores",
  quad_reto: "Reto femoral",
  quad_lat: "Vasto lateral",
  quad_med: "Vasto medial",
  isq_lat: "Bíceps femoral",
  isq_med: "Semitendinoso e semimembranoso",
  gastro: "Gastrocnêmio",
  soleo: "Sóleo",
};
const MUSCLE_ORDER = Object.keys(MUSCLE);

const LIBRARY = [
  // Peito
  { n: "Supino reto com barra", g: "Peito", e: "barra", p: ["peito_med", "peito_inf"], s: ["tri_lat", "delt_ant"] },
  { n: "Supino inclinado com barra", g: "Peito", e: "barra", p: ["peito_sup"], s: ["delt_ant", "tri_lat"] },
  { n: "Supino reto com halteres", g: "Peito", e: "halteres", p: ["peito_med"], s: ["delt_ant", "tri_lat"] },
  { n: "Supino inclinado com halteres", g: "Peito", e: "halteres", p: ["peito_sup"], s: ["delt_ant", "tri_lat"] },
  { n: "Crucifixo com halteres", g: "Peito", e: "halteres", p: ["peito_med"], s: ["delt_ant"] },
  { n: "Crossover na polia", g: "Peito", e: "polia", p: ["peito_med", "peito_inf"], s: ["delt_ant"] },
  { n: "Peck deck", g: "Peito", e: "maquina", p: ["peito_med"], s: ["delt_ant"] },
  { n: "Supino na máquina", g: "Peito", e: "maquina", p: ["peito_med"], s: ["tri_lat", "delt_ant"] },
  { n: "Flexão de braço", g: "Peito", e: "corpo", p: ["peito_med"], s: ["tri_lat", "delt_ant", "reto_sup"] },
  { n: "Mergulho em paralelas", g: "Peito", e: "corpo", p: ["peito_inf"], s: ["tri_longa", "tri_lat", "delt_ant"] },

  // Costas
  { n: "Barra fixa", g: "Costas", e: "corpo", p: ["lat", "redondo"], s: ["bic_longa", "bic_curta", "trap_med"] },
  { n: "Remada curvada com barra", g: "Costas", e: "barra", p: ["lat", "trap_med"], s: ["bic_curta", "lombar", "delt_post"] },
  { n: "Levantamento terra", g: "Costas", e: "barra", p: ["lombar", "glut_max", "isq_lat", "isq_med"], s: ["trap_sup", "trap_med", "lat", "quad_lat"] },
  { n: "Remada cavalinho", g: "Costas", e: "barra", p: ["lat", "trap_med"], s: ["bic_curta", "delt_post"] },
  { n: "Remada unilateral com halter", g: "Costas", e: "halteres", p: ["lat", "trap_med"], s: ["bic_curta", "delt_post"] },
  { n: "Pullover com halter", g: "Costas", e: "halteres", p: ["lat", "redondo"], s: ["peito_med", "tri_longa"] },
  { n: "Puxada frontal", g: "Costas", e: "polia", p: ["lat", "redondo"], s: ["bic_curta", "trap_med"] },
  { n: "Puxada supinada", g: "Costas", e: "polia", p: ["lat"], s: ["bic_longa", "bic_curta"] },
  { n: "Remada baixa na polia", g: "Costas", e: "polia", p: ["lat", "trap_med"], s: ["bic_curta", "delt_post", "lombar"] },
  { n: "Remada na máquina", g: "Costas", e: "maquina", p: ["lat", "trap_med"], s: ["bic_curta", "delt_post"] },

  // Ombros
  { n: "Desenvolvimento militar com barra", g: "Ombros", e: "barra", p: ["delt_ant", "delt_lat"], s: ["tri_lat", "trap_sup"] },
  { n: "Remada alta", g: "Ombros", e: "barra", p: ["delt_lat", "trap_sup"], s: ["bic_curta"] },
  { n: "Desenvolvimento com halteres", g: "Ombros", e: "halteres", p: ["delt_ant", "delt_lat"], s: ["tri_lat", "trap_sup"] },
  { n: "Elevação lateral", g: "Ombros", e: "halteres", p: ["delt_lat"], s: ["trap_sup"] },
  { n: "Elevação frontal", g: "Ombros", e: "halteres", p: ["delt_ant"], s: ["peito_sup"] },
  { n: "Crucifixo inverso", g: "Ombros", e: "halteres", p: ["delt_post"], s: ["trap_med"] },
  { n: "Encolhimento com halteres", g: "Ombros", e: "halteres", p: ["trap_sup"], s: ["antebraco"] },
  { n: "Elevação lateral na polia", g: "Ombros", e: "polia", p: ["delt_lat"], s: ["trap_sup"] },
  { n: "Desenvolvimento na máquina", g: "Ombros", e: "maquina", p: ["delt_ant", "delt_lat"], s: ["tri_lat"] },

  // Bíceps
  { n: "Rosca direta com barra", g: "Bíceps", e: "barra", p: ["bic_curta", "bic_longa"], s: ["braquial", "antebraco"] },
  { n: "Rosca alternada", g: "Bíceps", e: "halteres", p: ["bic_longa", "bic_curta"], s: ["braquial"] },
  { n: "Rosca martelo", g: "Bíceps", e: "halteres", p: ["braquial"], s: ["bic_longa", "antebraco"] },
  { n: "Rosca concentrada", g: "Bíceps", e: "halteres", p: ["bic_curta"], s: ["braquial"] },
  { n: "Rosca scott", g: "Bíceps", e: "maquina", p: ["bic_curta"], s: ["braquial"] },
  { n: "Rosca na polia", g: "Bíceps", e: "polia", p: ["bic_longa", "bic_curta"], s: ["braquial"] },

  // Tríceps
  { n: "Supino fechado", g: "Tríceps", e: "barra", p: ["tri_lat", "tri_med"], s: ["peito_med", "delt_ant"] },
  { n: "Tríceps testa", g: "Tríceps", e: "barra", p: ["tri_longa"], s: ["tri_lat", "tri_med"] },
  { n: "Tríceps francês", g: "Tríceps", e: "halteres", p: ["tri_longa"], s: ["tri_med"] },
  { n: "Tríceps coice", g: "Tríceps", e: "halteres", p: ["tri_lat", "tri_longa"], s: ["tri_med"] },
  { n: "Tríceps corda", g: "Tríceps", e: "polia", p: ["tri_lat", "tri_med"], s: ["tri_longa"] },
  { n: "Tríceps na polia com barra", g: "Tríceps", e: "polia", p: ["tri_lat", "tri_med"], s: [] },
  { n: "Mergulho no banco", g: "Tríceps", e: "corpo", p: ["tri_lat", "tri_med"], s: ["peito_inf", "delt_ant"] },

  // Quadríceps
  { n: "Agachamento livre", g: "Quadríceps", e: "barra", p: ["quad_lat", "quad_med", "quad_reto", "glut_max"], s: ["lombar", "adutor", "isq_lat"] },
  { n: "Agachamento frontal", g: "Quadríceps", e: "barra", p: ["quad_reto", "quad_lat", "quad_med"], s: ["glut_max", "lombar", "reto_sup"] },
  { n: "Afundo com halteres", g: "Quadríceps", e: "halteres", p: ["quad_lat", "quad_med", "glut_max"], s: ["isq_med", "glut_med"] },
  { n: "Agachamento búlgaro", g: "Quadríceps", e: "halteres", p: ["glut_max", "quad_lat", "quad_med"], s: ["isq_lat", "glut_med", "adutor"] },
  { n: "Leg press", g: "Quadríceps", e: "maquina", p: ["quad_lat", "quad_med", "glut_max"], s: ["isq_lat", "adutor"] },
  { n: "Cadeira extensora", g: "Quadríceps", e: "maquina", p: ["quad_reto", "quad_lat", "quad_med"], s: [] },
  { n: "Hack squat", g: "Quadríceps", e: "maquina", p: ["quad_lat", "quad_med"], s: ["glut_max", "quad_reto"] },
  { n: "Agachamento sem peso", g: "Quadríceps", e: "corpo", p: ["quad_lat", "quad_med"], s: ["glut_max"] },

  // Posterior
  { n: "Levantamento terra romeno", g: "Posterior", e: "barra", p: ["isq_lat", "isq_med", "glut_max"], s: ["lombar", "trap_med", "antebraco"] },
  { n: "Elevação pélvica", g: "Posterior", e: "barra", p: ["glut_max"], s: ["isq_med", "quad_reto"] },
  { n: "Stiff com halteres", g: "Posterior", e: "halteres", p: ["isq_lat", "isq_med"], s: ["glut_max", "lombar"] },
  { n: "Mesa flexora", g: "Posterior", e: "maquina", p: ["isq_lat", "isq_med"], s: ["gastro"] },
  { n: "Cadeira flexora", g: "Posterior", e: "maquina", p: ["isq_lat", "isq_med"], s: ["gastro"] },
  { n: "Cadeira abdutora", g: "Posterior", e: "maquina", p: ["glut_med"], s: ["glut_max"] },

  // Panturrilha
  { n: "Panturrilha em pé", g: "Panturrilha", e: "maquina", p: ["gastro"], s: ["soleo"] },
  { n: "Panturrilha sentado", g: "Panturrilha", e: "maquina", p: ["soleo"], s: ["gastro"] },
  { n: "Panturrilha no leg press", g: "Panturrilha", e: "maquina", p: ["gastro", "soleo"], s: [] },
  { n: "Panturrilha no degrau", g: "Panturrilha", e: "corpo", p: ["gastro"], s: ["soleo"] },

  // Core
  { n: "Prancha", g: "Core", e: "corpo", p: ["reto_sup", "reto_inf"], s: ["obliquo"] },
  { n: "Abdominal supra", g: "Core", e: "corpo", p: ["reto_sup"], s: ["obliquo"] },
  { n: "Elevação de pernas suspenso", g: "Core", e: "corpo", p: ["reto_inf"], s: ["obliquo", "antebraco"] },
  { n: "Rodinha abdominal", g: "Core", e: "corpo", p: ["reto_sup", "reto_inf"], s: ["lat", "obliquo"] },
  { n: "Abdominal na polia", g: "Core", e: "polia", p: ["reto_sup"], s: ["obliquo"] },
];

const BY_NAME = new Map(LIBRARY.map((x) => [x.n.toLowerCase(), x]));

// para exercícios criados do zero: termos específicos antes dos genéricos
const RULES = [
  [["supino inclinado"], ["peito_sup"], ["delt_ant", "tri_lat"]],
  [["supino fechado"], ["tri_lat", "tri_med"], ["peito_med"]],
  [["crucifixo inverso"], ["delt_post"], ["trap_med"]],
  [["remada alta"], ["delt_lat", "trap_sup"], []],
  [["elevação de pernas"], ["reto_inf"], ["obliquo"]],
  [["panturrilha sentado", "sóleo"], ["soleo"], ["gastro"]],
  [["panturrilha"], ["gastro"], ["soleo"]],
  [["mergulho"], ["tri_lat", "peito_inf"], ["delt_ant"]],
  [["terra"], ["lombar", "isq_lat", "isq_med", "glut_max"], ["trap_med", "lat"]],
  [["encolhimento", "trapézio"], ["trap_sup"], []],
  [["supino", "crucifixo", "crossover", "peck", "flexão de braço"], ["peito_med", "peito_inf"], ["tri_lat", "delt_ant"]],
  [["barra fixa", "puxada", "pulldown", "pullover"], ["lat", "redondo"], ["bic_curta", "trap_med"]],
  [["remada"], ["lat", "trap_med"], ["bic_curta", "delt_post"]],
  [["desenvolvimento", "militar"], ["delt_ant", "delt_lat"], ["tri_lat", "trap_sup"]],
  [["elevação lateral"], ["delt_lat"], ["trap_sup"]],
  [["elevação frontal"], ["delt_ant"], ["peito_sup"]],
  [["martelo"], ["braquial"], ["bic_longa", "antebraco"]],
  [["rosca"], ["bic_curta", "bic_longa"], ["braquial"]],
  [["tríceps", "testa", "francês", "coice"], ["tri_longa", "tri_lat"], ["tri_med"]],
  [["flexora", "stiff", "romeno"], ["isq_lat", "isq_med"], ["glut_max"]],
  [["abdutora"], ["glut_med"], ["glut_max"]],
  [["pélvica", "glúteo"], ["glut_max"], ["isq_med"]],
  [["agachamento", "leg press", "extensora", "hack", "afundo", "búlgaro"], ["quad_lat", "quad_med", "quad_reto"], ["glut_max", "adutor"]],
  [["oblíquo", "prancha lateral"], ["obliquo"], []],
  [["abdominal", "prancha", "rodinha"], ["reto_sup", "reto_inf"], ["obliquo"]],
  [["antebraço", "punho"], ["antebraco"], []],
];

function musclesFor(name) {
  const n = (name || "").toLowerCase().trim();
  const lib = BY_NAME.get(n);
  if (lib) return { pri: lib.p, sec: lib.s };
  for (const [termos, pri, sec] of RULES) {
    if (termos.some((t) => n.includes(t))) return { pri, sec };
  }
  return { pri: [], sec: [] };
}

const DEFAULT_SETS = 3;
const DEFAULT_REPS = "8-12";

const mk = (name, focus, nomesEx) => ({
  id: uid(),
  name,
  focus,
  exercises: nomesEx.map((n) => ({ id: uid(), name: n, sets: DEFAULT_SETS, repRange: DEFAULT_REPS })),
});

// garante que exercícios vindos de backups antigos (ou sem série/faixa definida) fiquem no formato atual
function normalizeDays(days) {
  return (days || []).map((d) => ({
    ...d,
    exercises: (d.exercises || []).map((ex) => ({
      id: ex.id,
      name: ex.name,
      sets: Number(ex.sets) > 0 ? Number(ex.sets) : DEFAULT_SETS,
      repRange: ex.repRange || "",
    })),
  }));
}

function buildABCDEF() {
  return [
    mk("Treino A", "Peito e tríceps", [
      "Supino reto com barra",
      "Supino inclinado com halteres",
      "Crossover na polia",
      "Tríceps testa",
      "Tríceps corda",
    ]),
    mk("Treino B", "Costas e bíceps", [
      "Barra fixa",
      "Remada curvada com barra",
      "Puxada frontal",
      "Rosca direta com barra",
      "Rosca martelo",
    ]),
    mk("Treino C", "Pernas", [
      "Agachamento livre",
      "Leg press",
      "Cadeira extensora",
      "Mesa flexora",
      "Panturrilha em pé",
    ]),
    mk("Treino D", "Ombros e trapézio", [
      "Desenvolvimento com halteres",
      "Elevação lateral",
      "Crucifixo inverso",
      "Encolhimento com halteres",
    ]),
    mk("Treino E", "Peito e costas", [
      "Supino reto com halteres",
      "Remada unilateral com halter",
      "Peck deck",
      "Puxada supinada",
    ]),
    mk("Treino F", "Posterior e panturrilha", [
      "Levantamento terra romeno",
      "Cadeira flexora",
      "Agachamento búlgaro",
      "Panturrilha sentado",
    ]),
  ];
}

const TEMPLATES = [
  {
    id: "abc",
    label: "ABC",
    desc: "3 treinos por semana, alternando peito, costas e pernas.",
    build: () => [
      mk("Treino A", "Peito e tríceps", [
        "Supino reto com barra",
        "Supino inclinado com halteres",
        "Crossover na polia",
        "Tríceps testa",
        "Tríceps corda",
      ]),
      mk("Treino B", "Costas e bíceps", [
        "Barra fixa",
        "Remada curvada com barra",
        "Puxada frontal",
        "Rosca direta com barra",
        "Rosca martelo",
      ]),
      mk("Treino C", "Pernas e ombros", [
        "Agachamento livre",
        "Leg press",
        "Cadeira extensora",
        "Mesa flexora",
        "Desenvolvimento com halteres",
        "Elevação lateral",
      ]),
    ],
  },
  {
    id: "ppl",
    label: "Push / Pull / Legs",
    desc: "Empurrar, puxar e pernas — 3 treinos por semana.",
    build: () => [
      mk("Push", "Peito, ombro e tríceps", [
        "Supino reto com barra",
        "Desenvolvimento com halteres",
        "Elevação lateral",
        "Tríceps corda",
        "Mergulho no banco",
      ]),
      mk("Pull", "Costas e bíceps", [
        "Puxada frontal",
        "Remada curvada com barra",
        "Remada unilateral com halter",
        "Rosca direta com barra",
        "Rosca martelo",
      ]),
      mk("Legs", "Pernas", [
        "Agachamento livre",
        "Leg press",
        "Cadeira extensora",
        "Mesa flexora",
        "Panturrilha em pé",
      ]),
    ],
  },
  {
    id: "upperlower",
    label: "Upper / Lower",
    desc: "Superior e inferior — 2 treinos por semana.",
    build: () => [
      mk("Upper", "Superior", [
        "Supino reto com barra",
        "Remada curvada com barra",
        "Desenvolvimento com halteres",
        "Rosca direta com barra",
        "Tríceps corda",
      ]),
      mk("Lower", "Inferior", [
        "Agachamento livre",
        "Levantamento terra romeno",
        "Leg press",
        "Cadeira flexora",
        "Panturrilha em pé",
      ]),
    ],
  },
  {
    id: "abcdef",
    label: "ABCDEF",
    desc: "6 treinos, um grupo muscular por dia.",
    build: buildABCDEF,
  },
];

function defaultSchedule(days) {
  const s = {};
  WEEKDAYS.forEach((w, i) => {
    s[w.idx] = i < 6 && days[i] ? days[i].id : null;
  });
  return s;
}

const C_NONE = "#d7d4cd";
const C_SEC = "#e2a9a1";
const C_MID = "#d0685b";
const C_PRI = "#bf3529";
const C_SKIN = "#c9c5bd";
const C_LINE = "#b0aca3";

function BodyMap({ color, onPick, picked }) {
  const P = (k) => ({
    fill: color(k),
    stroke: picked === k ? "#17191c" : C_LINE,
    strokeWidth: picked === k ? 1.6 : 0.6,
    onClick: () => onPick && onPick(k),
    style: { cursor: onPick ? "pointer" : "default" },
  });
  const N = { fill: C_SKIN, stroke: C_LINE, strokeWidth: 0.6 };
  return (
    <svg viewBox="0 0 260 235" width="100%" role="img" aria-label="Mapa muscular do corpo">
      {/* ===== FRENTE ===== */}
      <ellipse cx="64" cy="16" rx="10" ry="11.5" {...N} />
      <rect x="59" y="26" width="10" height="6" {...N} />
      <path d="M52 30 h24 l8 10 h-40 Z" {...P("trap_sup")} />
      <ellipse cx="42" cy="48" rx="6" ry="8.5" {...P("delt_ant")} />
      <ellipse cx="86" cy="48" rx="6" ry="8.5" {...P("delt_ant")} />
      <ellipse cx="35" cy="49" rx="5.5" ry="8" {...P("delt_lat")} />
      <ellipse cx="93" cy="49" rx="5.5" ry="8" {...P("delt_lat")} />

      <rect x="48" y="40" width="15" height="7" rx="3" {...P("peito_sup")} />
      <rect x="65" y="40" width="15" height="7" rx="3" {...P("peito_sup")} />
      <rect x="48" y="47.5" width="15" height="8" rx="3" {...P("peito_med")} />
      <rect x="65" y="47.5" width="15" height="8" rx="3" {...P("peito_med")} />
      <rect x="49" y="56" width="14" height="6" rx="3" {...P("peito_inf")} />
      <rect x="65" y="56" width="14" height="6" rx="3" {...P("peito_inf")} />

      <ellipse cx="34" cy="64" rx="4" ry="10" {...P("bic_longa")} />
      <ellipse cx="94" cy="64" rx="4" ry="10" {...P("bic_longa")} />
      <ellipse cx="41" cy="64" rx="4" ry="10" {...P("bic_curta")} />
      <ellipse cx="87" cy="64" rx="4" ry="10" {...P("bic_curta")} />
      <ellipse cx="37" cy="77" rx="5" ry="5.5" {...P("braquial")} />
      <ellipse cx="91" cy="77" rx="5" ry="5.5" {...P("braquial")} />
      <ellipse cx="33" cy="91" rx="5.5" ry="12" {...P("antebraco")} />
      <ellipse cx="95" cy="91" rx="5.5" ry="12" {...P("antebraco")} />
      <circle cx="31" cy="107" r="4.5" {...N} />
      <circle cx="97" cy="107" r="4.5" {...N} />

      <path d="M48 64 L54 64 L54 90 L49 85 Z" {...P("obliquo")} />
      <path d="M80 64 L74 64 L74 90 L79 85 Z" {...P("obliquo")} />
      <rect x="55" y="63" width="18" height="14" rx="3" {...P("reto_sup")} />
      <rect x="55" y="78" width="18" height="13" rx="3" {...P("reto_inf")} />
      <rect x="52" y="92" width="24" height="10" rx="4" {...N} />

      <rect x="49" y="103" width="6" height="38" rx="3" {...P("quad_lat")} />
      <rect x="73" y="103" width="6" height="38" rx="3" {...P("quad_lat")} />
      <rect x="55.5" y="103" width="5.5" height="38" rx="2.5" {...P("quad_reto")} />
      <rect x="67" y="103" width="5.5" height="38" rx="2.5" {...P("quad_reto")} />
      <ellipse cx="61" cy="110" rx="3.5" ry="8" {...P("adutor")} />
      <ellipse cx="67" cy="110" rx="3.5" ry="8" {...P("adutor")} />
      <ellipse cx="61" cy="132" rx="3.8" ry="8" {...P("quad_med")} />
      <ellipse cx="67" cy="132" rx="3.8" ry="8" {...P("quad_med")} />
      <rect x="50" y="142" width="11" height="6" rx="3" {...N} />
      <rect x="67" y="142" width="11" height="6" rx="3" {...N} />
      <ellipse cx="56" cy="162" rx="5.5" ry="12" {...P("gastro")} />
      <ellipse cx="72" cy="162" rx="5.5" ry="12" {...P("gastro")} />
      <ellipse cx="56" cy="180" rx="4.5" ry="7" {...P("soleo")} />
      <ellipse cx="72" cy="180" rx="4.5" ry="7" {...P("soleo")} />
      <rect x="50" y="189" width="11" height="6" rx="3" {...N} />
      <rect x="67" y="189" width="11" height="6" rx="3" {...N} />
      <text x="64" y="212" textAnchor="middle" fontSize="10" fill="#75726c">
        frente
      </text>

      {/* ===== COSTAS ===== */}
      <ellipse cx="192" cy="16" rx="10" ry="11.5" {...N} />
      <rect x="187" y="26" width="10" height="6" {...N} />
      <path d="M184 29 h16 l8 13 h-32 Z" {...P("trap_sup")} />
      <ellipse cx="170" cy="48" rx="7" ry="8.5" {...P("delt_post")} />
      <ellipse cx="214" cy="48" rx="7" ry="8.5" {...P("delt_post")} />
      <rect x="181" y="43" width="22" height="12" rx="2" {...P("trap_med")} />
      <path d="M184 56 L200 56 L192 70 Z" {...P("trap_inf")} />
      <ellipse cx="178" cy="52" rx="4.5" ry="4" {...P("redondo")} />
      <ellipse cx="206" cy="52" rx="4.5" ry="4" {...P("redondo")} />
      <path d="M177 57 L190 60 L189 82 L181 74 Z" {...P("lat")} />
      <path d="M207 57 L194 60 L195 82 L203 74 Z" {...P("lat")} />
      <rect x="185" y="80" width="14" height="12" rx="3" {...P("lombar")} />

      <ellipse cx="163" cy="64" rx="4" ry="10" {...P("tri_lat")} />
      <ellipse cx="221" cy="64" rx="4" ry="10" {...P("tri_lat")} />
      <ellipse cx="170" cy="64" rx="4" ry="10" {...P("tri_longa")} />
      <ellipse cx="214" cy="64" rx="4" ry="10" {...P("tri_longa")} />
      <ellipse cx="166" cy="77" rx="5" ry="5.5" {...P("tri_med")} />
      <ellipse cx="218" cy="77" rx="5" ry="5.5" {...P("tri_med")} />
      <ellipse cx="162" cy="91" rx="5.5" ry="12" {...P("antebraco")} />
      <ellipse cx="222" cy="91" rx="5.5" ry="12" {...P("antebraco")} />
      <circle cx="160" cy="107" r="4.5" {...N} />
      <circle cx="224" cy="107" r="4.5" {...N} />

      <ellipse cx="177" cy="94" rx="4.5" ry="5" {...P("glut_med")} />
      <ellipse cx="207" cy="94" rx="4.5" ry="5" {...P("glut_med")} />
      <ellipse cx="186" cy="99" rx="8.5" ry="8" {...P("glut_max")} />
      <ellipse cx="198" cy="99" rx="8.5" ry="8" {...P("glut_max")} />
      <rect x="177" y="109" width="6.5" height="32" rx="3" {...P("isq_lat")} />
      <rect x="200.5" y="109" width="6.5" height="32" rx="3" {...P("isq_lat")} />
      <rect x="184.5" y="109" width="6" height="32" rx="3" {...P("isq_med")} />
      <rect x="193.5" y="109" width="6" height="32" rx="3" {...P("isq_med")} />
      <rect x="178" y="142" width="11" height="6" rx="3" {...N} />
      <rect x="195" y="142" width="11" height="6" rx="3" {...N} />
      <ellipse cx="184" cy="162" rx="5.5" ry="12" {...P("gastro")} />
      <ellipse cx="200" cy="162" rx="5.5" ry="12" {...P("gastro")} />
      <ellipse cx="184" cy="180" rx="4.5" ry="7" {...P("soleo")} />
      <ellipse cx="200" cy="180" rx="4.5" ry="7" {...P("soleo")} />
      <rect x="178" y="189" width="11" height="6" rx="3" {...N} />
      <rect x="195" y="189" width="11" height="6" rx="3" {...N} />
      <text x="192" y="212" textAnchor="middle" fontSize="10" fill="#75726c">
        costas
      </text>
    </svg>
  );
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=Inter:wght@400;500;600&display=swap');

.ft {
  --iron: #17191c; --paper: #fbfaf8; --chalk: #e7e5e0; --rule: #d3d0c9; --muted: #75726c; --plate: #bf3529;
  font-family: Inter, system-ui, -apple-system, "Segoe UI", sans-serif;
  color: var(--iron); background: var(--chalk); min-height: 100vh; padding-bottom: 88px;
  -webkit-font-smoothing: antialiased;
}
.ft * { box-sizing: border-box; }
.ft-num { font-variant-numeric: tabular-nums; }

.ft-head { padding: 18px 18px 13px; border-bottom: 1px solid var(--rule); background: var(--paper); }
.ft-title { font-family: "Barlow Condensed", "Arial Narrow", system-ui, sans-serif; font-size: 29px; font-weight: 700; letter-spacing: -0.01em; line-height: 1; margin: 0; }
.ft-sub { font-size: 13px; color: var(--muted); margin-top: 6px; }

.ft-tabs { display: flex; background: var(--paper); border-bottom: 1px solid var(--rule); position: sticky; top: 0; z-index: 5; }
.ft-tab { flex: 1; padding: 12px 4px; background: none; border: none; cursor: pointer; font-family: inherit; font-size: 13px; font-weight: 500; color: var(--muted); border-bottom: 2px solid transparent; }
.ft-tab[data-on="1"] { color: var(--iron); border-bottom-color: var(--iron); font-weight: 600; }
.ft-tab:focus-visible { outline: 2px solid var(--iron); outline-offset: -2px; }

.ft-body { padding: 16px 14px 0; }

.ft-daybar { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 12px; }
.ft-daybar::-webkit-scrollbar { display: none; }
.ft-chip { flex: 0 0 auto; padding: 8px 14px; border: 1px solid var(--rule); background: var(--paper); border-radius: 2px; cursor: pointer; font-family: "Barlow Condensed", system-ui, sans-serif; font-size: 17px; font-weight: 600; color: var(--muted); }
.ft-chip[data-on="1"] { background: var(--iron); border-color: var(--iron); color: var(--paper); }

.ft-dayname { font-family: "Barlow Condensed", system-ui, sans-serif; font-size: 24px; font-weight: 700; line-height: 1.1; margin: 6px 0 2px; }
.ft-dayfocus { font-size: 13px; color: var(--muted); margin-bottom: 14px; }

.ft-map { background: var(--paper); border: 1px solid var(--rule); border-radius: 2px; padding: 10px 10px 6px; margin-bottom: 14px; }
.ft-mapcap { font-size: 12px; color: var(--muted); line-height: 1.55; padding: 7px 2px 2px; border-top: 1px solid var(--rule); margin-top: 4px; }
.ft-mapcap b { color: var(--iron); font-weight: 600; }
.ft-legend { display: flex; gap: 14px; font-size: 11px; color: var(--muted); padding: 0 2px 4px; }
.ft-sw { display: inline-block; width: 9px; height: 9px; border-radius: 50%; margin-right: 5px; vertical-align: -1px; }

.ft-ex { background: var(--paper); border: 1px solid var(--rule); border-radius: 2px; padding: 14px; margin-bottom: 10px; }
.ft-ex[data-focus="1"] { border-color: var(--iron); }
.ft-exname { font-size: 15px; font-weight: 600; line-height: 1.25; background: none; border: none; padding: 0; font-family: inherit; color: var(--iron); text-align: left; cursor: pointer; display: block; width: 100%; }
.ft-last { font-size: 12px; color: var(--muted); margin-top: 3px; line-height: 1.45; }
.ft-last b { font-weight: 600; color: var(--iron); }

.ft-set { display: flex; align-items: center; gap: 8px; margin-top: 10px; }
.ft-setidx { font-family: "Barlow Condensed", system-ui, sans-serif; font-size: 15px; color: var(--muted); width: 16px; flex: 0 0 16px; }
.ft-input { font-family: "Barlow Condensed", system-ui, sans-serif; font-variant-numeric: tabular-nums; font-size: 26px; font-weight: 600; line-height: 1; width: 74px; padding: 8px 6px; text-align: center; border: 1px solid var(--rule); border-radius: 2px; background: var(--chalk); color: var(--iron); }
.ft-input::placeholder { color: #b4b0a8; font-weight: 500; }
.ft-input:focus { outline: 2px solid var(--iron); outline-offset: -1px; background: var(--paper); }
.ft-x { font-size: 15px; color: var(--muted); }
.ft-pr { font-family: "Barlow Condensed", system-ui, sans-serif; font-size: 14px; font-weight: 600; color: var(--plate); display: flex; align-items: center; gap: 4px; margin-left: auto; }
.ft-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--plate); display: inline-block; }
.ft-rm { margin-left: auto; background: none; border: none; color: var(--muted); font-family: inherit; font-size: 12px; cursor: pointer; padding: 4px; }
.ft-pr + .ft-rm { margin-left: 8px; }
.ft-addset { margin-top: 10px; background: none; border: 1px dashed var(--rule); border-radius: 2px; padding: 7px 12px; font-family: inherit; font-size: 13px; color: var(--muted); cursor: pointer; }
.ft-addset:hover { border-color: var(--iron); color: var(--iron); }

.ft-save { position: fixed; left: 0; right: 0; bottom: 0; padding: 12px 14px; background: linear-gradient(to top, var(--chalk) 70%, rgba(231,229,224,0)); }
.ft-rest { display: flex; align-items: center; gap: 10px; background: var(--iron); color: var(--paper); border-radius: 2px; padding: 9px 12px; margin-bottom: 8px; }
.ft-rest-label { font-size: 12px; color: #b7b4ac; flex: 0 0 auto; }
.ft-rest-time { font-family: "Barlow Condensed", system-ui, sans-serif; font-variant-numeric: tabular-nums; font-size: 26px; font-weight: 700; flex: 1; }
.ft-rest-btns { display: flex; gap: 6px; }
.ft-rest-btn { background: none; border: 1px solid #4a4d52; color: var(--paper); border-radius: 2px; padding: 6px 10px; font-family: inherit; font-size: 12px; cursor: pointer; }
.ft-rest-btn:hover { border-color: var(--paper); }
.ft-btn { width: 100%; padding: 15px; background: var(--iron); color: var(--paper); border: none; border-radius: 2px; cursor: pointer; font-family: "Barlow Condensed", system-ui, sans-serif; font-size: 20px; font-weight: 600; }
.ft-btn:disabled { background: #a6a29b; cursor: default; }
.ft-btn:focus-visible { outline: 3px solid var(--plate); outline-offset: 2px; }
.ft-toast { position: fixed; bottom: 78px; left: 14px; right: 14px; padding: 11px 14px; background: var(--iron); color: var(--paper); border-radius: 2px; font-size: 14px; text-align: center; z-index: 10; }

.ft-weekrow { display: flex; align-items: center; gap: 10px; background: var(--paper); border: 1px solid var(--rule); border-radius: 2px; padding: 10px 12px; margin-bottom: 8px; }
.ft-weekrow[data-today="1"] { border-color: var(--iron); border-left-width: 4px; }
.ft-weekday { font-family: "Barlow Condensed", system-ui, sans-serif; font-size: 19px; font-weight: 600; flex: 0 0 46px; }
.ft-select { width: 100%; padding: 9px; font-family: inherit; font-size: 14px; border: 1px solid var(--rule); border-radius: 2px; background: var(--chalk); color: var(--iron); }
.ft-weekrow .ft-select { flex: 1; }

.ft-cover { display: flex; justify-content: space-between; gap: 10px; font-size: 13px; padding: 8px 2px; border-bottom: 1px solid var(--rule); }
.ft-cover span:last-child { color: var(--muted); flex: 0 0 auto; }
.ft-cover[data-zero="1"] span:last-child { color: var(--plate); }

.ft-stats { display: flex; gap: 10px; margin: 14px 0; }
.ft-stat { flex: 1; background: var(--paper); border: 1px solid var(--rule); border-radius: 2px; padding: 12px; }
.ft-statval { font-family: "Barlow Condensed", system-ui, sans-serif; font-variant-numeric: tabular-nums; font-size: 32px; font-weight: 700; line-height: 1; }
.ft-statlab { font-size: 11px; color: var(--muted); margin-top: 5px; }
.ft-chart { background: var(--paper); border: 1px solid var(--rule); border-radius: 2px; padding: 14px 6px 6px; }

.ft-hist { border-top: 1px solid var(--rule); padding: 12px 2px; display: flex; gap: 12px; align-items: baseline; }
.ft-histdate { font-family: "Barlow Condensed", system-ui, sans-serif; font-variant-numeric: tabular-nums; font-size: 19px; font-weight: 600; flex: 0 0 52px; }
.ft-histday { font-size: 14px; font-weight: 500; }
.ft-histmeta { font-size: 12px; color: var(--muted); margin-top: 2px; }

.ft-empty { background: var(--paper); border: 1px solid var(--rule); border-radius: 2px; padding: 22px 16px; font-size: 14px; color: var(--muted); line-height: 1.5; }

.ft-cfgday { background: var(--paper); border: 1px solid var(--rule); border-radius: 2px; padding: 13px; margin-bottom: 10px; }
.ft-cfginput { font-family: inherit; font-size: 15px; font-weight: 600; padding: 7px 8px; width: 100%; border: 1px solid transparent; background: var(--chalk); border-radius: 2px; color: var(--iron); }
.ft-cfginput:focus { outline: 2px solid var(--iron); outline-offset: -1px; }
.ft-cfgex { display: flex; gap: 6px; align-items: center; margin-top: 7px; flex-wrap: wrap; }
.ft-cfgex .ft-cfginput { font-size: 14px; font-weight: 400; flex: 1; min-width: 120px; }
.ft-mini { background: none; border: 1px solid var(--rule); border-radius: 2px; padding: 6px 9px; font-family: inherit; font-size: 12px; color: var(--muted); cursor: pointer; flex: 0 0 auto; }
.ft-mini:hover { border-color: var(--iron); color: var(--iron); }
.ft-mini[data-on="1"] { background: var(--iron); border-color: var(--iron); color: var(--paper); }
.ft-danger { color: var(--plate); border-color: var(--plate); }
.ft-note { font-size: 12px; color: var(--muted); line-height: 1.5; margin: 14px 2px 24px; }
.ft-label { font-size: 13px; font-weight: 600; margin: 4px 2px 8px; }
.ft-ta { width: 100%; min-height: 90px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; padding: 8px; border: 1px solid var(--rule); border-radius: 2px; background: var(--chalk); color: var(--iron); resize: vertical; }

.ft-lib { border-top: 1px solid var(--rule); margin-top: 12px; padding-top: 11px; }
.ft-libitem { display: flex; justify-content: space-between; align-items: center; gap: 10px; width: 100%; padding: 9px 4px; border: none; border-bottom: 1px solid var(--rule); background: none; font-family: inherit; font-size: 14px; color: var(--iron); text-align: left; cursor: pointer; }
.ft-libitem:disabled { color: var(--muted); cursor: default; }
.ft-libitem[data-active="1"] { background: var(--chalk); font-weight: 600; }
.ft-libtag { font-size: 11px; color: var(--muted); flex: 0 0 40%; text-align: right; line-height: 1.35; }
.ft-libwrap { max-height: 280px; overflow-y: auto; }

.ft-tplcard { display: block; width: 100%; text-align: left; background: var(--paper); border: 1px solid var(--rule); border-radius: 2px; padding: 14px; margin-bottom: 10px; font-family: inherit; cursor: pointer; }
.ft-tplcard:hover { border-color: var(--iron); }
.ft-tplcard:focus-visible { outline: 2px solid var(--iron); outline-offset: -2px; }
.ft-tplname { font-family: "Barlow Condensed", system-ui, sans-serif; font-size: 22px; font-weight: 700; line-height: 1.15; color: var(--iron); }
.ft-tpldesc { font-size: 13px; color: var(--muted); margin-top: 4px; line-height: 1.45; }
.ft-reorder { display: flex; flex-direction: column; gap: 2px; flex: 0 0 auto; }
.ft-reorder .ft-mini { padding: 3px 8px; line-height: 1; }

@media (prefers-reduced-motion: no-preference) {
  .ft-toast { animation: ft-in 180ms ease-out; }
  @keyframes ft-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
}
`;

function fmtDate(iso) {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function fmtRest(totalSec) {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
const nomes = (arr) => arr.map((k) => MUSCLE[k]).join(", ");

export default function FichaDeTreino() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("hoje");
  const [dayId, setDayId] = useState(null);
  const [draft, setDraft] = useState({});
  const [toast, setToast] = useState("");
  const [chartEx, setChartEx] = useState("");
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [libOpen, setLibOpen] = useState(false);
  const [libQuery, setLibQuery] = useState("");
  const [libPick, setLibPick] = useState(null);
  const [focusEx, setFocusEx] = useState(null);
  const [pick, setPick] = useState(null);
  const [pickWeek, setPickWeek] = useState(null);
  const [backupOpen, setBackupOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [restEnd, setRestEnd] = useState(null);
  const [restNow, setRestNow] = useState(Date.now());
  const audioCtxRef = useRef(null);

  const hoje = new Date().getDay();

  useEffect(() => {
    let alive = true;
    (async () => {
      let loaded = null;
      let importado = false;
      const raw = await store.get(KEY);
      if (raw) {
        try {
          loaded = JSON.parse(raw);
        } catch (e) {
          loaded = null;
        }
      }
      if (!loaded) {
        for (const k of OLD_KEYS) {
          const old = await store.get(k);
          if (!old) continue;
          try {
            const p = JSON.parse(old);
            if (p && Array.isArray(p.days) && p.days.length) {
              loaded = p;
              importado = true;
              break;
            }
          } catch (e) {
            /* ignora */
          }
        }
      }
      if (!alive) return;
      const days =
        loaded && Array.isArray(loaded.days) && loaded.days.length ? normalizeDays(loaded.days) : [];
      const safe = {
        days,
        sessions: (loaded && loaded.sessions) || [],
        schedule: (loaded && loaded.schedule) || (days.length ? defaultSchedule(days) : {}),
        equipment: (loaded && loaded.equipment) || EQUIP.map((e) => e.id),
        restSeconds: (loaded && loaded.restSeconds) || 90,
      };
      const doHoje = safe.schedule[new Date().getDay()];
      setData(safe);
      setDayId(days.length ? (days.some((d) => d.id === doHoje) ? doHoje : days[0].id) : null);
      setLoading(false);
      if (importado) {
        try {
          await store.set(KEY, JSON.stringify(safe));
        } catch (e) {
          /* segue */
        }
        setToast(
          `Trouxe seus dados anteriores: ${safe.days.length} treinos, ${safe.sessions.length} sessões`
        );
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    setLibOpen(false);
    setLibQuery("");
    setLibPick(null);
  }, [dayId]);

  useEffect(() => {
    if (!restEnd) return;
    const id = setInterval(() => setRestNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [restEnd]);

  const restRemaining = restEnd ? Math.max(0, Math.ceil((restEnd - restNow) / 1000)) : 0;

  useEffect(() => {
    if (restEnd && restRemaining === 0) finishRestTimer();
  }, [restRemaining, restEnd]);

  async function persist(next) {
    setData(next);
    try {
      await store.set(KEY, JSON.stringify(next));
      return true;
    } catch (e) {
      return false;
    }
  }

  const day = useMemo(
    () => (data ? data.days.find((d) => d.id === dayId) || data.days[0] : null),
    [data, dayId]
  );

  const lastByExercise = useMemo(() => {
    const map = {};
    if (!data) return map;
    [...data.sessions]
      .sort((a, b) => a.date.localeCompare(b.date))
      .forEach((s) =>
        s.entries.forEach((e) => {
          if (e.sets.length) map[e.exerciseId] = { date: s.date, sets: e.sets };
        })
      );
    return map;
  }, [data]);

  const bestByExercise = useMemo(() => {
    const map = {};
    if (!data) return map;
    data.sessions.forEach((s) =>
      s.entries.forEach((e) =>
        e.sets.forEach((set) => {
          const kg = Number(set.kg);
          if (kg > (map[e.exerciseId] || 0)) map[e.exerciseId] = kg;
        })
      )
    );
    return map;
  }, [data]);

  useEffect(() => {
    if (!day) return;
    const next = {};
    day.exercises.forEach((ex) => {
      next[ex.id] = Array.from({ length: ex.sets || DEFAULT_SETS }, () => ({ kg: "", reps: "" }));
    });
    setDraft(next);
    setFocusEx(null);
    setPick(null);
  }, [day]);

  function setCell(exId, i, field, value) {
    const clean = value.replace(",", ".");
    const current = (draft[exId] || [])[i] || { kg: "", reps: "" };
    const next = { ...current, [field]: clean };
    setDraft((d) => {
      const sets = [...(d[exId] || [])];
      sets[i] = next;
      return { ...d, [exId]: sets };
    });
    const wasComplete = current.kg !== "" && current.reps !== "";
    const isComplete = next.kg !== "" && next.reps !== "";
    if (!wasComplete && isComplete) startRestTimer();
  }

  function ensureAudio() {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      if (!audioCtxRef.current) audioCtxRef.current = new Ctx();
      if (audioCtxRef.current.state === "suspended") audioCtxRef.current.resume();
      return audioCtxRef.current;
    } catch (e) {
      return null;
    }
  }

  function playBeep() {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      [0, 0.18, 0.36].forEach((offset) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.0001, now + offset);
        gain.gain.exponentialRampToValueAtTime(0.3, now + offset + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.15);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + offset);
        osc.stop(now + offset + 0.16);
      });
    } catch (e) {
      /* sem som, segue o treino */
    }
  }

  function startRestTimer() {
    ensureAudio();
    setRestNow(Date.now());
    setRestEnd(Date.now() + (data.restSeconds || 90) * 1000);
  }

  function stopRestTimer() {
    setRestEnd(null);
  }

  function adjustRest(deltaSec) {
    setRestEnd((end) => (end ? Math.max(Date.now() + 1000, end + deltaSec * 1000) : end));
  }

  function finishRestTimer() {
    setRestEnd(null);
    playBeep();
    if (navigator.vibrate) navigator.vibrate([200, 120, 200, 120, 200]);
    setToast("Descanso acabou — bora pra próxima série");
  }
  const addSet = (exId) =>
    setDraft((d) => ({ ...d, [exId]: [...(d[exId] || []), { kg: "", reps: "" }] }));
  const removeSet = (exId, i) =>
    setDraft((d) => ({ ...d, [exId]: (d[exId] || []).filter((_, idx) => idx !== i) }));

  function repetirUltimo(exId) {
    const prev = lastByExercise[exId];
    if (!prev) return;
    setDraft((d) => ({
      ...d,
      [exId]: prev.sets.map((s) => ({ kg: String(s.kg), reps: String(s.reps) })),
    }));
  }

  const filledCount = useMemo(
    () =>
      Object.values(draft)
        .flat()
        .filter((s) => s && s.kg !== "" && s.reps !== "").length,
    [draft]
  );

  async function saveSession() {
    const entries = day.exercises
      .map((ex) => ({
        exerciseId: ex.id,
        name: ex.name,
        sets: (draft[ex.id] || [])
          .filter((s) => s.kg !== "" && s.reps !== "")
          .map((s) => ({ kg: Number(s.kg), reps: Number(s.reps) })),
      }))
      .filter((e) => e.sets.length);
    if (!entries.length) return;
    const ok = await persist({
      ...data,
      sessions: [
        ...data.sessions,
        {
          id: uid(),
          dayId: day.id,
          dayName: day.name,
          dayFocus: day.focus,
          date: new Date().toISOString(),
          entries,
        },
      ],
    });
    setToast(ok ? "Treino salvo" : "Não deu para salvar. Tente de novo.");
  }

  const allExercises = useMemo(() => {
    if (!data) return [];
    const seen = new Map();
    data.days.forEach((d) => d.exercises.forEach((ex) => seen.set(ex.id, ex.name)));
    return [...seen].map(([id, name]) => ({ id, name }));
  }, [data]);

  const chartData = useMemo(() => {
    if (!data || !chartEx) return [];
    return [...data.sessions]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((s) => {
        const e = s.entries.find((x) => x.exerciseId === chartEx);
        if (!e || !e.sets.length) return null;
        return { data: fmtDate(s.date), carga: Math.max(...e.sets.map((x) => x.kg)) };
      })
      .filter(Boolean);
  }, [data, chartEx]);

  useEffect(() => {
    if (!chartEx && allExercises.length) {
      const withData = allExercises.find((e) => bestByExercise[e.id]);
      setChartEx(withData ? withData.id : allExercises[0].id);
    }
  }, [allExercises, bestByExercise, chartEx]);

  const dayMuscles = useMemo(() => {
    const pri = new Set();
    const sec = new Set();
    if (!day) return { pri, sec };
    const lista = focusEx ? day.exercises.filter((e) => e.id === focusEx) : day.exercises;
    lista.forEach((ex) => {
      const m = musclesFor(ex.name);
      m.pri.forEach((k) => pri.add(k));
      m.sec.forEach((k) => sec.add(k));
    });
    sec.forEach((k) => pri.has(k) && sec.delete(k));
    return { pri, sec };
  }, [day, focusEx]);

  const dayColor = (k) => (dayMuscles.pri.has(k) ? C_PRI : dayMuscles.sec.has(k) ? C_SEC : C_NONE);

  const weekCount = useMemo(() => {
    const c = {};
    MUSCLE_ORDER.forEach((k) => (c[k] = { n: 0, dias: [] }));
    if (!data) return c;
    WEEKDAYS.forEach((w) => {
      const d = data.days.find((x) => x.id === data.schedule[w.idx]);
      if (!d) return;
      const marcados = new Set();
      d.exercises.forEach((ex) => musclesFor(ex.name).pri.forEach((k) => marcados.add(k)));
      marcados.forEach((k) => {
        c[k].n += 1;
        c[k].dias.push(w.short);
      });
    });
    return c;
  }, [data]);

  const weekColor = (k) => {
    const n = (weekCount[k] || {}).n || 0;
    if (n === 0) return C_NONE;
    if (n === 1) return C_SEC;
    if (n === 2) return C_MID;
    return C_PRI;
  };

  const updateDay = (id, patch) =>
    persist({ ...data, days: data.days.map((d) => (d.id === id ? { ...d, ...patch } : d)) });

  const updateExercise = (dId, exId, patch) =>
    persist({
      ...data,
      days: data.days.map((d) =>
        d.id === dId
          ? { ...d, exercises: d.exercises.map((ex) => (ex.id === exId ? { ...ex, ...patch } : ex)) }
          : d
      ),
    });

  const addExercise = (dId, name) =>
    persist({
      ...data,
      days: data.days.map((d) =>
        d.id === dId
          ? { ...d, exercises: [...d.exercises, { id: uid(), name, sets: DEFAULT_SETS, repRange: "" }] }
          : d
      ),
    });

  const removeExercise = (dId, exId) =>
    persist({
      ...data,
      days: data.days.map((d) =>
        d.id === dId ? { ...d, exercises: d.exercises.filter((ex) => ex.id !== exId) } : d
      ),
    });

  function moveExercise(dId, exId, dir) {
    const d = data.days.find((x) => x.id === dId);
    if (!d) return;
    const idx = d.exercises.findIndex((ex) => ex.id === exId);
    const alvo = idx + dir;
    if (idx === -1 || alvo < 0 || alvo >= d.exercises.length) return;
    const exercises = [...d.exercises];
    [exercises[idx], exercises[alvo]] = [exercises[alvo], exercises[idx]];
    updateDay(dId, { exercises });
  }

  function addDay() {
    const novo = { id: uid(), name: `Treino ${data.days.length + 1}`, focus: "", exercises: [] };
    persist({ ...data, days: [...data.days, novo] });
    setDayId(novo.id);
  }

  const duplicarDia = (dId) => {
    const d = data.days.find((x) => x.id === dId);
    if (!d) return;
    const novo = {
      id: uid(),
      name: `${d.name} (cópia)`,
      focus: d.focus,
      exercises: d.exercises.map((ex) => ({ ...ex, id: uid() })),
    };
    persist({ ...data, days: [...data.days, novo] });
    setDayId(novo.id);
  };

  function removeDay(dId) {
    if (data.days.length <= 1) return;
    const days = data.days.filter((d) => d.id !== dId);
    const schedule = { ...data.schedule };
    Object.keys(schedule).forEach((k) => {
      if (schedule[k] === dId) schedule[k] = null;
    });
    persist({ ...data, days, schedule });
    if (dayId === dId) setDayId(days[0].id);
  }

  async function chooseTemplate(tpl) {
    const days = tpl.build();
    const fresh = {
      days,
      sessions: [],
      schedule: defaultSchedule(days),
      equipment: EQUIP.map((e) => e.id),
      restSeconds: 90,
    };
    await persist(fresh);
    setDayId(days[0].id);
    setTab("hoje");
  }

  const setWeekday = (idx, value) =>
    persist({ ...data, schedule: { ...data.schedule, [idx]: value || null } });

  const toggleEquip = (id) =>
    persist({
      ...data,
      equipment: data.equipment.includes(id)
        ? data.equipment.filter((e) => e !== id)
        : [...data.equipment, id],
    });

  const setRestSeconds = (sec) => persist({ ...data, restSeconds: sec });

  function baixarBackup() {
    try {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ficha-treino-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setToast("Backup baixado");
    } catch (e) {
      setToast("Download bloqueado aqui. Copie o texto acima.");
    }
  }

  async function copiarBackup() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(data));
      setToast("Backup copiado");
    } catch (e) {
      setToast("Não consegui copiar. Selecione o texto e copie na mão.");
    }
  }

  async function restaurar() {
    let p = null;
    try {
      p = JSON.parse(importText);
    } catch (e) {
      setToast("Esse texto não é um JSON válido");
      return;
    }
    if (!p || !Array.isArray(p.days) || !p.days.length) {
      setToast("O backup não tem treinos dentro");
      return;
    }
    const days = normalizeDays(p.days);
    const restaurado = {
      days,
      sessions: p.sessions || [],
      schedule: p.schedule || defaultSchedule(days),
      equipment: p.equipment || EQUIP.map((e) => e.id),
      restSeconds: p.restSeconds || 90,
    };
    await persist(restaurado);
    setDayId(restaurado.days[0].id);
    setImportText("");
    setToast(`Restaurado: ${restaurado.days.length} treinos, ${restaurado.sessions.length} sessões`);
  }

  async function wipe() {
    const fresh = {
      days: [],
      sessions: [],
      schedule: {},
      equipment: EQUIP.map((e) => e.id),
      restSeconds: 90,
    };
    await persist(fresh);
    setDayId(null);
    setConfirmWipe(false);
    setTab("hoje");
    setToast("Dados apagados");
  }

  if (loading) {
    return (
      <div className="ft">
        <style>{CSS}</style>
        <div className="ft-head">
          <h1 className="ft-title">Ficha de treino</h1>
          <p className="ft-sub">Carregando seus registros…</p>
        </div>
      </div>
    );
  }

  if (data.days.length === 0) {
    return (
      <div className="ft">
        <style>{CSS}</style>
        <header className="ft-head">
          <h1 className="ft-title">Ficha de treino</h1>
          <p className="ft-sub">Escolha um modelo de divisão para montar sua ficha</p>
        </header>
        <div className="ft-body">
          <p className="ft-empty" style={{ marginBottom: 14 }}>
            Você ainda não tem nenhum treino montado. Escolha uma divisão abaixo — os treinos e
            exercícios são preenchidos na hora, e dá pra editar tudo depois em Exercícios.
          </p>
          {TEMPLATES.map((tpl) => (
            <button key={tpl.id} className="ft-tplcard" onClick={() => chooseTemplate(tpl)}>
              <div className="ft-tplname">{tpl.label}</div>
              <div className="ft-tpldesc">{tpl.desc}</div>
            </button>
          ))}
          <div style={{ height: 24 }} />
        </div>
        {toast && <div className="ft-toast">{toast}</div>}
      </div>
    );
  }

  const sessionsDesc = [...data.sessions].sort((a, b) => b.date.localeCompare(a.date));
  const semana = data.sessions.filter((s) => Date.now() - new Date(s.date).getTime() < 7 * 864e5).length;
  const treinosNaSemana = WEEKDAYS.filter((w) => data.schedule[w.idx]).length;
  const hojeNome = WEEKDAYS.find((w) => w.idx === hoje).long;
  const ehDescanso = !data.schedule[hoje];
  const libQueryNorm = libQuery.trim().toLowerCase();
  const libItems = LIBRARY.filter(
    (x) =>
      (libQueryNorm === "" || x.n.toLowerCase().includes(libQueryNorm)) &&
      (data.equipment.length === 0 || data.equipment.includes(x.e))
  );
  const libColor = (k) =>
    !libPick ? C_NONE : libPick.p.includes(k) ? C_PRI : libPick.s.includes(k) ? C_SEC : C_NONE;
  const focusName = focusEx && day ? (day.exercises.find((e) => e.id === focusEx) || {}).name : null;

  const quemPega = (k) => {
    if (!day) return { pri: [], sec: [] };
    const pri = [];
    const sec = [];
    day.exercises.forEach((ex) => {
      const m = musclesFor(ex.name);
      if (m.pri.includes(k)) pri.push(ex.name);
      else if (m.sec.includes(k)) sec.push(ex.name);
    });
    return { pri, sec };
  };

  return (
    <div className="ft">
      <style>{CSS}</style>

      <header className="ft-head">
        <h1 className="ft-title">Ficha de treino</h1>
        <p className="ft-sub">
          {treinosNaSemana}x por semana · {data.sessions.length} treinos registrados · {semana} nos
          últimos 7 dias
        </p>
      </header>

      <nav className="ft-tabs">
        {[
          ["hoje", "Hoje"],
          ["semana", "Semana"],
          ["progresso", "Progresso"],
          ["ajustes", "Exercícios"],
        ].map(([id, label]) => (
          <button key={id} className="ft-tab" data-on={tab === id ? "1" : "0"} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </nav>

      {tab === "hoje" && day && (
        <div className="ft-body">
          <div className="ft-daybar">
            {data.days.map((d) => (
              <button
                key={d.id}
                className="ft-chip"
                data-on={d.id === day.id ? "1" : "0"}
                onClick={() => setDayId(d.id)}
              >
                {d.name}
              </button>
            ))}
          </div>

          {ehDescanso && (
            <p className="ft-empty" style={{ marginBottom: 14 }}>
              {hojeNome} está marcada como descanso. Para treinar mesmo assim, escolha um treino acima.
            </p>
          )}

          <h2 className="ft-dayname">{day.focus || day.name}</h2>
          <p className="ft-dayfocus">
            {hojeNome}, {day.name} · carga em kg, depois as repetições
          </p>
          <button
            className="ft-mini"
            style={{ marginBottom: 14 }}
            onClick={() => setTab("ajustes")}
          >
            Editar este treino
          </button>

          <div className="ft-map">
            <div className="ft-legend">
              <span>
                <span className="ft-sw" style={{ background: C_PRI }} />
                principal
              </span>
              <span>
                <span className="ft-sw" style={{ background: C_SEC }} />
                auxiliar
              </span>
            </div>
            <BodyMap color={dayColor} picked={pick} onPick={(k) => setPick(pick === k ? null : k)} />
            <p className="ft-mapcap">
              {pick ? (
                (() => {
                  const q = quemPega(pick);
                  return (
                    <>
                      <b>{MUSCLE[pick]}</b>
                      {q.pri.length > 0 && <> — principal em {q.pri.join(", ")}</>}
                      {q.pri.length === 0 && q.sec.length > 0 && <> — só como auxiliar</>}
                      {q.sec.length > 0 && <>; auxiliar em {q.sec.join(", ")}</>}
                      {q.pri.length === 0 && q.sec.length === 0 && (
                        <> — nenhum exercício deste treino toca essa porção</>
                      )}
                      .
                    </>
                  );
                })()
              ) : focusName ? (
                <>
                  <b>{focusName}</b> — principal: {nomes([...dayMuscles.pri]) || "não mapeado"}
                  {dayMuscles.sec.size > 0 && <>; auxiliar: {nomes([...dayMuscles.sec])}</>}. Toque no
                  nome de novo para ver o treino inteiro.
                </>
              ) : (
                <>
                  Toque numa parte do corpo para saber qual porção é e quais exercícios a pegam. Toque
                  no nome de um exercício para isolar só ele.
                </>
              )}
            </p>
          </div>

          {day.exercises.length === 0 && (
            <p className="ft-empty">
              Este treino ainda não tem exercícios. Abra Exercícios e monte a lista.
            </p>
          )}

          {day.exercises.map((ex) => {
            const prev = lastByExercise[ex.id];
            const best = bestByExercise[ex.id] || 0;
            const sets = draft[ex.id] || [];
            const m = musclesFor(ex.name);
            return (
              <div className="ft-ex" key={ex.id} data-focus={focusEx === ex.id ? "1" : "0"}>
                <button
                  className="ft-exname"
                  onClick={() => {
                    setFocusEx(focusEx === ex.id ? null : ex.id);
                    setPick(null);
                  }}
                >
                  {ex.name}
                </button>
                <div className="ft-last">
                  {m.pri.length ? nomes(m.pri) : "porção não mapeada"}
                  {m.sec.length > 0 && <> · auxiliar: {nomes(m.sec)}</>}
                </div>
                <div className="ft-last">
                  Meta: {ex.sets} séries{ex.repRange ? ` de ${ex.repRange} reps` : ""}
                </div>
                {prev ? (
                  <div className="ft-last">
                    {fmtDate(prev.date)}:{" "}
                    {prev.sets.map((s, i) => (
                      <span key={i}>
                        {i > 0 && ", "}
                        <b>
                          {s.kg}×{s.reps}
                        </b>
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="ft-last">Primeira vez registrando este exercício.</div>
                )}

                {sets.map((s, i) => {
                  const prevSet = prev && prev.sets[i];
                  const isPR = s.kg !== "" && Number(s.kg) > best && best > 0;
                  return (
                    <div className="ft-set" key={i}>
                      <span className="ft-setidx ft-num">{i + 1}</span>
                      <input
                        className="ft-input"
                        inputMode="decimal"
                        value={s.kg}
                        placeholder={prevSet ? String(prevSet.kg) : "kg"}
                        onChange={(e) => setCell(ex.id, i, "kg", e.target.value)}
                        aria-label={`Carga da série ${i + 1} de ${ex.name}`}
                      />
                      <span className="ft-x">×</span>
                      <input
                        className="ft-input"
                        inputMode="numeric"
                        value={s.reps}
                        placeholder={prevSet ? String(prevSet.reps) : "reps"}
                        onChange={(e) => setCell(ex.id, i, "reps", e.target.value)}
                        aria-label={`Repetições da série ${i + 1} de ${ex.name}`}
                      />
                      {isPR && (
                        <span className="ft-pr">
                          <span className="ft-dot" />
                          recorde
                        </span>
                      )}
                      <button className="ft-rm" onClick={() => removeSet(ex.id, i)}>
                        remover
                      </button>
                    </div>
                  );
                })}
                <div className="ft-cfgex">
                  <button className="ft-addset" onClick={() => addSet(ex.id)}>
                    Mais uma série
                  </button>
                  {prev && (
                    <button className="ft-addset" onClick={() => repetirUltimo(ex.id)}>
                      Repetir última vez
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          <div style={{ height: 8 }} />
          <div className="ft-save">
            {restEnd && (
              <div className="ft-rest">
                <span className="ft-rest-label">Descanso</span>
                <span className="ft-rest-time ft-num">{fmtRest(restRemaining)}</span>
                <div className="ft-rest-btns">
                  <button className="ft-rest-btn" onClick={() => adjustRest(-15)} aria-label="Tirar 15 segundos do descanso">
                    −15s
                  </button>
                  <button className="ft-rest-btn" onClick={() => adjustRest(15)} aria-label="Adicionar 15 segundos ao descanso">
                    +15s
                  </button>
                  <button className="ft-rest-btn" onClick={stopRestTimer} aria-label="Pular descanso">
                    pular
                  </button>
                </div>
              </div>
            )}
            <button className="ft-btn" disabled={filledCount === 0} onClick={saveSession}>
              {filledCount === 0 ? "Preencha uma série para salvar" : `Salvar treino (${filledCount} séries)`}
            </button>
          </div>
        </div>
      )}

      {tab === "semana" && (
        <div className="ft-body">
          <p className="ft-label">Qual treino cai em cada dia</p>
          {WEEKDAYS.map((w) => (
            <div className="ft-weekrow" key={w.idx} data-today={w.idx === hoje ? "1" : "0"}>
              <span className="ft-weekday">{w.short}</span>
              <select
                className="ft-select"
                value={data.schedule[w.idx] || ""}
                onChange={(e) => setWeekday(w.idx, e.target.value)}
                aria-label={`Treino de ${w.long}`}
              >
                <option value="">Descanso</option>
                {data.days.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} — {d.focus || "sem foco definido"}
                  </option>
                ))}
              </select>
            </div>
          ))}

          <p className="ft-label" style={{ marginTop: 20 }}>
            Cobertura da semana
          </p>
          <div className="ft-map">
            <div className="ft-legend">
              <span>
                <span className="ft-sw" style={{ background: C_SEC }} />
                1x
              </span>
              <span>
                <span className="ft-sw" style={{ background: C_MID }} />
                2x
              </span>
              <span>
                <span className="ft-sw" style={{ background: C_PRI }} />
                3x ou mais
              </span>
            </div>
            <BodyMap
              color={weekColor}
              picked={pickWeek}
              onPick={(k) => setPickWeek(pickWeek === k ? null : k)}
            />
            <p className="ft-mapcap">
              {pickWeek ? (
                <>
                  <b>{MUSCLE[pickWeek]}</b> —{" "}
                  {weekCount[pickWeek].n === 0
                    ? "sem estímulo direto na escala atual"
                    : `${weekCount[pickWeek].n}x por semana (${weekCount[pickWeek].dias.join(", ")})`}
                  .
                </>
              ) : (
                <>Toque numa porção para ver quantas vezes ela é treinada e em quais dias.</>
              )}
            </p>
          </div>

          {MUSCLE_ORDER.map((k) => (
            <div className="ft-cover" key={k} data-zero={weekCount[k].n === 0 ? "1" : "0"}>
              <span>{MUSCLE[k]}</span>
              <span>{weekCount[k].n === 0 ? "fora da semana" : `${weekCount[k].n}x`}</span>
            </div>
          ))}
          <p className="ft-note">
            A conta usa só o músculo principal de cada exercício, então o que aparece como zero é o
            que não tem estímulo direto — pode até receber carga como auxiliar.
          </p>
        </div>
      )}

      {tab === "progresso" && (
        <div className="ft-body">
          {data.sessions.length === 0 ? (
            <p className="ft-empty">
              Nenhum treino salvo ainda. Registre o primeiro em Hoje e a evolução de carga aparece aqui.
            </p>
          ) : (
            <>
              <select
                className="ft-select"
                value={chartEx}
                onChange={(e) => setChartEx(e.target.value)}
                aria-label="Exercício"
              >
                {allExercises.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.name}
                  </option>
                ))}
              </select>

              <div className="ft-stats">
                <div className="ft-stat">
                  <div className="ft-statval ft-num">{bestByExercise[chartEx] || 0}</div>
                  <div className="ft-statlab">melhor carga (kg)</div>
                </div>
                <div className="ft-stat">
                  <div className="ft-statval ft-num">{chartData.length}</div>
                  <div className="ft-statlab">sessões com este exercício</div>
                </div>
              </div>

              {chartData.length >= 2 ? (
                <div className="ft-chart">
                  <ResponsiveContainer width="100%" height={190}>
                    <LineChart data={chartData} margin={{ top: 4, right: 14, left: -18, bottom: 0 }}>
                      <CartesianGrid stroke="#e0ddd6" vertical={false} />
                      <XAxis dataKey="data" tick={{ fontSize: 11, fill: "#75726c" }} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: "#75726c" }} tickLine={false} axisLine={false} />
                      <Tooltip
                        contentStyle={{ fontSize: 12, borderRadius: 2, border: "1px solid #d3d0c9" }}
                        formatter={(v) => [`${v} kg`, "carga"]}
                      />
                      <Line
                        type="monotone"
                        dataKey="carga"
                        stroke="#17191c"
                        strokeWidth={2}
                        dot={{ r: 3, fill: "#bf3529", stroke: "#bf3529" }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="ft-empty">
                  Registre este exercício em pelo menos duas sessões para ver a curva de carga.
                </p>
              )}

              <h3 className="ft-dayname" style={{ marginTop: 26 }}>
                Histórico
              </h3>
              {sessionsDesc.slice(0, 20).map((s) => {
                const series = s.entries.reduce((t, e) => t + e.sets.length, 0);
                const volume = s.entries.reduce(
                  (t, e) => t + e.sets.reduce((v, x) => v + x.kg * x.reps, 0),
                  0
                );
                return (
                  <div className="ft-hist" key={s.id}>
                    <div className="ft-histdate">{fmtDate(s.date)}</div>
                    <div>
                      <div className="ft-histday">{s.dayFocus || s.dayName}</div>
                      <div className="ft-histmeta">
                        {series} séries · {volume.toLocaleString("pt-BR")} kg de volume
                      </div>
                    </div>
                  </div>
                );
              })}
              <div style={{ height: 30 }} />
            </>
          )}
        </div>
      )}

      {tab === "ajustes" && (
        <div className="ft-body">
          <p className="ft-label">O que você tem disponível</p>
          <div className="ft-cfgex" style={{ marginBottom: 16 }}>
            {EQUIP.map((eq) => (
              <button
                key={eq.id}
                className="ft-mini"
                data-on={data.equipment.includes(eq.id) ? "1" : "0"}
                onClick={() => toggleEquip(eq.id)}
              >
                {eq.label}
              </button>
            ))}
          </div>

          <p className="ft-label">Descanso padrão entre séries</p>
          <div className="ft-cfgex" style={{ marginBottom: 16 }}>
            {[45, 60, 90, 120, 150, 180].map((s) => (
              <button
                key={s}
                className="ft-mini"
                data-on={(data.restSeconds || 90) === s ? "1" : "0"}
                onClick={() => setRestSeconds(s)}
              >
                {s}s
              </button>
            ))}
          </div>

          <p className="ft-label">Treino em edição</p>
          <select
            className="ft-select"
            value={day ? day.id : ""}
            onChange={(e) => setDayId(e.target.value)}
            aria-label="Escolher treino para editar"
          >
            {data.days.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
                {d.focus ? ` — ${d.focus}` : ""}
              </option>
            ))}
          </select>

          {day && (
            <div className="ft-cfgday" style={{ marginTop: 10 }}>
              <input
                className="ft-cfginput"
                value={day.name}
                onChange={(e) => updateDay(day.id, { name: e.target.value })}
                aria-label="Nome do treino"
              />
              <div style={{ height: 6 }} />
              <input
                className="ft-cfginput"
                style={{ fontWeight: 400, fontSize: 14 }}
                value={day.focus}
                placeholder="Grupos musculares"
                onChange={(e) => updateDay(day.id, { focus: e.target.value })}
                aria-label="Grupos musculares"
              />

              {day.exercises.map((ex, i) => (
                <div className="ft-cfgex" key={ex.id}>
                  <div className="ft-reorder">
                    <button
                      className="ft-mini"
                      onClick={() => moveExercise(day.id, ex.id, -1)}
                      disabled={i === 0}
                      aria-label={`Subir ${ex.name}`}
                    >
                      ↑
                    </button>
                    <button
                      className="ft-mini"
                      onClick={() => moveExercise(day.id, ex.id, 1)}
                      disabled={i === day.exercises.length - 1}
                      aria-label={`Descer ${ex.name}`}
                    >
                      ↓
                    </button>
                  </div>
                  <input
                    className="ft-cfginput"
                    value={ex.name}
                    onChange={(e) => updateExercise(day.id, ex.id, { name: e.target.value })}
                    aria-label="Nome do exercício"
                  />
                  <input
                    className="ft-cfginput"
                    style={{ flex: "0 0 56px", textAlign: "center" }}
                    type="number"
                    min="1"
                    inputMode="numeric"
                    value={ex.sets}
                    onChange={(e) =>
                      updateExercise(day.id, ex.id, { sets: Math.max(1, Number(e.target.value) || 1) })
                    }
                    aria-label={`Séries alvo de ${ex.name}`}
                  />
                  <input
                    className="ft-cfginput"
                    style={{ flex: "0 0 74px" }}
                    value={ex.repRange}
                    placeholder="8-12"
                    onChange={(e) => updateExercise(day.id, ex.id, { repRange: e.target.value })}
                    aria-label={`Faixa de reps alvo de ${ex.name}`}
                  />
                  <button className="ft-mini" onClick={() => removeExercise(day.id, ex.id)}>
                    tirar
                  </button>
                </div>
              ))}

              <div className="ft-cfgex">
                <button
                  className="ft-mini"
                  onClick={() => {
                    setLibOpen((v) => !v);
                    setLibPick(null);
                  }}
                  data-on={libOpen ? "1" : "0"}
                >
                  {libOpen ? "Fechar busca" : "Buscar exercícios"}
                </button>
                <button className="ft-mini" onClick={() => addExercise(day.id, "Novo exercício")}>
                  Criar do zero
                </button>
                <button className="ft-mini" onClick={() => duplicarDia(day.id)}>
                  Duplicar
                </button>
                {data.days.length > 1 && (
                  <button className="ft-mini ft-danger" onClick={() => removeDay(day.id)}>
                    Excluir treino
                  </button>
                )}
              </div>

              {libOpen && (
                <div className="ft-lib">
                  <input
                    className="ft-cfginput"
                    value={libQuery}
                    onChange={(e) => setLibQuery(e.target.value)}
                    placeholder="Buscar exercício por nome"
                    aria-label="Buscar exercício por nome"
                  />
                  <div className="ft-map" style={{ marginTop: 10, marginBottom: 10 }}>
                    <div className="ft-legend">
                      <span>
                        <span className="ft-sw" style={{ background: C_PRI }} />
                        principal
                      </span>
                      <span>
                        <span className="ft-sw" style={{ background: C_SEC }} />
                        auxiliar
                      </span>
                    </div>
                    <BodyMap color={libColor} />
                    <p className="ft-mapcap">
                      {libPick ? (
                        <>
                          <b>{libPick.n}</b> — principal: {nomes(libPick.p) || "não mapeado"}
                          {libPick.s.length > 0 && <>; auxiliar: {nomes(libPick.s)}</>}.
                        </>
                      ) : (
                        <>Toque num exercício da lista abaixo para ver no mapa antes de adicionar.</>
                      )}
                    </p>
                    {libPick && (
                      <button
                        className="ft-addset"
                        style={{ marginTop: 2 }}
                        onClick={() => {
                          addExercise(day.id, libPick.n);
                          setLibPick(null);
                        }}
                      >
                        Adicionar {libPick.n}
                      </button>
                    )}
                  </div>

                  <div className="ft-libwrap">
                    {libItems.length === 0 && (
                      <p className="ft-note">
                        Nenhum exercício encontrado com esse nome e o equipamento marcado acima. Tente
                        outro termo, solte um equipamento ou crie o exercício do zero.
                      </p>
                    )}
                    {libItems.map((item) => {
                      const jaTem = day.exercises.some((ex) => ex.name === item.n);
                      return (
                        <button
                          key={item.n}
                          className="ft-libitem"
                          disabled={jaTem}
                          data-active={libPick && libPick.n === item.n ? "1" : "0"}
                          onClick={() => setLibPick(libPick && libPick.n === item.n ? null : item)}
                        >
                          <span>{item.n}</span>
                          <span className="ft-libtag">{jaTem ? "já está" : nomes(item.p)}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          <div style={{ height: 10 }} />
          <button className="ft-mini" onClick={addDay}>
            Adicionar treino
          </button>

          <div style={{ height: 18 }} />
          <button
            className="ft-mini"
            data-on={backupOpen ? "1" : "0"}
            onClick={() => setBackupOpen(!backupOpen)}
          >
            {backupOpen ? "Fechar backup" : "Backup e restauração"}
          </button>

          {backupOpen && (
            <div className="ft-cfgday" style={{ marginTop: 10 }}>
              <p className="ft-label">Seus dados</p>
              <textarea
                className="ft-ta"
                readOnly
                value={JSON.stringify(data)}
                onFocus={(e) => e.target.select()}
                aria-label="Backup dos dados"
              />
              <div className="ft-cfgex">
                <button className="ft-mini" onClick={baixarBackup}>
                  Baixar arquivo
                </button>
                <button className="ft-mini" onClick={copiarBackup}>
                  Copiar
                </button>
              </div>

              <p className="ft-label" style={{ marginTop: 16 }}>
                Restaurar de um backup
              </p>
              <textarea
                className="ft-ta"
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder="Cole aqui o JSON salvo"
                aria-label="Restaurar backup"
              />
              <div className="ft-cfgex">
                <button className="ft-mini ft-danger" onClick={restaurar} disabled={!importText.trim()}>
                  Substituir tudo por este backup
                </button>
              </div>
              <p className="ft-note">
                A restauração troca treinos, escala e histórico de uma vez. Baixe o backup atual antes,
                se tiver dúvida.
              </p>
            </div>
          )}

          <p className="ft-note">
            Os exercícios da lista já vêm com a porção muscular certa. Se criar um do zero, o
            reconhecimento é pelo nome — "supino inclinado" cai no peitoral superior, "panturrilha
            sentado" no sóleo.
          </p>

          {confirmWipe ? (
            <div className="ft-cfgex">
              <button className="ft-mini ft-danger" onClick={wipe}>
                Confirmar: apagar tudo
              </button>
              <button className="ft-mini" onClick={() => setConfirmWipe(false)}>
                Cancelar
              </button>
            </div>
          ) : (
            <button className="ft-mini ft-danger" onClick={() => setConfirmWipe(true)}>
              Apagar todos os dados
            </button>
          )}
          <div style={{ height: 40 }} />
        </div>
      )}

      {toast && <div className="ft-toast">{toast}</div>}
    </div>
  );
}
