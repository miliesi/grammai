/**
 * Offline English spelling with Hunspell dictionaries and deterministic grammar
 * rules. These are independent checks, not Grammarly's proprietary models.
 * Every range uses JavaScript/DOM UTF-16 offsets, including text with emoji.
 */
import { inspectSpelling } from "./spelling";
import { proseMask } from "./prose";
import { textStatistics } from "./statistics";

export type Category = "correctness" | "clarity" | "engagement" | "delivery";

export interface Issue {
  id: string;
  ruleId: string;
  offset: number;
  length: number;
  original: string;
  replacements: string[];
  message: string;
  shortMessage: string;
  category: Category;
  kind: "spelling" | "grammar" | "style";
}

export interface EngineOptions {
  dictionary?: string[];
  dialect?: string;
  categories?: Partial<Record<Category, boolean>>;
  /** The worker supplies dictionary diagnoses through Harper. */
  externalSpelling?: boolean;
}

// High-confidence common typos supplement dictionary suggestions (some require
// more edit operations than Hunspell's candidate search, e.g. “nessecary”).
const SPELLING: Record<string, string> = {
  accomodate: "accommodate",
  accomodation: "accommodation",
  acheive: "achieve",
  acheived: "achieved",
  acheivement: "achievement",
  accross: "across",
  adress: "address",
  adressed: "addressed",
  adressing: "addressing",
  alot: "a lot",
  apparant: "apparent",
  appearence: "appearance",
  arguement: "argument",
  assigment: "assignment",
  availabe: "available",
  basicly: "basically",
  becasue: "because",
  becuase: "because",
  beleive: "believe",
  beleived: "believed",
  belive: "believe",
  benifit: "benefit",
  buisness: "business",
  calender: "calendar",
  catagory: "category",
  cemetary: "cemetery",
  comming: "coming",
  commited: "committed",
  committment: "commitment",
  comparision: "comparison",
  competetive: "competitive",
  completly: "completely",
  concious: "conscious",
  concensus: "consensus",
  definately: "definitely",
  definitly: "definitely",
  definetely: "definitely",
  seperate: "separate",
  seperately: "separately",
  seperated: "separated",
  desicion: "decision",
  developement: "development",
  diffrent: "different",
  dissapoint: "disappoint",
  dissapointed: "disappointed",
  dissapear: "disappear",
  enviroment: "environment",
  embarass: "embarrass",
  embarassed: "embarrassed",
  embarassing: "embarrassing",
  exagerate: "exaggerate",
  excelent: "excellent",
  excercise: "exercise",
  existance: "existence",
  experiance: "experience",
  familar: "familiar",
  finaly: "finally",
  flourescent: "fluorescent",
  foriegn: "foreign",
  fourty: "forty",
  freind: "friend",
  freinds: "friends",
  goverment: "government",
  grammer: "grammar",
  guarentee: "guarantee",
  happend: "happened",
  hieght: "height",
  imediate: "immediate",
  imediately: "immediately",
  independant: "independent",
  intrest: "interest",
  intrested: "interested",
  irrelavant: "irrelevant",
  knowlege: "knowledge",
  langauge: "language",
  liason: "liaison",
  libary: "library",
  lisence: "license",
  maintainance: "maintenance",
  managment: "management",
  millenium: "millennium",
  mispell: "misspell",
  mispelled: "misspelled",
  neccessary: "necessary",
  nessecary: "necessary",
  nessessary: "necessary",
  nessisary: "necessary",
  neccesary: "necessary",
  necesary: "necessary",
  neccessarily: "necessarily",
  noticable: "noticeable",
  occassion: "occasion",
  occured: "occurred",
  occurence: "occurrence",
  ommited: "omitted",
  oppurtunity: "opportunity",
  oportunity: "opportunity",
  orginal: "original",
  oustanding: "outstanding",
  persue: "pursue",
  posession: "possession",
  possesion: "possession",
  prefered: "preferred",
  preffered: "preferred",
  priviledge: "privilege",
  probaly: "probably",
  proccess: "process",
  proffesional: "professional",
  publically: "publicly",
  recieve: "receive",
  recieved: "received",
  recieving: "receiving",
  realy: "really",
  recomend: "recommend",
  recomendation: "recommendation",
  refered: "referred",
  relevent: "relevant",
  rememberance: "remembrance",
  repitition: "repetition",
  responsability: "responsibility",
  restaraunt: "restaurant",
  resturant: "restaurant",
  rythym: "rhythm",
  sence: "sense",
  similiar: "similar",
  sincerly: "sincerely",
  somthing: "something",
  speach: "speech",
  sucess: "success",
  sucessful: "successful",
  succesful: "successful",
  succesfully: "successfully",
  suprise: "surprise",
  suprised: "surprised",
  teh: "the",
  thier: "their",
  thsi: "this",
  throught: "through",
  tommorow: "tomorrow",
  tommorrow: "tomorrow",
  truely: "truly",
  unfortunatly: "unfortunately",
  untill: "until",
  usefull: "useful",
  usualy: "usually",
  vaccum: "vacuum",
  wierd: "weird",
  writting: "writing",
  yesturday: "yesterday",
};

