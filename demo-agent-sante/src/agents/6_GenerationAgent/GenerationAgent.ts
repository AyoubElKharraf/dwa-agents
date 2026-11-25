import type {
  MedicationItem,
  PharmacologyAlert,
  MultilingualOutput,
} from "../../types/agentTypes";

const COARENA_API_KEY = "coa_43ad3b0c9896807241edbd1235e8fe4b";
const COARENA_BASE_URL = "https://coarena.ai/api/v1/chat/completions";
const MODEL = "gemini-3-8-flash";

/**
 * AGENT 6 : GÉNÉRATION MULTILINGUE (DARIJA / FRANÇAIS / ANGLAIS)
 * Mission : Produire des explications médicales claires, structurées et adaptées au patient.
 */
export class GenerationAgent {
  public static async generate(
    medications: MedicationItem[],
    alerts: PharmacologyAlert[]
  ): Promise<MultilingualOutput> {
    const prompt = `Tu es l'Agent de Génération Médicale Multilingue.
Médicaments analysés : ${JSON.stringify(medications)}
Alertes pharmacologiques : ${JSON.stringify(alerts)}

Génère une explication claire, accessible et empathique dans les 3 langues demandées (Français, Darija marocaine authentique et Anglais) selon ce format JSON strict :
{
  "fr": {
    "summary": "...",
    "instructions": "...",
    "risks": "...",
    "disclaimer": "Ce système ne remplace pas l'avis de votre médecin ou pharmacien."
  },
  "darija": {
    "summary": "...",
    "instructions": "...",
    "risks": "...",
    "disclaimer": "هاد النظام مساعيد فقط، وما كيعوضش استشارة الطبيب أو الصيدلاني ديالك."
  },
  "en": {
    "summary": "...",
    "instructions": "...",
    "risks": "...",
    "disclaimer": "This system does not replace professional medical advice from a doctor or pharmacist."
  }
}`;

    try {
      const response = await fetch(COARENA_BASE_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${COARENA_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" },
        }),
      });

      const data = await response.json();
      return JSON.parse(data.choices[0]?.message?.content || "{}") as MultilingualOutput;
    } catch {
      return {
        fr: {
          summary: `Médicament : ${medications[0]?.commercialName || "Traitement"} (${medications[0]?.dosage || ""})`,
          instructions: medications[0]?.detectedInstructions || "À prendre selon prescription médicale.",
          risks: alerts[0]?.riskDescription || "Aucun risque majeur.",
          disclaimer: "Ce conseil ne remplace pas une consultation médicale.",
        },
        darija: {
          summary: `هاد الدوا هو ${medications[0]?.commercialName || "العلاج ديالك"} (${medications[0]?.dci || ""})`,
          instructions: "شرب الحبة مع كاس كبير ديال الما وسط الماكلة من الأفضل باش تحمي المعدة ديالك.",
          risks: alerts[0]?.riskDescription || "ماكاين حتى شي خطر مع الحالة ديالك.",
          disclaimer: "هاد المساعدة ما كتعوضش استشارة الطبيب أو الفارماسيان.",
        },
        en: {
          summary: `Medication: ${medications[0]?.commercialName || "Treatment"}`,
          instructions: medications[0]?.detectedInstructions || "Take as directed by doctor.",
          risks: alerts[0]?.riskDescription || "No major risk.",
          disclaimer: "This does not replace professional medical advice.",
        },
      };
    }
  }
}
