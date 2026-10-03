document.addEventListener("DOMContentLoaded", () => {
  const notesArea = document.getElementById("study-notes");
  const fileInput = document.getElementById("file-input");
  const fileChip = document.getElementById("file-chip");
  const clearMaterialButton = document.getElementById("clear-material");
  const outputContent = document.getElementById("output-content");
  const emptyState = document.getElementById("empty-state");
  const loadingState = document.getElementById("loading-state");
  const formMessage = document.getElementById("form-message");
  const resultClearControls = document.getElementById("result-clear-controls");
  const modes = [...document.querySelectorAll(".format-option")];
  const clearResultButtons = [...document.querySelectorAll("[data-clear-mode]")];
  const storageKey = "smart-study-buddy-sets";
  let activeMode = "summary";
  let displayedResultMode = null;
  let attachedFile = null;
  let savedSets = loadSavedSets();

  const icon = (name, className = "") => {
    const element = document.createElement("i");
    element.dataset.lucide = name;
    if (className) element.className = className;
    return element;
  };

  function refreshIcons() {
    if (window.lucide) window.lucide.createIcons();
  }

  function loadSavedSets() {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "[]");
      return Array.isArray(saved) ? saved.filter((item) => item && item.id && item.title && item.mode) : [];
    } catch {
      return [];
    }
  }

  function updateLibraryCount() {
    document.getElementById("library-count").textContent = savedSets.length;
  }

  function setMessage(message, isError = false) {
    formMessage.textContent = message;
    formMessage.classList.toggle("is-error", isError);
  }

  function updateCount() {
    const count = notesArea.value.length;
    document.getElementById("source-count").textContent = `${count.toLocaleString()} / 30,000`;
    clearMaterialButton.disabled = count === 0 && !attachedFile;
  }

  function showView(viewName) {
    const isLibrary = viewName === "library";
    document.getElementById("workspace-view").classList.toggle("hidden", isLibrary);
    document.getElementById("library-view").classList.toggle("hidden", !isLibrary);
    document.getElementById("breadcrumb-current").textContent = isLibrary ? "SAVED SETS" : "CREATE A SET";
    document.querySelectorAll(".nav-link").forEach((button) => {
      const isActive = button.dataset.view === viewName;
      button.classList.toggle("is-active", isActive);
      if (isActive) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });
    if (isLibrary) renderLibrary();
  }

  document.querySelectorAll(".nav-link").forEach((button) => {
    button.addEventListener("click", () => showView(button.dataset.view));
  });

  modes.forEach((button) => {
    button.addEventListener("click", () => {
      activeMode = button.dataset.mode;
      modes.forEach((option) => {
        const selected = option === button;
        option.classList.toggle("is-selected", selected);
        option.setAttribute("aria-pressed", String(selected));
      });
    });
  });

  notesArea.addEventListener("input", updateCount);

  function clearAttachedFileState() {
    attachedFile = null;
    fileInput.value = "";
    fileChip.classList.add("hidden");
    document.getElementById("file-name-display").textContent = "";
    updateCount();
  }

  function setAttachedFile(file) {
    if (!file) {
      clearAttachedFileState();
      return;
    }

    const extension = file.name.split(".").pop().toLowerCase();
    if (!["docx", "pptx"].includes(extension)) {
      clearAttachedFileState();
      setMessage("Choose a DOCX or PPTX document.", true);
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      clearAttachedFileState();
      setMessage("That file is over 12 MB. Try a smaller document.", true);
      return;
    }

    attachedFile = file;
    document.getElementById("file-name-display").textContent = file.name;
    fileChip.classList.remove("hidden");
    updateCount();
    setMessage("");
    refreshIcons();
  }

  fileInput.addEventListener("change", () => setAttachedFile(fileInput.files[0]));
  document.getElementById("remove-file").addEventListener("click", () => {
    clearAttachedFileState();
  });
  clearMaterialButton.addEventListener("click", () => {
    notesArea.value = "";
    clearAttachedFileState();
    setMessage("");
    notesArea.focus();
  });

  const dropZone = document.getElementById("drop-zone");
  ["dragenter", "dragover"].forEach((eventName) => dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.add("is-dragging");
  }));
  ["dragleave", "drop"].forEach((eventName) => dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.remove("is-dragging");
  }));
  dropZone.addEventListener("drop", (event) => setAttachedFile(event.dataTransfer.files[0]));

  async function extractDocx(file) {
    if (!window.mammoth) throw new Error("The document reader did not load. Refresh the page and try again.");
    const extracted = await window.mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return extracted.value;
  }

  async function extractPptx(file) {
    if (!window.JSZip) throw new Error("The presentation reader did not load. Refresh the page and try again.");
    const archive = await window.JSZip.loadAsync(file);
    const slides = Object.keys(archive.files)
      .filter((path) => /^ppt\/slides\/slide\d+\.xml$/.test(path))
      .sort((left, right) => Number(left.match(/slide(\d+)/)[1]) - Number(right.match(/slide(\d+)/)[1]));
    const slideText = [];
    for (const path of slides) {
      const xml = await archive.file(path).async("text");
      const document = new DOMParser().parseFromString(xml, "application/xml");
      if (document.querySelector("parsererror")) continue;
      slideText.push([...document.getElementsByTagName("a:t")].map((node) => node.textContent).join(" "));
    }
    return slideText.join("\n");
  }

  async function extractFile(file) {
    return file.name.toLowerCase().endsWith(".docx") ? extractDocx(file) : extractPptx(file);
  }

  function saveSet(item) {
    savedSets = [item, ...savedSets.filter((saved) => saved.id !== item.id)].slice(0, 20);
    try {
      localStorage.setItem(storageKey, JSON.stringify(savedSets));
    } catch {
      setMessage("This set was created, but your browser could not save it to the library.", true);
    }
    updateLibraryCount();
  }

  function renderSummary(text) {
    const summary = document.createElement("div");
    summary.className = "summary-output";
    summary.textContent = text;
    outputContent.append(summary);
  }

  function renderFlashcards(cards) {
    if (!Array.isArray(cards) || !cards.length || cards.some((card) => typeof card.question !== "string" || typeof card.answer !== "string")) {
      throw new Error("The flashcards came back in an unexpected format. Try generating them again.");
    }
    let currentIndex = 0;
    let showingAnswer = false;
    const card = document.createElement("button");
    card.className = "study-card";
    card.type = "button";
    card.setAttribute("aria-label", "Reveal flashcard answer");
    const label = document.createElement("span");
    label.className = "study-card-label";
    const text = document.createElement("strong");
    text.className = "study-card-text";
    const reveal = document.createElement("span");
    reveal.className = "reveal-hint";
    card.append(label, text, reveal);

    const controls = document.createElement("div");
    controls.className = "deck-controls";
    const previous = document.createElement("button");
    previous.type = "button";
    previous.className = "icon-button deck-arrow";
    previous.setAttribute("aria-label", "Previous flashcard");
    previous.append(icon("arrow-left"));
    const progress = document.createElement("span");
    progress.className = "deck-progress";
    const next = document.createElement("button");
    next.type = "button";
    next.className = "icon-button deck-arrow";
    next.setAttribute("aria-label", "Next flashcard");
    next.append(icon("arrow-right"));
    controls.append(previous, progress, next);

    function updateCard() {
      const current = cards[currentIndex];
      label.textContent = showingAnswer ? "ANSWER" : `CARD ${String(currentIndex + 1).padStart(2, "0")}`;
      text.textContent = showingAnswer ? current.answer : current.question;
      reveal.textContent = showingAnswer ? "Tap to see question" : "Tap to reveal answer";
      progress.textContent = `${currentIndex + 1} / ${cards.length}`;
      card.setAttribute("aria-label", showingAnswer ? "Show flashcard question" : "Reveal flashcard answer");
    }

    card.addEventListener("click", () => { showingAnswer = !showingAnswer; updateCard(); });
    previous.addEventListener("click", () => { currentIndex = (currentIndex - 1 + cards.length) % cards.length; showingAnswer = false; updateCard(); });
    next.addEventListener("click", () => { currentIndex = (currentIndex + 1) % cards.length; showingAnswer = false; updateCard(); });
    updateCard();
    outputContent.append(card, controls);
  }

  function renderQuiz(questions) {
    if (!Array.isArray(questions) || !questions.length || questions.some((item) => !item.question || !Array.isArray(item.options) || item.options.length < 2 || !item.options.includes(item.answer))) {
      throw new Error("The quiz came back in an unexpected format. Try generating it again.");
    }
    const form = document.createElement("form");
    form.className = "quiz-form";
    const groups = [];
    let quizCompleted = false;

    questions.forEach((item, index) => {
      const fieldset = document.createElement("fieldset");
      fieldset.className = "quiz-question";
      const legend = document.createElement("legend");
      legend.textContent = `${String(index + 1).padStart(2, "0")}  ${item.question}`;
      fieldset.append(legend);
      const feedback = document.createElement("p");
      feedback.className = "quiz-feedback";
      item.options.forEach((option, optionIndex) => {
        const label = document.createElement("label");
        label.className = "quiz-option";
        const input = document.createElement("input");
        input.type = "radio";
        input.name = `question-${index}`;
        input.value = option;
        input.required = true;
        const marker = document.createElement("span");
        marker.className = "option-letter";
        marker.textContent = String.fromCharCode(65 + optionIndex);
        const optionText = document.createElement("span");
        optionText.textContent = option;
        label.append(input, marker, optionText);
        fieldset.append(label);
      });
      fieldset.append(feedback);
      groups.push({ fieldset, item, feedback });
      form.append(fieldset);
    });

    const footer = document.createElement("div");
    footer.className = "quiz-footer";
    const score = document.createElement("p");
    score.className = "quiz-score";
    const submit = document.createElement("button");
    submit.className = "primary-button quiz-submit";
    submit.type = "submit";
    submit.textContent = "Check my answers";
    footer.append(score, submit);
    form.append(footer);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (quizCompleted) {
        quizCompleted = false;
        groups.forEach(({ fieldset, feedback }) => {
          fieldset.classList.remove("is-correct", "is-incorrect");
          feedback.textContent = "";
          feedback.classList.remove("is-visible");
          fieldset.querySelectorAll("input").forEach((input) => {
            input.checked = false;
            input.disabled = false;
          });
        });
        score.textContent = "";
        submit.disabled = false;
        submit.textContent = "Check my answers";
        return;
      }

      const answers = new FormData(form);
      let correct = 0;
      groups.forEach(({ fieldset, item, feedback }, index) => {
        const isCorrect = answers.get(`question-${index}`) === item.answer;
        if (isCorrect) correct += 1;
        fieldset.classList.add(isCorrect ? "is-correct" : "is-incorrect");
        feedback.textContent = `${isCorrect ? "Correct" : `Answer: ${item.answer}`}${item.explanation ? ` · ${item.explanation}` : ""}`;
        feedback.classList.add("is-visible");
        fieldset.querySelectorAll("input").forEach((input) => { input.disabled = true; });
      });
      score.textContent = `You got ${correct} of ${questions.length} right.`;
      quizCompleted = true;
      submit.disabled = false;
      submit.textContent = "Try again";
    });
    outputContent.append(form);
  }

  function renderResult(result, mode) {
    outputContent.replaceChildren();
    const modeHandlers = {
      summary: renderSummary,
      flashcards: renderFlashcards,
      quiz: renderQuiz,
    };

    const modeTitles = {
      summary: { title: "Your study guide", badge: "STUDY GUIDE" },
      flashcards: { title: "Your flashcards", badge: "FLASHCARDS" },
      quiz: { title: "Your quick quiz", badge: "QUICK QUIZ" },
    };

    const handler = modeHandlers[mode];
    if (handler) handler(result);

    const label = modeTitles[mode] || modeTitles.summary;
    displayedResultMode = mode;
    resultClearControls.classList.remove("hidden");
    clearResultButtons.forEach((button) => {
      button.disabled = button.dataset.clearMode !== mode;
    });
    document.getElementById("result-title").textContent = label.title;
    document.getElementById("result-badge").lastElementChild.textContent = label.badge;
    emptyState.classList.add("hidden");
    loadingState.classList.add("hidden");
    outputContent.classList.remove("hidden");
    refreshIcons();
  }

  function clearDisplayedResult(mode) {
    if (displayedResultMode !== mode) return;
    outputContent.replaceChildren();
    outputContent.classList.add("hidden");
    emptyState.classList.remove("hidden");
    loadingState.classList.add("hidden");
    resultClearControls.classList.add("hidden");
    clearResultButtons.forEach((button) => { button.disabled = true; });
    displayedResultMode = null;
    document.getElementById("result-title").textContent = "Ready when you are";
    document.getElementById("result-badge").lastElementChild.textContent = "NEW SET";
  }

  clearResultButtons.forEach((button) => {
    button.addEventListener("click", () => clearDisplayedResult(button.dataset.clearMode));
  });

  document.getElementById("generate-btn").addEventListener("click", async (event) => {
    const button = event.currentTarget;
    const notes = notesArea.value.trim();
    if (!notes && !attachedFile) {
      setMessage("Add some notes or attach a document to get started.", true);
      notesArea.focus();
      return;
    }

    button.disabled = true;
    button.classList.add("is-loading");
    setMessage("");
    emptyState.classList.add("hidden");
    outputContent.classList.add("hidden");
    resultClearControls.classList.add("hidden");
    displayedResultMode = null;
    loadingState.classList.remove("hidden");

    try {
      let sourceText = notes;
      if (attachedFile) {
        document.getElementById("loading-title").textContent = "Reading your document";
        document.getElementById("loading-text").textContent = `Extracting text from ${attachedFile.name}.`;
        const extracted = await extractFile(attachedFile);
        sourceText = [notes, extracted].filter(Boolean).join("\n\n");
      }
      sourceText = sourceText.trim();
      if (!sourceText) throw new Error("No readable text was found. Try another document or paste your notes instead.");
      if (sourceText.length > 30000) throw new Error("Your source is over 30,000 characters. Remove a section and try again.");

      document.getElementById("loading-title").textContent = "Making sense of your notes";
      document.getElementById("loading-text").textContent = "Pulling out the ideas worth remembering.";
      const response = await fetch("/.netlify/functions/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: sourceText, mode: activeMode }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "The study set could not be generated. Try again.");

      renderResult(data.result, activeMode);
      const fallbackTitle = attachedFile ? attachedFile.name.replace(/\.(docx|pptx)$/i, "") : "Untitled study set";
      saveSet({
        id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
        title: document.getElementById("set-title").value.trim() || fallbackTitle,
        mode: activeMode,
        result: data.result,
        createdAt: new Date().toISOString(),
      });
    } catch (error) {
      loadingState.classList.add("hidden");
      outputContent.replaceChildren();
      const errorBox = document.createElement("div");
      errorBox.className = "error-state";
      errorBox.append(icon("circle-alert"));
      const message = document.createElement("p");
      message.textContent = error.message || "Something went wrong. Please try again.";
      errorBox.append(message);
      outputContent.append(errorBox);
      outputContent.classList.remove("hidden");
      clearResultButtons.forEach((clearButton) => { clearButton.disabled = true; });
      document.getElementById("result-title").textContent = "Could not make that set";
      setMessage("Check the message in your study panel and try again.", true);
      refreshIcons();
    } finally {
      button.disabled = false;
      button.classList.remove("is-loading");
    }
  });

  function formatDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "Saved study set" : new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
  }

  function renderLibrary() {
    const list = document.getElementById("library-list");
    const query = document.getElementById("library-search").value.trim().toLowerCase();
    const filtered = savedSets.filter((item) => item.title.toLowerCase().includes(query));
    list.replaceChildren();
    document.getElementById("clear-library").classList.toggle("hidden", savedSets.length === 0);
    if (!filtered.length) {
      const empty = document.createElement("div");
      empty.className = "library-empty";
      empty.append(icon(savedSets.length ? "search-x" : "library"));
      const heading = document.createElement("h2");
      heading.textContent = savedSets.length ? "No sets found" : "Your library is taking a breath.";
      const copy = document.createElement("p");
      copy.textContent = savedSets.length ? "Try another search." : "Create a study set and it will be ready for you here next time.";
      empty.append(heading, copy);
      list.append(empty);
      refreshIcons();
      return;
    }

    filtered.forEach((item) => {
      const row = document.createElement("div");
      row.className = "library-item-row";
      const openButton = document.createElement("button");
      openButton.type = "button";
      openButton.className = "library-item";
      const badge = document.createElement("span");
      badge.className = `library-item-icon ${item.mode}`;
      badge.append(icon(item.mode === "summary" ? "align-left" : item.mode === "flashcards" ? "layers-2" : "list-checks"));
      const detail = document.createElement("span");
      detail.className = "library-item-detail";
      const title = document.createElement("strong");
      title.textContent = item.title;
      const meta = document.createElement("small");
      meta.textContent = `${item.mode === "summary" ? "Study guide" : item.mode === "flashcards" ? "Flashcards" : "Quick quiz"} · ${formatDate(item.createdAt)}`;
      detail.append(title, meta);
      openButton.append(badge, detail, icon("arrow-up-right", "library-open-icon"));
      openButton.addEventListener("click", () => {
        try {
          renderResult(item.result, item.mode);
          document.getElementById("set-title").value = item.title;
          showView("workspace");
        } catch {
          setMessage("This saved set could not be opened. Try creating it again.", true);
          showView("workspace");
        }
      });
      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.className = "library-delete";
      removeButton.setAttribute("aria-label", `Delete ${item.title}`);
      removeButton.title = "Delete this saved set";
      removeButton.append(icon("trash-2"));
      removeButton.addEventListener("click", () => {
        const updatedSets = savedSets.filter((saved) => saved.id !== item.id);
        try {
          localStorage.setItem(storageKey, JSON.stringify(updatedSets));
          savedSets = updatedSets;
          document.getElementById("library-message").textContent = "";
          updateLibraryCount();
          renderLibrary();
        } catch {
          document.getElementById("library-message").textContent = "This set could not be deleted from your browser storage.";
        }
      });
      row.append(openButton, removeButton);
      list.append(row);
    });
    refreshIcons();
  }

  document.getElementById("library-search").addEventListener("input", renderLibrary);
  document.getElementById("clear-library").addEventListener("click", () => {
    if (!window.confirm("Clear all saved study sets? This cannot be undone.")) return;
    try {
      localStorage.removeItem(storageKey);
      savedSets = [];
      document.getElementById("library-message").textContent = "";
      updateLibraryCount();
      renderLibrary();
    } catch {
      document.getElementById("library-message").textContent = "Your saved sets could not be cleared from browser storage.";
    }
  });

  updateCount();
  updateLibraryCount();
  renderLibrary();
  refreshIcons();
});