const CONTRACTIONS: Record<string, string> = {
  dont: "don't",
  doesnt: "doesn't",
  didnt: "didn't",
  isnt: "isn't",
  arent: "aren't",
  wasnt: "wasn't",
  werent: "weren't",
  havent: "haven't",
  hasnt: "hasn't",
  hadnt: "hadn't",
  couldnt: "couldn't",
  wouldnt: "wouldn't",
  shouldnt: "shouldn't",
  mustnt: "mustn't",
  neednt: "needn't",
  im: "I'm",
  ive: "I've",
  ill: "I'll",
};

const WORDINESS: Array<[RegExp, string, string]> = [
  [
    /\bin order to\b/gi,
    "to",
    "A shorter phrase can make this sentence easier to read.",
  ],
  [
    /\bdue to the fact that\b/gi,
    "because",
    "Consider a simpler way to express this reason.",
  ],
  [/\bat this point in time\b/gi, "now", "Consider a more concise expression."],
  [/\bat the present time\b/gi, "now", "Consider a more concise expression."],
  [/\bin the event that\b/gi, "if", "Consider a more direct expression."],
  [/\bfor the purpose of\b/gi, "for", "Consider a shorter phrase."],
  [
    /\bin spite of the fact that\b/gi,
    "although",
    "Consider a simpler connection.",
  ],
  [/\ba large number of\b/gi, "many", "Consider a more concise expression."],
  [/\ba small number of\b/gi, "a few", "Consider a more concise expression."],
  [/\bon a daily basis\b/gi, "daily", "Consider a more concise expression."],
  [/\bwith regard to\b/gi, "about", "Consider a more direct expression."],
  [/\bin regards to\b/gi, "about", "Consider a more direct expression."],
  [/\bdespite the fact that\b/gi, "although", "Consider a simpler connection."],
  [
    /\beach and every\b/gi,
    "every",
    "One of these words can express the same idea.",
  ],
  [
    /\badvance planning\b/gi,
    "planning",
    "Planning already implies looking ahead.",
  ],
  [/\bpast history\b/gi, "history", "History already refers to the past."],
  [/\bfree gift\b/gi, "gift", "A gift is usually understood to be free."],
  [/\breturn back\b/gi, "return", "“Back” may be unnecessary here."],
  [
    /\bvery unique\b/gi,
    "unique",
    "“Unique” usually does not need an intensifier.",
  ],
];

// Deliberately small dialect pairs: both variants remain valid unless a dialect is selected.
const DIALECT: Array<[string, string]> = [
  ["color", "colour"],
  ["colors", "colours"],
  ["colored", "coloured"],
  ["favorite", "favourite"],
  ["favorites", "favourites"],
  ["favor", "favour"],
  ["honor", "honour"],
  ["honors", "honours"],
  ["neighbor", "neighbour"],
  ["neighbors", "neighbours"],
  ["behavior", "behaviour"],
  ["behaviors", "behaviours"],
  ["center", "centre"],
  ["centers", "centres"],
  ["theater", "theatre"],
  ["organize", "organise"],
  ["organized", "organised"],
  ["organizing", "organising"],
  ["analyze", "analyse"],
  ["analyzed", "analysed"],
  ["analyzing", "analysing"],
  ["apologize", "apologise"],
  ["realize", "realise"],
  ["realized", "realised"],
  ["traveling", "travelling"],
  ["traveled", "travelled"],
  ["canceled", "cancelled"],
];

