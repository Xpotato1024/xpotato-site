import { useEffect } from "react";
import {
  activeInput,
  editorCaretEvent,
  revealFocusedInput,
  softwareKeyboardOpen,
} from "./editorFocus.js";

export function useEditorViewport() {
  useEffect(() => {
    const root = document.documentElement;
    const viewport = window.visualViewport;
    let frame = 0;
    let followup = 0;
    let baselineHeight = window.innerHeight;
    let baselineWidth = window.innerWidth;
    let observedInput: HTMLElement | null = null;
    let observedToolbar: Element | null = null;
    const resize = new ResizeObserver(() => schedule());
    const setVariable = (name: string, value: string) => {
      if (root.style.getPropertyValue(name) !== value) root.style.setProperty(name, value);
    };
    const update = () => {
      frame = 0;
      const input = activeInput();
      if (Math.abs(baselineWidth - window.innerWidth) > 2) {
        baselineWidth = window.innerWidth;
        baselineHeight = window.innerHeight;
      } else if (!input) {
        baselineHeight = window.innerHeight;
      }
      const height = Math.max(1, viewport?.height ?? window.innerHeight);
      const top = viewport?.offsetTop ?? 0;
      const left = viewport?.offsetLeft ?? 0;
      setVariable("--editor-viewport-height", `${height}px`);
      setVariable("--editor-viewport-offset-top", `${top}px`);
      const keyboard = softwareKeyboardOpen(
        input !== null,
        height,
        window.innerHeight,
        baselineHeight,
        viewport?.scale ?? 1,
      );
      if (keyboard) {
        if (root.dataset.editorKeyboard !== "true") root.dataset.editorKeyboard = "true";
      } else {
        root.removeAttribute("data-editor-keyboard");
      }
      const toolbar = document.querySelector(".workbench-toolbar");
      const toolbarHeight = toolbar?.getBoundingClientRect().height ?? 0;
      setVariable("--editor-toolbar-height", `${toolbarHeight}px`);
      setVariable("--cms-toolbar-top", `${toolbarHeight}px`);
      if (observedInput !== input || observedToolbar !== toolbar) {
        resize.disconnect();
        observedInput = input;
        observedToolbar = toolbar;
        if (input) resize.observe(input);
        if (toolbar) resize.observe(toolbar);
      }
      revealFocusedInput({
        top,
        bottom: top + height,
        left,
        right: left + (viewport?.width ?? window.innerWidth),
      });
    };
    function schedule() {
      if (!frame) frame = window.requestAnimationFrame(update);
    }
    function resized() {
      schedule();
      window.cancelAnimationFrame(followup);
      followup = window.requestAnimationFrame(() => {
        followup = window.requestAnimationFrame(schedule);
      });
    }
    schedule();
    window.addEventListener("resize", resized);
    viewport?.addEventListener("resize", resized);
    viewport?.addEventListener("scroll", resized);
    const events = [
      "focusin",
      "focusout",
      "input",
      "keyup",
      "pointerup",
      "selectionchange",
      "compositionstart",
      "compositionupdate",
      "compositionend",
      editorCaretEvent,
    ];
    for (const event of events) document.addEventListener(event, schedule, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.cancelAnimationFrame(followup);
      resize.disconnect();
      window.removeEventListener("resize", resized);
      viewport?.removeEventListener("resize", resized);
      viewport?.removeEventListener("scroll", resized);
      for (const event of events) document.removeEventListener(event, schedule, true);
      for (const property of [
        "--editor-viewport-height",
        "--editor-viewport-offset-top",
        "--editor-toolbar-height",
        "--cms-toolbar-top",
      ])
        root.style.removeProperty(property);
      root.removeAttribute("data-editor-keyboard");
    };
  }, []);
}
