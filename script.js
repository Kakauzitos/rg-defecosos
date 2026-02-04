// ====== COLE SUAS CHAVES AQUI ======
const SUPABASE_URL = "https://sfppqbxowbtkrhdbaykv.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNmcHBxYnhvd2J0a3JoZGJheWt2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyMDE2OTAsImV4cCI6MjA4NTc3NzY5MH0.FgMcaUDRLVniGSjCW5eKL40nTT_zQoom4RujWGCq898";

// ====== Supabase client ======
const sb = window.supabase.createClientXercesClient
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  })
  : window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

// ====== Helpers ======
function $(id) { return document.getElementById(id); }

function showLoginMsg(t) { $("loginMsg").textContent = t || ""; }
function showBankMsg(t, ok = false) {
  const el = $("bankMsg");
  el.style.color = ok ? "#059669" : "#ef4444";
  el.textContent = t || "";
}

function normalizeRegistro(v) {
  return (v || "").trim().toUpperCase();
}

// ====== Views ======
// ✅ ALTERAÇÃO: adicionamos rankView
function showView(name) {
  $("homeView").style.display = name === "home" ? "flex" : "none";
  $("rgView").style.display = name === "rg" ? "block" : "none";
  $("bankView").style.display = name === "bank" ? "block" : "none";
  $("rankView").style.display = name === "rank" ? "block" : "none";
}

function showApp() {
  $("loginWrap").style.display = "none";
  $("appWrap").style.display = "block";
  showView("home");
}

function showLogin() {
  $("loginWrap").style.display = "flex";
  $("appWrap").style.display = "none";
}

// ====== PDF ======
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

// ====== RG ======
async function carregarMeuRG(userId) {
  const { data, error } = await sb
    .from("rgs")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error) throw error;
  return data;
}

function renderRG(p) {
  const cardsDiv = $("cards");

  cardsDiv.innerHTML = `
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
            <span class="back-value">${p.emitidoPor || p["emitidoPor"] || ""}</span>
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

    <div style="display:flex; justify-content:center; margin-top:16px;">
      <button class="top-btn" id="pdfBtn">Baixar RG em PDF</button>
    </div>
  `;

  $("pdfBtn").onclick = () => baixarPDF(p.registro);

  $("photoArea").onclick = async () => {
    const { data: u } = await sb.auth.getUser();
    const user = u?.user;
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

      const up = await sb.storage
        .from("rg-photos")
        .upload(path, file, { upsert: true, contentType: file.type });

      if (up.error) {
        alert("Erro ao enviar foto: " + up.error.message);
        return;
      }

      const signed = await sb.storage
        .from("rg-photos")
        .createSignedUrl(path, 60 * 60 * 24 * 7);

      if (signed.error) {
        alert("Erro ao gerar link da foto: " + signed.error.message);
        return;
      }

      const upd = await sb
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

// ====== Bank ======
async function carregarWallet(userId) {
  const { data, error } = await sb
    .from("wallets")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error) throw error;
  return data;
}

async function carregarHistorico(userId) {
  const { data, error } = await sb
    .from("transactions")
    .select("id, from_user, to_user, amount, memo, created_at")
    .or(`from_user.eq.${userId},to_user.eq.${userId}`)
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) throw error;
  return data || [];
}

function formatDate(ts) {
  try { return new Date(ts).toLocaleString(); } catch { return ts; }
}

function renderHistorico(list, myId) {
  const box = $("txList");
  if (!list.length) {
    box.innerHTML = `<div class="bank-muted">Nenhuma transação ainda.</div>`;
    return;
  }

  box.innerHTML = list.map(tx => {
    const isOut = tx.from_user === myId;
    const sign = isOut ? "-" : "+";
    const who = isOut ? "Enviado" : "Recebido";
    return `
      <div class="tx-item">
        <div class="tx-top">
          <div>${who}</div>
          <div>${sign} DF$ ${tx.amount}</div>
        </div>
        <div class="tx-sub">${tx.memo ? tx.memo : "(sem descrição)"}<br>${formatDate(tx.created_at)}</div>
      </div>
    `;
  }).join("");
}

