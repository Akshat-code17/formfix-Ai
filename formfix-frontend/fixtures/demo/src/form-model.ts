import { SCHEMA_VERSION, type FormModel } from '@formfix/contracts';
import { DEMO_PAGE_COUNT, DEMO_TITLE, inputRegion, source } from './sources.js';

export const DEMO_FORM_ID = 'demo-student-support-v1';
export const DEMO_TEMPLATE_ID = 'sample-student-support-demo';

/**
 * The synthetic demo form: six pages, three sections, fourteen fields,
 * three document requirements. Shared with the backend fixtures so both
 * builds describe exactly the same document.
 */
export const demoFormModel: FormModel = {
  schemaVersion: SCHEMA_VERSION,
  formId: DEMO_FORM_ID,
  templateId: DEMO_TEMPLATE_ID,
  title: DEMO_TITLE,
  pageCount: DEMO_PAGE_COUNT,
  synthetic: true,

  sections: [
    {
      id: 'sec-a',
      titleOriginal: 'Section A — Applicant details',
      order: 0,
      pageStart: 1,
      pageEnd: 2,
    },
    {
      id: 'sec-b',
      titleOriginal: 'Section B — Address and contact',
      order: 1,
      pageStart: 3,
      pageEnd: 4,
    },
    {
      id: 'sec-c',
      titleOriginal: 'Section C — Support request and documents',
      order: 2,
      pageStart: 5,
      pageEnd: 6,
    },
  ],

  fields: [
    {
      id: 'fld-full-name',
      sectionId: 'sec-a',
      labelOriginal: 'Full name of applicant',
      type: 'text',
      requiredStatus: 'required',
      sources: [source('src-full-name', 'Question 1')],
      inputRegion: inputRegion('in-full-name'),
      ruleIds: ['rule-required'],
      order: 0,
    },
    {
      id: 'fld-dob',
      sectionId: 'sec-a',
      labelOriginal: 'Date of birth',
      type: 'date',
      requiredStatus: 'required',
      sources: [source('src-dob', 'Question 2')],
      inputRegion: inputRegion('in-dob'),
      ruleIds: ['rule-required', 'rule-date-not-future'],
      order: 1,
    },
    {
      id: 'fld-enrolment-no',
      sectionId: 'sec-a',
      labelOriginal: 'Enrolment number',
      type: 'numeric_string',
      requiredStatus: 'required',
      sources: [source('src-enrolment', 'Question 3')],
      inputRegion: inputRegion('in-enrolment'),
      ruleIds: ['rule-required', 'rule-enrolment-9-digits'],
      order: 2,
    },
    {
      id: 'fld-category',
      sectionId: 'sec-a',
      labelOriginal: 'Applicant category',
      type: 'radio',
      requiredStatus: 'required',
      sources: [source('src-category', 'Question 4')],
      inputRegion: inputRegion('in-category'),
      ruleIds: ['rule-required'],
      options: [
        { value: 'general', labelOriginal: 'General' },
        { value: 'reserved', labelOriginal: 'Reserved' },
        { value: 'other', labelOriginal: 'Other' },
      ],
      order: 3,
    },
    {
      id: 'fld-category-other',
      sectionId: 'sec-a',
      labelOriginal: 'Category, if Other was ticked',
      type: 'text',
      requiredStatus: 'conditional',
      sources: [source('src-category-other', 'Question 5')],
      inputRegion: inputRegion('in-category-other'),
      ruleIds: ['rule-conditional-required'],
      condition: {
        fieldId: 'fld-category',
        equalsAny: ['other'],
        describe: 'Needed only if you chose Other in question 4.',
      },
      order: 4,
    },

    {
      id: 'fld-address',
      sectionId: 'sec-b',
      labelOriginal: 'Postal address for correspondence',
      type: 'textarea',
      requiredStatus: 'required',
      sources: [source('src-address', 'Question 6')],
      inputRegion: inputRegion('in-address'),
      ruleIds: ['rule-required'],
      order: 5,
    },
    {
      id: 'fld-city',
      sectionId: 'sec-b',
      labelOriginal: 'City or town',
      type: 'text',
      requiredStatus: 'required',
      sources: [source('src-city', 'Question 7')],
      inputRegion: inputRegion('in-city'),
      ruleIds: ['rule-required'],
      order: 6,
    },
    {
      id: 'fld-pin',
      sectionId: 'sec-b',
      labelOriginal: 'PIN code',
      type: 'numeric_string',
      requiredStatus: 'required',
      sources: [
        source('src-pin', 'Question 8'),
        source('src-pin-note', 'Note on PIN code length'),
      ],
      inputRegion: inputRegion('in-pin'),
      ruleIds: ['rule-required', 'rule-pin-6-digits'],
      order: 7,
    },
    {
      id: 'fld-phone',
      sectionId: 'sec-b',
      labelOriginal: 'Contact telephone number',
      type: 'numeric_string',
      requiredStatus: 'required',
      sources: [source('src-phone', 'Question 9')],
      inputRegion: inputRegion('in-phone'),
      ruleIds: ['rule-required', 'rule-phone-10-digits'],
      order: 8,
    },
    {
      id: 'fld-email',
      sectionId: 'sec-b',
      labelOriginal: 'Email address',
      type: 'text',
      requiredStatus: 'optional',
      sources: [
        source('src-email', 'Question 10'),
        source('src-contact-note', 'How the office makes contact'),
      ],
      inputRegion: inputRegion('in-email'),
      ruleIds: ['rule-email-shape'],
      order: 9,
    },

    {
      id: 'fld-support-type',
      sectionId: 'sec-c',
      labelOriginal: 'Type of support requested',
      type: 'select',
      requiredStatus: 'required',
      sources: [source('src-support-type', 'Question 11')],
      inputRegion: inputRegion('in-support-type'),
      ruleIds: ['rule-required'],
      options: [
        { value: 'tuition', labelOriginal: 'Tuition fee' },
        { value: 'hostel', labelOriginal: 'Hostel fee' },
        { value: 'travel', labelOriginal: 'Travel' },
        { value: 'equipment', labelOriginal: 'Equipment' },
      ],
      order: 10,
    },
    {
      id: 'fld-amount',
      sectionId: 'sec-c',
      // The form never says whether this is compulsory, so the extractor
      // must not decide that it is.
      labelOriginal: 'Amount of support requested, in whole rupees',
      type: 'numeric_string',
      requiredStatus: 'unknown',
      sources: [
        source('src-amount', 'Question 12'),
        source('src-amount-note', 'How to write the amount'),
      ],
      inputRegion: inputRegion('in-amount'),
      ruleIds: ['rule-whole-rupees', 'rule-manual-review-amount'],
      order: 11,
    },
    {
      id: 'fld-doc-number',
      sectionId: 'sec-c',
      labelOriginal: 'Supporting document reference number',
      type: 'text',
      requiredStatus: 'required',
      sources: [source('src-doc-number', 'Question 13')],
      inputRegion: inputRegion('in-doc-number'),
      ruleIds: ['rule-required'],
      order: 12,
    },
    {
      id: 'fld-declaration',
      sectionId: 'sec-c',
      labelOriginal: 'Declaration that the information given is correct',
      type: 'checkbox',
      requiredStatus: 'required',
      sources: [source('src-declaration', 'Question 14')],
      inputRegion: inputRegion('in-declaration'),
      ruleIds: ['rule-declaration-accepted'],
      order: 13,
    },
  ],

  documentRequirements: [
    {
      id: 'doc-identity',
      labelOriginal: 'Student identity card',
      requiredStatus: 'required',
      alternatives: ['Provisional admission letter'],
      sources: [source('src-doc-id', 'Documents to attach (a)')],
      numberFieldId: 'fld-doc-number',
    },
    {
      id: 'doc-income',
      labelOriginal: 'Income declaration signed by a parent or guardian',
      purposeOriginal: 'It is used to decide the amount of support.',
      requiredStatus: 'required',
      alternatives: [],
      sources: [source('src-doc-income', 'Documents to attach (b)')],
    },
    {
      id: 'doc-bank',
      labelOriginal: 'Bank passbook first page',
      requiredStatus: 'conditional',
      alternatives: [],
      // Quoted without a rectangle: the extractor located the page and the
      // sentence but not a region, so the viewer must not draw a box.
      sources: [source('src-doc-bank', 'Documents to attach (c)', { withoutBox: true })],
      condition: {
        fieldId: 'fld-support-type',
        equalsAny: ['travel', 'equipment'],
        describe: 'Needed only if you asked for Travel or Equipment support in question 11.',
      },
    },
  ],

  extractionWarnings: [
    {
      id: 'warn-amount-required',
      fieldId: 'fld-amount',
      page: 5,
      code: 'required_status_not_stated',
      message:
        'The form does not say whether the amount is compulsory. This is marked unclear rather than guessed.',
    },
    {
      id: 'warn-doc-bank-region',
      requirementId: 'doc-bank',
      page: 6,
      code: 'region_not_located',
      message:
        'The sentence about the bank passbook was found on page 6, but its position on the page could not be measured.',
    },
  ],
};
