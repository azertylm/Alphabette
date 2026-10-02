/**
 * @file autonomousProjectExporter.ts
 * Module d'exportation et d'importation de projet autonome Zéro Serveur.
 *
 * Fonctionnalités clés :
 * - Chiffrement fort côté client via l'API standard Web Cryptography (SubtleCrypto) :
 *   - Algorithme : AES-GCM (256 bits).
 *   - Dérivation de clé sécurisée : PBKDF2 (100 000 itérations, SHA-256) avec Salt cryptographique aléatoire de 16 octets.
 *   - Vecteur d'initialisation (IV) unique de 12 octets par fichier.
 * - Compilation de l'état complet du projet :
 *   - Scénario & scripts textuels.
 *   - Fiches techniques (personnages, décors, éclairage, prompts de continuité).
 *   - Liens de fichiers locaux (paths et URIs locaux non exfiltrés).
 *   - Métadonnées de projet et horodatage.
 * - Validation stricte du schéma de données à l'importation avec messages d'erreurs explicites.
 * - Déclenchement automatique du téléchargement de fichier JSON chiffré (.alphabette.json ou .json).
 */

// ============================================================================
// Schéma de données du projet (TypeScript Strict)
// ============================================================================

export interface ProjectCharacter {
  id: string;
  name: string;
  age: string | number;
  traits: string;
  lockedOutfit: string;
  notes?: string;
}

export interface ProjectTechnicalSheet {
  id: string;
  title: string;
  cameraSettings: {
    lens: string;
    framing: string;
    lighting: string;
    aspectRatio: string;
  };
  lightingNotes: string;
  colorGrade: string;
  renderTarget: string; // ex: 'Wan2GP', 'MiniMax H3', 'Local vLLM'
}

export interface LocalFileLink {
  id: string;
  filename: string;
  localPath: string; // Chemin de stockage local sur machine (ex: '/Volumes/FastNVMe/Assets/scene1.mp4')
  mimeType: string;
  sizeBytes?: number;
  checksumSha256?: string;
  tags?: string[];
}

export interface ScenarioScene {
  id: string;
  sceneNumber: number;
  title: string;
  description: string;
  dialogue?: string;
  linkedCharacterIds: string[];
  visualPrompt?: string;
}

export interface AutonomousProjectData {
  /** En-tête et version de schéma */
  schemaVersion: '1.0.0' | string;
  projectId: string;
  projectName: string;
  description: string;
  author: string;
  createdAt: string;
  updatedAt: string;

  /** Corps du projet */
  scenario: {
    logline: string;
    synopsis: string;
    scenes: ScenarioScene[];
  };
  technicalSheets: ProjectTechnicalSheet[];
  characters: ProjectCharacter[];
  localFileLinks: LocalFileLink[];

  /** Paramètres de configuration personnalisés */
  customSettings?: Record<string, unknown>;
}

export interface EncryptedProjectPackage {
  format: 'ALPHABETTE_SOVEREIGN_ENCRYPTED_PROJECT';
  version: '1.0.0';
  encryption: {
    algorithm: 'AES-GCM';
    keyLengthBits: 256;
    kdf: 'PBKDF2';
    kdfHash: 'SHA-256';
    iterations: number;
  };
  /** Sel encodé en Base64 (16 octets) */
  saltBase64: string;
  /** Vecteur d'initialisation en Base64 (12 octets) */
  ivBase64: string;
  /** Payload chiffré (AES-GCM ciphertext + auth tag) en Base64 */
  ciphertextBase64: string;
  /** Métadonnées publiques non sensibles pour identification dans l'explorateur */
  manifest: {
    projectName: string;
    projectId: string;
    exportedAt: string;
    sceneCount: number;
    characterCount: number;
    fileLinksCount: number;
  };
}

export interface SchemaValidationResult {
  isValid: boolean;
  errors: string[];
  projectData?: AutonomousProjectData;
}

// ============================================================================
// Utilitaires Cryptographiques (SubtleCrypto)
// ============================================================================

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Dérive une clé cryptographique AES-GCM 256 bits à partir d'un mot de passe utilisateur et d'un sel
 * en utilisant PBKDF2 (100 000 itérations).
 */
async function deriveKeyFromPassphrase(
  passphrase: string,
  salt: Uint8Array,
  iterations: number = 100000
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(passphrase);

  // 1. Importer le mot de passe brut comme clé de base
  const baseKey = await crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  // 2. Dériver la clé finale AES-GCM
  return await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as unknown as BufferSource,
      iterations,
      hash: 'SHA-256',
    },
    baseKey,
    {
      name: 'AES-GCM',
      length: 256,
    },
    false,
    ['encrypt', 'decrypt']
  );
}

// ============================================================================
// Validateur de Schéma de Projet
// ============================================================================

/**
 * Valide rigoureusement la structure d'un objet de projet déchiffré.
 */
export function validateProjectSchema(raw: unknown): SchemaValidationResult {
  const errors: string[] = [];

  if (!raw || typeof raw !== 'object') {
    return { isValid: false, errors: ['Le document fourni n\'est pas un objet JSON valide.'] };
  }

  const p = raw as Record<string, any>;

  if (typeof p.projectName !== 'string' || !p.projectName.trim()) {
    errors.push('Champ requis manquant : "projectName" (chaîne non vide).');
  }

  if (typeof p.projectId !== 'string') {
    errors.push('Champ requis manquant : "projectId".');
  }

  if (!p.scenario || typeof p.scenario !== 'object') {
    errors.push('Structure "scenario" manquante ou invalide.');
  } else if (!Array.isArray(p.scenario.scenes)) {
    errors.push('Champ requis "scenario.scenes" doit être un tableau.');
  }

  if (!Array.isArray(p.characters)) {
    errors.push('Champ requis "characters" doit être un tableau.');
  }

  if (!Array.isArray(p.technicalSheets)) {
    errors.push('Champ requis "technicalSheets" doit être un tableau.');
  }

  if (!Array.isArray(p.localFileLinks)) {
    errors.push('Champ requis "localFileLinks" doit être un tableau.');
  }

  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  return {
    isValid: true,
    errors: [],
    projectData: raw as AutonomousProjectData,
  };
}

