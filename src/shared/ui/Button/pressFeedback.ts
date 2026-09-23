/** Microinteracción compartida por los controles pulsables: se eleva al pasar y se hunde al presionar. */
export const pressFeedback = {
  whileHover: { y: -1 },
  whileTap: { scale: 0.97 },
} as const;