let cachedRecipient = null; // { user_id, nome, registro }

async function lookupRecipientByRegistro(registro) {
  const { data, error } = await sb.rpc("lookup_registro", { p_registro: registro });
  if (error) throw error;
  return (data && data.length) ? data[0] : null;
}

async function transfer(registro, amount, memo) {
  const { data, error } = await sb.rpc("transfer_defecoins", {
    p_to_registro: registro,
    p_amount: amount,
    p_memo: memo || ""
  });

  if (error) throw error;
  return (data && data.length) ? data[0] : null;
}

async function openBank() {
  showBankMsg("");
  $("recipientPreview").textContent = "Digite um RG para identificar";
  $("sendBtn").disabled = true;
  cachedRecipient = null;

  const { data: u } = await sb.auth.getUser();
  const user = u?.user;
  if (!user) return;

  $("balanceSub").textContent = "Carregando...";
  try {
    const wallet = await carregarWallet(user.id);
    $("balanceText").textContent = `DF$ ${wallet.balance}`;
    $("balanceSub").textContent = "Defecoins disponíveis";
  } catch (e) {
    $("balanceText").textContent = "DF$ ?";
    $("balanceSub").textContent = "Wallet não encontrada. Crie uma linha em wallets para este usuário.";
  }

  try {
    const hist = await carregarHistorico(user.id);
    renderHistorico(hist, user.id);
  } catch (e) {
    $("txList").innerHTML = `<div class="bank-muted">Erro ao carregar histórico.</div>`;
  }

  showView("bank");
}

// ====== ✅ RANKING (NOVO) ======
async function carregarRanking(limit = 20) {
  const { data, error } = await sb.rpc("get_leaderboard", { p_limit: limit });
  if (error) throw error;
  return data || [];
}

function renderRanking(list) {
  const box = $("rankList");
  if (!list.length) {
    box.innerHTML = `<div class="bank-muted">Ninguém apareceu ainda. Falta wallet/RG.</div>`;
    return;
  }

  box.innerHTML = list.map((p, i) => `
    <div class="tx-item">
      <div class="tx-top">
        <div>#${i + 1} • ${p.nome}</div>
        <div>DF$ ${p.balance}</div>
      </div>
      <div class="tx-sub">RG: ${p.registro}</div>
    </div>
  `).join("");
}

async function openRank() {
  $("rankSub").textContent = "Carregando...";
  showView("rank");

  try {
    const list = await carregarRanking(20);
    renderRanking(list);
    $("rankSub").textContent = "Top 20 saldos do Defebank";
  } catch (e) {
    $("rankSub").textContent = "Erro ao carregar ranking.";
    $("rankList").innerHTML = `<div class="bank-muted">${e.message || e}</div>`;
  }
}

// ====== Login ======
async function loginEmail() {
  const email = $("emailInput").value.trim();
  const pass = $("passInput").value.trim();
  showLoginMsg("");

  if (!email || !pass) {
    showLoginMsg("Preenche email e senha.");
    return;
  }

  const res = await sb.auth.signInWithPassword({ email, password: pass });
  if (res.error) {
    showLoginMsg("Erro no login: " + res.error.message);
    return;
  }

  await enterApp();
}

async function signupEmail() {
  const email = $("emailInput").value.trim();
  const pass = $("passInput").value.trim();
  showLoginMsg("");

  if (!email || !pass) {
    showLoginMsg("Preenche email e senha.");
    return;
  }

  const res = await sb.auth.signUp({ email, password: pass });
  if (res.error) {
    showLoginMsg("Erro no cadastro: " + res.error.message);
    return;
  }

  showLoginMsg("Conta criada. Agora clique em Entrar.");
}

