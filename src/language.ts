import { eld } from "eld/extrasmall";
import { proseMask } from "./prose";
export type WritingLanguage = "en" | "de";
export type LanguageMode = "auto" | WritingLanguage;
const detector = eld.newInstance();
detector.setLanguageSubset(["en", "de"]);
/** Local character n-grams; no provider request on typing. */
export function detectLanguage(
  text: string,
  mode: LanguageMode = "auto",
): WritingLanguage {
  if (mode === "de" || mode === "en") return mode;
  const result = detector.detect(proseMask(text).slice(0, 6000));
  return result.language === "de" ? "de" : "en";
}
