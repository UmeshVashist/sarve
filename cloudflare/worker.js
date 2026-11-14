// Cloudflare Worker API for Survey Portal using Cloudflare D1
const STANDARD_KEYS = [
  'utct_no', 'name', 'case_type', 'total_cases', 'case_duration',
  'total_advocates_hired', 'times_in_jail', 'advocate_name_number',
  'known_unknown_advocate', 'high_court_advocate', 'advocate_payment_advance',
  'first_advocate_by_io', 'know_case_process', 'lawyer_collects_details_evidence',
  'know_fees_reasonable', 'complete_fees_total_initially',
  'work_transparency_tracking', 'know_legal_step_correct',
  'case_prolonged_expensive', 'pairvi_knowledge_reason',
  'court_docs_fees_timing', 'know_trustworthy_platform',
  'priority_money_vs_release', 'prisoner_psychologic_survey'
];

function extractCustomAnswers(data, existingCustom = {}) {
  const custom = { ...existingCustom };
  for (const [k, v] of Object.entries(data || {})) {
    if (!STANDARD_KEYS.includes(k) && !['id', 'created_at', 'updated_at', 'custom_answers'].includes(k)) {
      custom[k] = v;
    }
  }
  return JSON.stringify(custom);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // CORS Headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // 1. Auth Login (Authenticated via Database)
      if (path === '/api/auth/login' && method === 'POST') {
        const { username, password } = await request.json();
        const cleanUsername = (username || '').trim().toLowerCase();

        if (cleanUsername === 'sarve') {
          return new Response(
            JSON.stringify({ success: false, message: 'Invalid Username or Password! Please use correct credentials.' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // 1. Check users table in D1 Database
        let user = null;
        try {
          user = await env.DB.prepare(
            'SELECT id, username, role FROM users WHERE LOWER(TRIM(username)) = ? AND password = ?'
          ).bind(cleanUsername, password).first();
        } catch (dbErr) {
          console.warn('Users table query failed or not created yet:', dbErr);
        }

        if (user) {
          return new Response(
            JSON.stringify({
              success: true,
              token: 'survey-auth-d1-token-' + user.id,
              user: { id: user.id, username: user.username, role: user.role || 'Administrator', displayName: 'Survey Admin' }
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Fallback for default credential if table is pending (supports any case like meet, Meet, MEET)
        if (cleanUsername === 'meet' && password === 'New@1020') {
          return new Response(
            JSON.stringify({
              success: true,
              token: 'survey-auth-cloudflare-d1-token',
              user: { username: 'meet', role: 'Administrator', displayName: 'Survey Admin' }
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ success: false, message: 'Invalid Username or Password!' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // 2. Check UT/CT uniqueness
      if (path.startsWith('/api/survey/check-utct') && method === 'GET') {
        const utctNo = (url.searchParams.get('no') || url.searchParams.get('utctNo') || decodeURIComponent(path.split('/')[4] || '')).trim();
        const existing = await env.DB.prepare(
          'SELECT id, utct_no, name FROM prisoner_surveys WHERE LOWER(TRIM(utct_no)) = LOWER(TRIM(?))'
        ).bind(utctNo).first();

        return new Response(
          JSON.stringify({
            exists: !!existing,
            message: existing ? `UT/CT No. "${utctNo}" already exists!` : 'Available',
            survey: existing || null
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // 3. List Surveys
      if (path === '/api/survey/list' && method === 'GET') {
        const q = url.searchParams.get('q') || '';
        let result;
        if (q) {
          const searchPattern = `%${q}%`;
          result = await env.DB.prepare(
            `SELECT * FROM prisoner_surveys WHERE utct_no LIKE ? OR name LIKE ? OR case_type LIKE ? ORDER BY id DESC`
          ).bind(searchPattern, searchPattern, searchPattern).all();
        } else {
          result = await env.DB.prepare('SELECT * FROM prisoner_surveys ORDER BY id DESC').all();
        }

        const data = (result.results || []).map((r) => {
          let custom = {};
          if (r.custom_answers) {
            try { custom = JSON.parse(r.custom_answers); } catch (e) {}
          }
          return { ...r, ...custom };
        });

        return new Response(
          JSON.stringify({ success: true, count: data.length, data }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // 4. Get single survey by ID
      if (path.startsWith('/api/survey/') && method === 'GET' && !path.includes('check-utct') && !path.includes('list') && !path.includes('export')) {
        const id = path.split('/')[3];
        const survey = await env.DB.prepare('SELECT * FROM prisoner_surveys WHERE id = ?').bind(id).first();
        if (!survey) {
          return new Response(JSON.stringify({ success: false, message: 'Survey not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        let custom = {};
        if (survey.custom_answers) {
          try { custom = JSON.parse(survey.custom_answers); } catch (e) {}
        }
        return new Response(JSON.stringify({ success: true, data: { ...survey, ...custom } }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // 5. Add Survey
      if (path === '/api/survey/add' && method === 'POST') {
        const d = await request.json();
        const existing = await env.DB.prepare(
          'SELECT id FROM prisoner_surveys WHERE LOWER(TRIM(utct_no)) = LOWER(TRIM(?))'
        ).bind(d.utct_no).first();

        if (existing) {
          return new Response(
            JSON.stringify({ success: false, message: `UT/CT No. "${d.utct_no}" already exists!` }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const customJson = extractCustomAnswers(d);

        try {
          await env.DB.prepare(`
            INSERT INTO prisoner_surveys (
              utct_no, name, case_type, total_cases, case_duration,
              total_advocates_hired, times_in_jail, advocate_name_number,
              known_unknown_advocate, high_court_advocate, advocate_payment_advance,
              first_advocate_by_io, know_case_process, lawyer_collects_details_evidence,
              know_fees_reasonable, complete_fees_total_initially,
              work_transparency_tracking, know_legal_step_correct,
              case_prolonged_expensive, pairvi_knowledge_reason,
              court_docs_fees_timing, know_trustworthy_platform,
              priority_money_vs_release, prisoner_psychologic_survey,
              custom_answers
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            d.utct_no, d.name, Array.isArray(d.case_type) ? d.case_type.join(', ') : (d.case_type || ''),
            Number(d.total_cases) || 0, d.case_duration || '', Number(d.total_advocates_hired) || 0,
            Number(d.times_in_jail) || 0, d.advocate_name_number || '', d.known_unknown_advocate || '',
            d.high_court_advocate || '', d.advocate_payment_advance || '', d.first_advocate_by_io || '',
            d.know_case_process || '', d.lawyer_collects_details_evidence || '', d.know_fees_reasonable || '',
            d.complete_fees_total_initially || '', d.work_transparency_tracking || '', d.know_legal_step_correct || '',
            d.case_prolonged_expensive || '', d.pairvi_knowledge_reason || '', d.court_docs_fees_timing || '',
            d.know_trustworthy_platform || '', d.priority_money_vs_release || '', d.prisoner_psychologic_survey || '',
            customJson
          ).run();
        } catch (insertErr) {
          try {
            await env.DB.prepare("ALTER TABLE prisoner_surveys ADD COLUMN custom_answers TEXT DEFAULT '{}'").run();
            await env.DB.prepare(`
              INSERT INTO prisoner_surveys (
                utct_no, name, case_type, total_cases, case_duration,
                total_advocates_hired, times_in_jail, advocate_name_number,
                known_unknown_advocate, high_court_advocate, advocate_payment_advance,
                first_advocate_by_io, know_case_process, lawyer_collects_details_evidence,
                know_fees_reasonable, complete_fees_total_initially,
                work_transparency_tracking, know_legal_step_correct,
                case_prolonged_expensive, pairvi_knowledge_reason,
                court_docs_fees_timing, know_trustworthy_platform,
                priority_money_vs_release, prisoner_psychologic_survey,
                custom_answers
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
              d.utct_no, d.name, Array.isArray(d.case_type) ? d.case_type.join(', ') : (d.case_type || ''),
              Number(d.total_cases) || 0, d.case_duration || '', Number(d.total_advocates_hired) || 0,
              Number(d.times_in_jail) || 0, d.advocate_name_number || '', d.known_unknown_advocate || '',
              d.high_court_advocate || '', d.advocate_payment_advance || '', d.first_advocate_by_io || '',
              d.know_case_process || '', d.lawyer_collects_details_evidence || '', d.know_fees_reasonable || '',
              d.complete_fees_total_initially || '', d.work_transparency_tracking || '', d.know_legal_step_correct || '',
              d.case_prolonged_expensive || '', d.pairvi_knowledge_reason || '', d.court_docs_fees_timing || '',
              d.know_trustworthy_platform || '', d.priority_money_vs_release || '', d.prisoner_psychologic_survey || '',
              customJson
            ).run();
          } catch (retryErr) {
            console.error('Insert error in worker:', retryErr);
          }
        }

        const savedRecord = await env.DB.prepare(
          'SELECT * FROM prisoner_surveys WHERE LOWER(TRIM(utct_no)) = LOWER(TRIM(?))'
        ).bind(d.utct_no).first();

        let savedCustom = {};
        if (savedRecord?.custom_answers) {
          try { savedCustom = JSON.parse(savedRecord.custom_answers); } catch (e) {}
        }

        return new Response(
          JSON.stringify({ success: true, message: 'Saved successfully', data: { ...savedRecord, ...savedCustom } || d }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // 6. Update Survey
      if (path.startsWith('/api/survey/') && method === 'PUT') {
        const id = path.split('/')[3];
        const d = await request.json();

        const existing = await env.DB.prepare('SELECT * FROM prisoner_surveys WHERE id = ?').bind(id).first();
        let existingCustom = {};
        if (existing?.custom_answers) {
          try { existingCustom = JSON.parse(existing.custom_answers); } catch (e) {}
        }
        const customJson = extractCustomAnswers(d, existingCustom);

        try {
          await env.DB.prepare(`
            UPDATE prisoner_surveys SET
              utct_no = ?, name = ?, case_type = ?, total_cases = ?, case_duration = ?,
              total_advocates_hired = ?, times_in_jail = ?, advocate_name_number = ?,
              known_unknown_advocate = ?, high_court_advocate = ?, advocate_payment_advance = ?,
              first_advocate_by_io = ?, know_case_process = ?, lawyer_collects_details_evidence = ?,
              know_fees_reasonable = ?, complete_fees_total_initially = ?,
              work_transparency_tracking = ?, know_legal_step_correct = ?,
              case_prolonged_expensive = ?, pairvi_knowledge_reason = ?,
              court_docs_fees_timing = ?, know_trustworthy_platform = ?,
              priority_money_vs_release = ?, prisoner_psychologic_survey = ?,
              custom_answers = ?,
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).bind(
            d.utct_no, d.name, Array.isArray(d.case_type) ? d.case_type.join(', ') : (d.case_type || ''),
            Number(d.total_cases) || 0, d.case_duration || '', Number(d.total_advocates_hired) || 0,
            Number(d.times_in_jail) || 0, d.advocate_name_number || '', d.known_unknown_advocate || '',
            d.high_court_advocate || '', d.advocate_payment_advance || '', d.first_advocate_by_io || '',
            d.know_case_process || '', d.lawyer_collects_details_evidence || '', d.know_fees_reasonable || '',
            d.complete_fees_total_initially || '', d.work_transparency_tracking || '', d.know_legal_step_correct || '',
            d.case_prolonged_expensive || '', d.pairvi_knowledge_reason || '', d.court_docs_fees_timing || '',
            d.know_trustworthy_platform || '', d.priority_money_vs_release || '', d.prisoner_psychologic_survey || '',
            customJson,
            id
          ).run();
        } catch (e) {
          console.error('Update error in worker:', e);
        }

        const numId = Number(id) || id;
        const updatedRecord = await env.DB.prepare('SELECT * FROM prisoner_surveys WHERE id = ?').bind(numId).first();
        let updatedCustom = {};
        if (updatedRecord?.custom_answers) {
          try { updatedCustom = JSON.parse(updatedRecord.custom_answers); } catch (e) {}
        }
        const finalData = updatedRecord
          ? { ...updatedRecord, ...updatedCustom, id: numId }
          : { ...d, id: numId };
        return new Response(JSON.stringify({ success: true, message: 'Updated successfully', data: finalData }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // 7. Delete Survey
      if (path.startsWith('/api/survey/') && method === 'DELETE') {
        const id = path.split('/')[3];
        await env.DB.prepare('DELETE FROM prisoner_surveys WHERE id = ?').bind(id).run();
        return new Response(JSON.stringify({ success: true, message: 'Deleted successfully' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // 8. Questions List
      if (path === '/api/questions' && method === 'GET') {
        try {
          const list = await env.DB.prepare('SELECT * FROM questions ORDER BY order_num ASC, id ASC').all();
          const data = (list.results || []).map((q) => {
            let options = null;
            if (q.options) {
              try { options = JSON.parse(q.options); } catch (e) { options = q.options.split(','); }
            }
            return { ...q, required: Boolean(q.required), is_custom: Boolean(q.is_custom), options };
          });
          return new Response(JSON.stringify({ success: true, data }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } catch (e) {
          return new Response(JSON.stringify({ success: false, message: e.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      // 9. Add Question
      if (path === '/api/questions' && method === 'POST') {
        const body = await request.json();
        const maxOrder = (await env.DB.prepare('SELECT MAX(order_num) as m FROM questions').first())?.m || 0;
        const orderNum = body.order_num ? Number(body.order_num) : (maxOrder + 1);
        const key = body.key || `custom_${Date.now()}`;
        const optionsStr = body.options ? JSON.stringify(body.options) : null;

        await env.DB.prepare(`
          INSERT INTO questions (order_num, key, label, placeholder, type, options, required, note, is_custom)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
        `).bind(orderNum, key, body.label, body.placeholder || '', body.type || 'text', optionsStr, body.required ? 1 : 0, body.note || '').run();

        const created = await env.DB.prepare('SELECT * FROM questions WHERE key = ?').bind(key).first();
        return new Response(JSON.stringify({ success: true, data: created }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // 9b. Update Question & Numbering
      if (path.startsWith('/api/questions/') && method === 'PUT') {
        const id = path.split('/')[3];
        const body = await request.json();
        const existing = await env.DB.prepare('SELECT * FROM questions WHERE id = ?').bind(id).first();
        if (!existing) {
          return new Response(JSON.stringify({ success: false, message: 'Question not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const newOrderNum = (body.order_num !== undefined && !isNaN(body.order_num)) ? Number(body.order_num) : existing.order_num;
        const newLabel = body.label !== undefined ? body.label.trim() : existing.label;
        const newPlaceholder = body.placeholder !== undefined ? body.placeholder.trim() : existing.placeholder;
        const newType = body.type || existing.type;
        const newRequired = body.required !== undefined ? (body.required ? 1 : 0) : existing.required;
        const newNote = body.note !== undefined ? body.note.trim() : existing.note;
        let optionsStr = existing.options;
        if (body.options !== undefined) {
          optionsStr = Array.isArray(body.options) ? JSON.stringify(body.options) : (typeof body.options === 'string' ? JSON.stringify(body.options.split(',').map((s) => s.trim()).filter(Boolean)) : null);
        }

        await env.DB.prepare(`
          UPDATE questions SET
            order_num = ?, label = ?, placeholder = ?, type = ?, options = ?, required = ?, note = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).bind(newOrderNum, newLabel, newPlaceholder, newType, optionsStr, newRequired, newNote, id).run();

        const updated = await env.DB.prepare('SELECT * FROM questions WHERE id = ?').bind(id).first();
        return new Response(JSON.stringify({ success: true, message: 'Question updated successfully', data: updated }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // 9c. Delete Question
      if (path.startsWith('/api/questions/') && method === 'DELETE') {
        const id = path.split('/')[3];
        await env.DB.prepare('DELETE FROM questions WHERE id = ?').bind(id).run();
        return new Response(JSON.stringify({ success: true, message: 'Question deleted successfully' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // 9d. Batch Reorder Questions
      if (path === '/api/questions/reorder' && method === 'POST') {
        const { items } = await request.json();
        if (Array.isArray(items)) {
          for (const item of items) {
            if (item.label) {
              await env.DB.prepare('UPDATE questions SET order_num = ?, label = ? WHERE id = ?').bind(Number(item.order_num), item.label, item.id).run();
            } else {
              await env.DB.prepare('UPDATE questions SET order_num = ? WHERE id = ?').bind(Number(item.order_num), item.id).run();
            }
          }
        }
        const updatedList = await env.DB.prepare('SELECT * FROM questions ORDER BY order_num ASC, id ASC').all();
        return new Response(JSON.stringify({ success: true, message: 'Reordered successfully', data: updatedList.results }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // 9e. Reset Questions to Default 24
      if (path === '/api/questions/reset' && method === 'POST') {
        await env.DB.prepare('DELETE FROM questions').run();
        const defaultQueries = [
          [1, 'utct_no', '1) UT/CT No.', 'e.g. UT/2026/104 or CT/2026/89', 'text', null, 1, 'Note:- Unique ID. System will verify against database before proceeding.', 0],
          [2, 'name', '2) Name', 'Enter prisoner full name', 'text', null, 1, 'Note:- Please enter prisoner full name.', 0],
          [3, 'case_type', '3) Case type / how you type of advocate to hire', 'Select one or more case types', 'multi-select', null, 1, 'Note:- You can select multiple case types from the dropdown managed on the home page.', 0],
          [4, 'total_cases', '4) Total number of cases', 'e.g. 1, 2, 3', 'number', null, 1, 'Note:- Input only Numbers', 0],
          [5, 'case_duration', '5) How long these cases are running', 'e.g. 6 Months, 2 Years, 1 Year 4 Months', 'text', null, 1, 'Note:- Specify duration (months / years).', 0],
          [6, 'total_advocates_hired', '6) Total advocate hired till date', 'e.g. 0, 1, 2', 'number', null, 1, 'Note:- Input only Numbers', 0],
          [7, 'times_in_jail', '7) How many time come to jail', 'e.g. 1, 2, 3', 'number', null, 1, 'Note:- Input only Numbers', 0],
          [8, 'advocate_name_number', '8) Advocate name and number', 'e.g. Adv. R.K. Gupta (+91 9876543210)', 'text', null, 0, 'Note:- Enter current or previous advocate name and phone number.', 0],
          [9, 'known_unknown_advocate', '9) Known / unknown Advocate', 'Known or Unknown', 'yesno_or_choice', '["Known","Unknown","Yes","No"]', 0, 'Note:- Pls enter Only Yes or No', 0],
          [10, 'high_court_advocate', '10) High court advocate', 'Yes or No', 'yesno', '["Yes","No"]', 0, 'Note:- Pls enter Only Yes or No', 0],
          [11, 'advocate_payment_advance', '11) Advocate payment advance', 'Type \'Yes\' or \'No\'', 'yesno_advance', '["Yes","No"]', 0, 'Note:- Pls enter Only Yes or No', 0],
          [12, 'first_advocate_by_io', '12) First Advocate hired by IO', 'Yes or No', 'yesno', '["Yes","No"]', 0, 'Note:- Pls enter Only Yes or No', 0],
          [13, 'know_case_process', '13) Do you know process, when case started, first and next step', 'Yes or No', 'yesno', '["Yes","No"]', 0, 'Note:- Pls enter Only Yes or No', 0],
          [14, 'lawyer_collects_details_evidence', '14) Does your lawyer ask, all details about your case, and collect evidence', 'Yes or No', 'yesno', '["Yes","No"]', 0, 'Note:- Pls enter Only Yes or No', 0],
          [15, 'know_fees_reasonable', '15) How do you know, lawyer jo fees le raha hai, vo sahi hai', 'Yes or No / Details', 'yesno_text', '["Yes","No"]', 0, 'Note:- Pls enter Only Yes or No', 0],
          [16, 'complete_fees_total_initially', '16) Does it give, complete fees total, initially', 'Type \'Yes\' or \'No\'', 'yesno_advance', '["Yes","No"]', 0, 'Note:- Pls enter Only Yes or No (If Yes, specify complete fees amount)', 0],
          [17, 'work_transparency_tracking', '17) Work transparency and tracking of lawyer work', 'Yes or No', 'yesno', '["Yes","No"]', 0, 'Note:- Pls enter Only Yes or No', 0],
          [18, 'know_legal_step_correct', '18) Kya apko pata hai, jo legal step lawyer process kar raha hai, vo sab sahi hai, kuch miss toh nahi kar raha', 'Yes or No', 'yesno', '["Yes","No"]', 0, 'Note:- Pls enter Only Yes or No', 0],
          [19, 'case_prolonged_expensive', '19) Because of some extra unwanted step, kya lawyer ki wajah se, case lamba chala aur expensive ho gaya', 'Yes or No', 'yesno', '["Yes","No"]', 0, 'Note:- Pls enter Only Yes or No', 0],
          [20, 'pairvi_knowledge_reason', '20) Parivi karwane ko knowledge hai ya nahi, aur kyun parivi karta hai', 'Yes or No / Details', 'yesno_text', '["Yes","No"]', 0, 'Note:- Pls enter Only Yes or No', 0],
          [21, 'court_docs_fees_timing', '21) Court ke doc kyun nikalte hai, and uski fees pata hai, aur kya vo aapko time pe miljate hai', 'Yes or No / Details', 'yesno_text', '["Yes","No"]', 0, 'Note:- Pls enter Only Yes or No', 0],
          [22, 'know_trustworthy_platform', '22) Do you know any platform, jo aapko pairvi karne wala de, and jo guarantee de ki, jo adv provide karega, jo trustworthy hoga', 'Yes or No', 'yesno', '["Yes","No"]', 0, 'Note:- Pls enter Only Yes or No', 0],
          [23, 'priority_money_vs_release', '23) Your priority, ki paise bachana hai ya jail se bahar jaldi jana hai', 'Select priority', 'choice_text', '["Jail se bahar jaldi jana","Paise bachana"]', 0, 'Note:- Please select only one of the 2 options: Jail se bahar jaldi jana OR Paise bachana', 0],
          [24, 'prisoner_psychologic_survey', '24) Prisoner psychologic according Survey', 'Select Yes or No, and add remarks (optional)...', 'psychologic_yesno', '["Yes","No"]', 0, 'Note:- Pls select Yes or No (Remarks optional)', 0]
        ];
        for (const q of defaultQueries) {
          await env.DB.prepare(`
            INSERT INTO questions (order_num, key, label, placeholder, type, options, required, note, is_custom)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(...q).run();
        }
        const resetList = await env.DB.prepare('SELECT * FROM questions ORDER BY order_num ASC, id ASC').all();
        return new Response(JSON.stringify({ success: true, message: 'Reset to default 24 questions', data: resetList.results }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // 10. Case Types List
      if (path === '/api/case-types' && method === 'GET') {
        const list = await env.DB.prepare('SELECT * FROM case_types ORDER BY name ASC').all();
        return new Response(
          JSON.stringify({ success: true, data: list.results }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // 11. Add Case Type
      if (path === '/api/case-types' && method === 'POST') {
        const { name } = await request.json();
        await env.DB.prepare('INSERT OR IGNORE INTO case_types (name) VALUES (?)').bind(name.trim()).run();
        return new Response(JSON.stringify({ success: true, message: 'Case type added' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // 12. Delete Case Type
      if (path.startsWith('/api/case-types/') && method === 'DELETE') {
        const id = path.split('/')[3];
        await env.DB.prepare('DELETE FROM case_types WHERE id = ?').bind(id).run();
        return new Response(JSON.stringify({ success: true, message: 'Case type deleted' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ message: 'Not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
};