// ============================================================================
// Service d'Exportation & Importation Autonome
// ============================================================================

export class AutonomousProjectExporter {
  /**
   * Chiffre l'état complet du projet côté client avec AES-GCM (SubtleCrypto)
   * et retourne le package JSON prêt à être persisté ou téléchargé.
   *
   * @param project État complet du projet (scénario, fiches, liens)
   * @param passphrase Mot de passe de chiffrement défini par l'utilisateur
   * @returns Package JSON chiffré
   */
  public static async encryptProject(
    project: AutonomousProjectData,
    passphrase: string
  ): Promise<EncryptedProjectPackage> {
    if (!passphrase || passphrase.length < 6) {
      throw new Error('Le mot de passe de chiffrement doit contenir au minimum 6 caractères.');
    }

    // 1. Validation préalable du schéma
    const validation = validateProjectSchema(project);
    if (!validation.isValid) {
      throw new Error(`Schéma de projet invalide pour l'exportation : ${validation.errors.join(' ')}`);
    }

    // 2. Génération de sel cryptographique aléatoire (16 octets = 128 bits)
    const salt = crypto.getRandomValues(new Uint8Array(16));

    // 3. Génération du vecteur d'initialisation IV (12 octets recommandé pour AES-GCM)
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // 4. Dérivation de clé PBKDF2 (100 000 itérations)
    const iterations = 100000;
    const cryptoKey = await deriveKeyFromPassphrase(passphrase, salt, iterations);

    // 5. Encodage du payload JSON en UTF-8
    const encoder = new TextEncoder();
    const plainJson = JSON.stringify(project, null, 2);
    const plainBuffer = encoder.encode(plainJson);

    // 6. Chiffrement AES-GCM (intègre le tag d'authentification)
    const cipherBuffer = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      cryptoKey,
      plainBuffer
    );

    // 7. Assemblage du package final
    return {
      format: 'ALPHABETTE_SOVEREIGN_ENCRYPTED_PROJECT',
      version: '1.0.0',
      encryption: {
        algorithm: 'AES-GCM',
        keyLengthBits: 256,
        kdf: 'PBKDF2',
        kdfHash: 'SHA-256',
        iterations,
      },
      saltBase64: arrayBufferToBase64(salt.buffer),
      ivBase64: arrayBufferToBase64(iv.buffer),
      ciphertextBase64: arrayBufferToBase64(cipherBuffer),
      manifest: {
        projectName: project.projectName,
        projectId: project.projectId,
        exportedAt: new Date().toISOString(),
        sceneCount: project.scenario.scenes.length,
        characterCount: project.characters.length,
        fileLinksCount: project.localFileLinks.length,
      },
    };
  }

  /**
   * Déchiffre un package de projet chiffré et valide rigoureusement son schéma.
   *
   * @param encryptedPackage Objet chiffré ou chaîne JSON
   * @param passphrase Mot de passe de déchiffrement fourni par l'utilisateur
   * @returns État du projet validé
   */
  public static async decryptAndImportProject(
    encryptedPackage: EncryptedProjectPackage | string,
    passphrase: string
  ): Promise<AutonomousProjectData> {
    const pkg: EncryptedProjectPackage = typeof encryptedPackage === 'string'
      ? JSON.parse(encryptedPackage)
      : encryptedPackage;

    if (pkg.format !== 'ALPHABETTE_SOVEREIGN_ENCRYPTED_PROJECT') {
      throw new Error('Format de fichier non reconnu. Ce document n\'est pas un export chiffré valide.');
    }

    // 1. Décodage des buffers Base64
    const saltBuffer = base64ToArrayBuffer(pkg.saltBase64);
    const ivBuffer = base64ToArrayBuffer(pkg.ivBase64);
    const cipherBuffer = base64ToArrayBuffer(pkg.ciphertextBase64);

    // 2. Dérivation de la clé avec le même sel et nombre d'itérations
    const iterations = pkg.encryption?.iterations || 100000;
    const cryptoKey = await deriveKeyFromPassphrase(
      passphrase,
      new Uint8Array(saltBuffer),
      iterations
    );

    // 3. Déchiffrement AES-GCM (lève une exception si mot de passe erroné ou données corrompues)
    let decryptedBuffer: ArrayBuffer;
    try {
      decryptedBuffer = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: new Uint8Array(ivBuffer),
        },
        cryptoKey,
        cipherBuffer
      );
    } catch {
      throw new Error('Mot de passe incorrect ou fichier corrompu (Échec d\'authentification AES-GCM).');
    }

    // 4. Décodage texte et parsing JSON
    const decoder = new TextDecoder();
    const jsonString = decoder.decode(decryptedBuffer);
    const parsedData = JSON.parse(jsonString);

    // 5. Validation de conformité du schéma
    const validation = validateProjectSchema(parsedData);
    if (!validation.isValid) {
      throw new Error(`Le fichier déchiffré ne respecte pas le schéma du projet : ${validation.errors.join(', ')}`);
    }

    return validation.projectData!;
  }

  /**
   * Déclenche directement le téléchargement d'un fichier JSON chiffré dans le navigateur.
   */
  public static triggerFileDownload(
    data: EncryptedProjectPackage | AutonomousProjectData,
    fileName: string = 'projet_souverain.alphabette.json'
  ): void {
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }
}
