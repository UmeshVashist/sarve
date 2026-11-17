// Helper to get formatted label with dynamic question numbering for Advocate Survey
export function getAdvocateQuestionLabel(q, idx) {
  if (!q) return '';
  const num = (q.order_num !== undefined && q.order_num !== null && !isNaN(q.order_num))
    ? Number(q.order_num)
    : (idx !== undefined ? idx + 1 : '');
  const cleanLabel = (q.label || '').replace(/^\d+[\)\.\-]\s*/, '').trim();
  return num !== '' ? `${num}) ${cleanLabel}` : cleanLabel;
}

export const DEFAULT_ADVOCATE_TYPES = [
  { id: 1, name: 'Private Advocate' },
  { id: 2, name: 'DLSA / Legal Aid Advocate' },
  { id: 3, name: 'High Court Legal Services Committee (HCLSC) Advocate' },
  { id: 4, name: 'Remand Advocate' },
  { id: 5, name: 'Amicus Curiae' },
  { id: 6, name: 'Senior Advocate' },
  { id: 7, name: 'Government Pleader / Public Prosecutor' },
  { id: 8, name: 'Panel Advocate' },
  { id: 9, name: 'Other' }
];

export const ADVOCATE_SURVEY_QUESTIONS = [
  {
    id: 1,
    order_num: 1,
    key: 'advocate_reg_no',
    label: '1) Bar Council / Enrollment No.',
    placeholder: 'e.g. D/1234/2015 or UP/5678/2018',
    type: 'text',
    required: true,
    isUniqueCheck: true,
    note: 'Note:- Unique Bar Enrollment / Registration ID.'
  },
  {
    id: 2,
    order_num: 2,
    key: 'name',
    label: '2) Advocate Full Name',
    placeholder: 'e.g. Adv. Rajesh Kumar Sharma',
    type: 'text',
    required: true,
    note: 'Note:- Full official name as registered with Bar Council.'
  },
  {
    id: 3,
    order_num: 3,
    key: 'contact_number',
    label: '3) Contact / WhatsApp Number',
    placeholder: 'e.g. +91 9876543210',
    type: 'text',
    required: true,
    note: 'Note:- 10-digit primary mobile or chamber phone.'
  },
  {
    id: 4,
    order_num: 4,
    key: 'primary_court',
    label: '4) Primary Court of Practice',
    placeholder: 'Select primary court',
    type: 'choice_text',
    required: true,
    options: ['District Court', 'Sessions Court', 'High Court', 'Supreme Court', 'Magistrate Court (CMM / ACMM)', 'Special / NDPS Court', 'Other'],
    note: 'Note:- Main court where advocate practices regularly.'
  },
  {
    id: 5,
    order_num: 5,
    key: 'practice_experience_years',
    label: '5) Years of Legal Practice',
    placeholder: 'e.g. 5, 8, 12, 20',
    type: 'number',
    required: true,
    note: 'Note:- Input numeric digits only.'
  },
  {
    id: 6,
    order_num: 6,
    key: 'case_specialization',
    label: '6) Legal Specialization',
    placeholder: 'Select one or more specializations',
    type: 'multi-select',
    required: true,
    options: [
      'Criminal Defense',
      'Bail Applications',
      'NDPS Act (Narcotics)',
      'POCSO & Women Safety',
      'Cheating & Fraud (IPC 420)',
      'Murder / Attempt (IPC 302/307)',
      'Cyber Crime',
      'Civil & Property',
      'Constitutional / High Court Writs',
      'Other'
    ],
    note: 'Note:- Select one or more legal fields.'
  },
  {
    id: 7,
    order_num: 7,
    key: 'regularly_handles_undertrial_cases',
    label: '7) Regularly handles Jail / Undertrial Prisoner Cases?',
    placeholder: 'Yes or No',
    type: 'yesno',
    options: ['Yes', 'No'],
    required: true,
    note: 'Note:- Pls select or enter Only Yes or No.'
  },
  {
    id: 8,
    order_num: 8,
    key: 'provides_legal_aid_dlsa',
    label: '8) Empanelled with DLSA / Legal Aid Authority?',
    placeholder: 'Yes or No',
    type: 'yesno',
    options: ['Yes', 'No'],
    required: false,
    note: 'Note:- Pls select or enter Only Yes or No.'
  },
  {
    id: 9,
    order_num: 9,
    key: 'transparent_fee_structure',
    label: '9) Provides transparent upfront fee agreement to clients?',
    placeholder: 'Yes or No',
    type: 'yesno',
    options: ['Yes', 'No'],
    required: false,
    note: 'Note:- Pls select or enter Only Yes or No.'
  },
  {
    id: 10,
    order_num: 10,
    key: 'average_case_duration',
    label: '10) Average duration to secure Bail / Trial relief',
    placeholder: 'e.g. 1 Month, 3 Months, 6 Months',
    type: 'text',
    required: false,
    note: 'Note:- Typical timeline observed for client relief.'
  },
  {
    id: 11,
    order_num: 11,
    key: 'parivi_assistance_knowledge',
    label: '11) Knowledge of Prison Parivi & Document tracking process?',
    placeholder: 'Yes or No',
    type: 'yesno',
    options: ['Yes', 'No'],
    required: false,
    note: 'Note:- Pls select or enter Only Yes or No.'
  },
  {
    id: 12,
    order_num: 12,
    key: 'remarks',
    label: '12) Remarks / Suggestions for Jail Legal System',
    placeholder: 'Enter observations, suggestions, feedback for improving legal assistance...',
    type: 'textarea',
    required: false,
    note: 'Note:- Optional observations.'
  }
];

export const ADVOCATE_STANDARD_KEYS = ADVOCATE_SURVEY_QUESTIONS.map((q) => q.key);
