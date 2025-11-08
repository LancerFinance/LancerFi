/**
 * Profanity and Slur Filter Utility
 * Filters inappropriate language from user input
 */

import { Filter } from 'bad-words';

// Comprehensive list of slurs and offensive terms
// This list includes actual offensive terms that should be filtered
const EXTENDED_SLURS = [
  // Racial slurs - comprehensive list
  'nigger', 'nigga', 'niggar', 'niggah', 'nigguh', 'niggur', 'nigguhs', 'niggers', 'niggaz', 'n1gg3r', 'n1gga', 'nigg3r',
  'kike', 'kyke', 'k1ke', 'kikes',
  'chink', 'ch1nk', 'chinks', 'chinky',
  'gook', 'g00k', 'gooks',
  'spic', 'sp1c', 'spics', 'spick',
  'wetback', 'wetbacks',
  'beaner', 'beaners',
  'towelhead', 'towelheads',
  'sandnigger', 'sandn1gger', 'sandnigga',
  'raghead', 'ragheads',
  'cameljockey', 'cameljockeys',
  'taco', 'tacos', // when used as slur
  'jap', 'japs', // when used as slur
  'gyp', 'gyps', 'gypsy', // when used as slur
  'paki', 'pak1', 'pakis', // when used as slur
  'cholo', 'cholos',
  'coon', 'coons', 'c00n',
  'porchmonkey', 'porchmonkeys',
  'junglebunny', 'junglebunnies',
  'zipperhead', 'zipperheads',
  'slant', 'slants', 'slanteye', 'slanteyes',
  'gook', 'gooks',
  'mick', 'micks', // when used as slur
  'dago', 'dagos', // when used as slur
  'wop', 'wops', // when used as slur
  'kraut', 'krauts', // when used as slur
  'frog', 'frogs', // when used as slur
  'limey', 'limeys', // when used as slur
  'yid', 'yids', // when used as slur
  'heeb', 'heebs', // when used as slur
  'redskin', 'redskins',
  'injun', 'injuns',
  'squaw', 'squaws',
  'halfbreed', 'halfbreeds',
  'mulatto', 'mulattos',
  'oreo', 'oreos', // when used as slur
  'banana', 'bananas', // when used as slur
  'twinkie', 'twinkies', // when used as slur
  'coconut', 'coconuts', // when used as slur
  'apple', 'apples', // when used as slur (red on outside, white on inside)
  
  // Homophobic slurs
  'faggot', 'faggots', 'fag', 'fags', 'fagg', 'faggs', 'f4ggot', 'f4g', 'f4gg',
  'fagot', 'fagots',
  'dyke', 'dykes', 'dike', 'dikes', 'd1ke',
  'queer', 'queers', // when used as slur
  'homo', 'homos', // when used as slur
  'tranny', 'trannies', 'trannys',
  'shemale', 'shemales',
  'he-she', 'heshe',
  
  // Transphobic slurs
  'trap', 'traps', // when used as slur
  
  // Ableist slurs
  'retard', 'retards', 'retarded', 'r3tard', 'r3tarded',
  'retardation',
  'spaz', 'spazz', 'spazzes',
  'cripple', 'cripples', 'crippled',
  'midget', 'midgets',
  'mongoloid', 'mongoloids',
  
  // Other offensive terms
  'whore', 'whores', 'wh0re',
  'slut', 'sluts', 'slutt',
  'cunt', 'cunts', 'c0nt', 'cunty',
  'pussy', 'pussies', 'pussys', // when used as slur
  'bitch', 'bitches', 'b1tch',
  'bastard', 'bastards',
  'asshole', 'assholes', 'ashole',
  'dickhead', 'dickheads',
  'motherfucker', 'motherfuckers', 'mothafucker', 'mothafuckers',
  'cocksucker', 'cocksuckers',
  'douchebag', 'douchebags',
  'scumbag', 'scumbags',
  
  // Common misspellings and variations
  'n1gga', 'n1gger', 'nigg@', 'n1gg@',
  'f4ggot', 'f4g', 'f@g',
  'k1ke', 'k1k3',
  'ch1nk', 'ch1nky',
  'sp1c', 'sp1ck',
];

// Create filter instance with custom settings
const filter = new Filter({
  emptyList: false, // Use default list
  list: EXTENDED_SLURS, // Add custom words
  placeHolder: '*',
  regex: /\w/g,
  replaceRegex: /\w/g,
  splitRegex: /\b/,
});

