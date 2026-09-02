/**
 * Material look-development lab fixture.
 *
 * One scene shows the five authored recipes side by side and lets a reviewer
 * switch the selected recipe and environment tier. Physical fields are applied
 * to MeshPhysicalMaterial only when a recipe actually enables them; a base
 * color alone remains a MeshStandardMaterial input.
 *
 * @module
 */

import * as THREE from 'three';
import { createStableFrameMarker } from '@wdu-references/determinism-runtime.ts';
import type { ExperimentContext } from '../main.js';
import {
  ENVIRONMENT_TIERS,
  MATERIAL_RECIPES,
  hasPhysicalFeature,
  materialClassFor,
  type EnvironmentTierName,
  type MaterialFields,
  type MaterialRecipeName,
} from '../modules/material-lookdev.js';

const RECIPE_NAMES: MaterialRecipeName[] = ['ice', 'frost', 'glass', 'metal', 'matte'];
const TIER_NAMES: EnvironmentTierName[] = ['poster', 'low', 'medium', 'high'];

function addOption(select: HTMLSelectElement, value: string, label: string): void {
  const option = document.createElement('option');
  option.value = value;
  option.textContent = label;
  select.appendChild(option);
}

function createEnvironmentTexture(tier: EnvironmentTierName): THREE.DataTexture | null {
  const config = ENVIRONMENT_TIERS[tier];
  if (config.source === 'poster' || config.maxTextureSize === 0) return null;

  // The fixture uses a tiny deterministic equirectangular environment. The tier
  // still exposes the production ceiling; it does not download an HDRI merely
  // because the page has a 3D canvas.
  const width = tier === 'high' ? 32 : tier === 'medium' ? 16 : 8;
  const height = width / 2;
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    const vertical = y / Math.max(height - 1, 1);
    for (let x = 0; x < width; x += 1) {
      const horizontal = x / Math.max(width - 1, 1);
      const index = (y * width + x) * 4;
      data[index] = Math.round(18 + 48 * horizontal);
      data[index + 1] = Math.round(28 + 68 * (1 - vertical));
      data[index + 2] = Math.round(42 + 82 * (1 - horizontal * 0.45));
      data[index + 3] = 255;
    }
  }

  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

function setCommonMaterialFields(
  material: THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial,
  fields: MaterialFields,
): void {
  material.color.set(fields.baseColor);
  material.roughness = fields.roughness;
  material.metalness = fields.metalness;
  material.envMapIntensity = fields.envMapIntensity;
  material.normalScale.setScalar(fields.normalScale);

  if (material instanceof THREE.MeshPhysicalMaterial) {
    material.transmission = fields.transmission;
    material.ior = fields.ior;
    material.thickness = fields.thickness;
    material.attenuationColor.set(fields.attenuationColor);
    material.attenuationDistance = fields.attenuationDistance;
    material.clearcoat = fields.clearcoat;
    material.clearcoatRoughness = fields.clearcoatRoughness;
    material.iridescence = fields.iridescence;
    material.iridescenceIOR = fields.iridescenceIOR;
  }
  material.needsUpdate = true;
}

function createMaterial(fields: MaterialFields): THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial {
  const material = hasPhysicalFeature(fields)
    ? new THREE.MeshPhysicalMaterial()
    : new THREE.MeshStandardMaterial();
  setCommonMaterialFields(material, fields);
  return material;
}

function makeControl(label: string): HTMLLabelElement {
  const wrapper = document.createElement('label');
  wrapper.style.cssText = 'display:flex;flex-direction:column;gap:4px;font-size:11px;color:#d1d7e3;';
  const text = document.createElement('span');
  text.textContent = label;
  wrapper.appendChild(text);
  return wrapper;
}

