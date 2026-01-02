import { pgEnum } from "drizzle-orm/pg-core";

export const verdictEnum = pgEnum("verdict", [
  "AC",
  "WA",
  "TLE",
  "MLE",
  "RE",
  "CE",
  "PENDING",
]);

export const languageEnum = pgEnum("language", [
  "cpp",
  "java",
  "python",
  "javascript",
  "go",
  "rust",
]);

export const difficultyEnum = pgEnum("difficulty", [
  "EASY",
  "MEDIUM",
  "HARD",
]);
