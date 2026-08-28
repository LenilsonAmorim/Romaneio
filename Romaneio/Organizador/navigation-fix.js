/* CORREÇÃO DE NAVEGAÇÃO - ROMANEIO
   Coloque este arquivo em:
   Romaneio/Organizador/navigation-fix.js

   Depois, no FINAL do index.html, depois dos scripts existentes, coloque:
   <script src="navigation-fix.js"></script>
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
      Object.keys(telas).forEach((key) => {
        if (telas[key]) {
          telas[key].classList.toggle("activeScreen", key === nome);
        }
      });

      Object.keys(botoes).forEach((key) => {
        if (botoes[key]) {
          botoes[key].classList.toggle("active", key === nome);
        }
      });

      window.scrollTo(0, 0);

      // O viewer original possui sua própria renderização.
      // Não chama o render() global do app.js.
      if (nome === "view" && typeof window.renderRouteView === "function") {
        window.renderRouteView();
      }
    }

    Object.keys(botoes).forEach((nome) => {
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
