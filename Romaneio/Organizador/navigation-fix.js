/* CORREÇÃO DEFINITIVA DO RODAPÉ - ROMANEIO
   Esta versão deve ser carregada POR ÚLTIMO no index.html.
   Ela mantém:
   Planilha | Visualizar | Rastreamento | Cadastro
   e não interfere em Planilha Pronta ou Modo Entregador.
*/
(function () {
  "use strict";

  function iniciar() {
    const telas = {
      route: document.getElementById("screenRoute"),
      view: document.getElementById("screenView"),
      tracking: document.getElementById("screenTracking"),
      cadastro: document.getElementById("screenCadastro")
    };

    const botoes = {
      route: document.getElementById("navRoute"),
      view: document.getElementById("navView"),
      tracking: document.getElementById("navTracking"),
      cadastro: document.getElementById("navCadastro")
    };

    function mostrar(nome) {
      Object.keys(telas).forEach(function (key) {
        if (telas[key]) {
          telas[key].classList.toggle("activeScreen", key === nome);
        }
      });

      Object.keys(botoes).forEach(function (key) {
        if (botoes[key]) {
          botoes[key].classList.toggle("active", key === nome);
          botoes[key].type = "button";
        }
      });

      window.scrollTo(0, 0);

      if (nome === "view" && typeof window.render === "function") {
        window.render();
      }

      if (nome === "tracking") {
        setTimeout(function () {
          if (typeof window.loadTracking === "function") window.loadTracking();
          if (typeof window.loadDeliveryMap === "function") window.loadDeliveryMap();
        }, 150);
      }
    }

    Object.keys(botoes).forEach(function (nome) {
      const botao = botoes[nome];
      if (!botao) return;

      botao.type = "button";

      botao.onclick = function (event) {
        event.preventDefault();
        event.stopImmediatePropagation();
        mostrar(nome);
        return false;
      };
    });

    const planilhaPronta = document.getElementById("topPlanilhaPronta");
    if (planilhaPronta) {
      planilhaPronta.type = "button";
      planilhaPronta.onclick = function (event) {
        event.preventDefault();
        event.stopImmediatePropagation();
        window.location.assign("planilha-pronta.html");
        return false;
      };
    }

    const modoEntregador = document.getElementById("openDriverMode");
    if (modoEntregador) {
      modoEntregador.type = "button";
      modoEntregador.onclick = function (event) {
        event.preventDefault();
        event.stopImmediatePropagation();
        window.location.assign("entregador.html");
        return false;
      };
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar, { once: true });
  } else {
    iniciar();
  }
})();