// Additional custom words to filter (common profanity)
const CUSTOM_BAD_WORDS = [
  // Strong profanity
  'fuck', 'fucks', 'fucking', 'fucked', 'fucker', 'fuckers',
  'shit', 'shits', 'shitting', 'shitted', 'shitty',
  'damn', 'damned', 'damnit',
  'ass', 'asses', 'asshole', 'assholes',
  'bitch', 'bitches',
  'bastard', 'bastards',
  'piss', 'pissed', 'pissing',
  'crap', 'craps',
  'hell', // when used as profanity
];

// Add custom words to filter
CUSTOM_BAD_WORDS.forEach(word => {
  filter.addWords(word);
});

/**
 * Check if text contains profanity or slurs (including embedded slurs)
 * @param text - Text to check
 * @returns Object with isProfane boolean and details
 */
export function checkForProfanity(text: string): {
  isProfane: boolean;
  profaneWords: string[];
  cleanText: string;
} {
  if (!text || typeof text !== 'string') {
    return {
      isProfane: false,
      profaneWords: [],
      cleanText: text || '',
    };
  }

  // Normalize text for better detection (handle common obfuscation)
  const normalizedText = text
    .toLowerCase()
    .replace(/[0@]/g, 'o')
    .replace(/[1!]/g, 'i')
    .replace(/[3]/g, 'e')
    .replace(/[4]/g, 'a')
    .replace(/[5]/g, 's')
    .replace(/[7]/g, 't')
    .replace(/[@]/g, 'a')
    .replace(/[$]/g, 's')
    .replace(/[!]/g, 'i');
  
  // Check if text is profane (whole text check)
  let isProfane = filter.isProfane(normalizedText) || filter.isProfane(text);
  
  // Get list of profane words found
  const profaneWords: string[] = [];
  const words = normalizedText.split(/\s+/);
  
  // Check individual words
  words.forEach(word => {
    // Remove punctuation for checking
    const cleanWord = word.replace(/[^\w]/g, '');
    if (cleanWord && (filter.isProfane(cleanWord) || filter.isProfane(word))) {
      if (!profaneWords.includes(cleanWord)) {
        profaneWords.push(cleanWord);
      }
    }
  });
  
  // Also check original text for exact matches
  const originalWords = text.toLowerCase().split(/\s+/);
  originalWords.forEach(word => {
    const cleanWord = word.replace(/[^\w]/g, '');
    if (cleanWord && filter.isProfane(cleanWord)) {
      if (!profaneWords.includes(cleanWord)) {
        profaneWords.push(cleanWord);
      }
    }
  });

  // CRITICAL: Check for embedded slurs (substring matching)
  // This catches cases like "dniggerdsf" where the slur is embedded
  const allSlurs = [...EXTENDED_SLURS, ...CUSTOM_BAD_WORDS];
  const textToCheck = normalizedText.replace(/[^\w]/g, ''); // Remove all non-word chars for substring check
  
  allSlurs.forEach(slur => {
    const normalizedSlur = slur.toLowerCase();
    // Check if slur appears as substring in the text
    if (textToCheck.includes(normalizedSlur) || normalizedText.includes(normalizedSlur)) {
      if (!profaneWords.includes(slur)) {
        profaneWords.push(slur);
        isProfane = true;
      }
    }
  });

  // Get cleaned version
  const cleanText = filter.clean(text);

  return {
    isProfane,
    profaneWords,
    cleanText,
  };
}

/**
 * Check for excessive repetition/spam in text
 * @param text - Text to check
 * @returns Object with isSpam boolean and details
 */
