/**
 * Display name generator for anonymous (public) users in the
 * collaboration caret.
 *
 * Public viewers don't have a Discord account so their username
 * resolves to `undefined`, which previously rendered as the literal
 * string "undefined" next to their caret. This module produces a
 * random alliterative handle in the form `"<adjective> <animal>"`
 * (e.g. "confused koala", "bad bear") so every anonymous viewer
 * shows up with a friendly, distinguishable label.
 *
 * The lists are intentionally large: with N adjectives and M animals
 * spread across overlapping first letters, the helper picks one of
 * K letters and one adjective + one animal from that letter group,
 * giving roughly sum(K * A_k * O_k) distinct combinations.
 */

export const PUBLIC_USER_ADJECTIVES: readonly string[] = [
  // A
  "amused",
  "ancient",
  "angry",
  "anxious",
  "astonished",
  // B
  "bad",
  "bashful",
  "bewildered",
  "bold",
  "brave",
  "bright",
  "bubbly",
  "busy",
  // C
  "calm",
  "cheerful",
  "clever",
  "clumsy",
  "confused",
  "cozy",
  "cranky",
  "curious",
  "cute",
  // D
  "dainty",
  "dapper",
  "daring",
  "dashing",
  "dizzy",
  "dorky",
  "dreamy",
  // E
  "eager",
  "earnest",
  "eccentric",
  "elated",
  "enchanted",
  "energetic",
  // F
  "fancy",
  "fearless",
  "festive",
  "fluffy",
  "foolish",
  "friendly",
  "funky",
  "fuzzy",
  // G
  "gallant",
  "gentle",
  "gigantic",
  "gloomy",
  "glorious",
  "graceful",
  "groovy",
  "grumpy",
  // H
  "happy",
  "hearty",
  "heroic",
  "hilarious",
  "hopeful",
  "humble",
  "hungry",
  // I
  "icy",
  "idle",
  "industrious",
  "innocent",
  "itchy",
  // J
  "jolly",
  "jovial",
  "joyful",
  "jumpy",
  // K
  "keen",
  "kind",
  "kooky",
  // L
  "lazy",
  "lively",
  "lonely",
  "loud",
  "lucky",
  "luminous",
  "lyrical",
  // M
  "magical",
  "majestic",
  "merry",
  "mighty",
  "mischievous",
  "modest",
  "muddy",
  "mysterious",
  // N
  "naughty",
  "nervous",
  "nimble",
  "noble",
  "nostalgic",
  // O
  "odd",
  "offbeat",
  "optimistic",
  "outstanding",
  // P
  "patient",
  "peaceful",
  "peppy",
  "perplexed",
  "playful",
  "plucky",
  "polite",
  "proud",
  // Q
  "quacky",
  "quick",
  "quiet",
  "quirky",
  // R
  "rapid",
  "regal",
  "relieved",
  "restless",
  "royal",
  "rustic",
  // S
  "sassy",
  "shady",
  "shy",
  "silly",
  "sleepy",
  "snuggly",
  "sparkling",
  "stealthy",
  "stubborn",
  "sunny",
  // T
  "tame",
  "tangy",
  "thoughtful",
  "timid",
  "tiny",
  "tipsy",
  "tireless",
  // U
  "unlucky",
  "upbeat",
  // V
  "valiant",
  "vigilant",
  "vivid",
  // W
  "wandering",
  "weary",
  "whiskery",
  "wicked",
  "wise",
  "witty",
  "wobbly",
  // X
  "xenial",
  // Y
  "yawning",
  "youthful",
  "yummy",
  // Z
  "zany",
  "zealous",
  "zippy",
];

