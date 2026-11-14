import * as XLSX from 'xlsx';
import { getQuestionLabel } from '../data/questions';

export function downloadSurveyExcel(records, filename = 'Prisoner_Survey_Report.xlsx', customQuestions = null) {
  if (!records || records.length === 0) {
    alert('No survey records to export!');
    return;
  }

  let qList = Array.isArray(customQuestions) && customQuestions.length > 0 ? customQuestions : null;
  if (!qList) {
    try {
      const saved = localStorage.getItem('survey_questions_list');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          qList = parsed;
        }
      }
    } catch (e) {}
  }

  const sortedQuestions = qList
    ? [...qList].sort((a, b) => (Number(a.order_num) || 0) - (Number(b.order_num) || 0))
    : null;

  // Format each row with question headers
  const excelRows = records.map((r, index) => {
    const row = { 'S.No': index + 1 };

    if (sortedQuestions) {
      sortedQuestions.forEach((q, idx) => {
        const header = getQuestionLabel(q, idx);
        row[header] = (r[q.key] !== undefined && r[q.key] !== null) ? r[q.key] : '';
      });
    } else {
      // Standard 24 questions fallback
      row['1) UT/CT No.'] = r.utct_no || '';
      row['2) Name'] = r.name || '';
      row['3) Case type / how you type of advocate to hire'] = r.case_type || '';
      row['4) Total number of cases'] = r.total_cases ?? '';
      row['5) How long these cases are running'] = r.case_duration || '';
      row['6) Total advocate hired till date'] = r.total_advocates_hired ?? '';
      row['7) How many time come to jail'] = r.times_in_jail ?? '';
      row['8) Advocate name and number'] = r.advocate_name_number || '';
      row['9) Known / unknown Advocate'] = r.known_unknown_advocate || '';
      row['10) High court advocate'] = r.high_court_advocate || '';
      row['11) Advocate payment advance'] = r.advocate_payment_advance || '';
      row['12) First Advocate hired by IO'] = r.first_advocate_by_io || '';
      row['13) Do you know process, when case started, first and next step'] = r.know_case_process || '';
      row['14) Does your lawyer ask, all details about your case, and collect evidence'] = r.lawyer_collects_details_evidence || '';
      row['15) How do you know, lawyer jo fees le raha hai, vo sahi hai'] = r.know_fees_reasonable || '';
      row['16) Does it give, complete fees total, initially'] = r.complete_fees_total_initially || '';
      row['17) Work transparency and tracking of lawyer work'] = r.work_transparency_tracking || '';
      row['18) Kya apko pata hai, jo legal step lawyer process kar raha hai, vo sab sahi hai, kuch miss toh nahi kar raha'] = r.know_legal_step_correct || '';
      row['19) Because of some extra unwanted step, kya lawyer ki wajah se, case lamba chala aur expensive ho gaya'] = r.case_prolonged_expensive || '';
      row['20) Parivi karwane ko knowledge hai ya nahi, aur kyun parivi karta hai'] = r.pairvi_knowledge_reason || '';
      row['21) Court ke doc kyun nikalte hai, and uski fees pata hai, aur kya vo aapko time pe miljate hai'] = r.court_docs_fees_timing || '';
      row['22) Do you know any platform, jo aapko pairvi karne wala de, and jo guarantee de ki, jo adv provide karega, jo trustworthy hoga'] = r.know_trustworthy_platform || '';
      row['23) Your priority, ki paise bachana hai ya jail se bahar jaldi jana hai'] = r.priority_money_vs_release || '';
      row['24) Prisoner psychologic according Survey'] = r.prisoner_psychologic_survey || '';
    }

    row['Survey Date & Time'] = r.created_at || '';
    return row;
  });

  const worksheet = XLSX.utils.json_to_sheet(excelRows);

  // Dynamic Column widths
  const keys = Object.keys(excelRows[0] || {});
  worksheet['!cols'] = keys.map((k) => ({
    wch: k === 'S.No' ? 6 : Math.min(Math.max(k.length + 4, 18), 45)
  }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Prisoner Survey Data');
  XLSX.writeFile(workbook, filename);
}
