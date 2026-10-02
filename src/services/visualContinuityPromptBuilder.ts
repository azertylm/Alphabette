/**
 * @file visualContinuityPromptBuilder.ts
 * Module utilitaire pour Alphabette Studio :
 * Générateur de prompts de continuité visuelle optimisés pour les modèles d'animation
 * vidéo haute fidélité (Wan2GP, MiniMax Hailuo H3, CogVideoX, HunyuanVideo, Kling).
 *
 * Objectifs :
 * - Verrouiller strictement l'identité du personnage (traits, âge, visage, coiffure, vêtements immuables).
 * - Verrouiller les paramètres techniques cinématographiques (cadrage, focale, éclairage, ratio 16:9, colorimétrie, shutter angle).
 * - Compiler un prompt d'action fluide en anglais professionnel avec negative prompts anti-dérive.
 */

// ============================================================================
// Types stricts
// ============================================================================

export type FramingType =
  | 'extreme_close_up'
  | 'close_up'
  | 'medium_close_up'
  | 'medium_shot'
  | 'cowboy_shot'
  | 'full_body'
  | 'wide_shot';

export type CameraMovement =
  | 'static_locked'
  | 'slow_pan_right'
  | 'slow_pan_left'
  | 'slow_push_in'
  | 'dolly_zoom'
  | 'handheld_subtle'
  | 'orbital_tracking';

export type LightingStyle =
  | 'cinematic_soft_rembrandt'
  | 'dramatic_chiaroscuro'
  | 'golden_hour_warm'
  | 'overcast_diffused'
  | 'cyberpunk_neon_moody'
  | 'studio_high_key';

export type AspectRatio = '16:9' | '9:16' | '2.39:1' | '1:1' | '4:3';

export type TargetVideoModel = 'wan2gp' | 'minimax_h3' | 'cogvideox' | 'hunyuan_video' | 'general';

export interface CharacterSheet {
  /** Identifiant unique ou nom du personnage (ex: 'Jean Moreau') */
  name: string;
  /** Âge précis et allure (ex: '38 years old, weathered yet sharp gaze') */
  age: string | number;
  /** Caractéristiques anatomiques et faciales immuables (ex: 'piercing hazel eyes, sharp angular jawline, short salt-and-pepper hair') */
  facialFeatures: string;
  /** Morphologie / stature (ex: '182cm tall, athletic lean build, upright posture') */
  buildAndStature?: string;
  /** Tenue vestimentaire immuable / verrouillée (ex: 'tailored charcoal wool overcoat, crisp white oxford collar, black leather watch') */
  lockedOutfit: string;
  /** Signes distinctifs (ex: 'faint crescent scar above left eyebrow') */
  distinctiveMarks?: string;
  /** Origine ethnique / tonalité de peau pour éviter les dérives de génération */
  skinToneAndEthnicity?: string;
}

export interface ShotActionOptions {
  /** Description de l'action ou du mouvement (ex: 'looks down at an architectural blueprint on the table, points finger at solar azimuth, then raises gaze toward window') */
  action: string;
  /** Émotion / micro-expressions (ex: 'subtle contemplative smile turning into focused determination') */
  emotion?: string;
  /** Décor ou arrière-plan immédiat (ex: 'solar engineering design studio, soft evening twilight through floor-to-ceiling glass windows') */
  environment?: string;
  /** Cadrage souhaité */
  framing?: FramingType;
  /** Mouvement de caméra */
  cameraMovement?: CameraMovement;
  /** Style d'éclairage cinématographique */
  lighting?: LightingStyle;
  /** Ratio d'aspect */
  aspectRatio?: AspectRatio;
  /** Focale optique simulée (ex: '50mm anamorphic prime lens, T1.5') */
  lensFocalLength?: string;
  /** Cadence d'images cible (ex: '24fps') */
  framerateFps?: number;
  /** Modèle vidéo visé */
  targetModel?: TargetVideoModel;
  /** Niveau de verrouillage de cohérence (seed lock / continuity weight) */
  consistencyWeight?: 'ultra_strict' | 'balanced' | 'dynamic';
}

