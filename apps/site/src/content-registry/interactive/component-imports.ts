import PrimeFactorizerIdle from "../../components/interactive-renderers/PrimeFactorizerIdle.astro";
import PrimeFactorizerLoad from "../../components/interactive-renderers/PrimeFactorizerLoad.astro";
import PrimeFactorizerMedia from "../../components/interactive-renderers/PrimeFactorizerMedia.astro";
import PrimeFactorizerVisible from "../../components/interactive-renderers/PrimeFactorizerVisible.astro";
import type { InteractiveComponentId } from "./component-ids.js";

export const interactiveComponentImports = Object.freeze({
  "prime-factorizer-react-v1": Object.freeze({
    load: PrimeFactorizerLoad,
    idle: PrimeFactorizerIdle,
    visible: PrimeFactorizerVisible,
    media: PrimeFactorizerMedia,
  }),
} satisfies Record<InteractiveComponentId, Readonly<Record<"load" | "idle" | "visible" | "media", unknown>>>);
