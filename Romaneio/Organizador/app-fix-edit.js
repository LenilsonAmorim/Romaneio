// Correção: ao tocar em "Editar", abre o editor e rola a tela até ele.
(function(){
  const originalOpenRouteEditor = window.openRouteEditor;
  window.openRouteEditor = function(key){
    if (typeof originalOpenRouteEditor === 'function') {
      originalOpenRouteEditor(key);
    }
    const editor = document.getElementById('routeEditor');
    if (editor) {
      editor.hidden = false;
      setTimeout(function(){
        editor.scrollIntoView({ behavior: 'smooth', block: 'start' });
        const input = document.getElementById('editRouteBairro');
        if (input) input.focus({ preventScroll: true });
      }, 60);
    }
  };
})();
