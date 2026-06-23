document.addEventListener('DOMContentLoaded', () => {
  const toggleSidebar = document.getElementById('toggleSidebar');
  const sidebar = document.getElementById('sidebar');
  const mainContent = document.querySelector('.main-content');

  if (!toggleSidebar || !sidebar || !mainContent) {
    console.log('Elementos da sidebar não encontrados.');
    return;
  }

  toggleSidebar.addEventListener('click', () => {
    sidebar.classList.toggle('sidebar-collapsed');
    mainContent.classList.toggle('expanded');

    const icon = toggleSidebar.querySelector('i');

    if (sidebar.classList.contains('sidebar-collapsed')) {
      icon.classList.remove('bi-x-lg');
      icon.classList.add('bi-list');
    } else {
      icon.classList.remove('bi-list');
      icon.classList.add('bi-x-lg');
    }
  });

  const tabelaPresencas = document.getElementById('tabelaPresencas');
  const totalPresencas = document.getElementById('totalPresencas');
  const presencasHoje = document.getElementById('presencasHoje');
  const ultimaPresenca = document.getElementById('ultimaPresenca');
  const ultimaPresencaHorario = document.getElementById('ultimaPresencaHorario');
  const statusAtualizacao = document.getElementById('statusAtualizacao');
  const buscaPresenca = document.getElementById('buscaPresenca');
  const filtroDataPresenca = document.getElementById('filtroDataPresenca');
  const limparFiltrosPresenca = document.getElementById('limparFiltrosPresenca');

  if (!tabelaPresencas || !totalPresencas) return;

  const escaparHTML = (valor) => String(valor || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  const textoOuTraco = (valor) => escaparHTML(valor || '-');
  const normalizarBusca = (valor) => String(valor || '').toLowerCase().trim();
  const visualizacao = tabelaPresencas.dataset.presencasView;

  const dataLocalISO = (data = new Date()) => {
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const dia = String(data.getDate()).padStart(2, '0');

    return `${ano}-${mes}-${dia}`;
  };

  const criarLinhaResumo = (registro) => `
    <tr>
      <td>${escaparHTML(registro.nome)}</td>
      <td>${textoOuTraco(registro.turma)}</td>
      <td>
        <span class="badge text-bg-success">
          ${escaparHTML(registro.status || 'presente')}
        </span>
      </td>
      <td>${escaparHTML(registro.dataHora)}</td>
    </tr>
  `;

  const criarLinhaCompleta = (registro) => `
    <tr>
      <td>${escaparHTML(registro.nome)}</td>
      <td>${textoOuTraco(registro.matricula)}</td>
      <td>${textoOuTraco(registro.rg)}</td>
      <td>${textoOuTraco(registro.turma)}</td>
      <td>
        <span class="badge text-bg-success">
          ${escaparHTML(registro.status || 'presente')}
        </span>
      </td>
      <td>${escaparHTML(registro.dataHora)}</td>
    </tr>
  `;

  const atualizarPresencas = async () => {
    try {
      const resposta = await fetch('/registros-qrcode');
      if (!resposta.ok) {
        if (statusAtualizacao) statusAtualizacao.innerText = 'Não foi possível sincronizar agora.';
        return;
      }

      const registros = await resposta.json();
      const registrosRecentes = registros.slice().reverse();
      const colspan = visualizacao === 'completo' ? 6 : 4;
      const hoje = dataLocalISO();
      const textoBusca = normalizarBusca(buscaPresenca ? buscaPresenca.value : '');
      const dataFiltro = filtroDataPresenca ? filtroDataPresenca.value : '';

      const registrosFiltrados = registrosRecentes.filter((registro) => {
        const textoRegistro = normalizarBusca([
          registro.nome,
          registro.matricula,
          registro.rg,
          registro.turma,
          registro.status
        ].join(' '));

        const bateBusca = !textoBusca || textoRegistro.includes(textoBusca);
        const bateData = !dataFiltro || registro.data === dataFiltro;

        return bateBusca && bateData;
      });

      totalPresencas.innerText = registros.length;
      if (presencasHoje) {
        presencasHoje.innerText = registros.filter(registro => registro.data === hoje).length;
      }

      if (ultimaPresenca && ultimaPresencaHorario) {
        const ultimoRegistro = registrosRecentes[0];

        if (ultimoRegistro) {
          ultimaPresenca.innerText = ultimoRegistro.nome || 'Aluno sem nome';
          ultimaPresencaHorario.innerText = `${ultimoRegistro.dataHora || '-'} · ${ultimoRegistro.turma || 'Turma não informada'}`;
        } else {
          ultimaPresenca.innerText = 'Nenhuma leitura ainda';
          ultimaPresencaHorario.innerText = 'Aguardando QR Code';
        }
      }

      if (statusAtualizacao) {
        const agora = new Date().toLocaleTimeString('pt-BR');
        statusAtualizacao.innerText = `Atualizado às ${agora}`;
      }

      if (registrosFiltrados.length === 0) {
        tabelaPresencas.innerHTML = `
          <tr>
            <td colspan="${colspan}" class="text-center text-muted py-4">
              Nenhuma presença encontrada.
            </td>
          </tr>
        `;
        return;
      }

      tabelaPresencas.innerHTML = registrosFiltrados
        .slice(0, visualizacao === 'completo' ? registrosFiltrados.length : 10)
        .map(visualizacao === 'completo' ? criarLinhaCompleta : criarLinhaResumo)
        .join('');
    } catch (error) {
      if (statusAtualizacao) statusAtualizacao.innerText = 'Erro de sincronização do leitor QRCode';
      console.log('Nao foi possivel atualizar as presencas.', error);
    }
  };

  if (filtroDataPresenca && visualizacao === 'completo') {
    filtroDataPresenca.value = dataLocalISO();
  }

  [buscaPresenca, filtroDataPresenca].forEach((controle) => {
    if (controle) controle.addEventListener('input', atualizarPresencas);
  });

  if (limparFiltrosPresenca) {
    limparFiltrosPresenca.addEventListener('click', () => {
      if (buscaPresenca) buscaPresenca.value = '';
      if (filtroDataPresenca) filtroDataPresenca.value = '';
      atualizarPresencas();
    });
  }

  atualizarPresencas();
  setInterval(atualizarPresencas, 5000);
});
