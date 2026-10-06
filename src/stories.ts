import data from "./data/stories.json";
import type { Story } from "./types";

export const STORIES: Story[] = data as Story[];

export function storyById(id: string): Story | undefined {
  return STORIES.find((s) => s.id === id);
}
