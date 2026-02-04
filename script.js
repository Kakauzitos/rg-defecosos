// COLE AQUI
const SUPABASE_URL = "https://sfppqbxowbtkrhdbaykv.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNmcHBxYnhvd2J0a3JoZGJheWt2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyMDE2OTAsImV4cCI6MjA4NTc3NzY5MH0.FgMcaUDRLVniGSjCW5eKL40nTT_zQoom4RujWGCq898";

let supabase = null;

function showMsg(text) {
  const el = document.getElementById("loginMsg");
  if (el) el.textContent = text || "";
}

function mustGet(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Elemento #${id} não encontrado no HTML.`);
  return el;
}

async function baixarPDF(registro) {
  const btn = document.getElementById("pdfBtn");
  const old = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Gerando PDF...";

  try {
    const wrap = document.querySelector(".person-wrap");
    const canvas = await html2canvas(wrap, { scale: 3, useCORS: true, backgroundColor: null });
    const imgData = canvas.toDataURL("image/png");
    const { jsPDF } = window.jspdf;

    const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pw = pdf.internal.pageSize.getWidth();
    const ph = pdf.internal.pageSize.getHeight();
    const margin = 10;

    let w = pw - margin * 2;
    let h = (canvas.height * w) / canvas.width;

    if (h > ph - margin * 2) {
      h = ph - margin * 2;
      w = (canvas.width * h) / canvas.height;
    }

    pdf.addImage(imgData, "PNG", (pw - w) / 2, (ph - h) / 2, w, h);
    pdf.save(`RG-${(registro || "RG").replaceAll("/", "-")}.pdf`);
  } finally {
    btn.disabled = false;
    btn.textContent = old;
  }
}

function renderRG(p) {
  const cardsDiv = mustGet("cards");

  cardsDiv.innerHTML = `
    <div class="actions-bar">
      <button class="action-btn pdf" id="pdfBtn">Baixar em PDF</button>
      <button class="action-btn" id="logoutBtn">Sair</button>
    </div>

    <div class="person-wrap">
      <div class="card card-front">
        <div class="logo-area">
          <div class="club-title">${p.grupo || "Defecosos"}</div>
        </div>

        <div class="photo-container" id="photoArea" title="Clique para enviar/alterar a foto">
          ${p.photo_url
      ? `<img class="photo-img" src="${p.photo_url}" alt="Foto de ${p.nome}">`
      : `<div class="photo-placeholder">CLIQUE<br>PARA<br>FOTO</div>`
    }
        </div>

        <div class="info-block">
          <div class="member-name">${p.nome || ""}</div>
          <div>
            <span class="label">Nº REGISTO</span><br>
            <span class="value" style="font-family: 'Courier New', monospace;">${p.registro || ""}</span>
          </div>
          <div>
            <span class="status-pill">${p.status || ""}</span>
          </div>
        </div>
      </div>

      <div class="card card-back">
        <div class="data-grid">
          <div class="data-row">
            <span class="back-label">DATA DE EMISSÃO</span>
            <span class="back-value">${p.emissao || ""}</span>
          </div>
          <div class="data-row">
            <span class="back-label">EMITIDO POR</span>
            <span class="back-value">${p.emitidoPor || ""}</span>
          </div>
          <div class="validity-box">
            <span class="back-label">VALIDADE</span><br>
            <span class="validity-text">${p.validade || ""}</span>
          </div>
        </div>

        <div class="footer-text">
          DOCUMENTO INTERNO • USO PESSOAL E INTRANSFERÍVEL
        </div>
      </div>
    </div>
  `;

  document.getElementById("pdfBtn").onclick = () => baixarPDF(p.registro);

  document.getElementById("logoutBtn").onclick = async () => {
    await supabase.auth.signOut();
    location.reload();
  };

  document.getElementById("photoArea").onclick = async () => {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) return;

    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";

    input.onchange = async () => {
      const file = input.files && input.files[0];
      if (!file) return;
      if (file.size > 2_000_000) {
        alert("Foto muito grande (máx ~2MB).");
        return;
      }

      const path = `${user.id}/photo.jpg`;

      const up = await supabase.storage
        .from("rg-photos")
        .upload(path, file, { upsert: true, contentType: file.type });

      if (up.error) {
        alert("Erro ao enviar foto: " + up.error.message);
        return;
      }

      const signed = await supabase.storage
        .from("rg-photos")
        .createSignedUrl(path, 60 * 60 * 24 * 7);

      if (signed.error) {
        alert("Erro ao gerar link da foto: " + signed.error.message);
        return;
      }

      const upd = await supabase
        .from("rgs")
        .update({ photo_url: signed.data.signedUrl })
        .eq("user_id", user.id);

      if (upd.error) {
        alert("Erro ao salvar foto no RG: " + upd.error.message);
        return;
      }

      const rg = await carregarMeuRG(user.id);
      renderRG(rg);
    };

    input.click();
  };
}

async function carregarMeuRG(userId) {
  const { data, error } = await supabase
    .from("rgs")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error) throw error;
  return data;
}

async function login() {
  const email = mustGet("emailInput").value.trim();
  const pass = mustGet("passInput").value.trim();
  showMsg("");

  const res = await supabase.auth.signInWithPassword({ email, password: pass });
  if (res.error) throw res.error;

  // Sessão existe só enquanto a aba tá aberta (persistSession: false)
  const { data: u } = await supabase.auth.getUser();
  const user = u?.user;
  if (!user) throw new Error("Login ok, mas não achei usuário.");

  mustGet("loginWrap").style.display = "none";
  mustGet("cards").style.display = "flex";

  try {
    const rg = await carregarMeuRG(user.id);
    renderRG(rg);
  } catch (e) {
    mustGet("cards").innerHTML = `
      <div style="max-width:700px; padding:16px; background:#fff; border:1px solid #e2e8f0; border-radius:12px;">
        <b>Logado, mas sem RG cadastrado.</b><br><br>
        Cadastre na tabela <code>rgs</code> com <code>user_id = ${user.id}</code>.
      </div>
    `;
  }
}

async function signup() {
  const email = mustGet("emailInput").value.trim();
  const pass = mustGet("passInput").value.trim();
  showMsg("");

  const res = await supabase.auth.signUp({ email, password: pass });
  if (res.error) throw res.error;

  showMsg("Conta criada. Agora falta cadastrar seu RG na tabela rgs (admin faz isso).");
}

window.addEventListener("DOMContentLoaded", () => {
  try {
    // Se o Supabase não carregou, nada funciona mesmo
    if (!window.supabase) {
      showMsg("Erro: Supabase não carregou. Verifique o <script> do supabase no index.html.");
      return;
    }

    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
    });

    // Liga botões
    mustGet("loginBtn").onclick = () => login().catch(e => showMsg("Erro no login: " + e.message));
    mustGet("signupBtn").onclick = () => signup().catch(e => showMsg("Erro no cadastro: " + e.message));

    // Enter no input
    mustGet("passInput").addEventListener("keydown", (e) => {
      if (e.key === "Enter") mustGet("loginBtn").click();
    });

    showMsg(""); // tudo ok
  } catch (e) {
    showMsg("Erro inicial: " + e.message);
  }
});
