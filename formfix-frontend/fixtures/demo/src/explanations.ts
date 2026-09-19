import { SCHEMA_VERSION, type Explanation, type Language } from '@formfix/contracts';
import { demoFormModel } from './form-model.js';

type Copy = { meaning: string; whatToEnter: string; example?: string };

/**
 * Plain-language explanations for every field, in every supported language.
 * Examples are fictional and clearly marked; nothing here is ever written
 * into the user's answer.
 */
const COPY: Record<string, Record<Language, Copy>> = {
  'fld-full-name': {
    en: {
      meaning:
        'The form wants your name exactly as it is printed on your student record — not a short form and not a nickname.',
      whatToEnter:
        'Copy the name from your student record or identity card, in the same order and the same spelling. Include a middle name if it appears there.',
      example: 'Meera Anand Kulkarni',
    },
    hi: {
      meaning:
        'फ़ॉर्म को आपका नाम ठीक वैसा ही चाहिए जैसा आपके विद्यार्थी रिकॉर्ड पर छपा है — छोटा रूप या घर का नाम नहीं।',
      whatToEnter:
        'अपने विद्यार्थी रिकॉर्ड या पहचान पत्र से नाम उसी क्रम और उसी वर्तनी में लिखें। यदि वहाँ मध्य नाम है तो उसे भी लिखें।',
      example: 'मीरा आनंद कुलकर्णी',
    },
    te: {
      meaning:
        'మీ విద్యార్థి రికార్డులో ముద్రించి ఉన్న విధంగానే మీ పూర్తి పేరు కావాలి — పొట్టి రూపం లేదా ముద్దుపేరు కాదు.',
      whatToEnter:
        'మీ విద్యార్థి రికార్డు లేదా గుర్తింపు కార్డు నుండి అదే వరుసలో, అదే స్పెల్లింగ్‌తో పేరు రాయండి. మధ్య పేరు ఉంటే దానిని కూడా చేర్చండి.',
      example: 'మీరా ఆనంద్ కులకర్ణి',
    },
    mr: {
      meaning:
        'तुमच्या विद्यार्थी नोंदीवर जसे छापले आहे तसेच नाव या फॉर्मला हवे आहे — लघुरूप किंवा टोपणनाव नाही.',
      whatToEnter:
        'तुमच्या विद्यार्थी नोंदीतून किंवा ओळखपत्रातून नाव त्याच क्रमाने आणि त्याच स्पेलिंगमध्ये लिहा. मधले नाव असल्यास तेही लिहा.',
      example: 'मीरा आनंद कुलकर्णी',
    },
  },

  'fld-dob': {
    en: {
      meaning: 'Your date of birth, written day first, then month, then the four-digit year.',
      whatToEnter:
        'Two digits for the day, two for the month and four for the year. The form shows this as DD/MM/YYYY.',
      example: '04/09/2004',
    },
    hi: {
      meaning: 'आपकी जन्म तिथि — पहले दिन, फिर महीना, फिर चार अंकों का वर्ष।',
      whatToEnter:
        'दिन के लिए दो अंक, महीने के लिए दो अंक और वर्ष के लिए चार अंक। फ़ॉर्म इसे DD/MM/YYYY के रूप में दिखाता है।',
      example: '04/09/2004',
    },
    te: {
      meaning: 'మీ పుట్టిన తేదీ — ముందు రోజు, తరువాత నెల, ఆ తరువాత నాలుగు అంకెల సంవత్సరం.',
      whatToEnter:
        'రోజుకు రెండు అంకెలు, నెలకు రెండు అంకెలు, సంవత్సరానికి నాలుగు అంకెలు. ఫారం దీనిని DD/MM/YYYY అని చూపుతుంది.',
      example: '04/09/2004',
    },
    mr: {
      meaning: 'तुमची जन्मतारीख — आधी दिवस, मग महिना, मग चार अंकी वर्ष.',
      whatToEnter:
        'दिवसासाठी दोन अंक, महिन्यासाठी दोन अंक आणि वर्षासाठी चार अंक. फॉर्म हे DD/MM/YYYY असे दाखवतो.',
      example: '04/09/2004',
    },
  },

  'fld-enrolment-no': {
    en: {
      meaning: 'The nine-digit number your institution gave you when you enrolled.',
      whatToEnter:
        'Copy all nine digits exactly. If your number begins with one or more zeros, keep them — they are part of the number.',
      example: '007412580',
    },
    hi: {
      meaning: 'नौ अंकों की वह संख्या जो नामांकन के समय आपके संस्थान ने आपको दी थी।',
      whatToEnter:
        'सभी नौ अंक ठीक वैसे ही लिखें। यदि संख्या शून्य से शुरू होती है तो शून्य भी लिखें — वे संख्या का हिस्सा हैं।',
      example: '007412580',
    },
    te: {
      meaning: 'మీరు చేరినప్పుడు మీ సంస్థ ఇచ్చిన తొమ్మిది అంకెల సంఖ్య.',
      whatToEnter:
        'తొమ్మిది అంకెలనూ అలాగే రాయండి. సంఖ్య సున్నాతో మొదలైతే ఆ సున్నాలను తీసివేయవద్దు — అవి సంఖ్యలో భాగమే.',
      example: '007412580',
    },
    mr: {
      meaning: 'प्रवेश घेतेवेळी तुमच्या संस्थेने दिलेला नऊ अंकी क्रमांक.',
      whatToEnter:
        'सर्व नऊ अंक जसेच्या तसे लिहा. क्रमांक शून्याने सुरू होत असेल तर ते शून्यही लिहा — ते क्रमांकाचा भाग आहेत.',
      example: '007412580',
    },
  },

  'fld-category': {
    en: {
      meaning:
        'Which of the three categories the form lists applies to you. The form asks you to tick exactly one.',
      whatToEnter:
        'Choose the one that matches your student record. If neither General nor Reserved applies, choose Other and name it in the next question.',
      example: 'General',
    },
    hi: {
      meaning:
        'फ़ॉर्म में दी गई तीन श्रेणियों में से कौन-सी आप पर लागू होती है। फ़ॉर्म केवल एक चुनने को कहता है।',
      whatToEnter:
        'वही चुनें जो आपके विद्यार्थी रिकॉर्ड से मेल खाती है। यदि General या Reserved में से कोई लागू नहीं होती, तो Other चुनें और अगले प्रश्न में उसका नाम लिखें।',
      example: 'General',
    },
    te: {
      meaning:
        'ఫారంలో ఇచ్చిన మూడు వర్గాలలో మీకు వర్తించేది ఏది. ఒక్కదానినే ఎంచుకోమని ఫారం చెబుతోంది.',
      whatToEnter:
        'మీ విద్యార్థి రికార్డుకు సరిపోయే దానిని ఎంచుకోండి. General లేదా Reserved వర్తించకపోతే Other ఎంచుకుని, తరువాతి ప్రశ్నలో దాని పేరు రాయండి.',
      example: 'General',
    },
    mr: {
      meaning:
        'फॉर्ममध्ये दिलेल्या तीन प्रवर्गांपैकी कोणता तुम्हाला लागू होतो. फॉर्म फक्त एकच निवडायला सांगतो.',
      whatToEnter:
        'तुमच्या विद्यार्थी नोंदीशी जुळणारा प्रवर्ग निवडा. General किंवा Reserved लागू नसेल तर Other निवडा आणि पुढील प्रश्नात त्याचे नाव लिहा.',
      example: 'General',
    },
  },

  'fld-category-other': {
    en: {
      meaning:
        'A place to write the category name when the first two boxes do not apply to you.',
      whatToEnter:
        'Fill this only if you chose Other in question 4. If you chose General or Reserved, leave it blank.',
      example: 'Sports quota',
    },
    hi: {
      meaning: 'जब पहले दो विकल्प लागू न हों, तब श्रेणी का नाम लिखने की जगह।',
      whatToEnter:
        'इसे केवल तभी भरें जब आपने प्रश्न 4 में Other चुना हो। General या Reserved चुना है तो इसे खाली छोड़ दें।',
      example: 'खेल कोटा',
    },
    te: {
      meaning: 'మొదటి రెండు ఎంపికలు వర్తించనప్పుడు వర్గం పేరు రాయడానికి ఉన్న చోటు.',
      whatToEnter:
        '4వ ప్రశ్నలో Other ఎంచుకున్నప్పుడు మాత్రమే దీనిని నింపండి. General లేదా Reserved ఎంచుకుంటే ఖాళీగా వదిలేయండి.',
      example: 'క్రీడా కోటా',
    },
    mr: {
      meaning: 'पहिले दोन पर्याय लागू नसतील तेव्हा प्रवर्गाचे नाव लिहिण्याची जागा.',
      whatToEnter:
        'प्रश्न ४ मध्ये Other निवडले असेल तरच हे भरा. General किंवा Reserved निवडले असल्यास रिकामे ठेवा.',
      example: 'क्रीडा कोटा',
    },
  },

  'fld-address': {
    en: {
      meaning: 'The postal address where the office should send letters about this application.',
      whatToEnter:
        'Write the house or building on the first line, the street on the second, and the locality on the third, as the form asks.',
      example: '14 Neelkanth Apartments\nSecond Cross Road\nVidya Nagar',
    },
    hi: {
      meaning: 'वह डाक पता जहाँ कार्यालय इस आवेदन से जुड़े पत्र भेजेगा।',
      whatToEnter:
        'पहली पंक्ति में घर या भवन, दूसरी में सड़क और तीसरी में मोहल्ला लिखें, जैसा फ़ॉर्म कहता है।',
      example: '१४ नीलकंठ अपार्टमेंट्स\nसेकंड क्रॉस रोड\nविद्या नगर',
    },
    te: {
      meaning: 'ఈ దరఖాస్తుకు సంబంధించిన ఉత్తరాలను కార్యాలయం పంపవలసిన తపాలా చిరునామా.',
      whatToEnter:
        'మొదటి పంక్తిలో ఇల్లు లేదా భవనం, రెండవ పంక్తిలో వీధి, మూడవ పంక్తిలో ప్రాంతం రాయండి — ఫారం అడిగినట్టు.',
      example: '14 నీలకంఠ అపార్ట్‌మెంట్స్\nసెకండ్ క్రాస్ రోడ్\nవిద్యా నగర్',
    },
    mr: {
      meaning: 'या अर्जाबाबतची पत्रे कार्यालयाने ज्या पत्त्यावर पाठवावीत तो टपाल पत्ता.',
      whatToEnter:
        'पहिल्या ओळीत घर किंवा इमारत, दुसऱ्या ओळीत रस्ता आणि तिसऱ्या ओळीत वस्ती लिहा, फॉर्म सांगतो तसे.',
      example: '१४ नीलकंठ अपार्टमेंट्स\nसेकंड क्रॉस रोड\nविद्या नगर',
    },
  },

  'fld-city': {
    en: {
      meaning: 'The city or town of the address you just gave.',
      whatToEnter: 'Write the name of the city or town only, without the district or the state.',
      example: 'Dharwad',
    },
    hi: {
      meaning: 'अभी दिए गए पते का शहर या कस्बा।',
      whatToEnter: 'केवल शहर या कस्बे का नाम लिखें, ज़िला या राज्य नहीं।',
      example: 'धारवाड़',
    },
    te: {
      meaning: 'మీరు ఇప్పుడే ఇచ్చిన చిరునామాకు సంబంధించిన నగరం లేదా పట్టణం.',
      whatToEnter: 'నగరం లేదా పట్టణం పేరు మాత్రమే రాయండి — జిల్లా లేదా రాష్ట్రం వద్దు.',
      example: 'ధార్వాడ్',
    },
    mr: {
      meaning: 'तुम्ही आत्ता दिलेल्या पत्त्याचे शहर किंवा गाव.',
      whatToEnter: 'फक्त शहराचे किंवा गावाचे नाव लिहा, जिल्हा किंवा राज्य लिहू नका.',
      example: 'धारवाड',
    },
  },

  'fld-pin': {
    en: {
      meaning:
        'The six-digit postal code for that address. The form says a PIN code with fewer than six digits cannot be processed.',
      whatToEnter: 'Enter all six digits together, with no space in between.',
      example: '580009',
    },
    hi: {
      meaning:
        'उस पते का छह अंकों का डाक कोड। फ़ॉर्म कहता है कि छह से कम अंकों वाला पिन कोड संसाधित नहीं किया जा सकता।',
      whatToEnter: 'छहों अंक बिना किसी खाली जगह के एक साथ लिखें।',
      example: '580009',
    },
    te: {
      meaning:
        'ఆ చిరునామాకు సంబంధించిన ఆరు అంకెల పోస్టల్ కోడ్. ఆరు అంకెల కంటే తక్కువ ఉన్న పిన్ కోడ్‌ను ప్రాసెస్ చేయలేమని ఫారం చెబుతోంది.',
      whatToEnter: 'ఆరు అంకెలనూ ఖాళీ లేకుండా కలిపి రాయండి.',
      example: '580009',
    },
    mr: {
      meaning:
        'त्या पत्त्याचा सहा अंकी टपाल कोड. सहापेक्षा कमी अंकांचा पिन कोड असल्यास अर्ज प्रक्रियेत घेतला जात नाही, असे फॉर्म सांगतो.',
      whatToEnter: 'सहाही अंक मधे जागा न सोडता एकत्र लिहा.',
      example: '580009',
    },
  },

  'fld-phone': {
    en: {
      meaning:
        'A telephone number the office can reach you on. The form asks for ten digits without a country code.',
      whatToEnter: 'Enter the ten digits only. Do not add +91 and do not add a leading zero.',
      example: '9876500011',
    },
    hi: {
      meaning:
        'वह टेलीफ़ोन नंबर जिस पर कार्यालय आपसे संपर्क कर सके। फ़ॉर्म देश कोड के बिना दस अंक माँगता है।',
      whatToEnter: 'केवल दस अंक लिखें। +91 न जोड़ें और शुरू में शून्य न लगाएँ।',
      example: '9876500011',
    },
    te: {
      meaning:
        'కార్యాలయం మిమ్మల్ని సంప్రదించగల టెలిఫోన్ నంబర్. దేశ కోడ్ లేకుండా పది అంకెలు కావాలని ఫారం అడుగుతోంది.',
      whatToEnter: 'పది అంకెలు మాత్రమే రాయండి. +91 చేర్చవద్దు, మొదట సున్నా పెట్టవద్దు.',
      example: '9876500011',
    },
    mr: {
      meaning:
        'कार्यालय तुमच्याशी संपर्क साधू शकेल असा दूरध्वनी क्रमांक. फॉर्म देश कोडशिवाय दहा अंक मागतो.',
      whatToEnter: 'फक्त दहा अंक लिहा. +91 जोडू नका आणि सुरुवातीला शून्य लावू नका.',
      example: '9876500011',
    },
  },

  'fld-email': {
    en: {
      meaning:
        'An email address. The form marks this optional and says email is used only when a telephone call does not reach you.',
      whatToEnter: 'Give an address you actually read, or leave it blank.',
      example: 'meera.demo@example.org',
    },
    hi: {
      meaning:
        'एक ईमेल पता। फ़ॉर्म इसे वैकल्पिक बताता है और कहता है कि ईमेल तभी उपयोग होगा जब फ़ोन पर संपर्क न हो सके।',
      whatToEnter: 'वही पता दें जिसे आप वास्तव में पढ़ते हैं, या इसे खाली छोड़ दें।',
      example: 'meera.demo@example.org',
    },
    te: {
      meaning:
        'ఒక ఇమెయిల్ చిరునామా. ఇది ఐచ్ఛికమని ఫారం చెబుతోంది; ఫోన్‌లో సంప్రదించలేనప్పుడు మాత్రమే ఇమెయిల్ వాడతారు.',
      whatToEnter: 'మీరు నిజంగా చదివే చిరునామా ఇవ్వండి, లేదా ఖాళీగా వదిలేయండి.',
      example: 'meera.demo@example.org',
    },
    mr: {
      meaning:
        'एक ईमेल पत्ता. फॉर्म हे ऐच्छिक असल्याचे सांगतो आणि दूरध्वनीवर संपर्क न झाल्यासच ईमेल वापरला जातो असे नमूद करतो.',
      whatToEnter: 'तुम्ही खरोखर वाचता तो पत्ता द्या, किंवा रिकामे ठेवा.',
      example: 'meera.demo@example.org',
    },
  },

  'fld-support-type': {
    en: {
      meaning: 'Which kind of help you are asking for. The form lists four and asks you to choose one.',
      whatToEnter: 'Pick the one that matches what the support would be spent on.',
      example: 'Hostel fee',
    },
    hi: {
      meaning: 'आप किस प्रकार की सहायता माँग रहे हैं। फ़ॉर्म चार विकल्प देता है और एक चुनने को कहता है।',
      whatToEnter: 'वही चुनें जिस पर यह सहायता खर्च होगी।',
      example: 'Hostel fee',
    },
    te: {
      meaning:
        'మీరు ఏ రకమైన సహాయం కోరుతున్నారు. ఫారం నాలుగు ఎంపికలు ఇచ్చి ఒకటి ఎంచుకోమని అడుగుతోంది.',
      whatToEnter: 'ఈ సహాయం దేనికి ఖర్చు అవుతుందో దానికి సరిపోయే ఎంపికను ఎంచుకోండి.',
      example: 'Hostel fee',
    },
    mr: {
      meaning: 'तुम्ही कोणत्या प्रकारची मदत मागत आहात. फॉर्म चार पर्याय देतो आणि एक निवडायला सांगतो.',
      whatToEnter: 'ही मदत ज्यावर खर्च होणार आहे त्याच्याशी जुळणारा पर्याय निवडा.',
      example: 'Hostel fee',
    },
  },

  'fld-amount': {
    en: {
      meaning:
        'How much support you are asking for, as a whole number of rupees. The form does not say whether this question must be answered.',
      whatToEnter: 'Write digits only — no commas, no decimal point and no rupee sign.',
      example: '24000',
    },
    hi: {
      meaning:
        'आप कितनी सहायता माँग रहे हैं, पूरे रुपयों में। फ़ॉर्म यह नहीं बताता कि इस प्रश्न का उत्तर देना अनिवार्य है या नहीं।',
      whatToEnter: 'केवल अंक लिखें — अल्पविराम, दशमलव या रुपये का चिह्न न लगाएँ।',
      example: '24000',
    },
    te: {
      meaning:
        'మీరు ఎంత సహాయం కోరుతున్నారో పూర్తి రూపాయలలో. ఈ ప్రశ్నకు తప్పనిసరిగా జవాబు ఇవ్వాలా అనేది ఫారం చెప్పలేదు.',
      whatToEnter: 'అంకెలు మాత్రమే రాయండి — కామాలు, దశాంశ బిందువు, రూపాయి గుర్తు వద్దు.',
      example: '24000',
    },
    mr: {
      meaning:
        'तुम्ही किती मदत मागत आहात, पूर्ण रुपयांत. या प्रश्नाचे उत्तर देणे बंधनकारक आहे का, हे फॉर्म सांगत नाही.',
      whatToEnter: 'फक्त अंक लिहा — स्वल्पविराम, दशांश चिन्ह किंवा रुपयाचे चिन्ह वापरू नका.',
      example: '24000',
    },
  },

  'fld-doc-number': {
    en: {
      meaning: 'The reference number printed on the identity document you will attach at (a).',
      whatToEnter:
        'Copy the number from the document itself, exactly as printed, including any letters and dashes.',
      example: 'STU-2024-114520',
    },
    hi: {
      meaning: 'उस पहचान दस्तावेज़ पर छपा संदर्भ संख्या जिसे आप (a) में संलग्न करेंगे।',
      whatToEnter:
        'संख्या दस्तावेज़ से ही देखकर लिखें, ठीक वैसी ही, जिसमें अक्षर और डैश भी शामिल हों।',
      example: 'STU-2024-114520',
    },
    te: {
      meaning: '(a) వద్ద మీరు జతచేసే గుర్తింపు పత్రంపై ముద్రించిన రిఫరెన్స్ నంబర్.',
      whatToEnter:
        'ఆ పత్రం నుండే నంబర్‌ను అలాగే రాయండి — అక్షరాలు, డాష్‌లు ఉంటే వాటితో సహా.',
      example: 'STU-2024-114520',
    },
    mr: {
      meaning: '(a) मध्ये तुम्ही जोडणार असलेल्या ओळखपत्रावर छापलेला संदर्भ क्रमांक.',
      whatToEnter:
        'क्रमांक त्या कागदपत्रावरूनच जसाच्या तसा लिहा, त्यातील अक्षरे आणि डॅशसह.',
      example: 'STU-2024-114520',
    },
  },

  'fld-declaration': {
    en: {
      meaning:
        'A statement that everything you wrote is correct. The form requires this box to be ticked.',
      whatToEnter:
        'Read your answers once more, then tick the box. Leave it unticked if anything still needs changing.',
    },
    hi: {
      meaning:
        'यह घोषणा कि आपने जो लिखा है वह सही है। फ़ॉर्म इस बॉक्स पर निशान लगाना अनिवार्य करता है।',
      whatToEnter:
        'अपने उत्तर एक बार फिर पढ़ें, फिर बॉक्स पर निशान लगाएँ। यदि कुछ बदलना बाकी है तो निशान न लगाएँ।',
    },
    te: {
      meaning:
        'మీరు రాసినదంతా సరైనదని చెప్పే ప్రకటన. ఈ పెట్టెలో గుర్తు పెట్టడం తప్పనిసరి అని ఫారం చెబుతోంది.',
      whatToEnter:
        'మీ జవాబులను ఒకసారి మళ్ళీ చదివి, ఆ తరువాత గుర్తు పెట్టండి. ఇంకా ఏదైనా మార్చాల్సి ఉంటే గుర్తు పెట్టవద్దు.',
    },
    mr: {
      meaning:
        'तुम्ही लिहिलेले सर्व बरोबर आहे असे सांगणारे विधान. या चौकटीत खूण करणे फॉर्मला आवश्यक आहे.',
      whatToEnter:
        'तुमची उत्तरे पुन्हा एकदा वाचा, मग चौकटीत खूण करा. काही बदलायचे शिल्लक असल्यास खूण करू नका.',
    },
  },
};

/** Fields the extractor was not confident about. */
const NEEDS_REVIEW = new Set(['fld-amount', 'fld-category-other']);

export function demoExplanation(fieldId: string, language: Language): Explanation | undefined {
  const perLanguage = COPY[fieldId];
  const field = demoFormModel.fields.find((f) => f.id === fieldId);
  if (!perLanguage || !field) return undefined;
  const copy = perLanguage[language];
  return {
    fieldId,
    language,
    meaning: copy.meaning,
    whatToEnter: copy.whatToEnter,
    example: copy.example,
    sources: field.sources,
    needsReview: NEEDS_REVIEW.has(fieldId),
    schemaVersion: SCHEMA_VERSION,
  };
}

export const EXPLAINED_FIELD_IDS = Object.keys(COPY);
