/**
 * The follow window starts with none of the app's styles, so its colors are copied here as
 * constants. A unit test compares each one with the token of the same name in `src/styles.css`.
 */
export const PIP_COLORS = {
  /** `--night`: the window's background. */
  night: '#0b0910',
  /** `--bone`: its text. */
  bone: '#efe6d2',
  /** `--ecto`: the ghost. */
  ecto: '#8ff5d2',
} as const;
