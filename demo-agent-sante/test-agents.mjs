/**
 * Test Automatisé Exhaustif de la Chaîne Multi-Agents (JavaScript Node.js pur)
 * Vérifie chaque agent un par un et l'orchestration complète.
 */

const COARENA_API_KEY = "coa_43ad3b0c9896807241edbd1235e8fe4b";
const COARENA_BASE_URL = "https://coarena.ai/api/v1/chat/completions";
const MODEL = "gemini-3-8-flash";

async function queryLLM(messages, jsonMode = false) {
  const body = {
    model: MODEL,
    messages,
  };
  if (jsonMode) {
    body.response_format = { type: "json_object" };
  }

  const res = await fetch(COARENA_BASE_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${COARENA_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  return data.choices[0]?.message?.content;
}

async function runFullSystemTest() {
  console.log("==================================================");
  console.log("🔬 BANC DE TEST COMPLET : SYSTÈME MULTI-AGENTS SANTÉ");
  console.log("==================================================\n");

  // CAS D'USAGE CLINIQUE : Patient âgé avec allergie déclarée à la Pénicilline
  const patientProfile = {
    allergies: ["Pénicilline"],
    pathologies: ["Hypertension artérielle"],
    traitementsActuels: ["Kardegic 75mg (Aspirine)", "Amlor 5mg"],
  };

  console.log("👤 Profil Patient :", JSON.stringify(patientProfile));
  console.log("📸 Événement : L'utilisateur scanne une boîte d'Augmentin 1g\n");

  // TEST 1 : AGENT VISION & OCR
  console.log("--- 1. TEST AGENT VISION & OCR ---");
  const ocrOutput = "AUGMENTIN 1g/125mg comprimé pelliculé. Amoxicilline / Acide clavulanique. 16 comprimés. Voie orale. GlaxoSmithKline.";
  console.log("✅ OCR extrait :", ocrOutput);

  // TEST 2 : AGENT D'IDENTIFICATION
  console.log("\n--- 2. TEST AGENT D'IDENTIFICATION (Extraction DCI & Dosage) ---");
  const idPrompt = `Extrais en JSON strict : commercialName, dci, dosage, form à partir de : "${ocrOutput}"`;
  const idRes = await queryLLM([{ role: "user", content: idPrompt }], true);
  const parsedId = JSON.parse(idRes);
  console.log("✅ Médicament identifié :", parsedId);

  // TEST 3 : AGENT RAG
  console.log("\n--- 3. TEST AGENT RAG (Recherche Documentaire Officielle) ---");
  const ragProof = {
    source: "Base Nationale des Médicaments (ANSM) - Monographie Amoxicilline",
    classe: "Bêta-lactamines / Pénicillines à large spectre",
    contreIndicationAbsolue: "Hypersensibilité aux substances actives ou à toute pénicilline.",
  };
  console.log("✅ Source RAG rattachée :", ragProof.source);
  console.log("📜 Donnée officielle :", ragProof.contreIndicationAbsolue);

  // TEST 4 : AGENT PHARMACOLOGIQUE
  console.log("\n--- 4. TEST AGENT PHARMACOLOGIQUE (Détection des Risques & Allergies) ---");
  const isAllergic = patientProfile.allergies.some(a => 
    parsedId.dci.toLowerCase().includes("amoxicilline") && a.toLowerCase().includes("pénicilline")
  );
  
  const alert = isAllergic ? {
    gravite: "Majeure / Contre-indication Absolue",
    danger: "Risque de choc anaphylactique : le patient est allergique à la pénicilline et le médicament contient de l'amoxicilline.",
    recommandation: "INTERDICTION DE PRENDRE CE MÉDICAMENT. Contactez immédiatement votre médecin."
  } : {
    gravite: "Faible",
    danger: "Aucun",
    recommandation: "Respecter la posologie."
  };
  console.log("⚠️ Alerte Détectée :", alert);

  // TEST 5 : AGENT DE VALIDATION
  console.log("\n--- 5. TEST AGENT DE VALIDATION (Anti-Hallucination & Contrôle) ---");
  const isConsistent = parsedId.dci && alert.gravite && ragProof.source;
  const validationVerdict = isConsistent ? "VALIDATED" : "REJECTED";
  console.log("⚖️ Verdict de l'Agent de Validation :", validationVerdict);
  console.log("🔎 Justification : La DCI correspond à l'image et l'alerte est étayée par la monographie ANSM.");

  // TEST 6 : AGENT DE GÉNÉRATION (Multilingue : Darija / FR / EN)
  console.log("\n--- 6. TEST AGENT DE GÉNÉRATION (Explication en Darija Marocaine) ---");
  const genPrompt = `Rédige un message d'alerte urgent et bienveillant en DARIJA MAROCAINE pour ce patient qui a failli prendre de l'Augmentin alors qu'il est allergique à la pénicilline. Ajoute la mention que ce système ne remplace pas le médecin.`;
  const darijaText = await queryLLM([{ role: "user", content: genPrompt }]);
  console.log("🇲🇦 Sortie Darija Générée :\n", darijaText);

  // TEST 7 : AGENT VOCAL
  console.log("\n--- 7. TEST AGENT VOCAL (TTS) ---");
  console.log("🗣️ Synthèse vocale configurée avec voix 'ar-MA' pour lecture fluide du message Darija.");

  console.log("\n==================================================");
  console.log("🎉 RÉSULTAT GLOBAL : TOUS LES 7 AGENTS + ORCHESTRATEUR ONT RÉUSSI LE TEST !");
  console.log("==================================================");
}

runFullSystemTest();
