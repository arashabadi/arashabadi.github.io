import * as THREE from './vendor/three.module.min.js';

const stage = document.querySelector('[data-hero-cells]');

function startCanvasFallback(container, reducedMotion) {
  if (reducedMotion.matches) {
    container.hidden = true;
    return;
  }

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) {
    container.hidden = true;
    return;
  }

  container.dataset.renderer = 'canvas2d';
  canvas.setAttribute('aria-hidden', 'true');
  container.appendChild(canvas);

  const colors = ['#58d8e7', '#33aebf', '#84d7d0', '#e77d4d', '#e8c277'];
  const layerPositions = [0.18, 0.29, 0.4, 0.51, 0.62];
  const particles = Array.from({ length: window.innerWidth <= 820 ? 90 : 150 }, function (_, index) {
    const random = function (salt) {
      const value = Math.sin(index * 91.173 + salt * 37.719) * 43758.5453;
      return value - Math.floor(value);
    };
    const layer = index % layerPositions.length;
    const direction = layer === 0 ? 1 : layer === layerPositions.length - 1 ? -1 : random(1) > 0.5 ? 1 : -1;
    const migrates = random(2) > 0.76;
    return {
      layer,
      targetLayer: migrates ? layer + direction : layer,
      x: (random(3) - 0.5) * 0.74,
      y: (random(4) - 0.5) * 0.018,
      phase: random(5) * Math.PI * 2,
      speed: 0.3 + random(6) * 0.2,
      drift: (random(7) - 0.5) * 0.09,
      radius: 0.8 + random(8) * 1.4,
      color: colors[Math.floor(random(9) * colors.length)],
      migrates
    };
  });

  let width = 1;
  let height = 1;
  let frame = 0;
  let animationFrame = 0;
  let visible = true;
  const started = performance.now();

  function smoothstep(value) {
    const clamped = Math.max(0, Math.min(1, value));
    return clamped * clamped * (3 - 2 * clamped);
  }

  function convergenceAt(cycle) {
    if (cycle < 0.56) return 0;
    if (cycle < 0.7) return smoothstep((cycle - 0.56) / 0.14);
    if (cycle < 0.82) return 1;
    return 1 - smoothstep((cycle - 0.82) / 0.18);
  }

  function resize() {
    width = Math.max(1, container.clientWidth);
    height = Math.max(1, container.clientHeight);
    const ratio = Math.min(window.devicePixelRatio || 1, 1.75);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  function draw(now) {
    const elapsed = (now - started) / 1000;
    const cycle = (elapsed % 16) / 16;
    const convergence = convergenceAt(cycle);
    const centerX = width <= 820 ? width * 0.36 : width * 0.49;
    context.clearRect(0, 0, width, height);
    context.globalCompositeOperation = 'lighter';

    particles.forEach(function (particle) {
      const wave = particle.migrates
        ? (1 - Math.cos(elapsed * particle.speed * Math.PI * 2 + particle.phase)) * 0.5
        : 0;
      const layerY = layerPositions[particle.layer];
      const targetY = layerPositions[particle.targetLayer];
      const movingY = layerY + (targetY - layerY) * wave + particle.y;
      const assembledY = 0.78 + Math.cos(particle.x * Math.PI) * 0.012;
      const arc = particle.migrates ? Math.sin(wave * Math.PI) : 0;
      const x = centerX + (particle.x + particle.drift * arc * (1 - convergence)) * width * 0.62;
      const y = (movingY + (assembledY - movingY) * convergence) * height;
      const radius = particle.radius * (1 + convergence * 0.2);

      context.beginPath();
      context.fillStyle = particle.color;
      context.globalAlpha = 0.55 + convergence * 0.25;
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.fill();
    });

    context.globalAlpha = 1;
    context.globalCompositeOperation = 'source-over';
    frame += 1;
    if (frame % 20 === 0) {
      container.dataset.frame = String(frame);
      container.dataset.state = convergence > 0.88 ? 'assembled' : convergence > 0.08 ? 'converging' : 'sectioned';
    }
    if (visible && !document.hidden && !reducedMotion.matches) animationFrame = window.requestAnimationFrame(draw);
  }

  function start() {
    window.cancelAnimationFrame(animationFrame);
    if (!visible || document.hidden || reducedMotion.matches) return;
    animationFrame = window.requestAnimationFrame(draw);
  }

  const observer = new IntersectionObserver(function (entries) {
    visible = entries[0] && entries[0].isIntersecting;
    start();
  }, { threshold: 0.01 });
  observer.observe(container);
  window.addEventListener('resize', resize, { passive: true });
  document.addEventListener('visibilitychange', start);
  resize();
  start();
}