export const PUBLIC_USER_OBJECTS: readonly string[] = [
  // A
  "alligator",
  "alpaca",
  "anaconda",
  "antelope",
  "armadillo",
  // B
  "baboon",
  "badger",
  "bear",
  "beetle",
  "buffalo",
  "butterfly",
  // C
  "capybara",
  "caribou",
  "cat",
  "chameleon",
  "cheetah",
  "chimpanzee",
  "cobra",
  "crab",
  "crow",
  // D
  "deer",
  "dog",
  "dolphin",
  "donkey",
  "dragon",
  "duck",
  // E
  "eagle",
  "eel",
  "elephant",
  "elk",
  "emu",
  // F
  "falcon",
  "ferret",
  "flamingo",
  "fox",
  "frog",
  // G
  "gazelle",
  "giraffe",
  "goat",
  "goose",
  "gopher",
  "gorilla",
  // H
  "hamster",
  "hawk",
  "hedgehog",
  "heron",
  "hippo",
  "horse",
  // I
  "ibex",
  "iguana",
  "impala",
  // J
  "jaguar",
  "jellyfish",
  // K
  "kangaroo",
  "kingfisher",
  "koala",
  // L
  "lemur",
  "leopard",
  "lion",
  "lizard",
  "llama",
  "lobster",
  // M
  "magpie",
  "manatee",
  "mongoose",
  "monkey",
  "moose",
  "mouse",
  // N
  "narwhal",
  "newt",
  "nightingale",
  "nutria",
  // O
  "octopus",
  "okapi",
  "orangutan",
  "otter",
  "owl",
  "ox",
  // P
  "panda",
  "panther",
  "parrot",
  "peacock",
  "pelican",
  "penguin",
  "pig",
  "pigeon",
  "platypus",
  "pony",
  "puffin",
  // Q
  "quail",
  "quokka",
  // R
  "rabbit",
  "raccoon",
  "ram",
  "raven",
  "reindeer",
  "rhino",
  // S
  "salamander",
  "salmon",
  "seal",
  "shark",
  "sheep",
  "sloth",
  "snail",
  "sparrow",
  "squid",
  "squirrel",
  "swan",
  // T
  "tapir",
  "tiger",
  "toad",
  "toucan",
  "turkey",
  "turtle",
  // U
  "umbrellabird",
  "urial",
  // V
  "vulture",
  // W
  "walrus",
  "warthog",
  "weasel",
  "whale",
  "wolf",
  "wombat",
  "woodpecker",
  // X
  "xerus",
  // Y
  "yak",
  "yellowhammer",
  // Z
  "zebra",
  "zebu",
];

function groupByFirstLetter(words: readonly string[]): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  for (const word of words) {
    const letter = word[0];
    const bucket = groups.get(letter);
    if (bucket) {
      bucket.push(word);
    } else {
      groups.set(letter, [word]);
    }
  }
  return groups;
}

const adjectivesByLetter = groupByFirstLetter(PUBLIC_USER_ADJECTIVES);
const objectsByLetter = groupByFirstLetter(PUBLIC_USER_OBJECTS);

const sharedLetters: string[] = [];
for (const letter of adjectivesByLetter.keys()) {
  if (objectsByLetter.has(letter)) {
    sharedLetters.push(letter);
  }
}

/**
 * Returns a random alliterative handle like "confused koala" or
 * "bad bear". Both words always start with the same letter.
 *
 * Pure with respect to module state: results vary only because of
 * `Math.random`. Callers that want a stable name for a session
 * (e.g. a caret label) should cache the result.
 */
export function generatePublicUserName(): string {
  const letter =
    sharedLetters[Math.floor(Math.random() * sharedLetters.length)];
  const adjectives = adjectivesByLetter.get(letter)!;
  const objects = objectsByLetter.get(letter)!;
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const object = objects[Math.floor(Math.random() * objects.length)];
  return `${adjective} ${object}`;
}

/**
 * Up-to-two-letter abbreviation for a user's display name, used as
 * the avatar `children` when no profile picture is resolved.
 *
 *   - First letter of each of the first two words for multi-word
 *     names ("confused koala" -> "CK", "alice cooper" -> "AC").
 *   - First two letters of the first word for single-word names
 *     ("alice" -> "AL", Discord handles without spaces).
 *
 * Falls back to "?" when the input is missing or whitespace-only
 * so the avatar never renders an empty circle.
 */
export function displayInitials(name: string | undefined): string {
  if (!name) return "?";
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length >= 2) {
    return ((words[0]?.[0] ?? "") + (words[1]?.[0] ?? "")).toUpperCase();
  }
  return words[0]!.slice(0, 2).toUpperCase();
}
