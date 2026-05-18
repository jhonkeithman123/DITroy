# DITroy Structure & Roadmap

## 📂 Repository Layout

```md
📂 DITroy
┣ 📂 core
┃ ┣ 📄 nlp
┃ ┣ 📄 dialogue
┃ ┗ 📄 personality
┣ 📂 interfaces
┃ ┣ 📄 console
┃ ┣ 📄 gui
┃ ┗ 📄 api
┣ 📂 infra
┃ ┣ 📄 caching
┃ ┣ 📄 error-handling
┃ ┗ 📄 database
┣ 📂 models
┃ ┣ 📄 v1-basic
┃ ┣ 📄 v2-gui
┃ ┗ 📄 v3-personality
┣ 📂 tests
┣ 📂 docs
┣ 📄 structure-plan.md
┣ 📄 microservices-plan.md
┣ 📄 error-handling-plan.md
┗ 📄 caching-plan.md
```

---

## 🧩 Responsibilities by Folder

- **[core/nlp](ca://s?q=DITroy_core_nlp)** → Tokenization, intent recognition, sentiment analysis.
- **[core/dialogue](ca://s?q=DITroy_core_dialogue)** → Rule-based and context-aware conversation logic.
- **[core/personality](ca://s?q=DITroy_core_personality)** → Humor, empathy, block identity (DITrix → DITroy).
- **[interfaces/console](ca://s?q=DITroy_console_interface)** → CLI chatbot loop.
- **[interfaces/gui](ca://s?q=DITroy_gui_interface)** → WinForms or web-based chat UI.
- **[infra/caching](ca://s?q=DITroy_infra_caching)** → Store recent conversation state.
- **[infra/error-handling](ca://s?q=DITroy_infra_error_handling)** → Centralized error management.
- **[infra/database](ca://s?q=DITroy_infra_database)** → FAQs, user preferences, block-wide knowledge base.
- **[models/v1-basic](ca://s?q=DITroy_Model_1_console)** → Console + basic dialogue.
- **[models/v2-gui](ca://s?q=DITroy_Model_2_gui)** → GUI + improved dialogue.
- **[models/v3-personality](ca://s?q=DITroy_Model_3_personality)** → GUI + personality + memory.

---

## 🚀 Roadmap

### Phase 0 — Preparation

- Learn programming fundamentals (C#, OOP, data structures).
- Set up GitHub repo with skeleton folders.
- Document plans in `/docs`.

### Phase 1 — Model 1 (Console Assistant)

- Build CLI chatbot loop.
- Add basic dialogue (rule-based).
- Package as a library for import.

### Phase 2 — Model 2 (GUI Assistant)

- Create WinForms GUI interface.
- Improve dialogue logic with simple NLP.
- Add error handling and caching.

### Phase 3 — Model 3 (Personality + Memory)

- Add personality module (humor, empathy, block identity).
- Implement context-aware dialogue management.
- Store user preferences and FAQs in database.

### Phase 4 — Packaging & Integration

- Export as DLL (C#), npm (Node.js), or pip (Python).
- Integrate into other apps.
- Use semantic versioning (v1.0.0, v2.0.0, v3.0.0).

### Phase 5 — Block-Wide Deployment

- Host repo in GitHub org for DITrix block.
- Assign contribution roles (NLP team, GUI team, personality team).
- Deploy cloud-hosted version for shared use.

---

## 👥 Collaboration Workflow

- Use GitHub branches for features (`feature/gui`, `feature/nlp`).
- Pull requests reviewed by blockmates.
- Keep `/docs` updated with plans and study notes.
- Assign roles so each team focuses on one layer.

---

## 🎯 Key Principles

- **Modularity:** Each layer is reusable across models.
- **Scalability:** Models evolve by combining layers differently.
- **Documentation:** Every subsystem has a plan in `/docs`.
- **Collaboration:** Blockmates can contribute without breaking core logic.
