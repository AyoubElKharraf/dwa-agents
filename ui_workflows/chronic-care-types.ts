/** Mon Suivi Santé — types et constantes. */

export const CHRONIC_CARE_STORAGE_KEY = "marocpulse.chronic.v1";

export type PriseMoment = "matin" | "midi" | "soir" | "nuit" | "custom";

export type MedicamentAddedBy = "patient" | "doctor" | "photo";

export type MesureType = "glycemie" | "tension" | "poids" | "pouls";

export type MesureMoment = "matin" | "midi" | "soir";

export type RappelLangue = "fr" | "en" | "ar";

export type RappelMode = "audio" | "texte" | "les-deux";

export type AlerteExpirationNiveau = "info" | "warning" | "urgent";

export interface PriseHoraire {
  moment: PriseMoment;
  heure: string;
  quantite: number;
  avecRepas: boolean;
  obligatoire: boolean;
}

export interface Medicament {
  id: string;
  nom: string;
  dosage: string;
  forme: string;
  indication: string;
  horaires: PriseHoraire[];
  stockActuel: number;
  stockInitial: number;
  dateExpiration: string;
  dateOuverture: string;
  prescripteur: string;
  instructions: string;
  couleur: string;
  photo?: string;
  actif: boolean;
  addedBy: MedicamentAddedBy;
}

export interface PriseConfirmee {
  medicamentId: string;
  dateHeure: string;
  prise: boolean;
  horaireKey?: string;
  note?: string;
}

export interface AlerteExpiration {
  medicamentId: string;
  joursRestants: number;
  niveau: AlerteExpirationNiveau;
}

export interface MesureQuotidienne {
  type: MesureType;
  valeur: string;
  date: string;
  moment: MesureMoment;
  note?: string;
}

export interface MaladieChronique {
  id: string;
  nom: string;
  dateDecouverte: string;
  medecin: string;
  medicaments: string[];
  mesures: MesureQuotidienne[];
}

export interface RappelsConfig {
  actif: boolean;
  langue: RappelLangue;
  mode: RappelMode;
  avanceExpiration: number[];
  rappelOubli: boolean;
  delaiOubli: number;
}

export interface ProfilMedicalComplet {
  bloodGroup: string;
  chronicConditions: string;
  allergies: string;
  medications: string;
  doctor: string;
  doctorEmail: string;
  maladiesChroniques: MaladieChronique[];
  medicaments: Medicament[];
  prisesConfirmees: PriseConfirmee[];
  rappelsConfig: RappelsConfig;
  doctorLinkToken?: string;
  doctorLinkExpiry?: string;
}

export interface ChronicCareStoreV1 {
  version: 1;
  profil: ProfilMedicalComplet;
  updatedAt: string;
}

export interface MedicamentExtrait {
  nom: string | null;
  dosage: string | null;
  forme: string | null;
  dateExpiration: string | null;
  posologie: string | null;
  /** Texte notice / avertissements sur la boîte (composition, précautions, lot…). */
  description: string | null;
  indication: string | null;
  fabricant: string | null;
  horairesSuggeres: PriseHoraire[];
  confidence: number;
  warning?: string;
}

export function defaultRappelsConfig(): RappelsConfig {
  return {
    actif: true,
    langue: "fr",
    mode: "les-deux",
    avanceExpiration: [30, 15, 7],
    rappelOubli: true,
    delaiOubli: 15,
  };
}

export function defaultProfilMedicalComplet(): ProfilMedicalComplet {
  return {
    bloodGroup: "",
    chronicConditions: "",
    allergies: "",
    medications: "",
    doctor: "",
    doctorEmail: "",
    maladiesChroniques: [],
    medicaments: [],
    prisesConfirmees: [],
    rappelsConfig: defaultRappelsConfig(),
  };
}

export function newMedicamentId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `med-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function newMaladieId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `mc-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Clé stable pour une prise (médicament + horaire du jour). */
export function priseHoraireKey(medicamentId: string, horaire: PriseHoraire): string {
  return `${medicamentId}:${horaire.moment}:${horaire.heure}`;
}

export function couleurPourIndication(indication: string): string {
  const t = indication.toLowerCase();
  if (t.includes("diab")) return "blue";
  if (t.includes("hypert") || t.includes("tension")) return "violet";
  if (t.includes("cholest")) return "orange";
  return "emerald";
}

export const COULEUR_UI: Record<string, { bg: string; border: string; text: string }> = {
  blue: {
    bg: "bg-blue-50/90",
    border: "border-blue-200/80",
    text: "text-blue-900",
  },
  violet: {
    bg: "bg-violet-50/90",
    border: "border-violet-200/80",
    text: "text-violet-900",
  },
  orange: {
    bg: "bg-orange-50/90",
    border: "border-orange-200/80",
    text: "text-orange-900",
  },
  emerald: {
    bg: "bg-emerald-50/90",
    border: "border-emerald-200/80",
    text: "text-emerald-900",
  },
};

export function joursAvantExpiration(dateExpiration: string): number | null {
  if (!dateExpiration?.trim()) return null;
  const exp = new Date(dateExpiration);
  if (Number.isNaN(exp.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  exp.setHours(0, 0, 0, 0);
  return Math.ceil((exp.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
}

export function niveauExpiration(jours: number, seuils: number[]): AlerteExpirationNiveau | null {
  if (jours < 0) return "urgent";
  const sorted = [...seuils].sort((a, b) => b - a);
  if (sorted.includes(7) && jours <= 7) return "urgent";
  if (sorted.includes(15) && jours <= 15) return "warning";
  if (sorted.includes(30) && jours <= 30) return "info";
  return null;
}
