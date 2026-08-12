import * as THREE from './vendor/three.module.min.js';

const stage = document.querySelector('[data-hero-cells]');

if (stage) {
  const section = stage.closest('[data-spatial-intro]');
  const visual = stage.closest('.hero-visual');
  const progressBar = section.querySelector('[data-hero-progress]');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const coarsePointer = window.matchMedia('(pointer: coarse)');

  const CONFIG = {
    coordinateStart: 0.02,
    coordinateEnd: 0.56,
    depthStart: 0.48,
    depthEnd: 0.82,
    rotationStart: 0.5,
    rotationEnd: 0.94,
    trajectoryCurve: 0.075,
    easing: 0.14,
    pointerRadius: 0.18,
    pointerDisplacement: 0.045,
    volumeDepth: 0.72,
    maxDpr: 1.75
  };

  const pointer = {
    x: 0.5,
    y: 0.5,
    lastX: 0.5,
    lastY: 0.5,
    lastTime: 0,
    active: false,
    energy: 0
  };

  let renderer;
  let scene;
  let camera;
  let cloud;
  let material;
  let geometry;
  let particles = [];
  let dataSource;
  let positionAttribute;
  let alphaAttribute;
  let width = 1;
  let height = 1;
  let targetProgress = 0;
  let renderedProgress = 0;
  let animationFrame = 0;
  let ready = false;
  let sectionVisible = true;
  let navigationSkipping = false;
  let navigationFrame = 0;

  stage.dataset.status = 'loading';

  function clamp(value, minimum = 0, maximum = 1) {
    return Math.max(minimum, Math.min(maximum, value));
  }

  function smoothstep(value) {
    const clamped = clamp(value);
    return clamped * clamped * (3 - 2 * clamped);
  }

  function smootherstep(value) {
    const clamped = clamp(value);
    return clamped ** 3 * (clamped * (clamped * 6 - 15) + 10);
  }

  function mix(start, end, progress) {
    return start + (end - start) * progress;
  }

  function hashIdentity(identity) {
    let hash = 2166136261;
    for (let index = 0; index < identity.length; index += 1) {
      hash ^= identity.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0) / 4294967295;
  }

  function worldScale() {
    const aspect = width / Math.max(1, height);
    return {
      x: Math.min(3.2, 2.45 * aspect),
      y: 2.14
    };
  }

  function toWorld(normalizedX, normalizedY) {
    const scale = worldScale();
    return {
      x: (normalizedX - 0.5) * scale.x,
      y: (0.5 - normalizedY) * scale.y
    };
  }

  function trajectory(cell, progress) {
    const stagger = hashIdentity(cell.id) * 0.045;
    const localProgress = smootherstep(
      (progress - CONFIG.coordinateStart - stagger)
      / (CONFIG.coordinateEnd - CONFIG.coordinateStart - stagger)
    );
    const dx = cell.spatialX - cell.umapX;
    const dy = cell.spatialY - cell.umapY;
    const distance = Math.max(0.001, Math.hypot(dx, dy));
    const direction = (hashIdentity(`${cell.id}:curve`) - 0.5) * 2;
    const curve = Math.min(distance * 0.18, CONFIG.trajectoryCurve) * direction;
    const controlX = (cell.umapX + cell.spatialX) * 0.5 - (dy / distance) * curve;
    const controlY = (cell.umapY + cell.spatialY) * 0.5 + (dx / distance) * curve;
    const inverse = 1 - localProgress;
    return {
      x: inverse ** 2 * cell.umapX
        + 2 * inverse * localProgress * controlX
        + localProgress ** 2 * cell.spatialX,
      y: inverse ** 2 * cell.umapY
        + 2 * inverse * localProgress * controlY
        + localProgress ** 2 * cell.spatialY
    };
  }

  function createParticleRecords(data) {
    const compact = stage.clientWidth <= 620;
    const layers = compact ? [-2, -1, 0, 1, 2] : [-3, -2, -1, 0, 1, 2, 3];
    const typeMap = new Map(data.metadata.cellTypes.map((type) => [type.key, type]));
    const records = [];

    data.cells.forEach((cell) => {
      layers.forEach((layer) => {
        const absoluteLayer = Math.abs(layer);
        const keep = hashIdentity(`${cell.id}:${layer}:keep`);
        const skipThreshold = compact ? 0.22 + absoluteLayer * 0.035 : 0.1 + absoluteLayer * 0.025;
        if (layer !== 0 && keep < skipThreshold) return;

        const type = typeMap.get(cell.cellType);
        const highlighted = cell.cellType === 'b_cell' || cell.cellType === 'treg';
        const supporting = cell.cellType === 'stromal' || cell.cellType === 'epithelial';
        const jitter = absoluteLayer * 0.012 + 0.004;
        const jitterX = (hashIdentity(`${cell.id}:${layer}:x`) - 0.5) * jitter * 2;
        const jitterY = (hashIdentity(`${cell.id}:${layer}:y`) - 0.5) * jitter * 2;
        const layerCurve = Math.sin(cell.spatialY * 8 + layer * 1.35) * absoluteLayer * 0.0045;
        const zJitter = (hashIdentity(`${cell.id}:${layer}:z`) - 0.5) * 0.11;
        const targetAlpha = layer === 0
          ? (highlighted ? 0.98 : supporting ? 0.7 : 0.84)
          : (highlighted ? 0.7 : supporting ? 0.42 : 0.56) * (0.78 + keep * 0.22);
        const baseSize = highlighted ? 3.15 : supporting ? 2.15 : 2.6;

        records.push({
          cell,
          color: new THREE.Color(type.color),
          layer,
          absoluteLayer,
          finalX: clamp(cell.spatialX + jitterX + layerCurve, 0.02, 0.98),
          finalY: clamp(cell.spatialY + jitterY, 0.03, 0.97),
          finalZ: (layer / Math.max(...layers.map(Math.abs))) * CONFIG.volumeDepth + zJitter,
          delay: absoluteLayer * 0.018 + hashIdentity(`${cell.id}:${layer}:delay`) * 0.028,
          phase: hashIdentity(`${cell.id}:${layer}:phase`) * Math.PI * 2,
          targetAlpha,
          size: baseSize * (layer === 0 ? 1 : 0.72 + keep * 0.18)
        });
      });
    });

    return records;
  }

  function createCloud(data) {
    particles = createParticleRecords(data);
    const positions = new Float32Array(particles.length * 3);
    const colors = new Float32Array(particles.length * 3);
    const sizes = new Float32Array(particles.length);
    const alphas = new Float32Array(particles.length);

    particles.forEach((particle, index) => {
      colors[index * 3] = particle.color.r;
      colors[index * 3 + 1] = particle.color.g;
      colors[index * 3 + 2] = particle.color.b;
      sizes[index] = particle.size;
      alphas[index] = particle.layer === 0 ? particle.targetAlpha : 0;
    });

    geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1).setUsage(THREE.DynamicDrawUsage));
    positionAttribute = geometry.getAttribute('position');
    alphaAttribute = geometry.getAttribute('aAlpha');

    material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: true,
      vertexColors: true,
      uniforms: {
        uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, CONFIG.maxDpr) }
      },
      vertexShader: `
        attribute float aSize;
        attribute float aAlpha;
        varying vec3 vColor;
        varying float vAlpha;
        uniform float uPixelRatio;

        void main() {
          vColor = color;
          vAlpha = aAlpha;
          vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * viewPosition;
          gl_PointSize = aSize * uPixelRatio * (4.6 / max(1.0, -viewPosition.z));
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vAlpha;

        void main() {
          float distanceFromCenter = distance(gl_PointCoord, vec2(0.5));
          float edge = 1.0 - smoothstep(0.36, 0.5, distanceFromCenter);
          if (edge <= 0.0 || vAlpha <= 0.002) discard;
          float centerLight = 1.0 - smoothstep(0.0, 0.52, distanceFromCenter);
          gl_FragColor = vec4(vColor * (0.9 + centerLight * 0.18), vAlpha * edge);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `
    });

    cloud = new THREE.Points(geometry, material);
    cloud.frustumCulled = false;
    scene.add(cloud);
    stage.dataset.particleCount = String(particles.length);
  }

  function disposeCloud() {
    if (!cloud) return;
    scene.remove(cloud);
    geometry.dispose();
    material.dispose();
    cloud = null;
  }

  function initializeRenderer() {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.setAttribute('aria-hidden', 'true');
    stage.appendChild(renderer.domElement);

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(35, 1, 0.1, 20);
    camera.position.set(0, 0, 4.6);
    stage.dataset.renderer = 'webgl';
  }

  function resize() {
    if (!renderer || !camera) return;
    const previousCompact = width <= 620;
    width = Math.max(1, stage.clientWidth);
    height = Math.max(1, stage.clientHeight);
    const compact = width <= 620;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, compact ? 1.5 : CONFIG.maxDpr);
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    if (material) material.uniforms.uPixelRatio.value = pixelRatio;

    if (ready && dataSource && previousCompact !== compact) {
      disposeCloud();
      createCloud(dataSource);
    }
    scheduleRender(true);
  }

  function updateParticles(progress, now) {
    const depthProgress = smootherstep(
      (progress - CONFIG.depthStart) / (CONFIG.depthEnd - CONFIG.depthStart)
    );
    const rotationProgress = smootherstep(
      (progress - CONFIG.rotationStart) / (CONFIG.rotationEnd - CONFIG.rotationStart)
    );
    const idleMotion = reducedMotion.matches ? 0 : depthProgress;
    const time = now * 0.001;

    particles.forEach((particle, index) => {
      const base = trajectory(particle.cell, progress);
      const depthT = particle.layer === 0
        ? depthProgress
        : smootherstep((depthProgress - particle.delay) / Math.max(0.001, 1 - particle.delay));
      let normalizedX = mix(base.x, particle.finalX, depthT);
      let normalizedY = mix(base.y, particle.finalY, depthT);
      const normalizedPointerX = normalizedX;
      const normalizedPointerY = normalizedY;
      const dx = normalizedPointerX - pointer.x;
      const dy = normalizedPointerY - pointer.y;
      const pointerDistance = Math.max(0.001, Math.hypot(dx, dy));
      const influence = smoothstep(1 - pointerDistance / CONFIG.pointerRadius) * pointer.energy;

      if (influence > 0) {
        const vibration = Math.sin(now * 0.026 + particle.phase) * 0.0065 * influence;
        normalizedX += (dx / pointerDistance) * CONFIG.pointerDisplacement * influence
          + Math.cos(particle.phase) * vibration;
        normalizedY += (dy / pointerDistance) * CONFIG.pointerDisplacement * influence
          + Math.sin(particle.phase) * vibration;
      }

      const world = toWorld(normalizedX, normalizedY);
      const livingDepth = Math.sin(time * 0.72 + particle.phase) * 0.012 * idleMotion;
      positionAttribute.array[index * 3] = world.x;
      positionAttribute.array[index * 3 + 1] = world.y;
      positionAttribute.array[index * 3 + 2] = particle.finalZ * depthT + livingDepth;
      alphaAttribute.array[index] = particle.layer === 0
        ? particle.targetAlpha
        : particle.targetAlpha * depthT;
    });

    positionAttribute.needsUpdate = true;
    alphaAttribute.needsUpdate = true;

    const idleYaw = Math.sin(time * 0.34) * 0.028 * idleMotion;
    const idlePitch = Math.cos(time * 0.27) * 0.014 * idleMotion;
    const pointerYaw = (pointer.x - 0.5) * 0.1 * pointer.energy;
    const pointerPitch = (pointer.y - 0.5) * 0.065 * pointer.energy;
    cloud.rotation.x = -0.14 * rotationProgress + idlePitch + pointerPitch;
    cloud.rotation.y = 0.56 * rotationProgress + idleYaw + pointerYaw;
    cloud.rotation.z = 0.075 * rotationProgress;
    cloud.position.z = -0.04 * rotationProgress;
    cloud.scale.setScalar(1 - 0.1 * rotationProgress);
    stage.dataset.state = progress < 0.34
      ? 'cell-states'
      : progress < CONFIG.depthStart
        ? 'spatial'
        : progress < CONFIG.rotationStart
          ? 'layering'
          : 'volume';
  }

  function render(progress, now) {
    if (!ready || !renderer || !cloud) return;
    updateParticles(progress, now);
    renderer.render(scene, camera);
    progressBar.style.transform = `scaleX(${progress.toFixed(4)})`;
  }

  function measureProgress() {
    if (navigationSkipping) return;
    if (reducedMotion.matches) {
      targetProgress = 1;
    } else {
      const rect = section.getBoundingClientRect();
      const scrollDistance = Math.max(1, section.offsetHeight - window.innerHeight);
      targetProgress = clamp(-rect.top / scrollDistance);
    }
    scheduleRender();
  }

  function animate(now) {
    animationFrame = 0;
    if (!ready || !sectionVisible) return;
    if (reducedMotion.matches) {
      renderedProgress = 1;
      pointer.energy = 0;
    } else {
      const difference = targetProgress - renderedProgress;
      renderedProgress = Math.abs(difference) < 0.0005
        ? targetProgress
        : renderedProgress + difference * CONFIG.easing;
      pointer.energy *= pointer.active ? 0.93 : 0.86;
    }
    render(renderedProgress, now);

    const settling = Math.abs(targetProgress - renderedProgress) >= 0.0005 || pointer.energy >= 0.004;
    const volumeIsAlive = renderedProgress >= CONFIG.rotationStart
      && !reducedMotion.matches
      && !navigationSkipping;
    if (settling || volumeIsAlive) scheduleRender();
  }

  function scheduleRender(immediate = false) {
    if (!ready || !sectionVisible) return;
    if (immediate) renderedProgress = reducedMotion.matches ? 1 : targetProgress;
    if (!animationFrame) animationFrame = window.requestAnimationFrame(animate);
  }

  function handlePointerMove(event) {
    if (coarsePointer.matches || reducedMotion.matches) return;
    const rect = visual.getBoundingClientRect();
    const now = performance.now();
    const x = clamp((event.clientX - rect.left) / rect.width);
    const y = clamp((event.clientY - rect.top) / rect.height);
    const elapsed = Math.max(16, now - pointer.lastTime);
    const speed = Math.hypot(x - pointer.lastX, y - pointer.lastY) / elapsed;
    pointer.x = x;
    pointer.y = y;
    pointer.lastX = x;
    pointer.lastY = y;
    pointer.lastTime = now;
    pointer.active = true;
    pointer.energy = clamp(Math.max(pointer.energy, 0.22 + speed * 48));
    scheduleRender();
  }

  function navigateWithoutScrubbing(event) {
    const link = event.currentTarget;
    const destination = document.querySelector(link.hash);
    if (!destination) return;

    event.preventDefault();
    navigationSkipping = true;
    pointer.active = false;
    pointer.energy = 0;
    targetProgress = renderedProgress;
    stage.dataset.navigation = 'skipping';
    window.history.pushState(null, '', link.hash);
    window.cancelAnimationFrame(navigationFrame);

    const headerHeight = document.querySelector('[data-site-header]')?.offsetHeight || 0;
    const startY = window.scrollY;
    const destinationY = Math.max(
      0,
      destination.getBoundingClientRect().top + startY - headerHeight
    );
    const distance = Math.abs(destinationY - startY);
    const duration = reducedMotion.matches ? 0 : clamp(620 + distance * 0.055, 700, 1000);

    if (duration === 0) {
      window.scrollTo({ top: destinationY, left: 0, behavior: 'instant' });
      navigationSkipping = false;
      delete stage.dataset.navigation;
      return;
    }

    const startTime = performance.now();
    const scrollStep = (now) => {
      const progress = clamp((now - startTime) / duration);
      const eased = 1 - (1 - progress) ** 2;
      window.scrollTo({
        top: mix(startY, destinationY, eased),
        left: 0,
        behavior: 'instant'
      });

      if (progress < 1) {
        navigationFrame = window.requestAnimationFrame(scrollStep);
      } else {
        navigationFrame = 0;
        navigationSkipping = false;
        delete stage.dataset.navigation;
      }
    };
    navigationFrame = window.requestAnimationFrame(scrollStep);
  }

  function createCanvasFallback(data) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    stage.replaceChildren(canvas);
    stage.dataset.renderer = 'canvas-fallback';
    stage.dataset.status = 'ready';

    function drawFallback() {
      const fallbackWidth = Math.max(1, stage.clientWidth);
      const fallbackHeight = Math.max(1, stage.clientHeight);
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = fallbackWidth * ratio;
      canvas.height = fallbackHeight * ratio;
      canvas.style.width = `${fallbackWidth}px`;
      canvas.style.height = `${fallbackHeight}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, fallbackWidth, fallbackHeight);
      data.cells.forEach((cell) => {
        context.beginPath();
        context.arc(cell.spatialX * fallbackWidth, cell.spatialY * fallbackHeight, 1.5, 0, Math.PI * 2);
        context.fillStyle = cell.color;
        context.globalAlpha = 0.82;
        context.fill();
      });
      context.globalAlpha = 1;
    }

    drawFallback();
    new ResizeObserver(drawFallback).observe(stage);
  }

  async function initialize() {
    try {
      const dataUrl = new URL('./data/spatial-demo.json', import.meta.url);
      const response = await fetch(dataUrl);
      if (!response.ok) throw new Error(`Unable to load spatial data (${response.status})`);
      const data = await response.json();
      if (!Array.isArray(data.cells) || !Array.isArray(data.metadata?.cellTypes)) {
        throw new Error('Spatial data does not match the expected cell-transition schema.');
      }
      dataSource = data;

      try {
        initializeRenderer();
        width = Math.max(1, stage.clientWidth);
        height = Math.max(1, stage.clientHeight);
        createCloud(data);
        ready = true;
        stage.dataset.status = 'ready';
        resize();
        measureProgress();
      } catch (rendererError) {
        console.warn('WebGL is unavailable; using the static cell fallback.', rendererError);
        createCanvasFallback(data);
      }
    } catch (error) {
      stage.dataset.status = 'error';
      console.error('Unable to initialize the cell-state-to-volume hero:', error);
    }
  }

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(stage);
  const visibilityObserver = new IntersectionObserver((entries) => {
    sectionVisible = entries[0]?.isIntersecting ?? true;
    if (sectionVisible) scheduleRender(true);
  });
  visibilityObserver.observe(section);
  window.addEventListener('scroll', measureProgress, { passive: true });
  window.addEventListener('resize', measureProgress, { passive: true });
  visual.addEventListener('pointermove', handlePointerMove, { passive: true });
  visual.addEventListener('pointerleave', () => {
    pointer.active = false;
    scheduleRender();
  });
  reducedMotion.addEventListener('change', () => {
    measureProgress();
    scheduleRender(true);
  });
  section.querySelectorAll('.hero-actions a').forEach((link) => {
    link.addEventListener('click', navigateWithoutScrubbing);
  });
  initialize();
}
