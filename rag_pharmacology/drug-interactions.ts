import type { AppLanguage } from "@/lib/translations";

export type DrugInteractionNiveau = "majeure" | "modérée" | "mineure";

export interface DrugInteraction {
  id: string;
  medicament1: string[];
  medicament2: string[];
  niveau: DrugInteractionNiveau;
  danger: string;
  consequence: string;
  conseil: string;
  arabicAlert: string;
}

export const DRUG_INTERACTIONS: DrugInteraction[] = [
  {
    id: "ains-aspirine",
    medicament1: [
      "ibuprofene",
      "ibuprofen",
      "advil",
      "nurofen",
      "brufen",
      "anti-inflammatoire",
      "naproxene",
      "diclofenac",
      "ketoprofene",
    ],
    medicament2: [
      "aspirine",
      "aspirin",
      "acide acetylsalicylique",
      "kardegic",
      "aspegic",
      "anticoagulant",
      "warfarine",
      "warfarin",
      "heparine",
      "rivaroxaban",
      "apixaban",
      "clopidogrel",
      "plavix",
    ],
    niveau: "majeure",
    danger: "Risque hémorragique très élevé",
    consequence:
      "Multiplication du risque de saignements graves, " +
      "hémorragies digestives, ulcères à l'estomac. " +
      "L'ibuprofène bloque l'effet protecteur " +
      "de l'aspirine sur le cœur.",
    conseil:
      "Ne jamais prendre ensemble. " +
      "Consultez votre médecin immédiatement. " +
      "Si douleur → préférez le paracétamol.",
    arabicAlert:
      "تحذير خطير! لا تأخذ الإيبوبروفين مع الأسبرين معاً. " +
      "هذا المزيج خطير جداً ويسبب نزيفاً في المعدة. " +
      "استشر طبيبك فوراً.",
  },
  {
    id: "paracetamol-alcool",
    medicament1: [
      "paracetamol",
      "doliprane",
      "dafalgan",
      "efferalgan",
      "tylenol",
      "acetaminophen",
      "panadol",
    ],
    medicament2: ["alcool", "alcohol", "biere", "vin"],
    niveau: "majeure",
    danger: "Toxicité hépatique sévère",
    consequence:
      "L'association paracétamol + alcool peut " +
      "provoquer une destruction du foie " +
      "même à doses thérapeutiques normales.",
    conseil:
      "Évitez toute consommation d'alcool " +
      "pendant le traitement. " +
      "En cas de doute → urgences médicales.",
    arabicAlert:
      "تحذير! لا تشرب الكحول مع الباراسيتامول. " +
      "هذا المزيج يدمر الكبد بشكل خطير. " +
      "إذا كنت تتناول الكحول أخبر طبيبك.",
  },
  {
    id: "metformine-contraste",
    medicament1: ["metformine", "glucophage", "stagid", "glucinan", "metformax"],
    medicament2: [
      "produit de contraste",
      "iode",
      "scanner",
      "radiologie",
      "irm",
    ],
    niveau: "majeure",
    danger: "Acidose lactique fatale",
    consequence:
      "Les produits de contraste iodés " +
      "combinés à la metformine peuvent " +
      "provoquer une acidose lactique " +
      "potentiellement mortelle.",
    conseil:
      "Arrêter la metformine 48h avant " +
      "tout examen avec produit de contraste. " +
      "Informez toujours le radiologue.",
    arabicAlert:
      "تحذير مهم لمرضى السكري! " +
      "إذا كنت تأخذ الميتفورمين وستجري فحصاً بالصبغة، " +
      "أوقف الدواء قبل 48 ساعة واستشر طبيبك.",
  },
  {
    id: "statines-antifongiques",
    medicament1: [
      "atorvastatine",
      "simvastatine",
      "rosuvastatine",
      "pravastatine",
      "lovastatine",
      "statine",
      "tahor",
      "crestor",
      "zocor",
    ],
    medicament2: [
      "fluconazole",
      "itraconazole",
      "ketoconazole",
      "antifongique",
      "triflucan",
    ],
    niveau: "majeure",
    danger: "Destruction musculaire (rhabdomyolyse)",
    consequence:
      "Association qui peut provoquer " +
      "une destruction des muscles " +
      "et une insuffisance rénale grave.",
    conseil:
      "Ne jamais combiner sans avis médical. " +
      "Si douleurs musculaires → urgences.",
    arabicAlert:
      "تحذير! لا تأخذ دواء الكوليسترول مع مضاد الفطريات. " +
      "هذا المزيج يؤذي العضلات والكلى. " +
      "استشر طبيبك قبل أخذهما معاً.",
  },
  {
    id: "iec-potassium",
    medicament1: [
      "lisinopril",
      "ramipril",
      "perindopril",
      "captopril",
      "enalapril",
      "iec",
      "coversyl",
      "triatec",
      "zestril",
    ],
    medicament2: [
      "potassium",
      "chlorure de potassium",
      "ibuprofene",
      "naproxene",
      "diclofenac",
      "ains",
      "anti-inflammatoire",
    ],
    niveau: "majeure",
    danger: "Hyperkaliémie / Insuffisance rénale",
    consequence:
      "Élévation dangereuse du potassium " +
      "pouvant provoquer des troubles " +
      "cardiaques graves ou " +
      "une insuffisance rénale.",
    conseil:
      "Contrôle régulier de la kaliémie requis. " +
      "Éviter les AINS avec les IEC. " +
      "Consultez votre médecin.",
    arabicAlert:
      "تحذير! دواء ضغط الدم مع مضاد الالتهاب خطير. " +
      "هذا المزيج يؤثر على الكلى والقلب. " +
      "استشر طبيبك قبل أخذهما معاً.",
  },
  {
    id: "antibiotiques-contraceptifs",
    medicament1: [
      "amoxicilline",
      "ampicilline",
      "rifampicine",
      "rifampicin",
      "antibiotique",
      "tetracycline",
      "doxycycline",
    ],
    medicament2: [
      "pilule",
      "contraceptif",
      "oestrogene",
      "progestatif",
      "minidril",
      "trinordiol",
      "microgyno",
    ],
    niveau: "modérée",
    danger: "Réduction efficacité contraceptive",
    consequence:
      "Certains antibiotiques réduisent " +
      "l'efficacité de la pilule contraceptive " +
      "et peuvent mener à une grossesse non désirée.",
    conseil:
      "Utiliser une contraception supplémentaire " +
      "pendant et 7 jours après le traitement. " +
      "Informez votre médecin.",
    arabicAlert:
      "تنبيه مهم! بعض المضادات الحيوية تقلل من " +
      "فعالية حبوب منع الحمل. " +
      "استخدمي وسيلة حماية إضافية خلال العلاج.",
  },
  {
    id: "benzodiazepines-opioides",
    medicament1: [
      "diazepam",
      "alprazolam",
      "lorazepam",
      "clonazepam",
      "benzodiazepine",
      "xanax",
      "lexomil",
      "temesta",
    ],
    medicament2: [
      "codeine",
      "tramadol",
      "morphine",
      "oxycodone",
      "fentanyl",
      "opiode",
      "opioide",
      "dolzam",
    ],
    niveau: "majeure",
    danger: "Dépression respiratoire fatale",
    consequence:
      "Association qui peut provoquer " +
      "un arrêt respiratoire, " +
      "coma ou mort. " +
      "Interaction potentiellement fatale.",
    conseil:
      "JAMAIS sans surveillance médicale stricte. " +
      "Si prise simultanée involontaire → " +
      "urgences immédiatement (15).",
    arabicAlert:
      "خطر للغاية! لا تأخذ المهدئات مع مسكنات الألم القوية. " +
      "هذا المزيج قد يوقف التنفس ويسبب الوفاة. " +
      "اتصل بالرقم 15 فوراً إذا أخذتهما معاً.",
  },
];

