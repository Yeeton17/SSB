document.addEventListener("DOMContentLoaded", () => {
  const modeButtons = document.querySelectorAll(".mode-btn");
  const generateBtn = document.getElementById("generate-btn");
  const notesArea = document.getElementById("study-notes");
  const fileInput = document.getElementById("file-input");
  const fileNameDisplay = document.getElementById("file-name-display");
  const outputContent = document.getElementById("output-content");
  const loadingState = document.getElementById("loading-state");
  const loadingText = document.getElementById("loading-text");

  let activeMode = "summary";

  // Mode switching
  modeButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      modeButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      activeMode = btn.dataset.mode;
    });
  });

  // Display chosen file name
  fileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
      fileNameDisplay.textContent = file.name;
    } else {
      fileNameDisplay.textContent = "No file selected";
    }
  });

  generateBtn.addEventListener("click", async () => {
    let textToProcess = notesArea.value.trim();
    const uploadedFile = fileInput.files[0];

    if (!textToProcess && !uploadedFile) {
      alert("Please paste study notes or select a .docx / .pptx file.");
      return;
    }

    loadingState.classList.remove("hidden");
    outputContent.classList.add("hidden");

    try {
      if (uploadedFile) {
        loadingText.textContent = `Extracting text from ${uploadedFile.name}...`;
        const extension = uploadedFile.name.split('.').pop().toLowerCase();

        if (extension === "docx") {
          textToProcess = await parseDocx(uploadedFile);
        } else if (extension === "pptx") {
          textToProcess = await parsePptx(uploadedFile);
        } else {
          throw new Error("Unsupported file format. Please upload .docx or .pptx.");
        }
      }

      if (!textToProcess || textToProcess.trim().length === 0) {
        throw new Error("Could not extract readable text from the provided source.");
      }

      loadingText.textContent = "Processing study text with Groq AI...";

      const response = await fetch("/.netlify/functions/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: textToProcess, mode: activeMode }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Generation request failed.");
      }

      renderOutput(data.result, activeMode);
    } catch (err) {
      outputContent.innerHTML = `<p style="color: #dc2626; font-weight: 600;">Error: ${err.message}</p>`;
    } finally {
      loadingState.classList.add("hidden");
      outputContent.classList.remove("hidden");
    }
  });

  // Parse DOCX via Mammoth
  async function parseDocx(file) {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
    return result.value;
  }

  // Parse PPTX slide XML via JSZip
  async function parsePptx(file) {
    const zip = await JSZip.loadAsync(file);
    let extractedText = "";

    const slideFiles = Object.keys(zip.files).filter((filename) =>
      filename.startsWith("ppt/slides/slide") && filename.endsWith(".xml")
    );

    // Sort slide files numerically
    slideFiles.sort((a, b) => {
      const numA = parseInt(a.match(/\d+/)[0], 10);
      const numB = parseInt(b.match(/\d+/)[0], 10);
      return numA - numB;
    });

    for (const slidePath of slideFiles) {
      const xmlText = await zip.file(slidePath).async("text");
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, "text/xml");
      const textNodes = xmlDoc.getElementsByTagName("a:t");
      
      for (let i = 0; i < textNodes.length; i++) {
        extractedText += textNodes[i].textContent + " ";
      }
      extractedText += "\n";
    }

    return extractedText;
  }

  function renderOutput(rawResult, mode) {
    if (mode === "summary") {
      outputContent.innerHTML = `<div class="summary-text">${rawResult.replace(/\n/g, "<br>")}</div>`;
      return;
    }

    try {
      const cleanJson = rawResult.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(cleanJson);

      if (mode === "flashcards") {
        outputContent.innerHTML = parsed
          .map(
            (card, idx) => `
          <div class="flashcard-card">
            <strong>Card ${idx + 1}: ${card.question}</strong>
            <p style="margin-top:0.5rem;"><em>Answer:</em> ${card.answer}</p>
          </div>
        `
          )
          .join("");
      } else if (mode === "quiz") {
        outputContent.innerHTML = parsed
          .map(
            (item, idx) => `
          <div class="quiz-item">
            <p><strong>Q${idx + 1}: ${item.question}</strong></p>
            <ul style="list-style-type: none; padding-left: 0;">
              ${item.options.map((opt) => `<li style="padding: 4px 0;">• ${opt}</li>`).join("")}
            </ul>
            <p><small style="color:#059669;"><strong>Correct Answer:</strong> ${item.answer}</small></p>
          </div>
        `
          )
          .join("");
      }
    } catch (e) {
      outputContent.innerHTML = `<div class="summary-text">${rawResult.replace(/\n/g, "<br>")}</div>`;
    }
  }
});