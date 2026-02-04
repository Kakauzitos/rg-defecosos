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

function renderRG(p) {
    const cardsDiv = document.getElementById("cards");

    // Topo com botão sair (sem bagunçar o flex do #cards)
    const topbar = `
    <div style="width:100%; display:flex; justify-content:center; margin-bottom:18px;">
      <button class="logout-btn" id="logoutBtn">Sair</button>
    </div>
  `;

    const cardFront = `
    <div class="card card-front">
      <div class="logo-area">
        <div class="club-title">${p.grupo || "NOME DO GRUPO / LOGO"}</div>
      </div>

      <div class="photo-container">
        ${p.foto
            ? `<img class="photo-img" src="${p.foto}" alt="Foto de ${p.nome}">`
            : `<div class="photo-placeholder">FOTO</div>`
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
  `;

    const pair = `
    <div class="person-wrap">
      ${cardFront}
      ${cardBack}
    </div>
  `;

    cardsDiv.innerHTML = topbar + pair;

    // botão sair
    document.getElementById("logoutBtn").onclick = () => {
        localStorage.removeItem("rg_code");
        localStorage.removeItem("rg_pin");
        location.reload();
    };
}

async function loginFake() {
    const code = normalizar(document.getElementById("codeInput").value);
    const pin = (document.getElementById("pinInput").value || "").trim();
    const msg = document.getElementById("loginMsg");

    if (!code || !pin) {
        msg.textContent = "Digite o código e o PIN.";
        return;
    }

    const pessoas = await carregarPessoas();

    const pessoa = pessoas.find(p =>
        normalizar(p.registro) === code && (p.pin || "") === pin
    );

    if (!pessoa) {
        msg.textContent = "Código ou PIN inválido.";
        return;
    }

    localStorage.setItem("rg_code", code);
    localStorage.setItem("rg_pin", pin);

    document.getElementById("loginWrap").style.display = "none";

    // IMPORTANTE: voltar #cards para FLEX (não block)
    const cardsDiv = document.getElementById("cards");
    cardsDiv.style.display = "flex"; // <- isso devolve seu layout original

    renderRG(pessoa);
}

// click + enter
document.getElementById("loginBtn").addEventListener("click", loginFake);
document.getElementById("codeInput").addEventListener("keydown", e => {
    if (e.key === "Enter") loginFake();
});
document.getElementById("pinInput").addEventListener("keydown", e => {
    if (e.key === "Enter") loginFake();
});

// auto-login
const savedCode = localStorage.getItem("rg_code");
const savedPin = localStorage.getItem("rg_pin");

if (savedCode && savedPin) {
    document.getElementById("codeInput").value = savedCode;
    document.getElementById("pinInput").value = savedPin;

    // mostra cards como flex antes de renderizar
    document.getElementById("loginWrap").style.display = "none";
    document.getElementById("cards").style.display = "flex";

    loginFake();
}
