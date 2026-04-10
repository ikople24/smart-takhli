function toBool(v) {
  return v === true || v === "true" || v === 1 || v === "1" || v === "yes";
}

export function is2QPositive(q2) {
  const q1 = toBool(q2?.q1);
  const q2b = toBool(q2?.q2);
  return Boolean(q1 || q2b);
}

export function normalize9QAnswers(raw) {
  if (!Array.isArray(raw)) return null;
  const out = raw.map((x) => {
    const n = typeof x === "number" ? x : Number(String(x ?? "").trim());
    if (!Number.isFinite(n)) return 0;
    if (n < 0) return 0;
    if (n > 3) return 3;
    return n;
  });
  if (out.length !== 9) return null;
  return out;
}

export function score9Q(answers) {
  const a = normalize9QAnswers(answers);
  if (!a) return { totalScore: null, severity: "unknown", suicidalRisk: null, answers: null };
  const totalScore = a.reduce((sum, n) => sum + n, 0);
  const suicidalRisk = a[8] > 0; // item 9
  const severity =
    totalScore <= 6
      ? "none"
      : totalScore <= 12
        ? "mild"
        : totalScore <= 18
          ? "moderate"
          : "severe";
  return { totalScore, severity, suicidalRisk, answers: a };
}

export function severityLabelThai(sev) {
  switch (sev) {
    case "none":
      return "ไม่มี/น้อยมาก";
    case "mild":
      return "เล็กน้อย";
    case "moderate":
      return "ปานกลาง";
    case "severe":
      return "รุนแรง";
    default:
      return "ไม่ทราบ";
  }
}

