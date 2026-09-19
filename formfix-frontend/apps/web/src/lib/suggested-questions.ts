import type { Language } from '@formfix/contracts';

/** Starter questions offered in the chat drawer. UI copy, not fixture data. */
export const SUGGESTED_QUESTIONS: Record<Language, string[]> = {
  en: ['What should I enter here?', 'Is this required?', 'Which documents does the form ask for?'],
  hi: ['यहाँ क्या लिखूँ?', 'क्या यह अनिवार्य है?', 'फ़ॉर्म कौन-से दस्तावेज़ माँगता है?'],
  te: ['ఇక్కడ ఏమి రాయాలి?', 'ఇది తప్పనిసరా?', 'ఫారం ఏ పత్రాలు అడుగుతోంది?'],
  mr: ['इथे काय लिहू?', 'हे आवश्यक आहे का?', 'फॉर्म कोणती कागदपत्रे मागतो?'],
};

