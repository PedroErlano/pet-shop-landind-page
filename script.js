/* =========================================================
   Pata Feliz — comportamento da página
   Tudo aqui é JavaScript puro, dividido em funções pequenas.
   ========================================================= */

/* ---------------------------------------------------------
   1. CONFIGURAÇÕES — é aqui que você personaliza o site
   --------------------------------------------------------- */
const CONFIG = {
  // TROQUE pelo número real, só dígitos: 55 + DDD + número. Ex.: 5511912345678
  whatsappNumber: "555DDDNUMERODOWHATSAPP",
  // Mensagem usada no botão "Chamar no WhatsApp" da seção de contato
  contactMessage: "Olá, Pata Feliz! Gostaria de mais informações.",
};

const WHATSAPP_PLACEHOLDER = "55DDDNUMERODOWHATSAPP";

/* ---------------------------------------------------------
   2. FUNÇÕES PURAS (não mexem na página; fáceis de testar)
   --------------------------------------------------------- */

// Devolve a data de hoje no formato AAAA-MM-DD, usando o fuso do aparelho.
function todayISO(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// "2026-10-28" -> "28/10/2026"
function formatDateBR(iso) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

// Confere se a string AAAA-MM-DD é uma data que realmente existe (ex.: recusa 2026-02-31).
function isRealDate(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

// Valida os dados do formulário. Devolve um objeto { campo: "mensagem de erro" }.
// Se o objeto voltar vazio, está tudo certo.
function validateBooking(data, now = new Date()) {
  const errors = {};
  const digits = data.telefone.replace(/\D/g, "");

  if (data.responsavel.trim().length < 2) errors.responsavel = "Informe o nome do responsável.";
  if (digits.length < 10 || digits.length > 13) errors.telefone = "Informe um telefone com DDD. Ex.: (11) 91234-5678.";
  if (data.pet.trim().length < 1) errors.pet = "Informe o nome do pet.";
  if (!data.tipo) errors.tipo = "Selecione o tipo de animal.";
  if (!data.servico) errors.servico = "Selecione o serviço desejado.";

  if (!data.data) {
    errors.data = "Escolha a data pretendida.";
  } else if (!isRealDate(data.data)) {
    errors.data = "Data inválida. Confira o dia e o mês.";
  } else if (data.data < todayISO(now)) {
    errors.data = "A data não pode ser anterior a hoje.";
  }

  if (!data.horario) {
    errors.horario = "Selecione o horário pretendido.";
  } else if (!errors.data && data.data === todayISO(now)) {
    // Se for hoje, o horário precisa ser depois da hora atual
    const [h, min] = data.horario.split(":").map(Number);
    if (h * 60 + min <= now.getHours() * 60 + now.getMinutes()) {
      errors.horario = "Esse horário de hoje já passou. Escolha outro.";
    }
  }
  return errors;
}

// Monta o texto organizado que o cliente vai enviar pelo WhatsApp.
function buildWhatsAppMessage(data) {
  const linhas = [
    "Olá, Pata Feliz! Gostaria de solicitar um agendamento:",
    "",
    `*Responsável:* ${data.responsavel.trim()}`,
    `*Telefone:* ${data.telefone.trim()}`,
    `*Pet:* ${data.pet.trim()} (${data.tipo})`,
    `*Serviço:* ${data.servico}`,
    `*Data pretendida:* ${formatDateBR(data.data)}`,
    `*Horário pretendido:* ${data.horario}`,
  ];
  if (data.obs && data.obs.trim()) linhas.push(`*Observações:* ${data.obs.trim()}`);
  linhas.push("", "Aguardo a confirmação da disponibilidade. Obrigado(a)!");
  return linhas.join("\n");
}

// Monta o link do WhatsApp: https://wa.me/NUMERO?text=MENSAGEM_CODIFICADA
function buildWhatsAppUrl(number, message) {
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

/* ---------------------------------------------------------
   3. PARTES DA PÁGINA (só rodam no navegador)
   --------------------------------------------------------- */

// 3.1 Menu mobile: abre/fecha e atualiza aria-expanded (acessibilidade)
function initMenu() {
  const toggle = document.querySelector(".nav-toggle");
  const menu = document.getElementById("menu-principal");
  if (!toggle || !menu) return;

  const setOpen = (open) => {
    toggle.setAttribute("aria-expanded", String(open));
    toggle.querySelector(".sr-only").textContent = open ? "Fechar menu" : "Abrir menu";
    menu.classList.toggle("is-open", open);
  };

  toggle.addEventListener("click", () => setOpen(toggle.getAttribute("aria-expanded") !== "true"));
  menu.addEventListener("click", (e) => { if (e.target.closest("a")) setOpen(false); }); // fecha ao escolher um link
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") setOpen(false); });
}

// 3.2 Animação de entrada: elementos .reveal aparecem ao rolar a página
function initReveal() {
  const items = document.querySelectorAll(".reveal");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce || !("IntersectionObserver" in window)) {
    items.forEach((el) => el.classList.remove("reveal"));
    return;
  }
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      el.classList.add("is-visible");
      observer.unobserve(el);
      // Depois da animação, tira as classes para não atrapalhar o efeito de hover dos cards
      setTimeout(() => el.classList.remove("reveal", "is-visible"), 800);
    });
  }, { threshold: 0.12 });
  items.forEach((el) => observer.observe(el));
}