export function mount(ctx: ExperimentContext): void {
  const { root, clock, deterministic, controlsEl } = ctx;
  root.dataset.wduLookdevRoute = 'lookdev';
  root.dataset.wduLookdevRecipes = RECIPE_NAMES.join(',');
  root.dataset.wduLookdevPhysicalFields = [
    'transmission',
    'ior',
    'thickness',
    'attenuationColor',
    'attenuationDistance',
    'clearcoat',
    'clearcoatRoughness',
    'iridescence',
    'iridescenceIOR',
  ].join(',');
  root.dataset.wduLookdevEnvironmentTiers = TIER_NAMES.join(',');
  root.dataset.wduLookdevStandardColorPhysics = 'false';
  root.dataset.wduLookdevNoGenericPath = 'true';
  root.setAttribute('data-wdu-lookdev-ready', 'false');

  const poster = document.createElement('div');
  poster.dataset.testid = 'lookdev-poster';
  poster.textContent = 'Material lookdev poster';
  poster.style.cssText = [
    'position:absolute',
    'inset:0',
    'display:grid',
    'place-items:center',
    'color:#cfe9ff',
    'font:600 14px ui-monospace,monospace',
    'letter-spacing:.08em',
    'background:radial-gradient(circle at 50% 36%, #25445f, #080d16 62%)',
    'pointer-events:none',
  ].join(';');
  root.appendChild(poster);

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    preserveDrawingBuffer: deterministic,
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.setSize(Math.max(root.clientWidth, 1), Math.max(root.clientHeight, 1));
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.domElement.setAttribute('aria-hidden', 'true');
  renderer.domElement.dataset.wduLookdevCanvas = 'decorative';
  root.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#08111d');
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 50);
  camera.position.set(0, 0.8, 8.4);
  camera.lookAt(0, 0.35, 0);

  const key = new THREE.DirectionalLight('#e8f4ff', 3.0);
  key.position.set(-3, 5, 4);
  scene.add(key);
  const fill = new THREE.HemisphereLight('#9ecbff', '#131b2a', 1.1);
  scene.add(fill);
  const rim = new THREE.DirectionalLight('#8cc9ff', 1.8);
  rim.position.set(4, 2, -4);
  scene.add(rim);

  const stage = new THREE.Mesh(
    new THREE.CylinderGeometry(4.8, 5.2, 0.22, 64),
    new THREE.MeshStandardMaterial({ color: '#111b28', roughness: 0.9, metalness: 0 }),
  );
  stage.position.y = -1.05;
  scene.add(stage);

  const geometry = new THREE.IcosahedronGeometry(0.82, 5);
  const surfaces: Array<{
    name: MaterialRecipeName;
    mesh: THREE.Mesh<THREE.IcosahedronGeometry, THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial>;
  }> = [];
  const group = new THREE.Group();
  scene.add(group);

  for (const [index, name] of RECIPE_NAMES.entries()) {
    const mesh = new THREE.Mesh(geometry, createMaterial(MATERIAL_RECIPES[name]));
    mesh.position.x = (index - 2) * 1.65;
    mesh.position.y = Math.sin(index * 1.4) * 0.08;
    group.add(mesh);
    surfaces.push({ name, mesh });
  }

  let selectedName: MaterialRecipeName = 'ice';
  let tierName: EnvironmentTierName = 'medium';
  let environmentTexture: THREE.DataTexture | null = null;
  let reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

  const status = document.createElement('div');
  status.dataset.testid = 'lookdev-status';
  status.style.cssText = 'position:absolute;left:18px;top:18px;z-index:2;color:#d7edff;font:12px ui-monospace,monospace;line-height:1.5;text-shadow:0 1px 8px #000;';
  root.appendChild(status);

  function updateStatus(): void {
    const fields = MATERIAL_RECIPES[selectedName];
    status.textContent = `${selectedName} · ${materialClassFor(fields)} · ${tierName}`;
    root.dataset.wduLookdevSelected = selectedName;
    root.dataset.wduLookdevMaterialClass = materialClassFor(fields);
    root.dataset.wduLookdevPhysicalEnabled = String(hasPhysicalFeature(fields));
    root.dataset.wduLookdevEnvironmentTier = tierName;
    root.dataset.wduLookdevReducedMotion = String(reducedMotion);
  }

  function applyEnvironment(nextTier: EnvironmentTierName): void {
    tierName = nextTier;
    const config = ENVIRONMENT_TIERS[nextTier];
    if (environmentTexture) {
      environmentTexture.dispose();
      environmentTexture = null;
    }
    environmentTexture = createEnvironmentTexture(nextTier);
    scene.environment = environmentTexture;
    scene.background = new THREE.Color(nextTier === 'poster' ? '#111827' : '#08111d');
    fill.intensity = config.lightIntensity;
    // Environment tiers change reflection cost, never the art-direction exposure.
    renderer.toneMappingExposure = 1;
    poster.hidden = nextTier !== 'poster';
    updateStatus();
  }

  function selectRecipe(nextName: MaterialRecipeName): void {
    selectedName = nextName;
    for (const surface of surfaces) {
      const selected = surface.name === selectedName;
      surface.mesh.scale.setScalar(selected ? 1.12 : 0.82);
      surface.mesh.position.z = selected ? 0.24 : 0;
    }
    updateStatus();
  }

  controlsEl.innerHTML = '';
  controlsEl.style.cssText = 'display:flex;flex-direction:column;gap:8px;';
  const recipeControl = makeControl('material recipe');
  const recipeSelect = document.createElement('select');
  recipeSelect.dataset.testid = 'lookdev-recipe';
  for (const name of RECIPE_NAMES) addOption(recipeSelect, name, name);
  recipeSelect.value = selectedName;
  recipeSelect.addEventListener('change', () => selectRecipe(recipeSelect.value as MaterialRecipeName));
  recipeControl.appendChild(recipeSelect);
  controlsEl.appendChild(recipeControl);

  const environmentControl = makeControl('environment tiers');
  const environmentSelect = document.createElement('select');
  environmentSelect.dataset.testid = 'lookdev-environment';
  for (const name of TIER_NAMES) addOption(environmentSelect, name, `${name} · ${ENVIRONMENT_TIERS[name].label}`);
  environmentSelect.value = tierName;
  environmentSelect.addEventListener('change', () => applyEnvironment(environmentSelect.value as EnvironmentTierName));
  environmentControl.appendChild(environmentSelect);
  controlsEl.appendChild(environmentControl);

  const motionControl = makeControl('reduced motion');
  const motionInput = document.createElement('input');
  motionInput.type = 'checkbox';
  motionInput.checked = reducedMotion;
  motionInput.addEventListener('change', () => {
    reducedMotion = motionInput.checked;
    updateStatus();
  });
  motionControl.appendChild(motionInput);
  controlsEl.appendChild(motionControl);

  const stableFrame = deterministic
    ? createStableFrameMarker({ target: document.documentElement, stableFrame: 3 })
    : null;
  let frame = 0;
  function animate(): void {
    if (deterministic && stableFrame?.ready) return;
    clock.tick();
    if (!reducedMotion) group.rotation.y = Math.sin(clock.elapsed * 0.42) * 0.08;
    renderer.render(scene, camera);
    frame += 1;
    poster.hidden = tierName !== 'poster';
    if (deterministic && stableFrame) {
      stableFrame.afterVisibleRender({
        frame,
        assetsReady: true,
        cameraStationApplied: true,
        streamsInitialized: true,
      });
    }
    requestAnimationFrame(animate);
  }

  function onResize(): void {
    const width = Math.max(root.clientWidth, 1);
    const height = Math.max(root.clientHeight, 1);
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    if (width < 680) {
      camera.position.z = 10.8;
      group.scale.setScalar(0.82);
    } else {
      camera.position.z = 8.4;
      group.scale.setScalar(1);
    }
    camera.lookAt(0, 0.35, 0);
  }
  window.addEventListener('resize', onResize);
  renderer.domElement.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    poster.hidden = false;
    poster.textContent = 'Material lookdev fallback';
    root.dataset.wduLookdevFallback = 'context-loss';
  });

  applyEnvironment(tierName);
  selectRecipe(selectedName);
  onResize();
  poster.hidden = true;
  root.dataset.wduLookdevReady = 'true';
  root.setAttribute('data-wdu-lookdev-ready', 'true');
  animate();
}
