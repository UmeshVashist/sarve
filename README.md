# Legal Sarve Portal (Prisoner & Advocate Survey System)

A full-stack Web Application built with **React (Vite)**, **Node.js (Express)**, and **SQLite / Cloudflare D1 Database**, featuring survey workflows, unique ID verification, dynamic case-type management, and Excel reporting.

---

## 🎨 Theme & Credentials
- **Background Color**: `#A3B9D0` (`rgb(163, 185, 208)`)
- **Action Buttons / Dashboard Cards**: Warm Peach/Coral (`#EE9576`) matching your reference image.
- **Login Credentials**:
  - **Username**: `sarve`
  - **Password**: `New@1020`

---

## 🚀 Quick Start (Running Locally)

### 1. Start Both Backend & Frontend Simultaneously:
```bash
npm run dev
```
- **Frontend App**: [http://localhost:5173](http://localhost:5173)
- **Backend API**: [http://localhost:5000](http://localhost:5000)

### Or Run Individually:
- **Server only**: `npm run server` (runs on port 5000)
- **Client only**: `npm run client` (runs on port 5173)

---

## ✨ Features Implemented

1. **Authentication System**:
   - Protected login with credentials `sarve` / `New@1020`.
   - Show/hide password toggle, error banners, and session persistence in `localStorage`.

2. **Dashboard Hub (4 Big Option Cards)**:
   - Matches the uploaded reference design with peach/coral buttons:
     - **Prisoner Sarve** (Active survey portal)
     - **Advocate Sarve** (Phase 2)
     - **Citizen Sarve** (Phase 2)
     - **Other** (Phase 2)

3. **Prisoner Sarve Page**:
   - Quick statistics cards: Total Surveys, High Court Advocates, Advance Fee cases, Immediate Release Priority.
   - **`+ Add Data`** button: Launches the 24-question survey wizard.
   - **`📥 Download Excel`** button: Exports all survey records to `.xlsx` with the exact 24 questions as column headers.
   - **`⚙️ Manage Case Types`** button: Manage dynamic case types that appear in Question 3.
   - **Real-time Search Bar**: Search across UT/CT No, Prisoner Name, Case Type, Advocate Name, etc.
   - **Data Table**: Displays records with UT/CT badges, case type tags, advance payment status, and actions:
     - 👁️ **View Full Response** (all 24 questions & answers)
     - ✏️ **Edit Record**
     - 🗑️ **Delete Record**

4. **Questionnaire Wizard (1 Question at a Time)**:
   - Displays 1 question at a time with a progress bar and percentage indicator.
   - **Enter Key Support**: Pressing Enter advances to the next question.
   - **Previous Button**: Go back anytime to change a previous answer.
   - **UT/CT No. Real-time Uniqueness Check**:
     - On Question 1, validates whether the entered UT/CT No. already exists in the database.
     - Displays error alert: `❌ Error: UT/CT No. already exists in database!` and prevents duplicate submissions.
   - **Input Validation**:
     - Questions 4, 6, 7 enforce numeric-only input (`Note:- Input only Numbers`).
     - Questions 9 to 22 display `Note:- Pls enter Only Yes or No` with quick Yes/No buttons.
     - Question 3 multi-select tag picker populated from dynamic case types.
   - **Review & Edit Summary Screen**:
     - When all 24 questions are completed, a review screen displays all questions and answers.
     - Each question has an **"✏️ Edit"** button to quickly adjust any answer before final submission!
     - Submit button saves to database with celebratory feedback and table auto-refresh.

5. **Cloudflare D1 Integration**:
   - Compatible with **Cloudflare D1** serverless SQLite database.
   - Includes `cloudflare/schema.sql`, `cloudflare/wrangler.toml`, `cloudflare/worker.js`, and `cloudflare/README.md` for 1-click deployment to Cloudflare D1 and Pages.

---

## 📋 The 24 Survey Questions

1. `UT/CT No.` *(Unique Identifier checked against DB)*
2. `Name` *(Prisoner Name)*
3. `Case type / how you type of advocate to hire` *(Multi-select from dynamic Case Types)*
4. `Total number of cases` *(Numbers only)*
5. `How long these cases are running`
6. `Total advocate hired till date` *(Numbers only)*
7. `How many time come to jail` *(Numbers only)*
8. `Advocate name and number`
9. `Known / unknown Advocate` *(Note:- Pls enter Only Yes or No)*
10. `High court advocate` *(Note:- Pls enter Only Yes or No)*
11. `Advocate payment advance` *(Note:- Pls enter Only Yes or No)*
12. `First Advocate hired by IO` *(Note:- Pls enter Only Yes or No)*
13. `Do you know process, when case started, first and next step` *(Note:- Pls enter Only Yes or No)*
14. `Does your lawyer ask, all details about your case, and collect evidence` *(Note:- Pls enter Only Yes or No)*
15. `How do you know, lawyer jo fees le raha hai, vo sahi hai` *(Note:- Pls enter Only Yes or No)*
16. `Does it give, complete fees total, initially` *(Note:- Pls enter Only Yes or No)*
17. `Work transparency and tracking of lawyer work` *(Note:- Pls enter Only Yes or No)*
18. `Kya apko pata hai, jo legal step lawyer process kar raha hai, vo sab sahi hai, kuch miss toh nahi kar raha` *(Note:- Pls enter Only Yes or No)*
19. `Because of some extra unwanted step, kya lawyer ki wajah se, case lamba chala aur expensive ho gaya` *(Note:- Pls enter Only Yes or No)*
20. `Parivi karwane ko knowledge hai ya nahi, aur kyun parivi karta hai` *(Note:- Pls enter Only Yes or No)*
21. `Court ke doc kyun nikalte hai, and uski fees pata hai, aur kya vo aapko time pe miljate hai` *(Note:- Pls enter Only Yes or No)*
22. `Do you know any platform, jo aapko pairvi karne wala de, and jo guarantee de ki, jo adv provide karega, jo trustworthy hoga` *(Note:- Pls enter Only Yes or No)*
23. `Your priority, ki paise bachana hai ya jail se bahar jaldi jana hai`
24. `Prisoner psychologic according sarve`