if (stage) {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const coarsePointer = window.matchMedia('(pointer: coarse)');
  let renderer;

  try {
    renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true
    });
  } catch (error) {
    startCanvasFallback(stage, reducedMotion);
  }

  if (renderer) {
    stage.dataset.renderer = 'webgl';
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.domElement.setAttribute('aria-hidden', 'true');
    stage.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    camera.position.set(0, 0, 10);

    const cellGroup = new THREE.Group();
    scene.add(cellGroup);

    const mobile = window.innerWidth <= 820;
    const cellCount = mobile || coarsePointer.matches ? 120 : 230;
    const geometry = new THREE.SphereGeometry(0.052, 7, 5);
    const material = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0.94,
      vertexColors: true,
      depthWrite: false
    });
    const cells = new THREE.InstancedMesh(geometry, material, cellCount);
    cells.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    cells.frustumCulled = false;
    cellGroup.add(cells);

    const layerY = [2.25, 1.35, 0.45, -0.45, -1.35];
    const palette = [0x58d8e7, 0x33aebf, 0x84d7d0, 0xe77d4d, 0xe8c277];
    const particles = [];
    const color = new THREE.Color();
    const dummy = new THREE.Object3D();

    function seeded(index, salt) {
      const value = Math.sin(index * 91.173 + salt * 37.719) * 43758.5453;
      return value - Math.floor(value);
    }

    for (let index = 0; index < cellCount; index += 1) {
      const layer = index % layerY.length;
      const angle = seeded(index, 1) * Math.PI * 2;
      const radial = Math.sqrt(seeded(index, 2));
      const width = 2.2 + seeded(layer, 5) * 0.35;
      const x = Math.cos(angle) * radial * width;
      const z = Math.sin(angle) * radial * 0.72;
      const direction = layer === 0 ? 1 : layer === layerY.length - 1 ? -1 : seeded(index, 3) > 0.5 ? 1 : -1;
      const migrates = seeded(index, 4) > 0.76;
      particles.push({
        layer,
        targetLayer: migrates ? layer + direction : layer,
        x,
        z,
        yJitter: (seeded(index, 6) - 0.5) * 0.16,
        phase: seeded(index, 7) * Math.PI * 2,
        speed: 0.34 + seeded(index, 8) * 0.22,
        drift: (seeded(index, 9) - 0.5) * 0.7,
        scale: (0.72 + seeded(index, 10) * 1.1) * (migrates ? 1.35 : 1),
        migrates
      });

      color.setHex(palette[Math.floor(seeded(index, 11) * palette.length)]);
      cells.setColorAt(index, color);
    }
    cells.instanceColor.needsUpdate = true;

    let frame = 0;
    let animationFrame = 0;
    let visible = true;
    let pointerX = 0;
    let pointerY = 0;
    const startTime = performance.now();

    function smoothstep(value) {
      const clamped = Math.max(0, Math.min(1, value));
      return clamped * clamped * (3 - 2 * clamped);
    }

    function convergenceAt(cycle) {
      if (cycle < 0.56) return 0;
      if (cycle < 0.7) return smoothstep((cycle - 0.56) / 0.14);
      if (cycle < 0.82) return 1;
      return 1 - smoothstep((cycle - 0.82) / 0.18);
    }

    function resize() {
      const width = Math.max(1, stage.clientWidth);
      const height = Math.max(1, stage.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      cellGroup.position.x = width <= 820 ? -0.82 : -0.38;
      cellGroup.scale.setScalar(width <= 480 ? 0.9 : 1);
    }

    function render(now) {
      const elapsed = (now - startTime) / 1000;
      const cycle = (elapsed % 16) / 16;
      const convergence = convergenceAt(cycle);

      particles.forEach(function (particle, index) {
        const migrationWave = particle.migrates
          ? (1 - Math.cos(elapsed * particle.speed * Math.PI * 2 + particle.phase)) * 0.5
          : 0;
        const sourceY = layerY[particle.layer];
        const targetY = layerY[particle.targetLayer];
        const migratingY = THREE.MathUtils.lerp(sourceY, targetY, migrationWave) + particle.yJitter;
        const assembledY = -1.98 + Math.cos((particle.x / 2.6) * Math.PI) * 0.11 + particle.z * 0.035;
        const arc = particle.migrates ? Math.sin(migrationWave * Math.PI) : 0;
        const breath = Math.sin(elapsed * 1.15 + particle.phase) * 0.018;

        dummy.position.set(
          particle.x + particle.drift * arc * (1 - convergence),
          THREE.MathUtils.lerp(migratingY + breath, assembledY, convergence),
          particle.z + arc * 0.16
        );
        const pulse = particle.scale * (1 + Math.sin(elapsed * 1.8 + particle.phase) * 0.1 + convergence * 0.12);
        dummy.scale.setScalar(pulse);
        dummy.updateMatrix();
        cells.setMatrixAt(index, dummy.matrix);
      });

      cells.instanceMatrix.needsUpdate = true;
      cellGroup.rotation.y += (pointerX * 0.035 - cellGroup.rotation.y) * 0.025;
      cellGroup.rotation.x += (-pointerY * 0.02 - cellGroup.rotation.x) * 0.025;
      material.opacity = 0.88 + convergence * 0.1;
      renderer.render(scene, camera);

      frame += 1;
      if (frame % 20 === 0) {
        stage.dataset.frame = String(frame);
        stage.dataset.state = convergence > 0.88 ? 'assembled' : convergence > 0.08 ? 'converging' : 'sectioned';
      }
      if (visible && !document.hidden && !reducedMotion.matches) animationFrame = window.requestAnimationFrame(render);
    }

    function start() {
      window.cancelAnimationFrame(animationFrame);
      if (reducedMotion.matches || !visible || document.hidden) {
        stage.hidden = reducedMotion.matches;
        return;
      }
      stage.hidden = false;
      animationFrame = window.requestAnimationFrame(render);
    }

    const observer = new IntersectionObserver(function (entries) {
      visible = entries[0] && entries[0].isIntersecting;
      start();
    }, { threshold: 0.01 });
    observer.observe(stage);

    const hero = stage.closest('.hero');
    if (hero && !coarsePointer.matches) {
      hero.addEventListener('pointermove', function (event) {
        const rect = hero.getBoundingClientRect();
        pointerX = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
        pointerY = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
      }, { passive: true });
      hero.addEventListener('pointerleave', function () {
        pointerX = 0;
        pointerY = 0;
      });
    }

    window.addEventListener('resize', resize, { passive: true });
    document.addEventListener('visibilitychange', start);
    reducedMotion.addEventListener('change', start);
    resize();
    start();
  }
}