// 3.3 Galeria: ampliar foto em um <dialog>, com setas e fechamento intuitivo
function initGallery() {
  const dialog = document.getElementById("lightbox");
  const img = document.getElementById("lightbox-img");
  const caption = document.getElementById("lightbox-caption");
  const buttons = [...document.querySelectorAll(".gallery-item")];
  if (!dialog || !buttons.length) return;

  let current = 0;

  const show = (index) => {
    current = (index + buttons.length) % buttons.length; // volta ao início/fim da lista
    const thumb = buttons[current].querySelector("img");
    img.src = buttons[current].dataset.full;
    img.alt = thumb.alt;
    caption.textContent = thumb.alt;
  };

  buttons.forEach((btn, i) => btn.addEventListener("click", () => { show(i); dialog.showModal(); }));
  dialog.querySelector(".lightbox-prev").addEventListener("click", () => show(current - 1));
  dialog.querySelector(".lightbox-next").addEventListener("click", () => show(current + 1));
  dialog.querySelector("[data-lightbox-close]").addEventListener("click", () => dialog.close());

  // Clicar fora da foto (no fundo escuro) também fecha
  dialog.addEventListener("click", (e) => { if (e.target === dialog) dialog.close(); });

  // Setas do teclado (Esc já fecha sozinho, é recurso nativo do <dialog>)
  dialog.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") show(current - 1);
    if (e.key === "ArrowRight") show(current + 1);
  });
}

// 3.4 Links de WhatsApp e redes demonstrativas
function initLinks() {
  document.querySelectorAll("[data-whatsapp-link]").forEach((a) => {
    a.href = buildWhatsAppUrl(CONFIG.whatsappNumber, CONFIG.contactMessage);
    a.target = "_blank";
    a.rel = "noopener noreferrer";
  });
  // Redes sociais de exemplo: não levam a lugar nenhum
  document.querySelectorAll("[data-demo]").forEach((a) =>
    a.addEventListener("click", (e) => e.preventDefault())
  );
  if (CONFIG.whatsappNumber === WHATSAPP_PLACEHOLDER) {
    console.warn("Pata Feliz: defina o número real de WhatsApp em CONFIG.whatsappNumber (script.js).");
  }
}

// 3.5 Botões "Agendar" dos cards: preenchem o serviço e levam ao formulário
function initServiceButtons() {
  const select = document.getElementById("servico");
  document.querySelectorAll("[data-service]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (select) select.value = btn.dataset.service;
      clearError("servico");
      document.getElementById("agendamento").scrollIntoView({ behavior: "smooth" });
      setTimeout(() => document.getElementById("responsavel").focus({ preventScroll: true }), 500);
    });
  });
}

