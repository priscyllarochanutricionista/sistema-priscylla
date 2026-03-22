document.addEventListener('DOMContentLoaded', () => {
    // 1. LOGIN
    const formLogin = document.getElementById('form-login');
    const viewLogin = document.getElementById('view-login');
    const viewApp = document.getElementById('view-app');
    const msgErroLogin = document.getElementById('msg-erro-login');

    if (formLogin) {
        formLogin.addEventListener('submit', (e) => {
            e.preventDefault(); 
            if (document.getElementById('login').value === 'admin' && document.getElementById('senha').value === 'admin') {
                msgErroLogin.classList.add('hidden'); viewLogin.classList.add('hidden'); viewApp.classList.remove('hidden');
                carregarPainelFinanceiro();
                carregarCategorias();
                carregarPacientes();
                carregarAgenda();
            } else { msgErroLogin.classList.remove('hidden'); }
        });
    }

    document.getElementById('btn-logout').addEventListener('click', () => {
        viewApp.classList.add('hidden'); viewLogin.classList.remove('hidden'); formLogin.reset();
    });

    // 2. ROTEADOR DE TELAS
    const telas = {
        'dashboard': document.getElementById('tela-dashboard'), 'agenda': document.getElementById('tela-agenda'),
        'receitas': document.getElementById('tela-receitas'), 'despesas': document.getElementById('tela-despesas'),
        'pacientes': document.getElementById('tela-pacientes'), 'categorias': document.getElementById('tela-categorias'),
        'rel-receitas': document.getElementById('tela-relatorios')
    };

    document.querySelectorAll('.sidebar a').forEach(link => {
        if (link.getAttribute('href').startsWith('#')) {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const destino = e.currentTarget.getAttribute('href').replace('#', '');
                if (!telas[destino]) return;
                document.querySelectorAll('.sidebar a').forEach(l => l.classList.remove('active'));
                e.currentTarget.classList.add('active');
                Object.values(telas).forEach(t => { if (t) t.classList.add('hidden'); });
                telas[destino].classList.remove('hidden');
                document.getElementById('titulo-pagina').textContent = e.currentTarget.textContent.trim();
            });
        }
    });

    // 3. SALVAR (FORMULÁRIOS)
    function configurarFormulario(idForm, tabela, preparadorDeDados, callbackSucesso) {
        const form = document.getElementById(idForm);
        if (!form) return;
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = form.querySelector('button[type="submit"]');
            const txtOrg = btn.innerHTML;
            btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Aguarde...'; btn.disabled = true;
            
            const dados = preparadorDeDados();
            const res = await enviarParaBanco('salvar', tabela, dados);
            btn.innerHTML = txtOrg; btn.disabled = false;

            if (res.status === 'sucesso') {
                alert(`✅ Salvo com sucesso!`);
                form.reset();
                callbackSucesso();
            } else { alert('❌ Erro: ' + res.mensagem); }
        });
    }

    configurarFormulario('form-receita', 'Lancamentos', () => [
        document.getElementById('data-receita').value, 'Receita', document.getElementById('desc-receita').value, '', document.getElementById('valor-receita').value, 'Pago'
    ], carregarPainelFinanceiro);

    configurarFormulario('form-despesa', 'Lancamentos', () => [
        document.getElementById('data-despesa').value, 'Despesa', document.getElementById('desc-despesa').value, document.getElementById('cat-despesa').value, document.getElementById('valor-despesa').value, 'Pago'
    ], carregarPainelFinanceiro);

    configurarFormulario('form-categoria', 'Categorias', () => [
        document.getElementById('nome-categoria').value, document.getElementById('nat-categoria').value
    ], () => { carregarCategorias(); carregarPainelFinanceiro(); });

    configurarFormulario('form-paciente', 'Pacientes', () => [
        document.getElementById('nome-paciente').value, document.getElementById('tel-paciente').value, document.getElementById('email-paciente').value || 'Sem e-mail', new Date().toISOString().split('T')[0]
    ], carregarPacientes);

    configurarFormulario('form-agenda', 'Agenda', () => [
        document.getElementById('data-agenda').value, document.getElementById('paciente-agenda').value, document.getElementById('tipo-agenda').value, 'Aguardando', 'Pendente', ''
    ], carregarAgenda);

    // 4. MÓDULO DE RELATÓRIOS E PDF
    const formFiltro = document.getElementById('form-filtro-relatorio');
    let dadosFiltradosParaPDF = [];

    if(formFiltro) {
        formFiltro.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = formFiltro.querySelector('button[type="submit"]');
            btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Buscando...'; btn.disabled = true;

            const dtInicio = document.getElementById('filtro-inicio').value;
            const dtFim = document.getElementById('filtro-fim').value;
            const lancamentos = await buscarDados('Lancamentos');
            
            dadosFiltradosParaPDF = lancamentos.filter(l => {
                const dataLanc = String(l.Data).split('T')[0];
                return dataLanc >= dtInicio && dataLanc <= dtFim;
            });
            dadosFiltradosParaPDF.sort((a, b) => new Date(a.Data) - new Date(b.Data));

            let totalReceitas = 0; let totalDespesas = 0;
            renderizarTabela('tbody-relatorio', dadosFiltradosParaPDF, l => {
                const valor = parseFloat(l.Valor) || 0;
                if(l.Tipo === 'Receita') totalReceitas += valor; else totalDespesas += valor;
                const corClass = l.Tipo === 'Receita' ? 'text-success' : 'text-danger';
                return `<td>${formatarData(l.Data)}</td><td><span class="badge">${l.Tipo}</span></td><td>${l.Descricao}</td><td class="${corClass}">${formatarMoeda(valor)}</td>`;
            });

            const btnPdf = document.getElementById('btn-gerar-pdf');
            if(dadosFiltradosParaPDF.length > 0) {
                btnPdf.style.display = 'inline-flex';
                document.getElementById('tbody-relatorio').innerHTML += `
                    <tr style="background-color: #f8fafc; font-weight: bold;"><td colspan="3" class="text-right">SALDO DO PERÍODO:</td><td class="${(totalReceitas - totalDespesas) >= 0 ? 'text-success' : 'text-danger'}">${formatarMoeda(totalReceitas - totalDespesas)}</td></tr>`;
            } else { btnPdf.style.display = 'none'; }

            btn.innerHTML = '<i class="ph ph-funnel"></i> Gerar Relatório'; btn.disabled = false;
        });
    }

    document.getElementById('btn-gerar-pdf').addEventListener('click', () => {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        doc.setFontSize(18); doc.text("Relatório Financeiro - Priscylla Rocha", 14, 20);
        doc.setFontSize(11); doc.setTextColor(100);
        doc.text(`Período: ${formatarData(document.getElementById('filtro-inicio').value)} até ${formatarData(document.getElementById('filtro-fim').value)}`, 14, 28);

        doc.autoTable({ html: '#tabela-relatorio-pdf', startY: 35, theme: 'striped', styles: { fontSize: 10, cellPadding: 3 }, headStyles: { fillColor: [13, 148, 136] } });
        doc.save(`Relatorio_Financeiro_${document.getElementById('filtro-inicio').value}.pdf`);
    });

}); // Fim DOMContentLoaded