export function checkForRepetition(text: string): {
  isSpam: boolean;
  reason: string;
} {
  if (!text || typeof text !== 'string' || text.length < 10) {
    return {
      isSpam: false,
      reason: '',
    };
  }

  const normalizedText = text.toLowerCase().trim();
  
  // Check for excessive character repetition (e.g., "aaaaaaa", "dsfdsfdsfdsf")
  const charPattern = /(.)\1{10,}/; // Same character repeated 11+ times
  if (charPattern.test(normalizedText)) {
    return {
      isSpam: true,
      reason: 'Text contains excessive character repetition',
    };
  }

  // Check for excessive word repetition (e.g., "dsf dsf dsf dsf")
  const words = normalizedText.split(/\s+/).filter(w => w.length > 0);
  if (words.length > 5) {
    // Count occurrences of each word
    const wordCounts: Record<string, number> = {};
    words.forEach(word => {
      wordCounts[word] = (wordCounts[word] || 0) + 1;
    });
    
    // Check if any word appears more than 30% of the time (spam indicator)
    const maxRepetition = Math.max(...Object.values(wordCounts));
    const repetitionRatio = maxRepetition / words.length;
    
    if (repetitionRatio > 0.3 && maxRepetition >= 5) {
      return {
        isSpam: true,
        reason: 'Text contains excessive word repetition',
      };
    }
  }

  // Check for pattern repetition (e.g., "dsfdsfdsfdsf" - same pattern repeated)
  const patternRegex = /(.{2,10})\1{4,}/; // Pattern of 2-10 chars repeated 5+ times
  if (patternRegex.test(normalizedText.replace(/\s/g, ''))) {
    return {
      isSpam: true,
      reason: 'Text contains repetitive patterns',
    };
  }

  // Check for very short words repeated excessively (e.g., "dsf dsf dsf")
  const shortWords = words.filter(w => w.length <= 4);
  if (shortWords.length > 10) {
    const shortWordCounts: Record<string, number> = {};
    shortWords.forEach(word => {
      shortWordCounts[word] = (shortWordCounts[word] || 0) + 1;
    });
    
    const maxShortRepetition = Math.max(...Object.values(shortWordCounts));
    if (maxShortRepetition >= 8) {
      return {
        isSpam: true,
        reason: 'Text contains excessive repetition of short words',
      };
    }
  }

  return {
    isSpam: false,
    reason: '',
  };
}

/**
 * Check multiple text fields for profanity
 * @param fields - Object with field names and text values
 * @returns Object with overall result and per-field results
 */
export function checkFieldsForProfanity(fields: Record<string, string>): {
  hasProfanity: boolean;
  profaneFields: string[];
  fieldResults: Record<string, { isProfane: boolean; profaneWords: string[] }>;
} {
  const fieldResults: Record<string, { isProfane: boolean; profaneWords: string[] }> = {};
  const profaneFields: string[] = [];
  let hasProfanity = false;

  Object.entries(fields).forEach(([fieldName, fieldValue]) => {
    if (!fieldValue || typeof fieldValue !== 'string') {
      fieldResults[fieldName] = {
        isProfane: false,
        profaneWords: [],
      };
      return;
    }

    const result = checkForProfanity(fieldValue);
    fieldResults[fieldName] = {
      isProfane: result.isProfane,
      profaneWords: result.profaneWords,
    };

    if (result.isProfane) {
      hasProfanity = true;
      profaneFields.push(fieldName);
    }
  });

  return {
    hasProfanity,
    profaneFields,
    fieldResults,
  };
}

/**
 * Validate project form data for profanity and spam
 * Checks title, description, and skills
 */
export function validateProjectTextForProfanity(formData: {
  title: string;
  description: string;
  skills: string;
}): {
  isValid: boolean;
  errors: Record<string, string>;
  profaneFields: string[];
} {
  const errors: Record<string, string> = {};
  const profaneFields: string[] = [];

  // Check title
  const titleCheck = checkForProfanity(formData.title);
  if (titleCheck.isProfane) {
    errors.title = `Title contains inappropriate language. Please use professional language.`;
    profaneFields.push('title');
  }

  // Check description for profanity
  const descCheck = checkForProfanity(formData.description);
  if (descCheck.isProfane) {
    errors.description = `Description contains inappropriate language. Please use professional language.`;
    profaneFields.push('description');
  }

  // Check description for spam/repetition
  const descSpamCheck = checkForRepetition(formData.description);
  if (descSpamCheck.isSpam) {
    errors.description = `Description contains excessive repetition or spam. Please provide a meaningful project description.`;
    if (!profaneFields.includes('description')) {
      profaneFields.push('description');
    }
  }

  // Check skills (comma-separated list)
  if (formData.skills) {
    const skillsCheck = checkForProfanity(formData.skills);
    if (skillsCheck.isProfane) {
      errors.skills = `Skills field contains inappropriate language. Please use professional language.`;
      profaneFields.push('skills');
    }
  }

  return {
    isValid: profaneFields.length === 0,
    errors,
    profaneFields,
  };
}

