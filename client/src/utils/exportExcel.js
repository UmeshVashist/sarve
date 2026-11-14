import * as XLSX from 'xlsx';

export function downloadSurveyExcel(records, filename = 'Prisoner_Survey_Report.xlsx') {
  if (!records || records.length === 0) {
    alert('No survey records to export!');
    return;
  }

  // Format each row with exact 24 question headers as requested
  const excelRows = records.map((r, index) => ({
    'S.No': index + 1,
    '1) UT/CT No.': r.utct_no || '',
    '2) Name': r.name || '',
    '3) Case type / how you type of advocate to hire': r.case_type || '',
    '4) Total number of cases': r.total_cases ?? '',
    '5) How long these cases are running': r.case_duration || '',
    '6) Total advocate hired till date': r.total_advocates_hired ?? '',
    '7) How many time come to jail': r.times_in_jail ?? '',
    '8) Advocate name and number': r.advocate_name_number || '',
    '9) Known / unknown Advocate': r.known_unknown_advocate || '',
    '10) High court advocate': r.high_court_advocate || '',
    '11) Advocate payment advance': r.advocate_payment_advance || '',
    '12) First Advocate hired by IO': r.first_advocate_by_io || '',
    '13) Do you know process, when case started, first and next step': r.know_case_process || '',
    '14) Does your lawyer ask, all details about your case, and collect evidence': r.lawyer_collects_details_evidence || '',
    '15) How do you know, lawyer jo fees le raha hai, vo sahi hai': r.know_fees_reasonable || '',
    '16) Does it give, complete fees total, initially': r.complete_fees_total_initially || '',
    '17) Work transparency and tracking of lawyer work': r.work_transparency_tracking || '',
    '18) Kya apko pata hai, jo legal step lawyer process kar raha hai, vo sab sahi hai, kuch miss toh nahi kar raha': r.know_legal_step_correct || '',
    '19) Because of some extra unwanted step, kya lawyer ki wajah se, case lamba chala aur expensive ho gaya': r.case_prolonged_expensive || '',
    '20) Parivi karwane ko knowledge hai ya nahi, aur kyun parivi karta hai': r.pairvi_knowledge_reason || '',
    '21) Court ke doc kyun nikalte hai, and uski fees pata hai, aur kya vo aapko time pe miljate hai': r.court_docs_fees_timing || '',
    '22) Do you know any platform, jo aapko pairvi karne wala de, and jo guarantee de ki, jo adv provide karega, jo trustworthy hoga': r.know_trustworthy_platform || '',
    '23) Your priority, ki paise bachana hai ya jail se bahar jaldi jana hai': r.priority_money_vs_release || '',
    '24) Prisoner psychologic according sarve': r.prisoner_psychologic_survey || '',
    'Survey Date & Time': r.created_at || ''
  }));

  const worksheet = XLSX.utils.json_to_sheet(excelRows);

  // Column widths
  worksheet['!cols'] = [
    { wch: 6 },
    { wch: 18 },
    { wch: 22 },
    { wch: 35 },
    { wch: 20 },
    { wch: 25 },
    { wch: 22 },
    { wch: 22 },
    { wch: 30 },
    { wch: 22 },
    { wch: 20 },
    { wch: 28 },
    { wch: 22 },
    { wch: 35 },
    { wch: 35 },
    { wch: 35 },
    { wch: 30 },
    { wch: 30 },
    { wch: 40 },
    { wch: 40 },
    { wch: 35 },
    { wch: 38 },
    { wch: 40 },
    { wch: 35 },
    { wch: 35 },
    { wch: 22 }
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Prisoner Surveys');
  XLSX.writeFile(workbook, filename);
}