async function enterApp() {
  const { data } = await sb.auth.getUser();
  const user = data?.user;
  if (!user) return;
  showApp();
}

// ====== Wiring ======
window.addEventListener("DOMContentLoaded", async () => {
  $("loginBtn").onclick = loginEmail;
  $("signupBtn").onclick = signupEmail;

  $("passInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") $("loginBtn").click();
  });

  $("logoutBtn").onclick = async () => {
    await sb.auth.signOut();
    location.reload();
  };

  $("goHomeBtn").onclick = () => showView("home");

  $("openRgBtn").onclick = async () => {
    const { data: u } = await sb.auth.getUser();
    const user = u?.user;
    if (!user) return;

    try {
      const rg = await carregarMeuRG(user.id);
      renderRG(rg);
      showView("rg");
    } catch (e) {
      $("cards").innerHTML = `
        <div class="bank-card" style="max-width:700px;">
          <b>Logado, mas sem RG cadastrado.</b><br><br>
          Cadastre uma linha em <code>rgs</code> com <code>user_id</code> = ${user.id}.
        </div>
      `;
      showView("rg");
    }
  };

  $("openBankBtn").onclick = openBank;

  // ✅ NOVO: botão Ranking
  $("openRankBtn").onclick = openRank;

  // preview PIX
  let lookupTimer = null;

  $("toRegistroInput").addEventListener("input", () => {
    showBankMsg("");
    $("sendBtn").disabled = true;
    cachedRecipient = null;

    const reg = normalizeRegistro($("toRegistroInput").value);
    if (!reg) {
      $("recipientPreview").textContent = "Digite um RG para identificar";
      return;
    }

    $("recipientPreview").textContent = "Procurando...";
    clearTimeout(lookupTimer);

    lookupTimer = setTimeout(async () => {
      try {
        const rec = await lookupRecipientByRegistro(reg);
        if (!rec) {
          $("recipientPreview").textContent = "RG não encontrado.";
          return;
        }
        cachedRecipient = rec;
        $("recipientPreview").textContent = `Vai enviar para: ${rec.nome} (${rec.registro})`;
        validateSend();
      } catch (e) {
        $("recipientPreview").textContent = "Erro ao procurar RG.";
      }
    }, 300);
  });

  $("amountInput").addEventListener("input", validateSend);
  $("memoInput").addEventListener("input", validateSend);

  function validateSend() {
    const amount = parseInt(($("amountInput").value || "").trim(), 10);
    const okAmount = Number.isFinite(amount) && amount > 0;
    $("sendBtn").disabled = !(cachedRecipient && okAmount);
  }

  $("sendBtn").onclick = async () => {
    showBankMsg("");

    const reg = normalizeRegistro($("toRegistroInput").value);
    const amount = parseInt(($("amountInput").value || "").trim(), 10);
    const memo = ($("memoInput").value || "").trim();

    if (!cachedRecipient) {
      showBankMsg("Escolha um destinatário válido.");
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      showBankMsg("Valor inválido.");
      return;
    }

    $("sendBtn").disabled = true;
    $("sendBtn").textContent = "Enviando...";

    try {
      const result = await transfer(reg, amount, memo);
      if (!result || !result.ok) {
        showBankMsg(result?.message || "Falha na transferência.");
      } else {
        showBankMsg(result.message, true);
        $("amountInput").value = "";
        $("memoInput").value = "";
        await openBank();
      }
    } catch (e) {
      showBankMsg("Erro: " + (e.message || e));
    } finally {
      $("sendBtn").textContent = "Enviar";
      $("sendBtn").disabled = true;
      cachedRecipient = null;
      $("toRegistroInput").value = "";
      $("recipientPreview").textContent = "Digite um RG para identificar";
    }
  };

  // auto-login
  const sess = await sb.auth.getSession();
  if (sess?.data?.session) {
    showApp();
  } else {
    showLogin();
  }
});