/* ---------------------------------------------------------
   4. FORMULÁRIO DE AGENDAMENTO
   --------------------------------------------------------- */
const FIELDS = ["responsavel", "telefone", "pet", "tipo", "servico", "data", "horario"];

function readForm(form) {
  return {
    responsavel: form.responsavel.value,
    telefone: form.telefone.value,
    pet: form.pet.value,
    tipo: form.tipo.value,
    servico: form.servico.value,
    data: form.data.value,
    horario: form.horario.value,
    obs: form.obs.value,
  };
}

function showError(field, message) {
  const input = document.getElementById(field);
  document.getElementById(`erro-${field}`).textContent = message;
  input.closest(".field").classList.add("has-error");
  input.setAttribute("aria-invalid", "true");
}

function clearError(field) {
  const input = document.getElementById(field);
  if (!input) return;
  document.getElementById(`erro-${field}`).textContent = "";
  input.closest(".field").classList.remove("has-error");
  input.removeAttribute("aria-invalid");
}

// Preenche o resumo exibido na janela de confirmação
function fillSummary(data) {
  const rows = [
    ["Responsável", data.responsavel.trim()],
    ["Telefone", data.telefone.trim()],
    ["Pet", `${data.pet.trim()} (${data.tipo})`],
    ["Serviço", data.servico],
    ["Data", formatDateBR(data.data)],
    ["Horário", data.horario],
  ];
  if (data.obs.trim()) rows.push(["Observações", data.obs.trim()]);

  const dl = document.getElementById("confirm-resumo");
  dl.textContent = "";
  rows.forEach(([label, value]) => {
    const dt = document.createElement("dt");
    const dd = document.createElement("dd");
    dt.textContent = label;
    dd.textContent = value; // textContent evita injetar HTML digitado pelo usuário
    dl.append(dt, dd);
  });
}

function initBookingForm() {
  const form = document.getElementById("form-agendamento");
  const dialog = document.getElementById("confirmacao");
  if (!form || !dialog) return;

  // Impede escolher dias passados no próprio calendário
  form.data.min = todayISO();

  // Some o erro de um campo assim que a pessoa o corrige
  FIELDS.forEach((f) => {
    const el = document.getElementById(f);
    el.addEventListener("input", () => clearError(f));
    el.addEventListener("change", () => clearError(f));
  });

  let pendingUrl = "";

  form.addEventListener("submit", (e) => {
    e.preventDefault(); // não deixa o navegador enviar o formulário sozinho
    FIELDS.forEach(clearError);

    const data = readForm(form);
    const errors = validateBooking(data);
    const firstInvalid = FIELDS.find((f) => errors[f]);

    if (firstInvalid) {
      FIELDS.forEach((f) => { if (errors[f]) showError(f, errors[f]); });
      document.getElementById(firstInvalid).focus();
      return;
    }

    pendingUrl = buildWhatsAppUrl(CONFIG.whatsappNumber, buildWhatsAppMessage(data));
    fillSummary(data);
    document.getElementById("confirm-demo").hidden = CONFIG.whatsappNumber !== WHATSAPP_PLACEHOLDER;
    dialog.showModal();
  });

  document.getElementById("confirm-voltar").addEventListener("click", () => dialog.close());
  document.getElementById("confirm-enviar").addEventListener("click", () => {
    window.open(pendingUrl, "_blank", "noopener,noreferrer");
    dialog.close();
  });
}

/* ---------------------------------------------------------
   5. INÍCIO
   --------------------------------------------------------- */
if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", () => {
    initMenu();
    initReveal();
    initGallery();
    initLinks();
    initServiceButtons();
    initBookingForm();
  });
}

// Permite testar as funções puras no Node (não afeta o navegador)
if (typeof module !== "undefined") {
  module.exports = { todayISO, formatDateBR, isRealDate, validateBooking, buildWhatsAppMessage, buildWhatsAppUrl };
}