// ==========================================
// FUNÇÕES GLOBAIS DE BANCO DE DADOS E FORMATAÇÃO
// ==========================================
const API_URL = 'https://script.google.com/macros/s/AKfycbzmrx8ds2GZLGjOoFz-VKdjMEPXHagDsYwRPuxX_YIp4KpoQvnNOl6PIsQGFba77SIJng/exec';

// Variáveis Globais para os Gráficos (Para evitar duplicação)
let graficoB = null;
let graficoC = null;

function formatarMoeda(valor) { return (parseFloat(valor) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }

function formatarData(valor) {
    if (!valor) return '-';
    const dataLimpa = String(valor).split('T')[0]; 
    const partes = dataLimpa.split('-');
    if (partes.length >= 3) {
        let ano = partes[partes.length - 3].replace('+', '');
        if (ano.length > 4) ano = ano.substring(ano.length - 4); 
        return `${partes[partes.length - 1]}/${partes[partes.length - 2]}/${ano}`;
    }
    return valor;
}

function formatarDataHora(valorISO) {
    if(!valorISO) return '-';
    try {
        const [dataObj, horaObj] = valorISO.split('T');
        if(!horaObj) return formatarData(dataObj);
        return `${formatarData(dataObj)} às ${horaObj.substring(0,5)}`;
    } catch(e) { return valorISO; }
}

async function buscarDados(tabela) {
    try { const res = await fetch(`${API_URL}?tabela=${tabela}`); const json = await res.json(); return json.dados || []; } 
    catch (e) { console.error(e); return []; }
}

async function enviarParaBanco(acao, tabela, dados = null, id = null) {
    const res = await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ acao, tabela, dados, id }) });
    return await res.json();
}