function normalizeMedToken(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9àâäéèêëïîôùûüç\s-]/gi, "")
    .trim();
}

export function detectInteractions(medicaments: string[]): DrugInteraction[] {
  const found: DrugInteraction[] = [];
  const lower = medicaments.map((m) => normalizeMedToken(m)).filter(Boolean);

  for (const interaction of DRUG_INTERACTIONS) {
    const hasMed1 = interaction.medicament1.some((m1) => {
      const k = normalizeMedToken(m1);
      if (k.length < 3) return false;
      return lower.some((med) => med.includes(k) || k.includes(med));
    });
    const hasMed2 = interaction.medicament2.some((m2) => {
      const k = normalizeMedToken(m2);
      if (k.length < 3) return false;
      return lower.some((med) => med.includes(k) || k.includes(med));
    });

    if (hasMed1 && hasMed2) {
      found.push(interaction);
    }
  }

  return found;
}

export function hasInteractionMajeure(medicaments: string[]): boolean {
  return detectInteractions(medicaments).some((i) => i.niveau === "majeure");
}

export function getInteractionAlert(interaction: DrugInteraction, lang: AppLanguage): string {
  if (lang === "ar") return interaction.arabicAlert;
  return `⚠️ ${interaction.danger}: ${interaction.conseil}`;
}
