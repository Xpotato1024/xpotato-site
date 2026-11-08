import { carouselIndex, canRotate, carouselSentinels } from "./carousel-state.js";

for (const root of document.querySelectorAll<HTMLElement>("[data-project-carousel]")) {
  const viewport = root.querySelector<HTMLElement>(".project-viewport")!;
  const track = root.querySelector<HTMLElement>(".project-track")!;
  const originals = [...track.children] as HTMLElement[];
  const count = originals.length;
  if (count < 2) { root.classList.add("project-carousel-static"); continue; }
  const controls = root.querySelector<HTMLElement>(".project-controls")!;
  const rotation = root.querySelector<HTMLButtonElement>("[data-rotation]")!;
  const pagination = root.querySelector<HTMLElement>(".project-pagination")!;
  const status = root.querySelector<HTMLElement>(".carousel-status")!;
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const narrow = matchMedia("(max-width: 760px)");
  const pauses = new Set<string>();
  let touchFocus: Element | null = null;
  let touchTarget: Element | null = null;
  const sentinels = carouselSentinels(count), offset = sentinels.before.length;
  let index = 0, position = offset, moving = false, manual = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let settleTimer: ReturnType<typeof setTimeout> | undefined;
  const clone = (slide: HTMLElement) => {
    const copy = slide.cloneNode(true) as HTMLElement;
    copy.setAttribute("aria-hidden", "true"); copy.inert = true;
    copy.dataset.loopCopy = "";
    // Sentinels are decorative and never add duplicate IDs or focus targets.
    copy.removeAttribute("id");
    for (const node of copy.querySelectorAll("[id]")) node.removeAttribute("id");
    return copy;
  };
  track.prepend(...sentinels.before.map(i => clone(originals[i]!)));
  track.append(...sentinels.after.map(i => clone(originals[i]!)));
  const slides = [...track.children] as HTMLElement[];
  const schedule = () => {
    clearTimeout(timer);
    if (!moving && canRotate(count, pauses)) timer = setTimeout(() => go(1, false), 6000);
  };
  const pause = (reason: string, value: boolean) => { value ? pauses.add(reason) : pauses.delete(reason); schedule(); };
  const dots = originals.map((slide, target) => {
    const button = document.createElement("button");
    button.type = "button"; button.dataset.projectDot = String(target);
    const title = slide.querySelector("h3")!.textContent!.replace("↗", "").trim();
    button.setAttribute("aria-label", `${target + 1} / ${count}：${title}を表示`);
    button.title = button.getAttribute("aria-label")!;
    button.addEventListener("click", () => { if (moving) finish(); go(target - index, true); });
    pagination.append(button); return button;
  });
  const arrows = [...controls.querySelectorAll<HTMLButtonElement>("[data-previous],[data-next]")];
  const updateNarrow = () => {
    // Only the desktop arrows disappear. Preserve focus on visible controls,
    // including a dot the user has reached with Tab but has not activated.
    // Own the hiding here too: CSS can apply before the change event in Edge.
    if (narrow.matches && arrows.includes(document.activeElement as HTMLButtonElement)) dots[index]!.focus({ preventScroll: true });
    arrows.forEach(arrow => { arrow.hidden = narrow.matches; });
  };
  narrow.addEventListener("change", updateNarrow);
  const place = (animate: boolean) => {
    track.style.transitionDuration = animate && !motion.matches ? "400ms" : "0ms";
    const slide = slides[position]!;
    track.style.transform = `translateX(${(viewport.clientWidth - slide.offsetWidth) / 2 - slide.offsetLeft}px)`;
  };
  const finish = () => {
    clearTimeout(settleTimer);
    position = index + offset; place(false); moving = false;
    originals.forEach((slide, i) => { slide.inert = i !== index; slide.setAttribute("aria-hidden", String(i !== index)); });
    dots.forEach((button, i) => button.setAttribute("aria-current", String(i === index)));
    if (manual) status.textContent = `${index + 1} / ${count}：${originals[index]!.querySelector("h3")!.textContent}`;
    manual = false; schedule();
  };
  const go = (delta: number, user: boolean) => {
    if (moving) return;
    if (!delta) { schedule(); return; }
    if (user && (document.activeElement as Element | null)?.closest(".project-slide")) {
      if (touchFocus === document.activeElement) touchFocus = viewport;
      viewport.focus({ preventScroll: true });
    }
    index = carouselIndex(index + delta, count); position += delta;
    moving = true; manual = user;
    originals.forEach(slide => { slide.inert = true; slide.setAttribute("aria-hidden", "true"); });
    const animate = Math.abs(delta) === 1;
    place(animate);
    // A deadline also handles interrupted transitions, backgrounding and zero motion.
    if (motion.matches || !animate) finish(); else settleTimer = setTimeout(finish, 450);
    schedule();
  };
  track.addEventListener("transitionend", event => { if (event.target === track && event.propertyName === "transform") finish(); });
  root.querySelector("[data-previous]")!.addEventListener("click", () => go(-1, true));
  root.querySelector("[data-next]")!.addEventListener("click", () => go(1, true));
  const showRotation = () => {
    const stopped = pauses.has("user") || motion.matches;
    const label = motion.matches ? "動きを減らす設定のため自動送りは停止中" : stopped ? "自動送りを再開" : "自動送りを停止";
    rotation.dataset.state = stopped ? "paused" : "playing";
    rotation.setAttribute("aria-label", label); rotation.title = label;
    rotation.disabled = motion.matches;
  };
  rotation.addEventListener("click", () => {
    const stopped = !pauses.has("user"); pause("user", stopped);
    showRotation();
  });
  root.addEventListener("keydown", event => {
    if (event.altKey || event.ctrlKey || event.metaKey || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const focused = dots.indexOf(document.activeElement as HTMLButtonElement);
    if (focused >= 0) {
      const target = event.key === "Home" ? 0 : event.key === "End" ? count - 1 : carouselIndex(focused + (event.key === "ArrowLeft" ? -1 : 1), count);
      dots[target]!.focus({ preventScroll: true }); dots[target]!.click(); return;
    }
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") go(event.key === "ArrowLeft" ? -1 : 1, true);
    else { if (moving) return; const target = event.key === "Home" ? 0 : count - 1; go(target - index, true); }
  });
  root.addEventListener("pointerenter", event => { if (event.pointerType === "mouse" && matchMedia("(hover: hover)").matches) pause("hover", true); });
  root.addEventListener("pointerleave", event => { if (event.pointerType === "mouse") pause("hover", false); });
  root.addEventListener("pointerdown", event => {
    const touch = event.pointerType === "touch";
    touchFocus = touch && root.contains(document.activeElement) ? document.activeElement : null;
    touchTarget = touch ? (event.target as Element).closest("button,a,[tabindex]") : null;
    if (touch) pause("focus", false);
  }, true);
  root.addEventListener("touchstart", () => { pause("contact", true); pause("focus", false); }, { passive: true });
  for (const type of ["touchend", "touchcancel"] as const) root.addEventListener(type, event => {
    pause("contact", event.touches.length > 0);
    pause("focus", root.contains(document.activeElement) && document.activeElement !== touchFocus);
    if (type === "touchcancel") touchTarget = null;
  }, { passive: true });
  // Native touch focus can follow touchend. Retire its candidate after click,
  // rather than a timer which may run before the compatibility mouse sequence.
  root.addEventListener("click", () => { touchTarget = null; }, true);
  document.addEventListener("keydown", () => { touchFocus = touchTarget = null; pause("focus", root.contains(document.activeElement)); }, true);
  root.addEventListener("focusin", () => {
    if (document.activeElement === touchTarget) touchFocus = touchTarget;
    pause("focus", document.activeElement !== touchFocus);
  });
  root.addEventListener("focusout", event => queueMicrotask(() => {
    const inside = root.contains(document.activeElement);
    if (!inside && !root.contains(event.relatedTarget as Node | null)) touchFocus = null;
    pause("focus", inside && document.activeElement !== touchFocus);
  }));
  document.addEventListener("visibilitychange", () => pause("hidden", document.hidden));
  let pointer: { id: number; x: number; y: number } | undefined, suppressClick = false;
  viewport.addEventListener("pointerdown", event => {
    if (!event.isPrimary || event.button !== 0) return;
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY }; pause("pointer", true);
  });
  viewport.addEventListener("pointermove", event => {
    if (!pointer || pointer.id !== event.pointerId) return;
    if (Math.abs(event.clientX - pointer.x) > 10 && Math.abs(event.clientX - pointer.x) > Math.abs(event.clientY - pointer.y)) {
      viewport.setPointerCapture(event.pointerId); if (event.cancelable) event.preventDefault();
    }
  });
  const release = (event: PointerEvent) => {
    if (!pointer || pointer.id !== event.pointerId) return;
    const dx = event.clientX - pointer.x, dy = event.clientY - pointer.y;
    pointer = undefined; pause("pointer", false);
    if (event.type === "pointercancel") touchTarget = null;
    if (event.type !== "pointercancel" && Math.abs(dx) >= 40 && Math.abs(dx) > Math.abs(dy)) {
      touchTarget = null;
      suppressClick = true; go(dx < 0 ? 1 : -1, true);
      setTimeout(() => { suppressClick = false; }, 0);
    }
  };
  window.addEventListener("pointerup", release); window.addEventListener("pointercancel", release);
  viewport.addEventListener("lostpointercapture", event => {
    // Touch begins with implicit capture on a descendant. Its transfer to the
    // viewport is not the end of the gesture (that event bubbles too).
    if (event.target === viewport) { pointer = undefined; pause("pointer", false); }
  });
  viewport.addEventListener("click", event => { if (suppressClick) { event.preventDefault(); event.stopPropagation(); } }, true);
  viewport.addEventListener("dragstart", event => event.preventDefault());
  const updateMotion = () => {
    pause("motion", motion.matches); showRotation();
    if (moving) finish();
  };
  motion.addEventListener("change", updateMotion);
  pause("hidden", document.hidden); pause("outside", true);
  new IntersectionObserver(entries => pause("outside", !entries[0]?.isIntersecting), { threshold: .25 }).observe(viewport);
  new ResizeObserver(() => { if (moving) finish(); else place(false); }).observe(viewport);
  root.classList.add("project-carousel-enhanced"); controls.hidden = false; pagination.hidden = false;
  updateNarrow(); updateMotion(); finish();
}
