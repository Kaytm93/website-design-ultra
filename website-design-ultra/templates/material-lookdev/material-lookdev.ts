/**
 * The copyable, typed look-development contract used by the lab fixture.
 *
 * Values are authored PBR fields, not a palette. A base color is always safe to
 * use on MeshStandardMaterial; only an explicitly enabled physical feature
 * promotes a surface to MeshPhysicalMaterial.
 *
 * @module
 */

export type MaterialRecipeName = 'ice' | 'frost' | 'glass' | 'metal' | 'matte';
export type MaterialClass = 'MeshStandardMaterial' | 'MeshPhysicalMaterial';

export interface MaterialFields {
  baseColor: string;
  roughness: number;
  metalness: number;
  envMapIntensity: number;
  transmission: number;
  ior: number;
  thickness: number;
  attenuationColor: string;
  attenuationDistance: number;
  clearcoat: number;
  clearcoatRoughness: number;
  iridescence: number;
  iridescenceIOR: number;
  normalScale: number;
}

export type MaterialRecipe = Readonly<MaterialFields>;

/** Fields that can activate MeshPhysicalMaterial behaviour. */
export const PHYSICAL_FEATURE_FIELDS = [
  'transmission',
  'ior',
  'thickness',
  'attenuationColor',
  'attenuationDistance',
  'clearcoat',
  'clearcoatRoughness',
  'iridescence',
  'iridescenceIOR',
] as const;

/**
 * Five intentionally different starting points for look development.
 *
 * The values are restrained defaults, not a permission to combine every
 * feature. A project selects one recipe and changes only the fields its visual
 * thesis needs.
 */
export const MATERIAL_RECIPES: Record<MaterialRecipeName, MaterialRecipe> = {
  ice: {
    baseColor: '#b8e8ff',
    roughness: 0.16,
    metalness: 0,
    envMapIntensity: 1.15,
    transmission: 0.72,
    ior: 1.31,
    thickness: 0.34,
    attenuationColor: '#8bc8e8',
    attenuationDistance: 1.6,
    clearcoat: 0.22,
    clearcoatRoughness: 0.1,
    iridescence: 0.08,
    iridescenceIOR: 1.31,
    normalScale: 0.06,
  },
  frost: {
    baseColor: '#d7e6ed',
    roughness: 0.6,
    metalness: 0,
    envMapIntensity: 0.82,
    transmission: 0.24,
    ior: 1.31,
    thickness: 0.16,
    attenuationColor: '#c3dce6',
    attenuationDistance: 0.8,
    clearcoat: 0.05,
    clearcoatRoughness: 0.42,
    iridescence: 0,
    iridescenceIOR: 1.31,
    normalScale: 0.18,
  },
  glass: {
    baseColor: '#dff7ff',
    roughness: 0.04,
    metalness: 0,
    envMapIntensity: 1.35,
    transmission: 0.92,
    ior: 1.5,
    thickness: 0.12,
    attenuationColor: '#d9f4ff',
    attenuationDistance: 3.8,
    clearcoat: 0.12,
    clearcoatRoughness: 0.04,
    iridescence: 0,
    iridescenceIOR: 1.5,
    normalScale: 0,
  },
  metal: {
    baseColor: '#aeb9c6',
    roughness: 0.24,
    metalness: 1,
    envMapIntensity: 1.1,
    transmission: 0,
    ior: 1.5,
    thickness: 0,
    attenuationColor: '#ffffff',
    attenuationDistance: 1,
    clearcoat: 0,
    clearcoatRoughness: 0.18,
    iridescence: 0,
    iridescenceIOR: 1.5,
    normalScale: 0.03,
  },
  matte: {
    baseColor: '#e5ded3',
    roughness: 0.88,
    metalness: 0,
    envMapIntensity: 0.32,
    transmission: 0,
    ior: 1.5,
    thickness: 0,
    attenuationColor: '#ffffff',
    attenuationDistance: 1,
    clearcoat: 0,
    clearcoatRoughness: 0.5,
    iridescence: 0,
    iridescenceIOR: 1.5,
    normalScale: 0.02,
  },
};

/**
 * A color, roughness, or metalness change is not a physical feature by itself.
 * Physical shading is enabled only by a positive feature that needs the
 * MeshPhysicalMaterial implementation.
 */
export function hasPhysicalFeature(fields: Partial<MaterialFields>): boolean {
  return (
    (fields.transmission ?? 0) > 0 ||
    (fields.thickness ?? 0) > 0 ||
    (fields.clearcoat ?? 0) > 0 ||
    (fields.iridescence ?? 0) > 0
  );
}

export function materialClassFor(fields: Partial<MaterialFields>): MaterialClass {
  return hasPhysicalFeature(fields) ? 'MeshPhysicalMaterial' : 'MeshStandardMaterial';
}

export type EnvironmentTierName = 'poster' | 'low' | 'medium' | 'high';

export interface EnvironmentTier {
  readonly label: string;
  readonly maxTextureSize: number;
  readonly maxSpecularSamples: number;
  readonly dynamic: boolean;
  readonly source: 'poster' | 'procedural';
  readonly lightIntensity: number;
}

/**
 * Environment is a cost tier, not a reason to load an HDRI unconditionally.
 * Poster and low are deterministic static representations; medium and high
 * permit a procedural reflection environment when the scene budget allows it.
 */
export const ENVIRONMENT_TIERS: Record<EnvironmentTierName, EnvironmentTier> = {
  poster: {
    label: 'Poster / static key visual',
    maxTextureSize: 0,
    maxSpecularSamples: 0,
    dynamic: false,
    source: 'poster',
    lightIntensity: 0.55,
  },
  low: {
    label: 'Low / compact static environment',
    maxTextureSize: 256,
    maxSpecularSamples: 1,
    dynamic: false,
    source: 'procedural',
    lightIntensity: 0.72,
  },
  medium: {
    label: 'Medium / balanced reflections',
    maxTextureSize: 512,
    maxSpecularSamples: 2,
    dynamic: true,
    source: 'procedural',
    lightIntensity: 0.9,
  },
  high: {
    label: 'High / authored reflection detail',
    maxTextureSize: 1024,
    maxSpecularSamples: 4,
    dynamic: true,
    source: 'procedural',
    lightIntensity: 1.05,
  },
};
