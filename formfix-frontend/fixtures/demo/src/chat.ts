import type { ChatAnswer, Language, SourceRef } from '@formfix/contracts';
import { demoExplanation } from './explanations.js';
import { demoFormModel } from './form-model.js';

type Phrases = Record<Language, string>;

const t = (en: string, hi: string, te: string, mr: string): Phrases => ({ en, hi, te, mr });

const PHRASES = {
  requiredYes: t(
    'Yes. The form marks this question required.',
    'हाँ। फ़ॉर्म इस प्रश्न को अनिवार्य बताता है।',
    'అవును. ఈ ప్రశ్న తప్పనిసరి అని ఫారం చెబుతోంది.',
    'होय. फॉर्म हा प्रश्न आवश्यक असल्याचे सांगतो.',
  ),
  requiredOptional: t(
    'No. The form marks this question optional.',
    'नहीं। फ़ॉर्म इस प्रश्न को वैकल्पिक बताता है।',
    'లేదు. ఈ ప్రశ్న ఐచ్ఛికమని ఫారం చెబుతోంది.',
    'नाही. फॉर्म हा प्रश्न ऐच्छिक असल्याचे सांगतो.',
  ),
  requiredConditional: t(
    'It depends. The form asks for this only in one case:',
    'यह निर्भर करता है। फ़ॉर्म इसे केवल एक स्थिति में माँगता है:',
    'ఇది ఆధారపడి ఉంటుంది. ఒక సందర్భంలో మాత్రమే ఫారం దీనిని అడుగుతోంది:',
    'हे अवलंबून आहे. फॉर्म हे फक्त एका परिस्थितीत विचारतो:',
  ),
  requiredUnknown: t(
    'The form does not say whether this question must be answered. Nothing on the six pages settles it.',
    'फ़ॉर्म यह नहीं बताता कि इस प्रश्न का उत्तर देना ज़रूरी है या नहीं। छह पृष्ठों में कहीं भी यह स्पष्ट नहीं है।',
    'ఈ ప్రశ్నకు జవాబు ఇవ్వాలా వద్దా అనేది ఫారం చెప్పలేదు. ఆరు పేజీలలో ఎక్కడా ఇది స్పష్టంగా లేదు.',
    'या प्रश्नाचे उत्तर देणे आवश्यक आहे का, हे फॉर्म सांगत नाही. सहा पानांत कुठेही हे स्पष्ट होत नाही.',
  ),
  documentsIntro: t(
    'The form asks for three documents:',
    'फ़ॉर्म तीन दस्तावेज़ माँगता है:',
    'ఫారం మూడు పత్రాలను అడుగుతోంది:',
    'फॉर्म तीन कागदपत्रे मागतो:',
  ),
  notFound: t(
    'The form does not mention this anywhere on its six pages, so there is nothing here to tell you. Ask the office that issued the form.',
    'फ़ॉर्म के छह पृष्ठों में इसका कहीं उल्लेख नहीं है, इसलिए यहाँ बताने को कुछ नहीं है। फ़ॉर्म जारी करने वाले कार्यालय से पूछें।',
    'ఈ ఫారం ఆరు పేజీలలో దీని గురించి ఎక్కడా లేదు, కాబట్టి ఇక్కడ చెప్పడానికి ఏమీ లేదు. ఫారం ఇచ్చిన కార్యాలయాన్ని అడగండి.',
    'फॉर्मच्या सहा पानांत याचा कुठेही उल्लेख नाही, त्यामुळे इथे सांगण्यासारखे काही नाही. फॉर्म देणाऱ्या कार्यालयाला विचारा.',
  ),
  aadhaarNotFound: t(
    'This form never mentions Aadhaar. It names a student identity card, a provisional admission letter, an income declaration and a bank passbook — nothing else. I cannot tell you that Aadhaar is accepted, because the form does not say so.',
    'यह फ़ॉर्म आधार का कोई उल्लेख नहीं करता। इसमें विद्यार्थी पहचान पत्र, अस्थायी प्रवेश पत्र, आय घोषणा और बैंक पासबुक का नाम है — और कुछ नहीं। मैं यह नहीं कह सकता कि आधार स्वीकार्य है, क्योंकि फ़ॉर्म ऐसा नहीं कहता।',
    'ఈ ఫారంలో ఆధార్ గురించి ఎక్కడా లేదు. ఇందులో విద్యార్థి గుర్తింపు కార్డు, తాత్కాలిక ప్రవేశ లేఖ, ఆదాయ ప్రకటన, బ్యాంక్ పాస్‌బుక్ మాత్రమే ఉన్నాయి. ఆధార్ అంగీకరిస్తారని చెప్పలేను, ఎందుకంటే ఫారం అలా చెప్పలేదు.',
    'या फॉर्ममध्ये आधारचा कुठेही उल्लेख नाही. यात विद्यार्थी ओळखपत्र, तात्पुरते प्रवेशपत्र, उत्पन्नाचे प्रतिज्ञापत्र आणि बँक पासबुक एवढेच नमूद आहे. आधार चालतो असे मी सांगू शकत नाही, कारण फॉर्म तसे सांगत नाही.',
  ),
  clarify: t(
    'I can look this up in the form, but I need a little more to go on.',
    'मैं इसे फ़ॉर्म में देख सकता हूँ, पर थोड़ा और बताना होगा।',
    'నేను దీనిని ఫారంలో చూడగలను, కానీ కొంచెం ఎక్కువ సమాచారం కావాలి.',
    'मी हे फॉर्ममध्ये पाहू शकतो, पण थोडी अधिक माहिती हवी.',
  ),
  clarifyQuestion: t(
    'Which question or which document do you mean?',
    'आपका मतलब किस प्रश्न या किस दस्तावेज़ से है?',
    'మీరు ఏ ప్రశ్న గురించి లేదా ఏ పత్రం గురించి అడుగుతున్నారు?',
    'तुम्हाला कोणता प्रश्न किंवा कोणते कागदपत्र अभिप्रेत आहे?',
  ),
  noFieldContext: t(
    'Open a question in the guide first, then ask this again and I will answer for that question.',
    'पहले गाइड में कोई प्रश्न खोलें, फिर यह दोबारा पूछें — मैं उसी प्रश्न के लिए उत्तर दूँगा।',
    'ముందు గైడ్‌లో ఒక ప్రశ్నను తెరవండి, తరువాత మళ్ళీ అడగండి — ఆ ప్రశ్నకు జవాబు ఇస్తాను.',
    'आधी मार्गदर्शकामध्ये एखादा प्रश्न उघडा, मग पुन्हा विचारा — मी त्या प्रश्नासाठी उत्तर देईन.',
  ),
} satisfies Record<string, Phrases>;

