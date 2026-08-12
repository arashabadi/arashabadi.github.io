const stage = document.querySelector('[data-hero-cells]');

if (stage) {
  const section = stage.closest('[data-spatial-intro]');
  const visual = stage.closest('.hero-visual');
  const progressBar = section.querySelector('[data-hero-progress]');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const coarsePointer = window.matchMedia('(pointer: coarse)');
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { alpha: true });

  const CONFIG = {
    coordinateStart: 0.05,
    coordinateEnd: 0.76,
    trajectoryCurve: 0.07,
    desktopPointRadius: 1.65,
    highlightedPointRadius: 2.25,
    mobilePointStride: 2,
    easing: 0.16,
    pointerRadius: 115,
    pointerDisplacement: 9,
    maxDpr: 1.75
  };

  const pointer = {
    x: 0,
    y: 0,
    lastX: 0,
    lastY: 0,
    lastTime: 0,
    active: false,
    energy: 0
  };

  let cellGroups = [];
  let width = 1;
  let height = 1;
  let dpr = 1;
  let plot = { x: 0, y: 0, width: 1, height: 1 };
  let targetProgress = 0;
  let renderedProgress = 0;
  let animationFrame = 0;
  let ready = false;

  canvas.setAttribute('aria-hidden', 'true');
  stage.appendChild(canvas);
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

  function hashIdentity(identity) {
    let hash = 2166136261;
    for (let index = 0; index < identity.length; index += 1) {
      hash ^= identity.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0) / 4294967295;
  }

  function pointAt(x, y) {
    return {
      x: plot.x + x * plot.width,
      y: plot.y + y * plot.height
    };
  }

  function resize() {
    width = Math.max(1, stage.clientWidth);
    height = Math.max(1, stage.clientHeight);
    const compact = width <= 620;
    dpr = Math.min(window.devicePixelRatio || 1, compact ? 1.5 : CONFIG.maxDpr);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    plot = compact
      ? { x: width * 0.01, y: height * 0.03, width: width * 0.98, height: height * 0.82 }
      : { x: width * 0.025, y: height * 0.03, width: width * 0.95, height: height * 0.88 };
    scheduleRender(true);
  }

  function trajectory(cell, progress) {
    const stagger = hashIdentity(cell.id) * 0.055;
    const localProgress = smootherstep(
      (progress - CONFIG.coordinateStart - stagger)
      / (CONFIG.coordinateEnd - CONFIG.coordinateStart - stagger)
    );
    const source = pointAt(cell.umapX, cell.umapY);
    const destination = pointAt(cell.spatialX, cell.spatialY);
    const dx = destination.x - source.x;
    const dy = destination.y - source.y;
    const distance = Math.max(1, Math.hypot(dx, dy));
    const direction = (hashIdentity(`${cell.id}:curve`) - 0.5) * 2;
    const curve = Math.min(distance * 0.18, Math.min(plot.width, plot.height) * CONFIG.trajectoryCurve) * direction;
    const control = {
      x: (source.x + destination.x) * 0.5 - (dy / distance) * curve,
      y: (source.y + destination.y) * 0.5 + (dx / distance) * curve
    };
    const inverse = 1 - localProgress;
    return {
      x: inverse ** 2 * source.x + 2 * inverse * localProgress * control.x + localProgress ** 2 * destination.x,
      y: inverse ** 2 * source.y + 2 * inverse * localProgress * control.y + localProgress ** 2 * destination.y,
      progress: localProgress
    };
  }

  function applyPointerMotion(point, cell, now) {
    if (!pointer.active || pointer.energy < 0.002 || reducedMotion.matches) return point;
    const dx = point.x - pointer.x;
    const dy = point.y - pointer.y;
    const distance = Math.max(1, Math.hypot(dx, dy));
    const influence = smoothstep(1 - distance / CONFIG.pointerRadius);
    if (influence <= 0) return point;
    const identityPhase = hashIdentity(`${cell.id}:pointer`) * Math.PI * 2;
    const vibration = Math.sin(now * 0.026 + identityPhase) * 2.4 * pointer.energy * influence;
    const displacement = CONFIG.pointerDisplacement * pointer.energy * influence;
    return {
      ...point,
      x: point.x + (dx / distance) * displacement + Math.cos(identityPhase) * vibration,
      y: point.y + (dy / distance) * displacement + Math.sin(identityPhase) * vibration
    };
  }

  function draw(progress, now) {
    if (!ready) return;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, height);

    const compact = width <= 620;
    const stride = compact ? CONFIG.mobilePointStride : 1;
    cellGroups.forEach((group) => {
      const highlighted = group.key === 'b_cell' || group.key === 'treg';
      const supporting = group.key === 'stromal' || group.key === 'epithelial';
      const radius = compact
        ? (highlighted ? 1.82 : supporting ? 1.05 : 1.28)
        : (highlighted ? CONFIG.highlightedPointRadius : supporting ? 1.35 : CONFIG.desktopPointRadius);
      context.beginPath();
      group.cells.forEach((cell, index) => {
        if (index % stride !== 0) return;
        const basePoint = trajectory(cell, progress);
        const point = applyPointerMotion(basePoint, cell, now);
        const settledRadius = radius * (0.92 + point.progress * 0.08);
        context.moveTo(point.x + settledRadius, point.y);
        context.arc(point.x, point.y, settledRadius, 0, Math.PI * 2);
      });
      context.fillStyle = group.color;
      context.globalAlpha = highlighted ? 0.96 : supporting ? 0.68 : 0.8;
      context.fill();
    });
    context.globalAlpha = 1;
    progressBar.style.transform = `scaleX(${progress.toFixed(4)})`;
    stage.dataset.state = progress < 0.36 ? 'umap' : progress < 0.72 ? 'mapping' : 'spatial';
  }

  function measureProgress() {
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
    if (!ready) return;
    if (reducedMotion.matches) {
      renderedProgress = 1;
      pointer.energy = 0;
    } else {
      const difference = targetProgress - renderedProgress;
      renderedProgress = Math.abs(difference) < 0.0005
        ? targetProgress
        : renderedProgress + difference * CONFIG.easing;
      pointer.energy *= 0.9;
    }
    draw(renderedProgress, now);
    if (Math.abs(targetProgress - renderedProgress) >= 0.0005 || pointer.energy >= 0.004) scheduleRender();
  }

  function scheduleRender(immediate = false) {
    if (!ready) return;
    if (immediate) renderedProgress = reducedMotion.matches ? 1 : targetProgress;
    if (!animationFrame) animationFrame = window.requestAnimationFrame(animate);
  }

  function groupCells(data) {
    const ordering = ['stromal', 'epithelial', 'macrophage', 'dendritic', 'cd8_t', 'cd4_t', 'treg', 'b_cell'];
    return ordering.map((key) => {
      const type = data.metadata.cellTypes.find((candidate) => candidate.key === key);
      return {
        key,
        color: type.color,
        cells: data.cells.filter((cell) => cell.cellType === key)
      };
    });
  }

  function handlePointerMove(event) {
    if (coarsePointer.matches || reducedMotion.matches) return;
    const rect = visual.getBoundingClientRect();
    const now = performance.now();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const elapsed = Math.max(16, now - pointer.lastTime);
    const speed = Math.hypot(x - pointer.lastX, y - pointer.lastY) / elapsed;
    pointer.x = x;
    pointer.y = y;
    pointer.lastX = x;
    pointer.lastY = y;
    pointer.lastTime = now;
    pointer.active = true;
    pointer.energy = clamp(Math.max(pointer.energy, 0.22 + speed * 0.75));
    scheduleRender();
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
      cellGroups = groupCells(data);
      ready = true;
      stage.dataset.status = 'ready';
      measureProgress();
      resize();
    } catch (error) {
      stage.dataset.status = 'error';
      console.error('Unable to initialize the immune-state-to-iBALT hero:', error);
    }
  }

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(stage);
  window.addEventListener('scroll', measureProgress, { passive: true });
  window.addEventListener('resize', measureProgress, { passive: true });
  visual.addEventListener('pointermove', handlePointerMove, { passive: true });
  visual.addEventListener('pointerleave', () => {
    pointer.active = false;
    pointer.energy = Math.max(pointer.energy, 0.16);
    scheduleRender();
  });
  reducedMotion.addEventListener('change', () => {
    measureProgress();
    scheduleRender(true);
  });
  initialize();
}