function matchCase(original: string, replacement: string): string {
  if (/^[A-Z]+$/.test(original) && original.length > 1)
    return replacement.toUpperCase();
  if (/^[A-Z]/.test(original))
    return replacement[0].toUpperCase() + replacement.slice(1);
  return replacement;
}

export function checkText(text: string, options: EngineOptions = {}): Issue[] {
  if (!text.trim()) return [];
  const prose = proseMask(text);
  const dictionary = new Set(
    (options.dictionary ?? []).map((word) => word.toLocaleLowerCase("en")),
  );
  const issues: Issue[] = [];

  const add = (
    ruleId: string,
    offset: number,
    length: number,
    replacements: string[],
    message: string,
    shortMessage: string,
    category: Category = "correctness",
    kind: Issue["kind"] = "grammar",
  ) => {
    if (!length || options.categories?.[category] === false) return;
    const original = text.slice(offset, offset + length);
    if (
      prose.slice(offset, offset + length) !== original ||
      dictionary.has(original.toLocaleLowerCase("en"))
    )
      return;
    // Keep one actionable suggestion at a time for the same source range.
    if (
      issues.some(
        (issue) =>
          offset < issue.offset + issue.length &&
          offset + length > issue.offset,
      )
    )
      return;
    issues.push({
      id: `${ruleId}:${offset}:${length}:${original}`,
      ruleId,
      offset,
      length,
      original,
      replacements,
      message,
      shortMessage,
      category,
      kind,
    });
  };

  const tokens = [...prose.matchAll(/[\p{L}\p{M}]+(?:['’][\p{L}\p{M}]+)*/gu)];
  const dialect = options.dialect?.toLowerCase().replace("_", "-");
  const isBritish =
    dialect === "uk" ||
    dialect === "british" ||
    dialect === "en-gb" ||
    dialect === "en-uk";
  const isAmerican =
    dialect === "us" || dialect === "american" || dialect === "en-us";
  const dialectWords = new Map(
    DIALECT.map(([us, uk]) => (isBritish ? [us, uk] : [uk, us])),
  );

  for (const token of tokens) {
    const word = token[0];
    const lower = word.toLowerCase();
    const offset = token.index!;
    if (dictionary.has(lower)) continue;
    // A letter run inside a numeric/code identifier is not a prose word.
    if (
      /[\p{N}_$]/u.test(prose[offset - 1] ?? "") ||
      /[\p{N}_$]/u.test(prose[offset + word.length] ?? "")
    )
      continue;
    // Do not interpret acronyms or mixed-case identifiers as misspellings.
    const plainCase = word === lower || /^[A-Z][a-z]+$/.test(word);
    const before = prose.slice(0, offset);
    const atSentenceStart = !before.trim() || /[.!?]["”')\]]*\s+$/.test(before);
    // A capitalized word within a sentence may be a person's or project's name.
    if (plainCase && SPELLING[lower] && (word === lower || atSentenceStart)) {
      add(
        "spelling",
        offset,
        word.length,
        [matchCase(word, SPELLING[lower])],
        "This word may be misspelled.",
        "Possible spelling mistake",
        "correctness",
        "spelling",
      );
    } else if (
      plainCase &&
      CONTRACTIONS[lower] &&
      lower !== "ill" &&
      word !== "Im"
    ) {
      add(
        "contraction-apostrophe",
        offset,
        word.length,
        [matchCase(word, CONTRACTIONS[lower])],
        "This contraction needs an apostrophe.",
        "Missing apostrophe",
      );
    } else if (lower === "i" && word === "i") {
      add(
        "capitalize-i",
        offset,
        1,
        ["I"],
        "Capitalize the pronoun “I.”",
        "Capitalization",
      );
    } else if (
      (isAmerican || isBritish) &&
      plainCase &&
      dialectWords.has(lower)
    ) {
      add(
        "dialect-spelling",
        offset,
        word.length,
        [matchCase(word, dialectWords.get(lower)!)],
        `Consider the ${isBritish ? "British" : "American"} English spelling for consistency.`,
        "Spelling consistency",
        "correctness",
        "spelling",
      );
    } else if (
      word === lower &&
      word.length >= 3 &&
      !options.externalSpelling &&
      options.categories?.correctness !== false
    ) {
      const spelling = inspectSpelling(word);
      // Detection does not depend on candidate generation succeeding.
      if (!spelling.correct) {
        add(
          "spelling",
          offset,
          word.length,
          [...spelling.suggestions],
          spelling.suggestions.length
            ? "This word may be misspelled."
            : "This word is not in the bundled dictionaries. It may be a name, specialist term, or misspelling.",
          spelling.suggestions.length
            ? "Possible spelling mistake"
            : "Unknown word",
          "correctness",
          "spelling",
        );
      }
    }
  }

  for (const match of prose.matchAll(/\b([A-Za-z]+)([ \t]+)\1\b/gi)) {
    // These repetitions can be grammatical: “I had had enough”, “the fact that that ...”.
    if (["had", "that"].includes(match[1].toLowerCase())) continue;
    add(
      "repeated-word",
      match.index!,
      match[0].length,
      [match[1]],
      "This word appears twice in a row.",
      "Repeated word",
    );
  }

  // A valid dictionary word can still be an auxiliary typo. Anchor to a
  // question/clause boundary so “The doe you think is small” remains valid.
  const questionStart = /(?:^|[.!?]\s+)(?:["“(]*)(?:(?:or|and|but)\s+)?/;
  for (const match of prose.matchAll(
    new RegExp(
      questionStart.source +
        String.raw`(doe)\s+(you|we|they|I)\s+(?:think|believe|want|need|know|have|like|agree|see|mean|feel|suppose|remember|understand)\b`,
      "gi",
    ),
  )) {
    const offset = match.index! + match[0].toLowerCase().indexOf("doe");
    add(
      "auxiliary-do",
      offset,
      3,
      [matchCase(match[1], "do")],
      "Use the auxiliary “do” in this question. “Doe” names a female deer.",
      "Auxiliary verb",
    );
  }
  for (const match of prose.matchAll(
    new RegExp(
      questionStart.source +
        String.raw`(?:do|doe)\s+(?:you|we|they|I)\s+(?:think|believe|feel|suppose)\s+(is|was)\s+(?:good|bad|necessary|possible|important|safe|ready|right|wrong|true|useful|enough)\b`,
      "gi",
    ),
  )) {
    // Repair only the copula; the auxiliary can be fixed independently.
    const relative = match[0].search(/\b(?:is|was)\b/i);
    add(
      "missing-clause-subject",
      match.index! + relative,
      match[1].length,
      [`it ${match[1].toLowerCase()}`],
      "This clause needs a subject before the verb. Consider “it”.",
      "Missing subject",
    );
  }

  const agreement: Array<[RegExp, string]> = [
    [/\bI (?:is|are)\b/g, "I am"],
    [/\bI has\b/g, "I have"],
    [/\b(you|we|they) is\b/gi, "$1 are"],
    [/\b(you|we|they) has\b/gi, "$1 have"],
    [/\b(he|she|it) are\b/gi, "$1 is"],
    [/\b(he|she|it) have\b/gi, "$1 has"],
    [/\b(he|she|it) were\b/gi, "$1 was"],
    [/\b(you|we|they) was\b/gi, "$1 were"],
  ];
  for (const [pattern, replacement] of agreement) {
    for (const match of prose.matchAll(pattern)) {
      if (
        pattern.source.includes("were") &&
        /\b(?:if|wish|though)\b[^.!?]*$/i.test(
          prose.slice(Math.max(0, match.index! - 80), match.index!),
        )
      )
        continue;
      const corrected = matchCase(
        match[0],
        match[0].replace(pattern, replacement),
      );
      add(
        "subject-verb-agreement",
        match.index!,
        match[0].length,
        [corrected],
        "The subject and verb may not agree.",
        "Subject–verb agreement",
      );
    }
  }

  for (const match of prose.matchAll(/\b(a|an) ([A-Za-z]+)\b/gi)) {
    const article = match[1].toLowerCase();
    const next = match[2].toLowerCase();
    // Acronyms, names and numbers need pronunciation knowledge; leave them alone.
    if (match[2] !== next) continue;
    const vowelSound =
      /^(?:honest|honou?r|hour|heir)/.test(next) ||
      (/^[aeiou]/.test(next) &&
        !/^(?:uni(?:vers|on|que|t|form|corn|cycle|lateral|direc)|us(?:e|ual|age)|util|euro|ewe|one|once|ubiq)/.test(
          next,
        ));
    const expected = vowelSound ? "an" : "a";
    if (expected !== article)
      add(
        "indefinite-article",
        match.index!,
        match[1].length,
        [matchCase(match[1], expected)],
        "Choose the article that matches the following sound.",
        "Article usage",
      );
  }

  const confusions: Array<[RegExp, string, string]> = [
    [
      /\btheir (are|is)\b/gi,
      "there $1",
      "Use “there” to introduce something that exists.",
    ],
    [
      /\byou['’]re (feedback|opinion|thoughts|suggestions|comments|address|email|password|account|name|phone|number|message|report|document|work|help|support|time|team|project|website|order|payment|subscription)\b/gi,
      "your $1",
      "Use the possessive “your” before this noun. “You’re” means “you are.”",
    ],
    [/\byour welcome\b/gi, "you're welcome", "Use “you’re” to mean “you are.”"],
    [/\bcould of\b/gi, "could have", "Use “have” after this modal verb."],
    [/\bshould of\b/gi, "should have", "Use “have” after this modal verb."],
    [/\bwould of\b/gi, "would have", "Use “have” after this modal verb."],
    [/\bmust of\b/gi, "must have", "Use “have” after this modal verb."],
    [/\bmore better\b/gi, "better", "“Better” already expresses a comparison."],
    [/\bmore easier\b/gi, "easier", "“Easier” already expresses a comparison."],
    [/\bmost best\b/gi, "best", "“Best” already expresses the highest degree."],
    [
      /\bbetween you and I\b/gi,
      "between you and me",
      "Use the object pronoun after “between.”",
    ],
  ];
  for (const [pattern, replacement, message] of confusions) {
    for (const match of prose.matchAll(pattern))
      add(
        "word-choice",
        match.index!,
        match[0].length,
        [matchCase(match[0], match[0].replace(pattern, replacement))],
        message,
        "Word choice",
      );
  }

  // Require prose on both sides; indentation, alignment and paragraph breaks stay intact.
  for (const match of prose.matchAll(/([A-Za-z,;:!?])[ \t]{2,}(?=[A-Za-z])/g)) {
    const gap = match[0].slice(1);
    if (gap.includes("\t")) continue;
    add(
      "extra-space",
      match.index! + 1,
      gap.length,
      [" "],
      "A single space is usually enough between words.",
      "Extra space",
    );
  }
  for (const match of prose.matchAll(/\b([A-Za-z]+)( +)([,;!?])/g)) {
    add(
      "space-before-punctuation",
      match.index! + match[1].length,
      match[2].length,
      [""],
      "Remove the space before this punctuation mark.",
      "Punctuation spacing",
    );
  }
  for (const match of prose.matchAll(/([,;:!?])([A-Za-z])/g)) {
    // Leave times, scheme separators, emoji shortcodes and punctuation runs alone.
    const start = match.index!;
    if (
      match[1] === ":" &&
      /(?:^|\s):$/.test(prose.slice(Math.max(0, start - 1), start + 1))
    )
      continue;
    add(
      "space-after-punctuation",
      start,
      match[0].length,
      [`${match[1]} ${match[2]}`],
      "Add a space after this punctuation mark.",
      "Punctuation spacing",
    );
  }

  // Only capitalize an unambiguous sentence boundary; abbreviations are excluded.
  const abbreviation =
    /\b(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|vs|etc|e\.g|i\.e|[A-Z])\.$/i;
  for (const match of prose.matchAll(/(?:^|[.!?][\s]+)(["“'‘(]*)([a-z])/g)) {
    const offset = match.index! + match[0].length - 1;
    const boundary = prose.slice(match.index!, offset);
    if (boundary !== text.slice(match.index!, offset)) continue;
    const before = prose.slice(
      0,
      match.index! + (boundary.startsWith(".") ? 1 : 0),
    );
    if (boundary.startsWith(".") && abbreviation.test(before)) continue;
    if (offset !== 0 && !/[.!?]/.test(boundary)) continue;
    // Lowercase letter names and stylistic initials are too ambiguous here.
    if (/^[a-z]\b/.test(prose.slice(offset)) && prose[offset] !== "i") continue;
    add(
      "sentence-capitalization",
      offset,
      1,
      [prose[offset].toUpperCase()],
      "Consider starting this sentence with a capital letter.",
      "Sentence capitalization",
    );
  }

  for (const [pattern, replacement, message] of WORDINESS) {
    for (const match of prose.matchAll(pattern))
      add(
        "wordiness",
        match.index!,
        match[0].length,
        [matchCase(match[0], replacement)],
        message,
        "Consider a shorter phrase",
        "clarity",
        "style",
      );
  }

  const strongerPhrases: Array<[RegExp, string]> = [
    [/\bvery good\b/gi, "great"],
    [/\bvery important\b/gi, "essential"],
    [/\bvery big\b/gi, "large"],
    [/\bvery quickly\b/gi, "rapidly"],
  ];
  for (const [pattern, replacement] of strongerPhrases) {
    for (const match of prose.matchAll(pattern))
      add(
        "stronger-expression",
        match.index!,
        match[0].length,
        [matchCase(match[0], replacement)],
        `For a stronger expression, consider “${replacement}” if it matches your meaning.`,
        "Consider a stronger expression",
        "engagement",
        "style",
      );
  }

  for (const match of prose.matchAll(/\bI just wanted to\b/gi)) {
    add(
      "direct-expression",
      match.index!,
      match[0].length,
      ["I wanted to"],
      "For a more direct tone, consider removing “just.” Keep it if you prefer a softer request.",
      "Consider a more direct tone",
      "delivery",
      "style",
    );
  }
  for (const match of prose.matchAll(/\bI think maybe\b/gi)) {
    add(
      "hesitant-expression",
      match.index!,
      match[0].length,
      [],
      "This phrase may sound hesitant. If you are certain, consider stating your point more directly.",
      "Consider your level of certainty",
      "delivery",
      "style",
    );
  }

  // This is an advisory, with no automatic rewrite: an active version needs an actor.
  const participles =
    "(?:written|sent|made|given|seen|taken|done|built|chosen|found|shown|known|approved|created|completed|reviewed|discussed|delivered|published|received|prepared|designed|developed|tested|rejected|submitted|provided|requested|reported|used)";
  for (const match of prose.matchAll(
    new RegExp(
      `\\b(?:is|are|was|were|be|been|being) (?:being |been )?${participles} by\\b`,
      "gi",
    ),
  )) {
    add(
      "passive-voice",
      match.index!,
      match[0].length,
      [],
      "This may be passive voice. If the actor matters, consider making them the subject.",
      "Consider active voice",
      "clarity",
      "style",
    );
  }

  for (const match of prose.matchAll(/!{3,}/g))
    add(
      "excessive-exclamation",
      match.index!,
      match[0].length,
      ["!"],
      "One exclamation mark is usually enough to convey emphasis.",
      "Strong emphasis",
      "delivery",
      "style",
    );

  return issues.sort(
    (a, b) => a.offset - b.offset || a.ruleId.localeCompare(b.ruleId),
  );
}

export function analyzeText(text: string) {
  return textStatistics(text, checkText(text));
}
