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
const REST_KEY = "ficha-treino:descanso-ativo";
const WAKE_LOCK_SUPPORTED = typeof navigator !== "undefined" && "wakeLock" in navigator;
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

// músculos somados de uma lista de exercícios: o que é principal em algum deles nunca conta como auxiliar
function musclesForList(exercises) {
  const pri = new Set();
  const sec = new Set();
  (exercises || []).forEach((ex) => {
    const m = musclesFor(ex.name);
    m.pri.forEach((k) => pri.add(k));
    m.sec.forEach((k) => sec.add(k));
  });
  sec.forEach((k) => pri.has(k) && sec.delete(k));
  return { pri, sec };
}

const DEFAULT_SETS = 3;
const DEFAULT_REPS = "8-12";

// mantém um peso alvo por série: corta ou estica o array quando o número de séries muda,
// repetindo o último peso digitado pras séries novas
function resizePesos(pesos, n) {
  const arr = Array.isArray(pesos) ? pesos.slice(0, n) : [];
  while (arr.length < n) arr.push(arr.length > 0 ? arr[arr.length - 1] : "");
  return arr;
}

const mk = (name, focus, nomesEx) => ({
  id: uid(),
  name,
  focus,
  exercises: nomesEx.map((n) => ({
    id: uid(),
    name: n,
    sets: DEFAULT_SETS,
    repRange: DEFAULT_REPS,
    pesos: Array(DEFAULT_SETS).fill(""),
  })),
});

