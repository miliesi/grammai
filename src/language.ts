import { eld } from "eld/extrasmall";
import { proseMask } from "./prose";
export type WritingLanguage = "en" | "de" | "ro";
export type LanguageMode = "auto" | WritingLanguage;
const detector = eld.newInstance();
detector.setLanguageSubset(["en", "de", "ro"]);
/** Local character n-grams; no provider request on typing. */
export function detectLanguage(
  text: string,
  mode: LanguageMode = "auto",
): WritingLanguage {
  if (mode === "de" || mode === "en" || mode === "ro") return mode;
  const result = detector.detect(proseMask(text).slice(0, 6000));
  const language = result.language;
  return language === "de" || language === "ro" ? language : "en";
}
