let pessoasCache = null;

async function carregarPessoas() {
  if (pessoasCache) return pessoasCache;
  const res = await fetch("./data.json");
  pessoasCache = await res.json();
  return pessoasCache;
}

function normalizar(v) {
  return (v || "").trim().toUpperCase();
}

// ===== FOTO POR USUÁRIO (salva no navegador) =====
function photoKey(registro) {
  return `photo_${normalizar(registro)}`;
}

function getSavedPhoto(registro) {
  return localStorage.getItem(photoKey(registro)) || "";
}

function savePhoto(registro, dataUrl) {
  localStorage.setItem(photoKey(registro), dataUrl);
}

// ===== PDF REAL (download direto) =====
async function baixarPDF(registro) {
  const btn = document.getElementById("pdfBtn");
  const oldText = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Gerando PDF...";

  try {
    const wrap = document.querySelector(".person-wrap");
    if (!wrap) throw new Error("Elemento do RG não encontrado.");

    const canvas = await html2canvas(wrap, {
      scale: 3,
      useCORS: true,
      backgroundColor: null,
      logging: false
    });

    const imgData = canvas.toDataURL("image/png");
    const { jsPDF } = window.jspdf;

    const pdf = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4"
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 10;

    let w = pageWidth - margin * 2;
    let h = (canvas.height * w) / canvas.width;

    if (h > pageHeight - margin * 2) {
      h = pageHeight - margin * 2;
      w = (canvas.width * h) / canvas.height;
    }

    const x = (pageWidth - w) / 2;
    const y = (pageHeight - h) / 2;

    pdf.addImage(imgData, "PNG", x, y, w, h);
    pdf.save(`RG-${registro.replaceAll("/", "-")}.pdf`);
  } catch (err) {
    alert("Não deu pra gerar o PDF.");
  } finally {
    btn.disabled = false;
    btn.textContent = oldText;
  }
}

// ===== RENDER =====
function renderRG(p) {
  const cardsDiv = document.getElementById("cards");
  const fotoFinal = getSavedPhoto(p.registro) || p.foto || "";

  cardsDiv.innerHTML = `
    <div class="actions-bar">
      <button class="action-btn pdf" id="pdfBtn">Baixar em PDF</button>
      <button class="action-btn" id="logoutBtn">Sair</button>
    </div>

    <div class="person-wrap">
      <div class="card card-front">
        <div class="logo-area">
          <div class="club-title">${p.grupo}</div>
        </div>

        <div class="photo-container" id="photoArea">
          ${fotoFinal
      ? `<img class="photo-img" src="${fotoFinal}" alt="Foto de ${p.nome}">`
      : `<div class="photo-placeholder">CLIQUE<br>PARA<br>FOTO</div>`
    }
        </div>

        <div class="info-block">
          <div class="member-name">${p.nome}</div>
          <div>
            <span class="label">Nº REGISTO</span><br>
            <span class="value" style="font-family: monospace;">${p.registro}</span>
          </div>
          <div>
            <span class="status-pill">${p.status}</span>
          </div>
        </div>
      </div>

      <div class="card card-back">
        <div class="data-grid">
          <div class="data-row">
            <span class="back-label">DATA DE EMISSÃO</span>
            <span class="back-value">${p.emissao}</span>
          </div>
          <div class="data-row">
            <span class="back-label">EMITIDO POR</span>
            <span class="back-value">${p.emitidoPor}</span>
          </div>
          <div class="validity-box">
            <span class="back-label">VALIDADE</span><br>
            <span class="validity-text">${p.validade}</span>
          </div>
        </div>
        <div class="footer-text">
          DOCUMENTO INTERNO • USO PESSOAL E INTRANSFERÍVEL
        </div>
      </div>
    </div>
  `;

  document.getElementById("logoutBtn").onclick = () => {
    location.reload();
  };

  document.getElementById("pdfBtn").onclick = () =>
    baixarPDF(p.registro);

  document.getElementById("photoArea").onclick = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";

    input.onchange = () => {
      const file = input.files[0];
      if (!file || file.size > 2_000_000) return;

      const reader = new FileReader();
      reader.onload = () => {
        savePhoto(p.registro, reader.result);
        renderRG(p);
      };
      reader.readAsDataURL(file);
    };

    input.click();
  };
}

// ===== LOGIN (SEM AUTO-LOGIN) =====
async function loginFake() {
  const code = normalizar(document.getElementById("codeInput").value);
  const pin = document.getElementById("pinInput").value.trim();
  const msg = document.getElementById("loginMsg");

  if (!code || !pin) {
    msg.textContent = "Digite o código e o PIN.";
    return;
  }

  const pessoas = await carregarPessoas();
  const pessoa = pessoas.find(
    p => normalizar(p.registro) === code && (p.pin || "") === pin
  );

  if (!pessoa) {
    msg.textContent = "Código ou PIN inválido.";
    return;
  }

  document.getElementById("loginWrap").style.display = "none";
  document.getElementById("cards").style.display = "flex";

  renderRG(pessoa);
}

// Eventos
document.getElementById("loginBtn").addEventListener("click", loginFake);
document.getElementById("codeInput").addEventListener("keydown", e => {
  if (e.key === "Enter") loginFake();
});
document.getElementById("pinInput").addEventListener("keydown", e => {
  if (e.key === "Enter") loginFake();
});
