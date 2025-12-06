import { setCookie } from '../utils/cookies';
import { z } from 'zod';

export const UserPreferencesSchema = z.object({
  theme: z.string()
});

export type UserPreferences = z.infer<typeof UserPreferencesSchema>;

// used for custom overrides, if default definitions are not good enough
export interface OverrideSportDefinition {
  sport: string;
  game: string;
  amount: number;
}
export interface DefaultSportsDefinition {
  sport: string | null;
  sport_multiplier: number | null;
  game: string | null;
  game_multiplier: number | null;
}

export interface Multiplier {
  game: string | null; // null means it's used global
  sport: string | null; // null means it's used for all sports
  multiplier: number;
}



export interface OtherPreferences {
  instant_open_modal: boolean; // whether or not to open the quick action modal with every key
}

export interface UIElement {
  name: string;
  isDisplayed: boolean;
}

export interface UIPreferences {
  displayedGames: UIElement[] | null; // null means, all Games will be shown
  displayedSports: UIElement[] | null; // null means, all Sports will be shown
}

export interface SportSpecific {
  plank: PlankSettings;
}

export interface PlankSettings {
  seconds: number; // this number will be the amount of seconds, with max_deaths
}

export function defaultPreferences(): UserPreferences {
  return {
    theme: "nord-dark"
  }
}
export function savePreferences(p: UserPreferences): void {
  setCookie('preferences', JSON.stringify(p), 9999);
}
