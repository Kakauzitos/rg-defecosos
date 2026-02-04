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

    // Captura com alta qualidade
    const canvas = await html2canvas(wrap, {
      scale: 3,
      useCORS: true,
      backgroundColor: null, // mantém transparência/estilos do elemento
      logging: false
    });

    const imgData = canvas.toDataURL("image/png");

    const { jsPDF } = window.jspdf;

    // A4 paisagem (cabe bem frente + verso lado a lado)
    const pdf = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4"
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    const margin = 10; // mm
    const maxW = pageWidth - margin * 2;
    const maxH = pageHeight - margin * 2;

    // Ajuste proporcional pra caber na página
    const imgW = maxW;
    const imgH = (canvas.height * imgW) / canvas.width;

    let finalW = imgW;
    let finalH = imgH;

    if (finalH > maxH) {
      finalH = maxH;
      finalW = (canvas.width * finalH) / canvas.height;
    }

    const x = (pageWidth - finalW) / 2;
    const y = (pageHeight - finalH) / 2;

    pdf.addImage(imgData, "PNG", x, y, finalW, finalH);
    pdf.save(`RG-${registro.replaceAll("/", "-")}.pdf`);
  } catch (err) {
    alert("Não deu pra gerar o PDF. Erro: " + (err?.message || err));
  } finally {
    btn.disabled = false;
    btn.textContent = oldText;
  }
}

// ===== RENDER =====
function renderRG(p) {
  const cardsDiv = document.getElementById("cards");

  const saved = getSavedPhoto(p.registro);
  const fotoFinal = saved || p.foto || "";

  const actions = `
    <div class="actions-bar">
      <button class="action-btn pdf" id="pdfBtn">Baixar em PDF</button>
      <button class="action-btn" id="logoutBtn">Sair</button>
    </div>
  `;

  const cardFront = `
    <div class="card card-front" id="cardFront">
      <div class="logo-area">
        <div class="club-title">${p.grupo || "NOME DO GRUPO / LOGO"}</div>
      </div>

      <div class="photo-container" id="photoArea" title="Clique para enviar/alterar a foto">
        ${fotoFinal
      ? `<img class="photo-img" src="${fotoFinal}" alt="Foto de ${p.nome}">`
      : `<div class="photo-placeholder">CLIQUE<br>PARA<br>FOTO</div>`
    }
      </div>

      <div class="info-block">
        <div class="member-name">${p.nome}</div>

        <div>
          <span class="label">Nº REGISTO</span><br>
          <span class="value" style="font-family: 'Courier New', monospace;">${p.registro}</span>
        </div>

        <div>
          <span class="status-pill">${p.status}</span>
        </div>
      </div>
    </div>
  `;

  const cardBack = `
    <div class="card card-back" id="cardBack">
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
  `;

  const pair = `
    <div class="person-wrap">
      ${cardFront}
      ${cardBack}
    </div>
  `;

  cardsDiv.innerHTML = actions + pair;

  // Sair
  document.getElementById("logoutBtn").onclick = () => {
    localStorage.removeItem("rg_code");
    localStorage.removeItem("rg_pin");
    location.reload();
  };

  // PDF real
  document.getElementById("pdfBtn").onclick = () => baixarPDF(p.registro);

  // Upload de foto (por usuário)
  const photoArea = document.getElementById("photoArea");
  photoArea.onclick = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";

    input.onchange = () => {
      const file = input.files && input.files[0];
      if (!file) return;

      // Limite simples pra não explodir localStorage
      if (file.size > 2_000_000) {
        alert("Foto muito grande. Usa uma imagem menor (até ~2MB).");
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result;
        savePhoto(p.registro, dataUrl);
        renderRG(p);
      };
      reader.readAsDataURL(file);
    };

    input.click();
  };
}

// ===== LOGIN =====
async function loginFake() {
  const code = normalizar(document.getElementById("codeInput").value);
  const pin = (document.getElementById("pinInput").value || "").trim();
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

  localStorage.setItem("rg_code", code);
  localStorage.setItem("rg_pin", pin);

  document.getElementById("loginWrap").style.display = "none";
  const cardsDiv = document.getElementById("cards");
  cardsDiv.style.display = "flex"; // mantém seu layout original (flex)

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

// Auto-login
const savedCode = localStorage.getItem("rg_code");
const savedPin = localStorage.getItem("rg_pin");

if (savedCode && savedPin) {
  document.getElementById("codeInput").value = savedCode;
  document.getElementById("pinInput").value = savedPin;

  document.getElementById("loginWrap").style.display = "none";
  document.getElementById("cards").style.display = "flex";

  loginFake();
}