// ==========================================
// A MÁGICA DO MÊS ATUAL E GRÁFICOS
// ==========================================
async function carregarPainelFinanceiro() {
    const lancamentos = await buscarDados('Lancamentos');
    
    // Captura o "Ano-Mês" atual (Ex: "2026-03")
    const hoje = new Date();
    const anoMesAtual = hoje.getFullYear() + '-' + String(hoje.getMonth() + 1).padStart(2, '0');

    let recMes = 0, desMes = 0; 
    const lRec = [], lDes = []; // Para as tabelas (últimos 10 geral)
    const despesasParaGrafico = []; // Apenas despesas do mês

    lancamentos.forEach(l => {
        const val = parseFloat(l.Valor) || 0;
        const dataLanc = String(l.Data).split('T')[0]; // "YYYY-MM-DD"
        
        // Separação para as tabelas (Independente do mês)
        if (l.Tipo === 'Receita') { lRec.push(l); } else if (l.Tipo === 'Despesa') { lDes.push(l); }

        // FILTRO DE INTELIGÊNCIA: Verifica se o lançamento pertence ao mês atual
        if (dataLanc.startsWith(anoMesAtual)) {
            if (l.Tipo === 'Receita') { 
                recMes += val; 
            } else if (l.Tipo === 'Despesa') { 
                desMes += val; 
                despesasParaGrafico.push(l); // Guarda para o gráfico de Rosca
            }
        }
    });

    // 1. Atualiza os KPIs apenas com valores do Mês Atual
    document.getElementById('kpi-receita').textContent = formatarMoeda(recMes); 
    document.getElementById('kpi-despesa').textContent = formatarMoeda(desMes); 
    document.getElementById('kpi-lucro').textContent = formatarMoeda(recMes - desMes);

    // 2. Atualiza as Tabelas Inferiores (Gerais)
    renderizarTabela('tbody-receitas', lRec.reverse().slice(0, 10), l => `<td>${formatarData(l.Data)}</td><td><strong>${l.Descricao}</strong></td><td class="text-success">${formatarMoeda(l.Valor)}</td><td class="text-center">${botoesAcao('Lancamentos', l.ID, l.Valor)}</td>`);
    renderizarTabela('tbody-despesas', lDes.reverse().slice(0, 10), l => `<td>${formatarData(l.Data)}</td><td><span class="badge">${l.Categoria||'Geral'}</span></td><td><strong>${l.Descricao}</strong></td><td class="text-danger">${formatarMoeda(l.Valor)}</td><td class="text-center">${botoesAcao('Lancamentos', l.ID, l.Valor)}</td>`);

    // 3. Desenha os Gráficos
    desenharGraficos(recMes, desMes, despesasParaGrafico);
}

