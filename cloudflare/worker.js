// Cloudflare Worker API for Survey Portal using Cloudflare D1
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
            priority_money_vs_release, prisoner_psychologic_survey
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          d.utct_no, d.name, Array.isArray(d.case_type) ? d.case_type.join(', ') : (d.case_type || ''),
          Number(d.total_cases) || 0, d.case_duration || '', Number(d.total_advocates_hired) || 0,
          Number(d.times_in_jail) || 0, d.advocate_name_number || '', d.known_unknown_advocate || '',
          d.high_court_advocate || '', d.advocate_payment_advance || '', d.first_advocate_by_io || '',
          d.know_case_process || '', d.lawyer_collects_details_evidence || '', d.know_fees_reasonable || '',
          d.complete_fees_total_initially || '', d.work_transparency_tracking || '', d.know_legal_step_correct || '',
          d.case_prolonged_expensive || '', d.pairvi_knowledge_reason || '', d.court_docs_fees_timing || '',
          d.know_trustworthy_platform || '', d.priority_money_vs_release || '', d.prisoner_psychologic_survey || ''
        ).run();

        const savedRecord = await env.DB.prepare(
          'SELECT * FROM prisoner_surveys WHERE LOWER(TRIM(utct_no)) = LOWER(TRIM(?))'
        ).bind(d.utct_no).first();

        return new Response(
          JSON.stringify({ success: true, message: 'Saved successfully', data: savedRecord || d }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // 6. Update Survey
      if (path.startsWith('/api/survey/') && method === 'PUT') {
        const id = path.split('/')[3];
        const d = await request.json();

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
          id
        ).run();

        const updatedRecord = await env.DB.prepare('SELECT * FROM prisoner_surveys WHERE id = ?').bind(id).first();
        return new Response(JSON.stringify({ success: true, message: 'Updated successfully', data: updatedRecord || d }), {
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