// garante que exercícios vindos de backups antigos (ou sem série/faixa definida) fiquem no formato atual
function normalizeDays(days) {
  return (days || []).map((d) => ({
    ...d,
    exercises: (d.exercises || []).map((ex) => {
      const sets = Number(ex.sets) > 0 ? Number(ex.sets) : DEFAULT_SETS;
      return {
        id: ex.id,
        name: ex.name,
        sets,
        repRange: ex.repRange || "",
        pesos: resizePesos(ex.pesos, sets),
      };
    }),
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
    id: "fullbody",
    label: "Full body",
    desc: "1 treino de corpo inteiro, repetido 2 ou 3 vezes na semana. Bom pra quem treina pouco dia.",
    build: () => [
      mk("Treino Único", "Corpo inteiro", [
        "Agachamento livre",
        "Supino reto com barra",
        "Remada curvada com barra",
        "Desenvolvimento com halteres",
        "Rosca direta com barra",
        "Tríceps corda",
        "Panturrilha em pé",
      ]),
    ],
  },
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
  {
    id: "custom",
    label: "Do zero",
    desc: "Começa com um treino vazio. Você monta os treinos e os exercícios do seu jeito.",
    build: () => [{ id: uid(), name: "Treino 1", focus: "", exercises: [] }],
  },
];

function defaultSchedule(days) {
  const s = {};
  WEEKDAYS.forEach((w, i) => {
    s[w.idx] = i < 6 && days[i] ? days[i].id : null;
  });
  return s;
}

/* cores do mapa vêm do tema (claro/escuro). Músculo em repouso usa a própria cor do corpo:
   só o que o treino pega aparece. Vão sempre por style, não por atributo fill, porque
   variável CSS em atributo de SVG não é confiável no Safari. */
const C_SKIN = "var(--m-skin)";
const C_NONE = C_SKIN;
const C_SEC = "var(--m-sec)";
const C_MID = "var(--m-mid)";
const C_PRI = "var(--m-pri)";

/* Silhueta comum às duas vistas: as partes se sobrepõem de propósito e usam o mesmo
   preenchimento, então leem como um corpo só em vez de blocos soltos. */
function Silhueta() {
  return (
    <g style={{ fill: C_SKIN }}>
      <ellipse cx="62" cy="15" rx="9.5" ry="11.5" />
      <rect x="57.5" y="24" width="9" height="11" rx="3.5" />
      <path d="M45,34 H79 Q84,38 84,47 Q79,61 75,74 Q77,86 78,96 H46 Q47,86 49,74 Q45,61 40,47 Q40,38 45,34 Z" />
      <circle cx="40" cy="43" r="8.5" />
      <circle cx="84" cy="43" r="8.5" />
      <rect x="34.5" y="42" width="9.5" height="33" rx="4.7" />
      <rect x="80" y="42" width="9.5" height="33" rx="4.7" />
      <rect x="32.5" y="72" width="9" height="31" rx="4.5" />
      <rect x="82.5" y="72" width="9" height="31" rx="4.5" />
      <ellipse cx="36.5" cy="106" rx="4.6" ry="5.6" />
      <ellipse cx="87.5" cy="106" rx="4.6" ry="5.6" />
      <rect x="46" y="88" width="32" height="16" rx="6" />
      <rect x="47" y="96" width="14" height="46" rx="6" />
      <rect x="63" y="96" width="14" height="46" rx="6" />
      <rect x="48.5" y="136" width="11" height="12" rx="4" />
      <rect x="64.5" y="136" width="11" height="12" rx="4" />
      <rect x="49" y="144" width="11.5" height="38" rx="5.5" />
      <rect x="63.5" y="144" width="11.5" height="38" rx="5.5" />
      <rect x="48" y="180" width="11" height="7" rx="3" />
      <rect x="65" y="180" width="11" height="7" rx="3" />
    </g>
  );
}

function BodyMap({ color, onPick, picked }) {
  const P = (k) => {
    const fill = color(k);
    const ativo = fill !== C_NONE;
    return {
      strokeWidth: picked === k ? 1.4 : ativo ? 0.7 : 0,
      onClick: () => onPick && onPick(k),
      style: {
        fill,
        // o contorno só entra no músculo aceso, pra separar blocos vizinhos da mesma cor
        stroke: picked === k ? "var(--m-pick)" : ativo ? "var(--m-sep)" : "none",
        cursor: onPick ? "pointer" : "default",
      },
    };
  };
  return (
    <svg viewBox="0 0 252 206" width="100%" role="img" aria-label="Mapa muscular do corpo">
      {/* ===== FRENTE ===== */}
      <g>
        <Silhueta />
        <path d="M54,33 H70 L76,40 H48 Z" {...P("trap_sup")} />
        <ellipse cx="44.5" cy="43" rx="4.5" ry="7" {...P("delt_ant")} />
        <ellipse cx="79.5" cy="43" rx="4.5" ry="7" {...P("delt_ant")} />
        <ellipse cx="38" cy="44" rx="4.5" ry="7.5" {...P("delt_lat")} />
        <ellipse cx="86" cy="44" rx="4.5" ry="7.5" {...P("delt_lat")} />

        <rect x="49" y="40" width="12" height="6.5" rx="2.5" {...P("peito_sup")} />
        <rect x="63" y="40" width="12" height="6.5" rx="2.5" {...P("peito_sup")} />
        <rect x="48.5" y="47" width="12.5" height="7" rx="2.5" {...P("peito_med")} />
        <rect x="63" y="47" width="12.5" height="7" rx="2.5" {...P("peito_med")} />
        <rect x="49.5" y="54.5" width="11.5" height="6" rx="2.5" {...P("peito_inf")} />
        <rect x="63" y="54.5" width="11.5" height="6" rx="2.5" {...P("peito_inf")} />

        <ellipse cx="37" cy="56" rx="3.2" ry="9" {...P("bic_longa")} />
        <ellipse cx="87" cy="56" rx="3.2" ry="9" {...P("bic_longa")} />
        <ellipse cx="41.5" cy="56" rx="3.2" ry="9" {...P("bic_curta")} />
        <ellipse cx="82.5" cy="56" rx="3.2" ry="9" {...P("bic_curta")} />
        <ellipse cx="38.5" cy="71" rx="4.2" ry="5.5" {...P("braquial")} />
        <ellipse cx="85.5" cy="71" rx="4.2" ry="5.5" {...P("braquial")} />
        <ellipse cx="36.5" cy="86" rx="4.5" ry="11" {...P("antebraco")} />
        <ellipse cx="87.5" cy="86" rx="4.5" ry="11" {...P("antebraco")} />

        <path d="M50,61 H54 V84 L48.5,77 Z" {...P("obliquo")} />
        <path d="M74,61 H70 V84 L75.5,77 Z" {...P("obliquo")} />
        <rect x="55" y="60" width="14" height="12" rx="3" {...P("reto_sup")} />
        <rect x="55" y="72.5" width="14" height="12" rx="3" {...P("reto_inf")} />

        <rect x="48" y="99" width="5.5" height="36" rx="2.5" {...P("quad_lat")} />
        <rect x="70.5" y="99" width="5.5" height="36" rx="2.5" {...P("quad_lat")} />
        <rect x="54" y="99" width="5" height="36" rx="2.5" {...P("quad_reto")} />
        <rect x="65" y="99" width="5" height="36" rx="2.5" {...P("quad_reto")} />
        <ellipse cx="59.5" cy="108" rx="3" ry="8" {...P("adutor")} />
        <ellipse cx="64.5" cy="108" rx="3" ry="8" {...P("adutor")} />
        <ellipse cx="58" cy="129" rx="4" ry="7.5" {...P("quad_med")} />
        <ellipse cx="66" cy="129" rx="4" ry="7.5" {...P("quad_med")} />

        <ellipse cx="54.5" cy="158" rx="5" ry="12" {...P("gastro")} />
        <ellipse cx="69.5" cy="158" rx="5" ry="12" {...P("gastro")} />
        <ellipse cx="54.5" cy="174" rx="4" ry="6.5" {...P("soleo")} />
        <ellipse cx="69.5" cy="174" rx="4" ry="6.5" {...P("soleo")} />

        <text x="62" y="200" textAnchor="middle" fontSize="9" style={{ fill: "var(--muted)" }}>
          frente
        </text>
      </g>

      {/* ===== COSTAS ===== */}
      <g transform="translate(128,0)">
        <Silhueta />
        <path d="M53,33 H71 L77,41 H47 Z" {...P("trap_sup")} />
        <rect x="52" y="41" width="20" height="12" rx="2.5" {...P("trap_med")} />
        <path d="M55,53 H69 L62,67 Z" {...P("trap_inf")} />
        <ellipse cx="41" cy="43" rx="6.5" ry="7.5" {...P("delt_post")} />
        <ellipse cx="83" cy="43" rx="6.5" ry="7.5" {...P("delt_post")} />
        <ellipse cx="49" cy="50" rx="4.5" ry="3.5" {...P("redondo")} />
        <ellipse cx="75" cy="50" rx="4.5" ry="3.5" {...P("redondo")} />
        <path d="M47,54 L60,58 L59,80 L50,72 Z" {...P("lat")} />
        <path d="M77,54 L64,58 L65,80 L74,72 Z" {...P("lat")} />
        <rect x="55" y="78" width="14" height="13" rx="3" {...P("lombar")} />

        <ellipse cx="37" cy="56" rx="3.2" ry="9" {...P("tri_lat")} />
        <ellipse cx="87" cy="56" rx="3.2" ry="9" {...P("tri_lat")} />
        <ellipse cx="41.5" cy="56" rx="3.2" ry="9" {...P("tri_longa")} />
        <ellipse cx="82.5" cy="56" rx="3.2" ry="9" {...P("tri_longa")} />
        <ellipse cx="38.5" cy="71" rx="4.2" ry="5.5" {...P("tri_med")} />
        <ellipse cx="85.5" cy="71" rx="4.2" ry="5.5" {...P("tri_med")} />
        <ellipse cx="36.5" cy="86" rx="4.5" ry="11" {...P("antebraco")} />
        <ellipse cx="87.5" cy="86" rx="4.5" ry="11" {...P("antebraco")} />

        <ellipse cx="51" cy="93" rx="4.5" ry="5" {...P("glut_med")} />
        <ellipse cx="73" cy="93" rx="4.5" ry="5" {...P("glut_med")} />
        <ellipse cx="56" cy="99" rx="8" ry="8" {...P("glut_max")} />
        <ellipse cx="68" cy="99" rx="8" ry="8" {...P("glut_max")} />
        <rect x="48" y="104" width="5.5" height="34" rx="2.5" {...P("isq_lat")} />
        <rect x="70.5" y="104" width="5.5" height="34" rx="2.5" {...P("isq_lat")} />
        <rect x="54" y="104" width="5" height="34" rx="2.5" {...P("isq_med")} />
        <rect x="65" y="104" width="5" height="34" rx="2.5" {...P("isq_med")} />

        <ellipse cx="54.5" cy="158" rx="5" ry="12" {...P("gastro")} />
        <ellipse cx="69.5" cy="158" rx="5" ry="12" {...P("gastro")} />
        <ellipse cx="54.5" cy="174" rx="4" ry="6.5" {...P("soleo")} />
        <ellipse cx="69.5" cy="174" rx="4" ry="6.5" {...P("soleo")} />

        <text x="62" y="200" textAnchor="middle" fontSize="9" style={{ fill: "var(--muted)" }}>
          costas
        </text>
      </g>
    </svg>
  );
}

const TAB_ICONS = {
  hoje: <path d="M6.5 6v12M17.5 6v12M3.5 9v6M20.5 9v6M6.5 12h11" />,
  semana: (
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="3" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  progresso: <path d="M4 17l5-5 4 3 7-8M15 7h5v5" />,
  ajustes: (
    <>
      <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
      <circle cx="15" cy="7" r="2" />
      <circle cx="9" cy="17" r="2" />
    </>
  ),
};

function TabIcon({ id }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {TAB_ICONS[id]}
    </svg>
  );
}

/* Linhas de exercício com reordenar, séries e faixa de reps. Serve tanto o passo a passo
   inicial (que mexe num rascunho em memória) quanto a aba Exercícios (que salva direto). */
function ExerciseRows({ exercises, onMove, onPatch, onRemove, onSwap, swapId }) {
  return exercises.map((ex, i) => (
    <div className="ft-exrow" key={ex.id} data-swap={swapId === ex.id ? "1" : "0"}>
      <div className="ft-exrow-top">
        <div className="ft-reorder">
          <button
            className="ft-mini"
            onClick={() => onMove(ex.id, -1)}
            disabled={i === 0}
            aria-label={`Subir ${ex.name}`}
          >
            ↑
          </button>
          <button
            className="ft-mini"
            onClick={() => onMove(ex.id, 1)}
            disabled={i === exercises.length - 1}
            aria-label={`Descer ${ex.name}`}
          >
            ↓
          </button>
        </div>
        <input
          className="ft-cfginput"
          value={ex.name}
          onChange={(e) => onPatch(ex.id, { name: e.target.value })}
          aria-label="Nome do exercício"
        />
        <button
          className="ft-mini"
          data-on={swapId === ex.id ? "1" : "0"}
          onClick={() => onSwap(ex.id)}
          aria-label={`Trocar ${ex.name} por outro exercício`}
        >
          {swapId === ex.id ? "cancelar" : "trocar"}
        </button>
        <button className="ft-mini" onClick={() => onRemove(ex.id)} aria-label={`Tirar ${ex.name}`}>
          tirar
        </button>
      </div>
      <div className="ft-exrow-bot">
        <span className="ft-exlab">séries</span>
        <div className="ft-step">
          <button
            onClick={() => {
              const sets = Math.max(1, ex.sets - 1);
              onPatch(ex.id, { sets, pesos: resizePesos(ex.pesos, sets) });
            }}
            disabled={ex.sets <= 1}
            aria-label={`Menos uma série em ${ex.name}`}
          >
            −
          </button>
          <span className="ft-stepval ft-num">{ex.sets}</span>
          <button
            onClick={() => {
              const sets = Math.min(12, ex.sets + 1);
              onPatch(ex.id, { sets, pesos: resizePesos(ex.pesos, sets) });
            }}
            disabled={ex.sets >= 12}
            aria-label={`Mais uma série em ${ex.name}`}
          >
            +
          </button>
        </div>
        <span className="ft-exlab">reps</span>
        <input
          className="ft-cfginput ft-exreps"
          value={ex.repRange}
          placeholder="8-12"
          onChange={(e) => onPatch(ex.id, { repRange: e.target.value })}
          aria-label={`Faixa de reps alvo de ${ex.name}`}
        />
      </div>
      <div className="ft-exrow-pesos">
        <span className="ft-exlab">peso alvo (kg)</span>
        {Array.from({ length: ex.sets }, (_, i) => (
          <input
            key={i}
            className="ft-cfginput ft-expeso"
            inputMode="decimal"
            value={(ex.pesos && ex.pesos[i]) || ""}
            placeholder="kg"
            onChange={(e) => {
              const pesos = resizePesos(ex.pesos, ex.sets);
              pesos[i] = e.target.value.replace(",", ".");
              onPatch(ex.id, { pesos });
            }}
            aria-label={`Peso alvo da série ${i + 1} de ${ex.name}`}
          />
        ))}
      </div>
    </div>
  ));
}

/* Mapa do treino que está sendo montado. Com um exercício selecionado na busca, mostra
   como o treino ficaria se ele entrasse — é o mesmo mapa, não um segundo. */
function TreinoMap({ dayName, exercises, pick, onAdd, swapId }) {
  const lista = !pick
    ? exercises
    : swapId
    ? exercises.map((ex) => (ex.id === swapId ? { ...ex, name: pick.n } : ex))
    : [...exercises, { id: "previa", name: pick.n }];
  const m = musclesForList(lista);
  const color = (k) => (m.pri.has(k) ? C_PRI : m.sec.has(k) ? C_SEC : C_NONE);
  const auxiliar = m.sec.size > 0 && <>; como auxiliar: {nomes([...m.sec])}</>;
  return (
    <div className="ft-map" style={{ marginTop: 12, marginBottom: 12 }}>
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
      <BodyMap color={color} />
      <p className="ft-mapcap">
        {pick ? (
          <>
            {swapId ? "Trocando por " : "Com "}
            <b>{pick.n}</b>, este treino passa a pegar {nomes([...m.pri]) || "nada mapeado"}
            {auxiliar}.
          </>
        ) : exercises.length === 0 ? (
          <>Sem exercícios ainda. Conforme você adiciona abaixo, o mapa mostra o que o treino pega.</>
        ) : (
          <>
            <b>{dayName}</b> pega {nomes([...m.pri]) || "nada mapeado ainda"}
            {auxiliar}.
          </>
        )}
      </p>
      {pick && (
        <button className="ft-addset" style={{ marginTop: 2 }} onClick={() => onAdd(pick.n)}>
          {swapId ? "Trocar por" : "Adicionar"} {pick.n}
        </button>
      )}
    </div>
  );
}

function ExerciseSearch({ equipment, existingNames, query, onQuery, pick, onPick, onAdd, swapName, onCancelSwap }) {
  const termo = query.trim().toLowerCase();
  const items = LIBRARY.filter(
    (x) =>
      (termo === "" || x.n.toLowerCase().includes(termo)) &&
      (equipment.length === 0 || equipment.includes(x.e))
  );
  return (
    <div className="ft-lib">
      {swapName && (
        <div className="ft-swapbar">
          <span>
            Trocando <b>{swapName}</b> — escolha o novo
          </span>
          <button className="ft-mini" onClick={onCancelSwap}>
            cancelar
          </button>
        </div>
      )}
      <input
        className="ft-cfginput"
        value={query}
        onChange={(e) => onQuery(e.target.value)}
        placeholder="Buscar exercício por nome"
        aria-label="Buscar exercício por nome"
      />
      <p className="ft-note" style={{ margin: "8px 2px 6px" }}>
        Toque no nome pra ver no mapa acima como o treino ficaria. No {swapName ? "⇄" : "+"} entra
        direto.
      </p>

      <div className="ft-libwrap">
        {items.length === 0 && (
          <p className="ft-note">
            Nenhum exercício encontrado com esse nome e o equipamento marcado. Tente outro termo,
            solte um equipamento ou crie o exercício do zero.
          </p>
        )}
        {items.map((item) => {
          const jaTem = existingNames.includes(item.n);
          return (
            <div className="ft-librow" key={item.n}>
              <button
                className="ft-libitem"
                disabled={jaTem}
                data-active={pick && pick.n === item.n ? "1" : "0"}
                onClick={() => onPick(pick && pick.n === item.n ? null : item)}
              >
                <span>{item.n}</span>
                <span className="ft-libtag">{jaTem ? "já está" : nomes(item.p)}</span>
              </button>
              <button
                className="ft-libadd"
                disabled={jaTem}
                onClick={() => onAdd(item.n)}
                aria-label={`${swapName ? "Trocar por" : "Adicionar"} ${item.n}`}
              >
                {swapName ? "⇄" : "+"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=Inter:wght@400;500;600&display=swap');

.ft {
  --bg: #f2f1ee; --surface: #ffffff; --surface-2: #e8e6e1; --field: #eceae5; --seg-on: #ffffff;
  --line: #e1ded8; --text: #16181b; --muted: #6c6963; --faint: #a9a59d;
  --accent: #d63a2b; --accent-fill: #d63a2b; --accent-soft: #fbe8e5; --good: #1b8549;
  --ink: #16181b; --on-ink: #ffffff; --scrim: rgba(22,24,27,.45);
  --shadow: 0 1px 2px rgba(22,24,27,.05), 0 6px 18px rgba(22,24,27,.06);
  --m-skin: #d8d4cd; --m-sec: #eeaea5; --m-mid: #e06c5c; --m-pri: #d63a2b; --m-sep: #ffffff; --m-pick: #16181b;
  --r-lg: 18px; --r-md: 12px;
  color-scheme: light;
  font-family: Inter, system-ui, -apple-system, "Segoe UI", sans-serif;
  color: var(--text); background: var(--bg); min-height: 100vh;
  padding-bottom: calc(96px + env(safe-area-inset-bottom));
  -webkit-font-smoothing: antialiased; -webkit-tap-highlight-color: transparent;
}
@media (prefers-color-scheme: dark) {
  .ft {
    --bg: #0e0f11; --surface: #17191c; --surface-2: #22252a; --field: #23262b; --seg-on: #34383e;
    --line: #2b2f35; --text: #f1f0ed; --muted: #9c998f; --faint: #5f5c57;
    --accent: #ff5a48; --accent-fill: #e0412d; --accent-soft: rgba(255,90,72,.15); --good: #3fcf7f;
    --ink: #f1f0ed; --on-ink: #0e0f11; --scrim: rgba(0,0,0,.62);
    --shadow: 0 0 0 1px #24272c;
    --m-skin: #2e3238; --m-sec: #803a31; --m-mid: #c44e3d; --m-pri: #ff5a48; --m-sep: #17191c; --m-pick: #f1f0ed;
    color-scheme: dark;
  }
}
.ft * { box-sizing: border-box; }
.ft-num { font-variant-numeric: tabular-nums; }

.ft-head { padding: calc(22px + env(safe-area-inset-top)) 18px 8px; }
.ft-eyebrow { font-size: 12px; font-weight: 500; color: var(--muted); margin: 0 0 5px; }
.ft-eyebrow::first-letter { text-transform: uppercase; }
.ft-title { font-family: "Barlow Condensed", "Arial Narrow", system-ui, sans-serif; font-size: 34px; font-weight: 700; letter-spacing: -0.01em; line-height: 1; margin: 0; }
.ft-sub { font-size: 13px; color: var(--muted); margin: 7px 0 0; line-height: 1.4; }

.ft-tabs { position: sticky; top: env(safe-area-inset-top, 0px); z-index: 5; padding: 8px 14px 10px; background: var(--bg); background: color-mix(in srgb, var(--bg) 86%, transparent); -webkit-backdrop-filter: saturate(1.4) blur(14px); backdrop-filter: saturate(1.4) blur(14px); }
.ft-seg { display: flex; gap: 4px; padding: 4px; background: var(--surface-2); border-radius: 16px; }
.ft-tab { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 7px 2px 6px; background: none; border: none; border-radius: 12px; cursor: pointer; font-family: inherit; font-size: 11px; font-weight: 500; color: var(--muted); transition: background-color .18s, color .18s, box-shadow .18s, transform .12s; }
.ft-tab[data-on="1"] { background: var(--seg-on); color: var(--text); font-weight: 600; box-shadow: 0 1px 3px rgba(0,0,0,.1); }
.ft-tab:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }

.ft-body { padding: 6px 14px 0; }

.ft-daybar { display: flex; gap: 8px; overflow-x: auto; padding: 2px 0 12px; scrollbar-width: none; }
.ft-daybar::-webkit-scrollbar { display: none; }
.ft-chip { flex: 0 0 auto; padding: 8px 16px; border: 1px solid var(--line); background: var(--surface); border-radius: 999px; cursor: pointer; font-family: "Barlow Condensed", system-ui, sans-serif; font-size: 17px; font-weight: 600; color: var(--muted); transition: background-color .18s, color .18s, border-color .18s, transform .12s; }
.ft-chip[data-on="1"] { background: var(--ink); border-color: var(--ink); color: var(--on-ink); }

.ft-dayname { font-family: "Barlow Condensed", system-ui, sans-serif; font-size: 28px; font-weight: 700; line-height: 1.05; margin: 8px 0 4px; }
.ft-dayfocus { font-size: 13px; color: var(--muted); margin: 0 0 12px; }

.ft-map { background: var(--surface); border-radius: var(--r-lg); box-shadow: var(--shadow); padding: 12px 12px 8px; margin-bottom: 14px; }
.ft-map svg { display: block; max-width: 250px; margin: 0 auto; }
.ft-mapcap { font-size: 12px; color: var(--muted); line-height: 1.55; padding: 9px 4px 2px; border-top: 1px solid var(--line); margin-top: 6px; }
.ft-mapcap b { color: var(--text); font-weight: 600; }
.ft-legend { display: flex; gap: 14px; font-size: 11px; color: var(--muted); padding: 0 4px 4px; }
.ft-sw { display: inline-block; width: 9px; height: 9px; border-radius: 50%; margin-right: 5px; vertical-align: -1px; }

.ft-ex { background: var(--surface); border-radius: var(--r-lg); box-shadow: var(--shadow); padding: 16px; margin-bottom: 12px; transition: box-shadow .18s; }
.ft-ex[data-focus="1"] { box-shadow: 0 0 0 2px var(--accent); }
.ft-exname { font-size: 16px; font-weight: 600; line-height: 1.25; background: none; border: none; padding: 0; font-family: inherit; color: var(--text); text-align: left; cursor: pointer; display: block; width: 100%; }
.ft-last { font-size: 12px; color: var(--muted); margin-top: 4px; line-height: 1.45; }
.ft-last b { font-weight: 600; color: var(--text); }

.ft-set { display: flex; align-items: center; gap: 8px; margin-top: 10px; }
.ft-setidx { font-family: "Barlow Condensed", system-ui, sans-serif; font-size: 15px; color: var(--muted); width: 16px; flex: 0 0 16px; }
.ft-input { font-family: "Barlow Condensed", system-ui, sans-serif; font-variant-numeric: tabular-nums; font-size: 26px; font-weight: 600; line-height: 1; width: 76px; padding: 9px 6px; text-align: center; border: 1px solid transparent; border-radius: var(--r-md); background: var(--field); color: var(--text); transition: background-color .15s, box-shadow .15s; }
.ft-input::placeholder { color: var(--faint); font-weight: 500; }
.ft-input:focus { outline: none; box-shadow: 0 0 0 2px var(--accent); background: var(--surface); }
.ft-x { font-size: 15px; color: var(--muted); }
.ft-pr { font-family: "Barlow Condensed", system-ui, sans-serif; font-size: 14px; font-weight: 600; color: var(--accent); display: flex; align-items: center; gap: 4px; margin-left: auto; }
.ft-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--accent); display: inline-block; }
.ft-rm { margin-left: auto; background: none; border: none; color: var(--muted); font-family: inherit; font-size: 12px; cursor: pointer; padding: 4px; }
.ft-pr + .ft-rm { margin-left: 8px; }
.ft-addset { margin-top: 12px; background: none; border: 1px dashed var(--line); border-radius: 999px; padding: 8px 14px; font-family: inherit; font-size: 13px; color: var(--muted); cursor: pointer; transition: border-color .15s, color .15s, transform .12s; }

.ft-save { position: fixed; left: 0; right: 0; bottom: 0; z-index: 4; padding: 16px 14px calc(12px + env(safe-area-inset-bottom)); background: linear-gradient(to top, var(--bg) 72%, transparent); }
.ft-rest { display: grid; grid-template-columns: 1fr auto; grid-template-areas: "label btns" "time btns"; column-gap: 10px; align-items: center; background: var(--accent-fill); color: #fff; border-radius: var(--r-lg); padding: 10px 12px 10px 16px; margin-bottom: 10px; box-shadow: 0 10px 24px -10px var(--accent-fill); }
.ft-rest-label { grid-area: label; font-size: 12px; font-weight: 500; color: rgba(255,255,255,.88); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ft-rest-lock { opacity: .85; }
.ft-rest-time { grid-area: time; font-family: "Barlow Condensed", system-ui, sans-serif; font-variant-numeric: tabular-nums; font-size: 30px; font-weight: 700; line-height: 1.05; }
.ft-rest-btns { grid-area: btns; display: flex; gap: 6px; }
.ft-rest-btn { background: rgba(255,255,255,.16); border: none; color: #fff; border-radius: 999px; padding: 7px 11px; font-family: inherit; font-size: 12px; font-weight: 500; cursor: pointer; transition: background-color .15s, transform .12s; }
.ft-btn { width: 100%; padding: 16px; background: var(--ink); color: var(--on-ink); border: none; border-radius: 16px; cursor: pointer; font-family: "Barlow Condensed", system-ui, sans-serif; font-size: 20px; font-weight: 600; letter-spacing: .01em; transition: background-color .15s, color .15s, transform .12s; }
.ft-btn:disabled { background: var(--surface-2); color: var(--faint); cursor: default; }
.ft-btn:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }
.ft[data-resting="1"] .ft-toast { bottom: calc(160px + env(safe-area-inset-bottom)); }
.ft-toast { position: fixed; bottom: calc(92px + env(safe-area-inset-bottom)); left: 16px; right: 16px; max-width: 440px; margin: 0 auto; padding: 12px 16px; background: var(--ink); color: var(--on-ink); border-radius: 14px; font-size: 14px; text-align: center; z-index: 10; box-shadow: 0 12px 30px -12px rgba(0,0,0,.4); }

.ft-weekrow { display: flex; align-items: center; gap: 10px; background: var(--surface); border-radius: 14px; box-shadow: var(--shadow); padding: 10px 12px; margin-bottom: 8px; }
.ft-weekrow[data-today="1"] { box-shadow: inset 4px 0 0 var(--accent), var(--shadow); }
.ft-weekday { font-family: "Barlow Condensed", system-ui, sans-serif; font-size: 19px; font-weight: 600; flex: 0 0 46px; }
.ft-select { width: 100%; padding: 10px 12px; font-family: inherit; font-size: 14px; border: 1px solid transparent; border-radius: 10px; background: var(--field); color: var(--text); }
.ft-select:focus { outline: none; box-shadow: 0 0 0 2px var(--accent); }
.ft-weekrow .ft-select { flex: 1; }

.ft-cover { display: flex; justify-content: space-between; gap: 10px; font-size: 13px; padding: 9px 4px; border-bottom: 1px solid var(--line); }
.ft-cover span:last-child { color: var(--muted); flex: 0 0 auto; }
.ft-cover[data-zero="1"] span:last-child { color: var(--accent); }

.ft-stats { display: flex; gap: 10px; margin: 14px 0; }
.ft-stat { flex: 1; background: var(--surface); border-radius: 16px; box-shadow: var(--shadow); padding: 14px; }
.ft-statval { font-family: "Barlow Condensed", system-ui, sans-serif; font-variant-numeric: tabular-nums; font-size: 32px; font-weight: 700; line-height: 1; }
.ft-statlab { font-size: 11px; color: var(--muted); margin-top: 6px; }
.ft-chart { background: var(--surface); border-radius: var(--r-lg); box-shadow: var(--shadow); padding: 16px 8px 8px; }

.ft-hist { border-top: 1px solid var(--line); padding: 12px 4px; display: flex; gap: 12px; align-items: baseline; }
.ft-histdate { font-family: "Barlow Condensed", system-ui, sans-serif; font-variant-numeric: tabular-nums; font-size: 19px; font-weight: 600; flex: 0 0 52px; }
.ft-histday { font-size: 14px; font-weight: 500; }
.ft-histmeta { font-size: 12px; color: var(--muted); margin-top: 2px; }

.ft-empty { background: var(--surface); border-radius: var(--r-lg); box-shadow: var(--shadow); padding: 22px 18px; font-size: 14px; color: var(--muted); line-height: 1.5; }

.ft-cfgday { background: var(--surface); border-radius: var(--r-lg); box-shadow: var(--shadow); padding: 14px; margin-bottom: 12px; }
.ft-cfginput { font-family: inherit; font-size: 15px; font-weight: 600; padding: 9px 10px; width: 100%; border: 1px solid transparent; background: var(--field); border-radius: 10px; color: var(--text); transition: background-color .15s, box-shadow .15s; }
.ft-cfginput::placeholder { color: var(--faint); }
.ft-cfginput:focus { outline: none; box-shadow: 0 0 0 2px var(--accent); background: var(--surface); }
.ft-cfgex { display: flex; gap: 6px; align-items: center; margin-top: 8px; flex-wrap: wrap; }
.ft-cfgex .ft-cfginput { font-size: 14px; font-weight: 400; flex: 1; min-width: 120px; }
.ft-mini { background: var(--surface); border: 1px solid var(--line); border-radius: 999px; padding: 7px 12px; font-family: inherit; font-size: 12px; font-weight: 500; color: var(--muted); cursor: pointer; flex: 0 0 auto; transition: background-color .15s, border-color .15s, color .15s, transform .12s; }
.ft-mini[data-on="1"] { background: var(--ink); border-color: var(--ink); color: var(--on-ink); }
.ft-mini:disabled { opacity: .4; cursor: default; }
.ft-danger { color: var(--accent); border-color: var(--accent); border-color: color-mix(in srgb, var(--accent) 45%, transparent); }
.ft-note { font-size: 12px; color: var(--muted); line-height: 1.5; margin: 14px 4px 24px; }
.ft-label { font-size: 13px; font-weight: 600; margin: 4px 4px 8px; }
.ft-ta { width: 100%; min-height: 90px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; padding: 10px; border: 1px solid transparent; border-radius: 12px; background: var(--field); color: var(--text); resize: vertical; }

.ft-lib { border-top: 1px solid var(--line); margin-top: 12px; padding-top: 12px; }
.ft-libitem { display: flex; justify-content: space-between; align-items: center; gap: 10px; width: 100%; padding: 10px 6px; border: none; border-bottom: 1px solid var(--line); background: none; font-family: inherit; font-size: 14px; color: var(--text); text-align: left; cursor: pointer; }
.ft-libitem:disabled { color: var(--muted); cursor: default; }
.ft-libitem[data-active="1"] { background: var(--accent-soft); font-weight: 600; }
.ft-libtag { font-size: 11px; color: var(--muted); flex: 0 0 40%; text-align: right; line-height: 1.35; }
.ft-libwrap { max-height: 280px; overflow-y: auto; }

.ft-stepbar { display: flex; gap: 6px; margin: 0 0 16px; }
.ft-stepseg { flex: 1; height: 4px; background: var(--surface-2); border-radius: 999px; transition: background-color .25s; }
.ft-stepseg[data-on="1"] { background: var(--accent); }
.ft-wzback { display: block; margin: 12px auto 0; }
.ft-wzhint { font-size: 13px; color: var(--muted); line-height: 1.5; margin: 0 4px 14px; }

.ft-tplcard { display: block; width: 100%; text-align: left; background: var(--surface); border: none; border-radius: var(--r-lg); box-shadow: var(--shadow); padding: 16px; margin-bottom: 10px; font-family: inherit; cursor: pointer; transition: box-shadow .18s, transform .12s; }
.ft-tplcard:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.ft-tplname { font-family: "Barlow Condensed", system-ui, sans-serif; font-size: 22px; font-weight: 700; line-height: 1.15; color: var(--text); }
.ft-tpldesc { font-size: 13px; color: var(--muted); margin-top: 4px; line-height: 1.45; }
.ft-reorder { display: flex; flex-direction: column; gap: 2px; flex: 0 0 auto; }
.ft-reorder .ft-mini { padding: 3px 8px; line-height: 1; border-radius: 8px; }
.ft-exrow { border-top: 1px solid var(--line); padding: 10px 4px 6px; }
.ft-exrow[data-swap="1"] { background: var(--accent-soft); border-radius: 12px; border-top-color: transparent; }
.ft-exrow-top { display: flex; gap: 6px; align-items: center; }
.ft-exrow-top .ft-cfginput { flex: 1; min-width: 0; font-size: 14px; font-weight: 400; }
.ft-exrow-bot { display: flex; gap: 6px; align-items: center; margin-top: 6px; padding-left: 40px; }
.ft-exlab { font-size: 12px; color: var(--muted); flex: 0 0 auto; }
.ft-exreps { flex: 0 0 74px; text-align: center; font-size: 14px; font-weight: 400; }
.ft-exrow-pesos { display: flex; gap: 6px; align-items: center; margin-top: 6px; padding-left: 40px; flex-wrap: wrap; row-gap: 6px; }
.ft-expeso { flex: 0 0 50px; text-align: center; font-size: 14px; font-weight: 400; }
.ft-step { display: flex; align-items: center; flex: 0 0 auto; border-radius: 10px; background: var(--field); }
.ft-step button { width: 30px; height: 30px; border: none; background: none; border-radius: 10px; font-family: inherit; font-size: 16px; line-height: 1; color: var(--text); cursor: pointer; }
.ft-step button:disabled { color: var(--faint); cursor: default; }
.ft-stepval { min-width: 20px; text-align: center; font-size: 14px; font-weight: 600; font-variant-numeric: tabular-nums; }

.ft-swapbar { display: flex; align-items: center; gap: 8px; justify-content: space-between; background: var(--accent-soft); border-radius: 12px; padding: 9px 12px; margin-bottom: 10px; font-size: 13px; line-height: 1.4; }
.ft-swapbar b { color: var(--accent); }
.ft-librow { display: flex; align-items: stretch; border-bottom: 1px solid var(--line); }
.ft-librow .ft-libitem { border-bottom: none; flex: 1; min-width: 0; }
.ft-libadd { flex: 0 0 42px; border: none; border-left: 1px solid var(--line); background: none; font-family: inherit; font-size: 18px; color: var(--accent); cursor: pointer; transition: background-color .15s, color .15s; }
.ft-libadd:disabled { color: var(--faint); cursor: default; }

.ft-summary-backdrop { position: fixed; inset: 0; background: var(--scrim); display: flex; align-items: flex-end; justify-content: center; z-index: 20; }
.ft-summary-card { background: var(--surface); width: 100%; max-width: 480px; border-radius: 24px 24px 0 0; padding: 10px 18px calc(18px + env(safe-area-inset-bottom)); box-shadow: 0 -12px 40px -14px rgba(0,0,0,.35); }
.ft-summary-grip { width: 38px; height: 5px; border-radius: 999px; background: var(--line); margin: 0 auto 16px; }
.ft-summary-eyebrow { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: .08em; color: var(--accent); margin: 0; }
.ft-summary-title { font-family: "Barlow Condensed", system-ui, sans-serif; font-size: 32px; font-weight: 700; line-height: 1.05; margin: 4px 0 18px; }
.ft-sumstats { display: grid; grid-template-columns: 1.4fr 1fr 1fr; gap: 8px; margin-bottom: 18px; }
.ft-sumstat { background: var(--field); border-radius: 16px; padding: 14px 12px 12px; min-width: 0; }
.ft-sumval { font-family: "Barlow Condensed", system-ui, sans-serif; font-variant-numeric: tabular-nums; font-size: 28px; font-weight: 700; line-height: 1; white-space: nowrap; }
.ft-sumunit { font-size: 15px; font-weight: 600; color: var(--muted); margin-left: 2px; }
.ft-sumlab { font-size: 12px; color: var(--muted); margin-top: 7px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.ft-delta { font-size: 11px; font-weight: 600; padding: 1px 7px; border-radius: 999px; background: var(--surface-2); color: var(--muted); }
.ft-delta[data-up="1"] { color: var(--good); background: color-mix(in srgb, var(--good) 15%, transparent); }

@media (hover: hover) {
  .ft-addset:hover { border-color: var(--text); color: var(--text); }
  .ft-mini:hover:not(:disabled) { border-color: var(--text); color: var(--text); }
  .ft-mini[data-on="1"]:hover { color: var(--on-ink); }
  .ft-rest-btn:hover { background: rgba(255,255,255,.26); }
  .ft-tplcard:hover { box-shadow: 0 0 0 2px var(--text); }
  .ft-step button:hover:not(:disabled) { background: var(--line); }
  .ft-libadd:hover:not(:disabled) { background: var(--accent-fill); color: #fff; }
}

@media (prefers-reduced-motion: no-preference) {
  .ft-body { animation: ft-fade .22s ease-out; }
  .ft-summary-backdrop { animation: ft-fade .2s ease-out; }
  .ft-summary-card { animation: ft-up .3s cubic-bezier(.2,.8,.2,1); }
  .ft-toast, .ft-rest { animation: ft-in .2s ease-out; }
  .ft-btn:active:not(:disabled), .ft-chip:active, .ft-mini:active:not(:disabled), .ft-tab:active,
  .ft-tplcard:active, .ft-rest-btn:active, .ft-addset:active { transform: scale(.97); }
  @keyframes ft-fade { from { opacity: 0; } to { opacity: 1; } }
  @keyframes ft-up { from { transform: translateY(100%); } to { transform: none; } }
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
function fmtDurationParts(ms) {
  if (ms == null) return ["—", ""];
  const totalMin = Math.round(ms / 60000);
  if (totalMin < 1) return ["<1", "min"];
  if (totalMin < 60) return [String(totalMin), "min"];
  return [`${Math.floor(totalMin / 60)}h${String(totalMin % 60).padStart(2, "0")}`, ""];
}

function usePrefersDark() {
  const [dark, setDark] = useState(
    () => typeof window !== "undefined" && !!window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
  );
  useEffect(() => {
    if (!window.matchMedia) return;
    const q = window.matchMedia("(prefers-color-scheme: dark)");
    const on = (e) => setDark(e.matches);
    if (q.addEventListener) q.addEventListener("change", on);
    else q.addListener(on);
    return () => (q.removeEventListener ? q.removeEventListener("change", on) : q.removeListener(on));
  }, []);
  return dark;
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
  const [wzStep, setWzStep] = useState("menu");
  const [wzDays, setWzDays] = useState([]);
  const [wzDayIdx, setWzDayIdx] = useState(0);
  const [wzEquip, setWzEquip] = useState(() => EQUIP.map((e) => e.id));
  const [wzRest, setWzRest] = useState(90);
  const [wzQuery, setWzQuery] = useState("");
  const [wzPick, setWzPick] = useState(null);
  const [wzSwapId, setWzSwapId] = useState(null);
  const [swapId, setSwapId] = useState(null);
  const [summary, setSummary] = useState(null);
  const dark = usePrefersDark();
  const audioCtxRef = useRef(null);
  const sessionStartRef = useRef(null);
  const wakeLockRef = useRef(null);
  const restEndRef = useRef(null);

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
    setSwapId(null);
  }, [dayId]);

  // restaura um descanso que ficou rodando se a página recarregou ou o app foi fechado no meio
  useEffect(() => {
    (async () => {
      const raw = await store.get(REST_KEY);
      if (!raw) return;
      let saved = null;
      try {
        saved = JSON.parse(raw);
      } catch (e) {
        return;
      }
      if (!saved || typeof saved.end !== "number") return;
      if (saved.end > Date.now()) {
        setRestNow(Date.now());
        setRestEnd(saved.end);
        acquireWakeLock();
      } else {
        await store.set(REST_KEY, "");
        setToast("O descanso já tinha acabado enquanto o app estava fechado");
      }
    })();
  }, []);

  useEffect(() => {
    restEndRef.current = restEnd;
    store.set(REST_KEY, restEnd ? JSON.stringify({ end: restEnd }) : "");
  }, [restEnd]);

  useEffect(() => {
    if (!restEnd) return;
    const id = setInterval(() => setRestNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [restEnd]);

  const restRemaining = restEnd ? Math.max(0, Math.ceil((restEnd - restNow) / 1000)) : 0;

  useEffect(() => {
    if (restEnd && restRemaining === 0) finishRestTimer();
  }, [restRemaining, restEnd]);

  // celular travou ou o app foi pra segundo plano: ao voltar, recalcula na hora (sem esperar o próximo tick)
  // e pede a tela acesa de novo, porque o sistema solta o wake lock quando a aba fica oculta
  useEffect(() => {
    function onBack() {
      if (document.visibilityState !== "visible") return;
      setRestNow(Date.now());
      if (restEndRef.current) acquireWakeLock();
    }
    document.addEventListener("visibilitychange", onBack);
    window.addEventListener("focus", onBack);
    return () => {
      document.removeEventListener("visibilitychange", onBack);
      window.removeEventListener("focus", onBack);
    };
  }, []);

  useEffect(() => () => releaseWakeLock(), []);

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
      const pesos = Array.isArray(ex.pesos) ? ex.pesos : [];
      next[ex.id] = Array.from({ length: ex.sets || DEFAULT_SETS }, (_, i) => ({
        kg: pesos[i] != null && pesos[i] !== "" ? String(pesos[i]) : "",
        reps: "",
      }));
    });
    setDraft(next);
    setFocusEx(null);
    setPick(null);
    sessionStartRef.current = null;
  }, [day]);

  function setCell(exId, i, field, value) {
    if (!sessionStartRef.current) sessionStartRef.current = Date.now();
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

  async function acquireWakeLock() {
    if (!WAKE_LOCK_SUPPORTED || wakeLockRef.current) return;
    try {
      wakeLockRef.current = await navigator.wakeLock.request("screen");
      wakeLockRef.current.addEventListener("release", () => {
        wakeLockRef.current = null;
      });
    } catch (e) {
      wakeLockRef.current = null;
    }
  }

  function releaseWakeLock() {
    try {
      wakeLockRef.current && wakeLockRef.current.release();
    } catch (e) {
      /* segue */
    }
    wakeLockRef.current = null;
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
    acquireWakeLock();
  }

  function stopRestTimer() {
    setRestEnd(null);
    releaseWakeLock();
  }

  function adjustRest(deltaSec) {
    setRestEnd((end) => (end ? Math.max(Date.now() + 1000, end + deltaSec * 1000) : end));
  }

  function finishRestTimer() {
    setRestEnd(null);
    releaseWakeLock();
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

    // compara com a sessão anterior deste mesmo treino, antes de salvar a nova
    const anterior = [...data.sessions]
      .filter((s) => s.dayId === day.id)
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    const volumeDe = (sess) =>
      sess.entries.reduce((t, e) => t + e.sets.reduce((v, s) => v + s.kg * s.reps, 0), 0);
    const volumeAnterior = anterior ? volumeDe(anterior) : 0;

    const totalVolume = entries.reduce((t, e) => t + e.sets.reduce((v, s) => v + s.kg * s.reps, 0), 0);
    const prCount = entries.reduce((t, e) => {
      const recordeAntes = bestByExercise[e.exerciseId] || 0;
      return t + e.sets.filter((s) => recordeAntes > 0 && s.kg > recordeAntes).length;
    }, 0);

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

    if (ok) {
      setSummary({
        dayName: day.name,
        dayFocus: day.focus,
        totalVolume,
        prCount,
        durationMs: sessionStartRef.current ? Date.now() - sessionStartRef.current : null,
        comparePct: volumeAnterior > 0 ? Math.round(((totalVolume - volumeAnterior) / volumeAnterior) * 100) : null,
      });
      sessionStartRef.current = null;
    } else {
      setToast("Não deu para salvar. Tente de novo.");
    }
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
    if (!day) return { pri: new Set(), sec: new Set() };
    const lista = focusEx ? day.exercises.filter((e) => e.id === focusEx) : day.exercises;
    return musclesForList(lista);
  }, [day, focusEx]);

  const dayColor = (k) => (dayMuscles.pri.has(k) ? C_PRI : dayMuscles.sec.has(k) ? C_SEC : C_NONE);

  const wzDay = wzDays[wzDayIdx] || null;
  const wzSwapEx = wzDay ? wzDay.exercises.find((ex) => ex.id === wzSwapId) : null;

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
          ? {
              ...d,
              exercises: [
                ...d.exercises,
                { id: uid(), name, sets: DEFAULT_SETS, repRange: "", pesos: Array(DEFAULT_SETS).fill("") },
              ],
            }
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
      exercises: d.exercises.map((ex) => ({ ...ex, id: uid(), pesos: [...(ex.pesos || [])] })),
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

  function resetWizard() {
    setWzStep("menu");
    setWzDays([]);
    setWzDayIdx(0);
    setWzEquip(EQUIP.map((e) => e.id));
    setWzRest(90);
    setWzQuery("");
    setWzPick(null);
    setWzSwapId(null);
  }

  function startCustomize(tpl) {
    setWzDays(tpl.build());
    setWzDayIdx(0);
    setWzQuery("");
    setWzPick(null);
    setWzSwapId(null);
    setWzStep("customizar");
  }

  // um toque no + da busca já entra; com um exercício em troca, entra no lugar dele
  function addOrSwapWz(name) {
    if (wzSwapId) {
      patchWzExercise(wzSwapId, { name });
      setWzSwapId(null);
    } else {
      addWzExercise(name);
    }
    setWzPick(null);
  }

  function addOrSwap(name) {
    if (swapId) {
      updateExercise(day.id, swapId, { name });
      setSwapId(null);
    } else {
      addExercise(day.id, name);
    }
    setLibPick(null);
  }

  const patchWzDay = (patch) =>
    setWzDays((days) => days.map((d, i) => (i === wzDayIdx ? { ...d, ...patch } : d)));

  const patchWzExercises = (fn) =>
    setWzDays((days) => days.map((d, i) => (i === wzDayIdx ? { ...d, exercises: fn(d.exercises) } : d)));

  const patchWzExercise = (exId, patch) =>
    patchWzExercises((list) => list.map((ex) => (ex.id === exId ? { ...ex, ...patch } : ex)));

  const removeWzExercise = (exId) => patchWzExercises((list) => list.filter((ex) => ex.id !== exId));

  const addWzExercise = (name) =>
    patchWzExercises((list) => [
      ...list,
      { id: uid(), name, sets: DEFAULT_SETS, repRange: DEFAULT_REPS, pesos: Array(DEFAULT_SETS).fill("") },
    ]);

  function moveWzExercise(exId, dir) {
    patchWzExercises((list) => {
      const idx = list.findIndex((ex) => ex.id === exId);
      const alvo = idx + dir;
      if (idx === -1 || alvo < 0 || alvo >= list.length) return list;
      const next = [...list];
      [next[idx], next[alvo]] = [next[alvo], next[idx]];
      return next;
    });
  }

  function addWzDay() {
    setWzDays((days) => [
      ...days,
      { id: uid(), name: `Treino ${days.length + 1}`, focus: "", exercises: [] },
    ]);
    setWzDayIdx(wzDays.length);
    setWzPick(null);
  }

  function removeWzDay() {
    if (wzDays.length <= 1) return;
    setWzDays((days) => days.filter((_, i) => i !== wzDayIdx));
    setWzDayIdx(Math.min(wzDayIdx, wzDays.length - 2));
    setWzPick(null);
  }

  const toggleWzEquip = (id) =>
    setWzEquip((eq) => (eq.includes(id) ? eq.filter((e) => e !== id) : [...eq, id]));

  async function finishWizard() {
    const days = wzDays.filter((d) => d.exercises.length > 0);
    if (!days.length) {
      setToast("Coloque pelo menos um exercício em um treino");
      return;
    }
    const ok = await persist({
      days,
      sessions: [],
      schedule: defaultSchedule(days),
      equipment: wzEquip,
      restSeconds: wzRest,
    });
    setDayId(days[0].id);
    setTab("hoje");
    resetWizard();
    setToast(ok ? "Ficha montada, bom treino" : "Não deu para salvar. Tente de novo.");
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
    resetWizard();
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
    const passo = wzStep === "menu" ? 1 : wzStep === "customizar" ? 2 : 3;
    const passoNome =
      passo === 1 ? "a divisão da semana" : passo === 2 ? "os exercícios" : "o descanso";
    return (
      <div className="ft">
        <style>{CSS}</style>
        <header className="ft-head">
          <h1 className="ft-title">Montar a ficha</h1>
          <p className="ft-sub">
            Passo {passo} de 3 · escolha {passoNome}
          </p>
        </header>

        <div className="ft-body">
          <div className="ft-stepbar">
            {[1, 2, 3].map((n) => (
              <div key={n} className="ft-stepseg" data-on={n <= passo ? "1" : "0"} />
            ))}
          </div>

          {wzStep === "menu" && (
            <>
              <p className="ft-wzhint">
                Como você quer dividir os treinos da semana? No passo seguinte você troca os
                exercícios de cada treino e vê no mapa, na hora, quais músculos ele pega.
              </p>
              {TEMPLATES.map((tpl) => (
                <button key={tpl.id} className="ft-tplcard" onClick={() => startCustomize(tpl)}>
                  <div className="ft-tplname">{tpl.label}</div>
                  <div className="ft-tpldesc">{tpl.desc}</div>
                </button>
              ))}
            </>
          )}

          {wzStep === "customizar" && wzDay && (
            <>
              <p className="ft-label">O que você tem disponível</p>
              <div className="ft-cfgex" style={{ marginBottom: 16 }}>
                {EQUIP.map((eq) => (
                  <button
                    key={eq.id}
                    className="ft-mini"
                    data-on={wzEquip.includes(eq.id) ? "1" : "0"}
                    onClick={() => toggleWzEquip(eq.id)}
                  >
                    {eq.label}
                  </button>
                ))}
              </div>

              <p className="ft-label">
                Treino {wzDayIdx + 1} de {wzDays.length}
              </p>
              <div className="ft-daybar">
                {wzDays.map((d, i) => (
                  <button
                    key={d.id}
                    className="ft-chip"
                    data-on={i === wzDayIdx ? "1" : "0"}
                    onClick={() => {
                      setWzDayIdx(i);
                      setWzPick(null);
                    }}
                  >
                    {d.name}
                  </button>
                ))}
              </div>
              <div className="ft-cfgex" style={{ marginBottom: 12 }}>
                <button className="ft-mini" onClick={addWzDay}>
                  + Treino
                </button>
                {wzDays.length > 1 && (
                  <button className="ft-mini ft-danger" onClick={removeWzDay}>
                    Remover este treino
                  </button>
                )}
              </div>

              <div className="ft-cfgday">
                <input
                  className="ft-cfginput"
                  value={wzDay.name}
                  onChange={(e) => patchWzDay({ name: e.target.value })}
                  aria-label="Nome do treino"
                />
                <div style={{ height: 6 }} />
                <input
                  className="ft-cfginput"
                  style={{ fontWeight: 400, fontSize: 14 }}
                  value={wzDay.focus}
                  placeholder="Grupos musculares"
                  onChange={(e) => patchWzDay({ focus: e.target.value })}
                  aria-label="Grupos musculares"
                />
              </div>

              <TreinoMap
                dayName={wzDay.name}
                exercises={wzDay.exercises}
                pick={wzPick}
                swapId={wzSwapId}
                onAdd={addOrSwapWz}
              />

              <div className="ft-cfgday">
                <ExerciseRows
                  exercises={wzDay.exercises}
                  onMove={moveWzExercise}
                  onPatch={patchWzExercise}
                  onRemove={(exId) => {
                    removeWzExercise(exId);
                    if (wzSwapId === exId) setWzSwapId(null);
                  }}
                  onSwap={(exId) => {
                    setWzSwapId(wzSwapId === exId ? null : exId);
                    setWzPick(null);
                  }}
                  swapId={wzSwapId}
                />
                <div className="ft-cfgex">
                  <button className="ft-mini" onClick={() => addWzExercise("Novo exercício")}>
                    Criar do zero
                  </button>
                </div>
                <ExerciseSearch
                  equipment={wzEquip}
                  existingNames={wzDay.exercises.map((ex) => ex.name)}
                  query={wzQuery}
                  onQuery={setWzQuery}
                  pick={wzPick}
                  onPick={setWzPick}
                  onAdd={addOrSwapWz}
                  swapName={wzSwapEx ? wzSwapEx.name : null}
                  onCancelSwap={() => setWzSwapId(null)}
                />
              </div>

              <div style={{ height: 16 }} />
              <button className="ft-btn" onClick={() => setWzStep("descanso")}>
                Continuar para o descanso
              </button>
              <button className="ft-mini ft-wzback" onClick={() => setWzStep("menu")}>
                voltar para as divisões
              </button>
            </>
          )}

          {wzStep === "descanso" && (
            <>
              <p className="ft-wzhint">
                Quanto tempo de descanso entre as séries? O cronômetro começa sozinho quando você
                registra uma série, e dá pra esticar ou cortar no meio do treino.
              </p>
              <p className="ft-label">Descanso padrão</p>
              <div className="ft-cfgex" style={{ marginBottom: 10 }}>
                <input
                  className="ft-cfginput"
                  style={{ flex: "0 0 96px", textAlign: "center" }}
                  type="number"
                  min="10"
                  step="5"
                  inputMode="numeric"
                  value={wzRest}
                  onChange={(e) => setWzRest(Math.max(10, Number(e.target.value) || 90))}
                  aria-label="Descanso em segundos"
                />
                <span className="ft-last" style={{ alignSelf: "center", marginTop: 0 }}>
                  segundos · {fmtRest(wzRest)}
                </span>
              </div>
              <div className="ft-cfgex" style={{ marginBottom: 20 }}>
                {[30, 45, 60, 90, 120, 150, 180].map((s) => (
                  <button
                    key={s}
                    className="ft-mini"
                    data-on={wzRest === s ? "1" : "0"}
                    onClick={() => setWzRest(s)}
                  >
                    {s}s
                  </button>
                ))}
              </div>

              <div className="ft-cfgday" style={{ marginBottom: 16 }}>
                <p className="ft-label" style={{ margin: "0 0 8px" }}>
                  Sua ficha ficou assim
                </p>
                {wzDays.map((d) => (
                  <div className="ft-cover" key={d.id}>
                    <span>{d.name}</span>
                    <span>
                      {d.exercises.length} {d.exercises.length === 1 ? "exercício" : "exercícios"}
                    </span>
                  </div>
                ))}
              </div>

              <button className="ft-btn" onClick={finishWizard}>
                Concluir e começar
              </button>
              <button className="ft-mini ft-wzback" onClick={() => setWzStep("customizar")}>
                voltar para os exercícios
              </button>
            </>
          )}

          <div style={{ height: 30 }} />
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
  const swapEx = day ? day.exercises.find((ex) => ex.id === swapId) : null;
  const chartColors = dark
    ? { grid: "#2b2f35", tick: "#9c998f", line: "#f1f0ed", dot: "#ff5a48", bg: "#17191c" }
    : { grid: "#e8e5df", tick: "#6c6963", line: "#16181b", dot: "#d63a2b", bg: "#ffffff" };
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
    <div className="ft" data-resting={restEnd && tab === "hoje" ? "1" : "0"}>
      <style>{CSS}</style>

      <header className="ft-head">
        <p className="ft-eyebrow">
          {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
        </p>
        <h1 className="ft-title">Ficha de treino</h1>
        <p className="ft-sub">
          {treinosNaSemana}x por semana · {data.sessions.length} treinos registrados · {semana} nos
          últimos 7 dias
        </p>
      </header>

      <nav className="ft-tabs">
        <div className="ft-seg">
          {[
            ["hoje", "Hoje"],
            ["semana", "Semana"],
            ["progresso", "Progresso"],
            ["ajustes", "Exercícios"],
          ].map(([id, label]) => (
            <button
              key={id}
              className="ft-tab"
              data-on={tab === id ? "1" : "0"}
              aria-current={tab === id ? "page" : undefined}
              onClick={() => setTab(id)}
            >
              <TabIcon id={id} />
              <span>{label}</span>
            </button>
          ))}
        </div>
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
                <span className="ft-rest-label">
                  Descanso
                  {WAKE_LOCK_SUPPORTED && <span className="ft-rest-lock"> · tela acesa</span>}
                </span>
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
                    <LineChart data={chartData} margin={{ top: 4, right: 24, left: -18, bottom: 0 }}>
                      <CartesianGrid stroke={chartColors.grid} vertical={false} />
                      <XAxis
                        dataKey="data"
                        tick={{ fontSize: 11, fill: chartColors.tick }}
                        tickLine={false}
                        axisLine={{ stroke: chartColors.grid }}
                      />
                      <YAxis tick={{ fontSize: 11, fill: chartColors.tick }} tickLine={false} axisLine={false} />
                      <Tooltip
                        contentStyle={{
                          fontSize: 12,
                          borderRadius: 12,
                          border: "none",
                          background: "var(--surface)",
                          color: "var(--text)",
                          boxShadow: "0 8px 24px -8px rgba(0,0,0,.3)",
                        }}
                        labelStyle={{ color: "var(--muted)" }}
                        cursor={{ stroke: chartColors.grid }}
                        formatter={(v) => [`${v} kg`, "carga"]}
                      />
                      <Line
                        type="monotone"
                        dataKey="carga"
                        stroke={chartColors.line}
                        strokeWidth={2.5}
                        dot={{ r: 3.5, fill: chartColors.dot, stroke: chartColors.dot }}
                        activeDot={{ r: 5, fill: chartColors.dot, stroke: chartColors.bg, strokeWidth: 2 }}
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
          <div className="ft-cfgex">
            <input
              className="ft-cfginput"
              style={{ flex: "0 0 96px", textAlign: "center" }}
              type="number"
              min="10"
              step="5"
              inputMode="numeric"
              value={data.restSeconds || 90}
              onChange={(e) => setRestSeconds(Math.max(10, Number(e.target.value) || 90))}
              aria-label="Descanso em segundos"
            />
            <span className="ft-last" style={{ alignSelf: "center", marginTop: 0 }}>
              segundos · {fmtRest(data.restSeconds || 90)}
            </span>
          </div>
          <div className="ft-cfgex" style={{ marginBottom: 16 }}>
            {[30, 45, 60, 90, 120, 150, 180].map((s) => (
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
          <div className="ft-daybar">
            {data.days.map((d) => (
              <button
                key={d.id}
                className="ft-chip"
                data-on={day && d.id === day.id ? "1" : "0"}
                onClick={() => setDayId(d.id)}
              >
                {d.name}
              </button>
            ))}
          </div>

          {day && (
            <div className="ft-cfgday">
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

              <TreinoMap
                dayName={day.name}
                exercises={day.exercises}
                pick={libOpen ? libPick : null}
                swapId={swapId}
                onAdd={addOrSwap}
              />

              <ExerciseRows
                exercises={day.exercises}
                onMove={(exId, dir) => moveExercise(day.id, exId, dir)}
                onPatch={(exId, patch) => updateExercise(day.id, exId, patch)}
                onRemove={(exId) => {
                  removeExercise(day.id, exId);
                  if (swapId === exId) setSwapId(null);
                }}
                onSwap={(exId) => {
                  const ativo = swapId === exId;
                  setSwapId(ativo ? null : exId);
                  setLibPick(null);
                  if (!ativo) setLibOpen(true);
                }}
                swapId={swapId}
              />

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
                <ExerciseSearch
                  equipment={data.equipment}
                  existingNames={day.exercises.map((ex) => ex.name)}
                  query={libQuery}
                  onQuery={setLibQuery}
                  pick={libPick}
                  onPick={setLibPick}
                  onAdd={addOrSwap}
                  swapName={swapEx ? swapEx.name : null}
                  onCancelSwap={() => setSwapId(null)}
                />
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

      {summary && (
        <div className="ft-summary-backdrop" onClick={() => setSummary(null)}>
          <div
            className="ft-summary-card"
            role="dialog"
            aria-label="Resumo do treino"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ft-summary-grip" />
            <p className="ft-summary-eyebrow">Treino concluído</p>
            <h2 className="ft-summary-title">{summary.dayFocus || summary.dayName}</h2>

            <div className="ft-sumstats">
              <div className="ft-sumstat">
                <div className="ft-sumval ft-num">
                  {summary.totalVolume.toLocaleString("pt-BR")}
                  <span className="ft-sumunit">kg</span>
                </div>
                <div className="ft-sumlab">
                  volume
                  {summary.comparePct != null && summary.comparePct !== 0 && (
                    <span className="ft-delta" data-up={summary.comparePct > 0 ? "1" : "0"}>
                      {summary.comparePct > 0 ? "+" : ""}
                      {summary.comparePct}%
                    </span>
                  )}
                </div>
              </div>
              <div className="ft-sumstat">
                <div className="ft-sumval ft-num">{summary.prCount}</div>
                <div className="ft-sumlab">{summary.prCount === 1 ? "recorde" : "recordes"}</div>
              </div>
              <div className="ft-sumstat">
                <div className="ft-sumval ft-num">
                  {fmtDurationParts(summary.durationMs)[0]}
                  <span className="ft-sumunit">{fmtDurationParts(summary.durationMs)[1]}</span>
                </div>
                <div className="ft-sumlab">duração</div>
              </div>
            </div>

            <button className="ft-btn" onClick={() => setSummary(null)}>
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