function desenharGraficos(totalRec, totalDes, despesasMes) {
    const ctxB = document.getElementById('graficoBalanco');
    const ctxC = document.getElementById('graficoCategorias');

    // Destrói os gráficos antigos para não bugar quando atualizar a tela
    if (graficoB) graficoB.destroy();
    if (graficoC) graficoC.destroy();

    // Gráfico de Barras (Receitas x Despesas)
    if (ctxB) {
        graficoB = new Chart(ctxB, {
            type: 'bar',
            data: {
                labels: ['Receitas', 'Despesas'],
                datasets: [{
                    label: 'Valor (R$)',
                    data: [totalRec, totalDes],
                    backgroundColor: ['#10b981', '#ef4444'], // Verde e Vermelho
                    borderRadius: 4
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
        });
    }

    // Gráfico de Rosca (Despesas por Categoria)
    if (ctxC) {
        const catAgrupadas = {};
        despesasMes.forEach(d => {
            const c = d.Categoria || 'Outros';
            catAgrupadas[c] = (catAgrupadas[c] || 0) + (parseFloat(d.Valor) || 0);
        });

        const labels = Object.keys(catAgrupadas);
        const data = Object.values(catAgrupadas);

        // Se o mês não tiver despesa ainda, mostra um gráfico cinza vazio
        if(labels.length === 0) { labels.push('Sem despesas'); data.push(1); }

        graficoC = new Chart(ctxC, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: ['#f43f5e', '#ec4899', '#d946ef', '#a855f7', '#8b5cf6', '#6366f1', '#3b82f6', '#0ea5e9'],
                    borderWidth: 0
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, cutout: '70%' }
        });
    }
}

// Restante das Funções de Carregamento
async function carregarCategorias() {
    const cats = await buscarDados('Categorias');
    const select = document.getElementById('cat-despesa');
    if (select) {
        select.innerHTML = '<option value="">Selecione uma categoria...</option>';
        cats.forEach(c => { if(c.Natureza === 'Despesa') select.innerHTML += `<option value="${c.Nome_Categoria}">${c.Nome_Categoria}</option>`; });
    }
    renderizarTabela('tbody-categorias', cats.reverse(), c => `<td><strong>${c.Nome_Categoria}</strong></td><td><span class="text-${c.Natureza==='Receita'?'success':'danger'}">${c.Natureza}</span></td><td class="text-center">${botoesAcao('Categorias', c.ID)}</td>`);
}

async function carregarPacientes() {
    const pacs = await buscarDados('Pacientes');
    renderizarTabela('tbody-pacientes', pacs.reverse(), p => `<td>${formatarData(p.Data_Cadastro)}</td><td><strong>${p.Nome_Completo}</strong></td><td>${p.Telefone}</td><td>${p.Email}</td><td class="text-center">${botoesAcao('Pacientes', p.ID)}</td>`);
}

async function carregarAgenda() {
    const agenda = await buscarDados('Agenda');
    renderizarTabela('tbody-agenda', agenda.reverse(), a => `
        <td><strong>${formatarDataHora(a.Data_Hora)}</strong></td>
        <td>${a.Nome_Paciente}</td>
        <td><span class="badge" style="background:#e0f2fe; color:#0284c7;">${a.Tipo_Consulta}</span></td>
        <td><span class="text-warning"><i class="ph ph-clock"></i> ${a.Status_Presenca}</span></td>
        <td class="text-center">${botoesAcao('Agenda', a.ID)}</td>
    `);
}

function renderizarTabela(id, dados, templateTr) {
    const tbody = document.getElementById(id);
    if(!tbody) return;
    if(dados.length === 0) { tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">Nenhum registro encontrado.</td></tr>`; return; }
    tbody.innerHTML = '';
    dados.forEach(d => { const tr = document.createElement('tr'); tr.innerHTML = templateTr(d); tbody.appendChild(tr); });
}

function botoesAcao(tabela, id, valorAntigo = '') {
    const btnEditar = tabela === 'Lancamentos' ? `<button onclick="editarValor('${id}', '${valorAntigo}')" class="btn-icon" style="color: var(--color-primary); background: none; border: none; font-size: 1.1rem; cursor: pointer; margin-right: 0.5rem;" title="Editar Valor"><i class="ph ph-pencil-simple"></i></button>` : '';
    return `${btnEditar}<button onclick="excluirRegistro('${tabela}', '${id}')" class="btn-icon" style="color: var(--color-danger); background: none; border: none; font-size: 1.1rem; cursor: pointer;" title="Excluir"><i class="ph ph-trash"></i></button>`;
}

window.excluirRegistro = async function(tabela, id) {
    if (!confirm(`Tem certeza que deseja apagar este registro de ${tabela}?`)) return;
    const res = await enviarParaBanco('excluir', tabela, null, id);
    if (res.status === 'sucesso') {
        alert('🗑️ Registro excluído.');
        if(tabela === 'Lancamentos') carregarPainelFinanceiro();
        if(tabela === 'Categorias') carregarCategorias();
        if(tabela === 'Pacientes') carregarPacientes();
        if(tabela === 'Agenda') carregarAgenda();
    } else alert('❌ Erro: ' + res.mensagem);
}

window.editarValor = async function(id, valorAntigo) {
    const novoValor = prompt('Corrija o VALOR (Use ponto para os centavos. Ex: 150.50):', valorAntigo);
    if (!novoValor || novoValor === valorAntigo) return;
    const lancamentos = await buscarDados('Lancamentos');
    const l = lancamentos.find(x => x.ID === id);
    if (l) {
        const res = await enviarParaBanco('alterar', 'Lancamentos', [l.Data, l.Tipo, l.Descricao, l.Categoria, novoValor, l.Status], id);
        if (res.status === 'sucesso') { alert('✅ Valor atualizado!'); carregarPainelFinanceiro(); } 
        else { alert('❌ Erro: ' + res.mensagem); }
    }
}
