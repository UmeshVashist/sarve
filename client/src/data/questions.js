// Helper to get formatted label with dynamic question numbering
export function getQuestionLabel(q, idx) {
  if (!q) return '';
  const num = q.order_num !== undefined && q.order_num !== null ? q.order_num : (idx !== undefined ? idx + 1 : '');
  const cleanLabel = (q.label || '').replace(/^\d+[\)\.\-]\s*/, '').trim();
  return num !== '' ? `${num}) ${cleanLabel}` : cleanLabel;
}

// All 24 Questions with validations, input types, and notes as specified
export const SURVEY_QUESTIONS = [
  {
    id: 1,
    key: 'utct_no',
    label: '1) UT/CT No.',
    placeholder: 'e.g. UT/2026/104 or CT/2026/89',
    type: 'text',
    required: true,
    isUniqueCheck: true,
    note: 'Note:- Unique ID. System will verify against database before proceeding.'
  },
  {
    id: 2,
    key: 'name',
    label: '2) Name',
    placeholder: 'Enter prisoner full name',
    type: 'text',
    required: true,
    note: 'Note:- Please enter prisoner full name.'
  },
  {
    id: 3,
    key: 'case_type',
    label: '3) Case type / how you type of advocate to hire',
    placeholder: 'Select one or more case types',
    type: 'multi-select',
    required: true,
    note: 'Note:- You can select multiple case types from the dropdown managed on the home page.'
  },
  {
    id: 4,
    key: 'total_cases',
    label: '4) Total number of cases',
    placeholder: 'e.g. 1, 2, 3',
    type: 'number',
    required: true,
    note: 'Note:- Input only Numbers'
  },
  {
    id: 5,
    key: 'case_duration',
    label: '5) How long these cases are running',
    placeholder: 'e.g. 6 Months, 2 Years, 1 Year 4 Months',
    type: 'text',
    required: true,
    note: 'Note:- Specify duration (months / years).'
  },
  {
    id: 6,
    key: 'total_advocates_hired',
    label: '6) Total advocate hired till date',
    placeholder: 'e.g. 0, 1, 2',
    type: 'number',
    required: true,
    note: 'Note:- Input only Numbers'
  },
  {
    id: 7,
    key: 'times_in_jail',
    label: '7) How many time come to jail',
    placeholder: 'e.g. 1, 2, 3',
    type: 'number',
    required: true,
    note: 'Note:- Input only Numbers'
  },
  {
    id: 8,
    key: 'advocate_name_number',
    label: '8) Advocate name and number',
    placeholder: 'e.g. Adv. R.K. Gupta (+91 9876543210)',
    type: 'text',
    required: false,
    note: 'Note:- Enter current or previous advocate name and phone number.'
  },
  {
    id: 9,
    key: 'known_unknown_advocate',
    label: '9) Known / unknown Advocate',
    placeholder: 'Known or Unknown',
    type: 'yesno_or_choice',
    options: ['Known', 'Unknown', 'Yes', 'No'],
    note: 'Note:- Pls enter Only Yes or No'
  },
  {
    id: 10,
    key: 'high_court_advocate',
    label: '10) High court advocate',
    placeholder: 'Yes or No',
    type: 'yesno',
    options: ['Yes', 'No'],
    note: 'Note:- Pls enter Only Yes or No'
  },
  {
    id: 11,
    key: 'advocate_payment_advance',
    label: '11) Advocate payment advance',
    placeholder: "Type 'Yes' or 'No'",
    type: 'yesno_advance',
    options: ['Yes', 'No'],
    note: 'Note:- Pls enter Only Yes or No'
  },
  {
    id: 12,
    key: 'first_advocate_by_io',
    label: '12) First Advocate hired by IO',
    placeholder: 'Yes or No',
    type: 'yesno',
    options: ['Yes', 'No'],
    note: 'Note:- Pls enter Only Yes or No'
  },
  {
    id: 13,
    key: 'know_case_process',
    label: '13) Do you know process, when case started, first and next step',
    placeholder: 'Yes or No',
    type: 'yesno',
    options: ['Yes', 'No'],
    note: 'Note:- Pls enter Only Yes or No'
  },
  {
    id: 14,
    key: 'lawyer_collects_details_evidence',
    label: '14) Does your lawyer ask, all details about your case, and collect evidence',
    placeholder: 'Yes or No',
    type: 'yesno',
    options: ['Yes', 'No'],
    note: 'Note:- Pls enter Only Yes or No'
  },
  {
    id: 15,
    key: 'know_fees_reasonable',
    label: '15) How do you know, lawyer jo fees le raha hai, vo sahi hai',
    placeholder: 'Yes or No / Details',
    type: 'yesno_text',
    options: ['Yes', 'No'],
    note: 'Note:- Pls enter Only Yes or No'
  },
  {
    id: 16,
    key: 'complete_fees_total_initially',
    label: '16) Does it give, complete fees total, initially',
    placeholder: "Type 'Yes' or 'No'",
    type: 'yesno_advance',
    options: ['Yes', 'No'],
    note: 'Note:- Pls enter Only Yes or No (If Yes, specify complete fees amount)'
  },
  {
    id: 17,
    key: 'work_transparency_tracking',
    label: '17) Work transparency and tracking of lawyer work',
    placeholder: 'Yes or No',
    type: 'yesno',
    options: ['Yes', 'No'],
    note: 'Note:- Pls enter Only Yes or No'
  },
  {
    id: 18,
    key: 'know_legal_step_correct',
    label: '18) Kya apko pata hai, jo legal step lawyer process kar raha hai, vo sab sahi hai, kuch miss toh nahi kar raha',
    placeholder: 'Yes or No',
    type: 'yesno',
    options: ['Yes', 'No'],
    note: 'Note:- Pls enter Only Yes or No'
  },
  {
    id: 19,
    key: 'case_prolonged_expensive',
    label: '19) Because of some extra unwanted step, kya lawyer ki wajah se, case lamba chala aur expensive ho gaya',
    placeholder: 'Yes or No',
    type: 'yesno',
    options: ['Yes', 'No'],
    note: 'Note:- Pls enter Only Yes or No'
  },
  {
    id: 20,
    key: 'pairvi_knowledge_reason',
    label: '20) Parivi karwane ko knowledge hai ya nahi, aur kyun parivi karta hai',
    placeholder: 'Yes or No / Details',
    type: 'yesno_text',
    options: ['Yes', 'No'],
    note: 'Note:- Pls enter Only Yes or No'
  },
  {
    id: 21,
    key: 'court_docs_fees_timing',
    label: '21) Court ke doc kyun nikalte hai, and uski fees pata hai, aur kya vo aapko time pe miljate hai',
    placeholder: 'Yes or No / Details',
    type: 'yesno_text',
    options: ['Yes', 'No'],
    note: 'Note:- Pls enter Only Yes or No'
  },
  {
    id: 22,
    key: 'know_trustworthy_platform',
    label: '22) Do you know any platform, jo aapko pairvi karne wala de, and jo guarantee de ki, jo adv provide karega, jo trustworthy hoga',
    placeholder: 'Yes or No',
    type: 'yesno',
    options: ['Yes', 'No'],
    note: 'Note:- Pls enter Only Yes or No'
  },
  {
    id: 23,
    key: 'priority_money_vs_release',
    label: '23) Your priority, ki paise bachana hai ya jail se bahar jaldi jana hai',
    placeholder: 'Select priority',
    type: 'choice_text',
    options: ['Jail se bahar jaldi jana', 'Paise bachana'],
    note: 'Note:- Please select only one of the 2 options: Jail se bahar jaldi jana OR Paise bachana'
  },
  {
    id: 24,
    order_num: 24,
    key: 'prisoner_psychologic_survey',
    label: '24) Prisoner psychologic according Survey',
    placeholder: 'Select Yes or No, and add remarks (optional)...',
    type: 'psychologic_yesno',
    options: ['Yes', 'No'],
    required: false,
    note: 'Note:- Pls select Yes or No (Remarks optional)'
  }
];

