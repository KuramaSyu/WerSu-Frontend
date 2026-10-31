import type { CustomTheme } from "./customTheme";
import { customThemes, defaultTheme } from "./themes";

/**
 * Registry of every theme the app knows about: the bundled themes from
 * `themes.ts` plus any user-generated themes registered at runtime from
 * the theme generator. The `useThemeStore` resolves a theme by name
 * through this registry.
 */
export class ThemeManager {
  themes: Map<string, CustomTheme>;
  private static instance: ThemeManager | undefined;
  /** Toggled by the developer-mode ThemeDebug switch in `DeveloperSection`.
   *  Read by callers (e.g. theme generation trace) to gate their output.
   *  Defaults to false so production builds stay silent. */
  public static debug: boolean = false;

  private constructor(themes: CustomTheme[]) {
    this.themes = new Map();

    themes.forEach((t) => this.themes.set(t.custom.themeName, t));
    console.log(
      `Initialized ThemeManager with themes: ${[...this.themes.keys()].join(", ")}`,
    );
  }

  public static getInstance(): ThemeManager {
    if (ThemeManager.instance === undefined) {
      ThemeManager.instance = new ThemeManager(customThemes);
    }
    return ThemeManager.instance;
  }

  /** Add (or replace) a theme by its `custom.themeName`. */
  public registerTheme(theme: CustomTheme): void {
    this.themes.set(theme.custom.themeName, theme);
  }

  public hasTheme(themeName: string): boolean {
    return this.themes.has(themeName);
  }

  public removeTheme(themeName: string): void {
    this.themes.delete(themeName);
  }

  /** Every registered theme, in insertion order. */
  public getAllThemes(): CustomTheme[] {
    return [...this.themes.values()];
  }

  public async generateTheme(themeName: string): Promise<CustomTheme | null> {
    return this.themes.get(themeName) ?? defaultTheme;
  }

  public getThemeSync(themeName: string): CustomTheme | null {
    return this.themes.get(themeName) ?? defaultTheme;
  }
}
