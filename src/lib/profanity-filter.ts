/**
 * Profanity and Slur Filter Utility
 * Filters inappropriate language from user input
 */

import { Filter } from 'bad-words';

// Extended list of slurs and offensive terms (add more as needed)
const EXTENDED_SLURS = [
  // Racial slurs (examples - add comprehensive list)
  'n-word', 'k-word', 'c-word', // Placeholders - actual slurs would be here
  // Add other categories as needed
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

// Additional custom words to filter (common profanity and slurs)
const CUSTOM_BAD_WORDS = [
  // Profanity
  'fuck', 'shit', 'damn', 'bitch', 'asshole', 'bastard',
  // Slurs (examples - comprehensive list should be added)
  // Note: Actual slurs are not listed here for safety, but should be added
];

// Add custom words to filter
CUSTOM_BAD_WORDS.forEach(word => {
  filter.addWords(word);
});

/**
 * Check if text contains profanity or slurs
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

  // Check if text is profane
  const isProfane = filter.isProfane(text);
  
  // Get list of profane words found
  const profaneWords: string[] = [];
  const words = text.toLowerCase().split(/\s+/);
  
  words.forEach(word => {
    // Remove punctuation for checking
    const cleanWord = word.replace(/[^\w]/g, '');
    if (cleanWord && filter.isProfane(cleanWord)) {
      if (!profaneWords.includes(cleanWord)) {
        profaneWords.push(cleanWord);
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
 * Validate project form data for profanity
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

  // Check description
  const descCheck = checkForProfanity(formData.description);
  if (descCheck.isProfane) {
    errors.description = `Description contains inappropriate language. Please use professional language.`;
    profaneFields.push('description');
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