const MATCHERS: { intent: string; patterns: RegExp[] }[] = [
  { intent: 'aadhaar', patterns: [/aadhaar|aadhar|आधार|ఆధార్/i] },
  {
    intent: 'documents',
    patterns: [/which document|what document|documents?\b|दस्तावे|పత్ర|कागदपत्र/i],
  },
  {
    intent: 'required',
    patterns: [/required|compulsory|mandatory|must i|अनिवार्य|ज़रूरी|తప్పనిసరి|आवश्यक/i],
  },
  {
    intent: 'what-to-enter',
    patterns: [/what (should|do) i (enter|write|put|fill)|how do i fill|क्या लिख|कसे भर|ఏమి రాయ|इथे काय/i],
  },
];

const VAGUE = /^(\s*(help|hi|hello|\?|ok|idk|what|namaste|नमस्ते)\s*[?.!]*\s*)$/i;

function documentsAnswer(language: Language): ChatAnswer {
  const lines = demoFormModel.documentRequirements.map((r) => {
    const status =
      r.requiredStatus === 'conditional'
        ? ` — ${r.condition?.describe ?? 'only in some cases'}`
        : r.requiredStatus === 'required'
          ? ' — required'
          : '';
    const alt = r.alternatives.length
      ? ` Instead of this the form also accepts: ${r.alternatives.join(', ')}.`
      : '';
    return `- **${r.labelOriginal}**${status}.${alt}`;
  });
  return {
    status: 'answered',
    answer: `${PHRASES.documentsIntro[language]}\n\n${lines.join('\n')}`,
    language,
    sources: demoFormModel.documentRequirements.flatMap((r) => r.sources),
  };
}

function requiredAnswer(fieldId: string, language: Language): ChatAnswer {
  const field = demoFormModel.fields.find((f) => f.id === fieldId);
  if (!field) {
    return {
      status: 'needs_clarification',
      answer: PHRASES.noFieldContext[language],
      language,
      sources: [],
      clarificationQuestion: PHRASES.clarifyQuestion[language],
    };
  }
  if (field.requiredStatus === 'unknown') {
    return {
      status: 'not_found',
      answer: PHRASES.requiredUnknown[language],
      language,
      sources: field.sources,
    };
  }
  const body =
    field.requiredStatus === 'required'
      ? PHRASES.requiredYes[language]
      : field.requiredStatus === 'optional'
        ? PHRASES.requiredOptional[language]
        : `${PHRASES.requiredConditional[language]} ${field.condition?.describe ?? ''}`.trim();
  return { status: 'answered', answer: body, language, sources: field.sources };
}

function whatToEnterAnswer(fieldId: string | undefined, language: Language): ChatAnswer {
  if (!fieldId) {
    return {
      status: 'needs_clarification',
      answer: PHRASES.noFieldContext[language],
      language,
      sources: [],
      clarificationQuestion: PHRASES.clarifyQuestion[language],
    };
  }
  const explanation = demoExplanation(fieldId, language);
  if (!explanation) {
    return {
      status: 'not_found',
      answer: PHRASES.notFound[language],
      language,
      sources: [],
    };
  }
  const example = explanation.example
    ? `\n\n_${language === 'en' ? 'Fictional example' : 'Example'}: ${explanation.example.replace(/\n/g, ', ')}_`
    : '';
  return {
    status: 'answered',
    answer: `${explanation.whatToEnter}${example}`,
    language,
    sources: explanation.sources,
  };
}

/**
 * The demo's deterministic stand-in for a grounded model call. It only ever
 * answers from the fixture document; anything it cannot find comes back as
 * `not_found` rather than an invented claim.
 */
export function demoAsk(
  question: string,
  fieldId: string | undefined,
  language: Language,
): ChatAnswer {
  const q = question.trim();

  if (VAGUE.test(q) || q.length < 4) {
    return {
      status: 'needs_clarification',
      answer: PHRASES.clarify[language],
      language,
      sources: [],
      clarificationQuestion: PHRASES.clarifyQuestion[language],
    };
  }

  const intent = MATCHERS.find((m) => m.patterns.some((p) => p.test(q)))?.intent;

  switch (intent) {
    case 'aadhaar':
      return {
        status: 'not_found',
        answer: PHRASES.aadhaarNotFound[language],
        language,
        sources: demoFormModel.documentRequirements.flatMap((r) => r.sources).slice(0, 2),
      };
    case 'documents':
      return documentsAnswer(language);
    case 'required':
      return requiredAnswer(fieldId ?? '', language);
    case 'what-to-enter':
      return whatToEnterAnswer(fieldId, language);
    default:
      return {
        status: 'not_found',
        answer: PHRASES.notFound[language],
        language,
        sources: [] as SourceRef[],
      };
  }
}