export interface CompiledContinuityPrompt {
  /** Prompt principal en anglais optimisé pour Wan2GP / MiniMax H3 */
  positivePrompt: string;
  /** Negative prompt blindé contre les dérives anatomiques et de vêtements */
  negativePrompt: string;
  /** Paramètres de génération recommandés (focale, ratio, fps, motion score) */
  parameters: {
    aspectRatio: AspectRatio;
    fps: number;
    motionStrength: number;
    cameraDirective: string;
    lightingDirective: string;
    lockedIdentityTag: string;
  };
  /** Prompt compact monoligne pour copié-collé direct en CLI / WebUI */
  fullCliString: string;
}

// ============================================================================
// Dictionnaires de directives cinématographiques
// ============================================================================

const FRAMING_DIRECTIVES: Record<FramingType, string> = {
  extreme_close_up: 'Extreme close-up shot focused on eyes and facial micro-expressions',
  close_up: 'Cinematic tight close-up shot framed from collarbone to top of head',
  medium_close_up: 'Medium close-up shot framed from chest up, keeping eye-line on upper third',
  medium_shot: 'Medium shot framed from waist up, showing body language and immediate desk props',
  cowboy_shot: 'American cowboy shot framed from mid-thigh up, stable balance',
  full_body: 'Full-body wide portrait shot showing complete stance, head to footwear',
  wide_shot: 'Environmental wide cinematic shot positioning subject in architecture',
};

const CAMERA_DIRECTIVES: Record<CameraMovement, string> = {
  static_locked: 'Locked tripod shot, zero artificial camera shake, zero pan jitter',
  slow_pan_right: 'Smooth motorized dolly pan to the right at 0.5m/s with fluid parallax',
  slow_pan_left: 'Smooth motorized dolly pan to the left at 0.5m/s with fluid parallax',
  slow_push_in: 'Slow subtle cinematic push-in (dolly in) intensifying subject focus',
  dolly_zoom: 'Subtle Vertigo Hitchcock dolly zoom effect, background compressing',
  handheld_subtle: 'Organic subtle handheld steadicam movement, natural human breath sway',
  orbital_tracking: 'Slow 15-degree orbital tracking arc around subject, maintaining eye focus',
};

const LIGHTING_DIRECTIVES: Record<LightingStyle, string> = {
  cinematic_soft_rembrandt: 'Rembrandt key lighting with soft diffused fill, subtle triangle highlight on cheek, natural soft shadows, 4500K balanced color temperature',
  dramatic_chiaroscuro: 'High contrast chiaroscuro lighting, deep shadows, single hard directional key light, moody cinematic gradient',
  golden_hour_warm: 'Warm low-angle sunset golden hour backlight, soft volumetric sun rays, rim lighting separating character from background, 3200K warm hues',
  overcast_diffused: 'Natural Scandinavian overcast sky, omnidirectional soft diffused lighting, no harsh specular highlights, neutral 5600K color rendition',
  cyberpunk_neon_moody: 'Moody architectural lighting, cyan key edge light with magenta rim accents, realistic environmental reflections',
  studio_high_key: 'Commercial studio high-key illumination, balanced softboxes, crisp clarity, clean shadow roll-off',
};

const DEFAULT_NEGATIVE_PROMPT = 
  'morphing face, changing clothes, disappearing wardrobe, changing hair length, extra fingers, malformed hands, mutated limbs, flickering background, temporal distortion, jittering artifacts, color shift between frames, double heads, morphing jacket, plastic skin texture, cartoonish render, oversaturated video, blown out highlights, low resolution compression artifacts, blurry motion blur, jitter, watermarks';

// ============================================================================
// Compilateur principal
// ============================================================================

/**
 * Compile un prompt de continuité visuelle pour modèles d'animation vidéo.
 *
 * @param character Fiche du personnage avec traits et vêtements verrouillés
 * @param options Action, cadrage, éclairage et modèle cible
 * @returns Objet complet contenant positive prompt, negative prompt et directives
 */
export function buildVisualContinuityPrompt(
  character: CharacterSheet,
  options: ShotActionOptions
): CompiledContinuityPrompt {
  const framing = options.framing || 'medium_close_up';
  const cameraMovement = options.cameraMovement || 'static_locked';
  const lighting = options.lighting || 'cinematic_soft_rembrandt';
  const aspectRatio = options.aspectRatio || '16:9';
  const lens = options.lensFocalLength || '50mm prime anamorphic lens, T1.8';
  const fps = options.framerateFps || 24;
  const targetModel = options.targetModel || 'wan2gp';

  // 1. Identité verrouillée immuable
  const ageStr = typeof character.age === 'number' ? `${character.age} years old` : character.age;
  const identityClause = [
    `Photorealistic live-action cinema footage of ${character.name}`,
    `exact age: ${ageStr}`,
    character.skinToneAndEthnicity ? `complexion: ${character.skinToneAndEthnicity}` : null,
    `locked facial structure: ${character.facialFeatures}`,
    character.buildAndStature ? `build: ${character.buildAndStature}` : null,
    character.distinctiveMarks ? `distinguishing features: ${character.distinctiveMarks}` : null,
    `IMMUTABLE LOCKED ATTIRE: perfectly identical ${character.lockedOutfit}, zero wardrobe changes across frames`,
  ].filter(Boolean).join(', ');

  // 2. Action cinématique et performance
  const emotionClause = options.emotion ? `with ${options.emotion}` : '';
  const actionClause = `Action sequence: the subject smoothly ${options.action.trim()} ${emotionClause}`.trim();

  // 3. Décor et environnement
  const envClause = options.environment
    ? `Setting environment: ${options.environment.trim()}`
    : 'Setting environment: architectural sovereign studio interior with pristine modern detailing';

  // 4. Paramètres optiques et de tournage
  const opticalClause = [
    FRAMING_DIRECTIVES[framing],
    CAMERA_DIRECTIVES[cameraMovement],
    LIGHTING_DIRECTIVES[lighting],
    `Optical profile: captured on ARRI Alexa Mini LF, ${lens}, shallow depth of field with organic bokeh roll-off, cinematic color grading, film grain texture (Kodak Vision3 500T 5219 emulation)`,
    `Framerate: ${fps}fps native, seamless temporal stability, zero morphing artifacts`,
  ].join('. ');

  // 5. Clauses d'optimisation spécifiques au modèle vidéo
  let modelSpecificSuffix = '';
  let motionStrength = 5.0;

  switch (targetModel) {
    case 'wan2gp':
      modelSpecificSuffix = 'Wan2.1 video engine, high fidelity motion trajectory, strict facial identity preservation, clean vector flow, no prompt bleeding.';
      motionStrength = 4.8;
      break;
    case 'minimax_h3':
      modelSpecificSuffix = 'MiniMax Hailuo H3 video format, cinematic camera physics, ultra-consistent cloth wrinkles and material physics, pristine temporal coherence.';
      motionStrength = 5.2;
      break;
    case 'cogvideox':
      modelSpecificSuffix = 'CogVideoX-5B architecture, high aesthetic score, consistent subject embeddings, zero spatial degradation.';
      motionStrength = 4.5;
      break;
    default:
      modelSpecificSuffix = 'Ultra high definition 4K master, hyper-consistent character tracking, flawless temporal consistency.';
      motionStrength = 5.0;
  }

  // 6. Assemblage du prompt positif
  const positivePrompt = [
    identityClause,
    actionClause,
    envClause,
    opticalClause,
    modelSpecificSuffix,
    `[Aspect Ratio: ${aspectRatio}]`,
  ].join('\n\n');

  // 7. Negative prompt avec renforcement de la tenue
  const negativePrompt = `${DEFAULT_NEGATIVE_PROMPT}, altered ${character.lockedOutfit}, changed hair color, morphing facial proportions`;

  // 8. Chaine de commande CLI compacte
  const fullCliString = `--prompt "${positivePrompt.replace(/\n+/g, ' ')}" --negative-prompt "${negativePrompt}" --ar ${aspectRatio} --fps ${fps} --motion-strength ${motionStrength}`;

  return {
    positivePrompt,
    negativePrompt,
    parameters: {
      aspectRatio,
      fps,
      motionStrength,
      cameraDirective: CAMERA_DIRECTIVES[cameraMovement],
      lightingDirective: LIGHTING_DIRECTIVES[lighting],
      lockedIdentityTag: `character:${character.name.toLowerCase().replace(/\s+/g, '_')}:v1`,
    },
    fullCliString,
  };
}
