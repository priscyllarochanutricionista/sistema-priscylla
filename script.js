document.addEventListener('DOMContentLoaded', () => {
    // ==========================================
    // 1. SISTEMA DE LOGIN E ROTEADOR
    // ==========================================
    const formLogin = document.getElementById('form-login');
    const viewLogin = document.getElementById('view-login');
    const viewApp = document.getElementById('view-app');
    const msgErroLogin = document.getElementById('msg-erro-login');

    if (formLogin) {
        formLogin.addEventListener('submit', (e) => {
            e.preventDefault(); 
            if (document.getElementById('login').value === 'admin' && document.getElementById('senha').value === 'admin') {
                msgErroLogin.classList.add('hidden'); viewLogin.classList.add('hidden'); viewApp.classList.remove('hidden');
                // Inicializa o sistema
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

    // ==========================================
    // 2. SALVAR DADOS (FORMULÁRIOS)
    // ==========================================
    function configurarFormulario(idForm, tabela, preparadorDeDados, callbackSucesso) {
        const form = document.getElementById(idForm);
        if (!form) return;
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = form.querySelector('button[type="submit"]');
            const txtOrg = btn.innerHTML;
            btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Aguarde...'; btn.disabled = true;
            
            const res = await enviarParaBanco('salvar', tabela, preparadorDeDados());
            btn.innerHTML = txtOrg; btn.disabled = false;

            if (res.status === 'sucesso') {
                showToast(`Registro salvo com sucesso!`, 'sucesso');
                form.reset(); callbackSucesso();
            } else { showToast('Erro: ' + res.mensagem, 'erro'); }
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

    // ==========================================
    // 3. MÓDULO DE RELATÓRIOS E PDF
    // ==========================================
    const formFiltro = document.getElementById('form-filtro-relatorio');
    if(formFiltro) {
        formFiltro.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = formFiltro.querySelector('button[type="submit"]');
            btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Buscando...'; btn.disabled = true;
            const dtInicio = document.getElementById('filtro-inicio').value;
            const dtFim = document.getElementById('filtro-fim').value;
            const lancamentos = await buscarDados('Lancamentos');
            
            let dadosFiltradosParaPDF = lancamentos.filter(l => { const dataLanc = String(l.Data).split('T')[0]; return dataLanc >= dtInicio && dataLanc <= dtFim; });
            dadosFiltradosParaPDF.sort((a, b) => new Date(a.Data) - new Date(b.Data));

            let totalReceitas = 0, totalDespesas = 0;
            renderizarTabela('tbody-relatorio', dadosFiltradosParaPDF, l => {
                const valor = parseFloat(l.Valor) || 0;
                if(l.Tipo === 'Receita') totalReceitas += valor; else totalDespesas += valor;
                return `<td>${formatarData(l.Data)}</td><td><span class="badge">${l.Tipo}</span></td><td>${l.Descricao}</td><td class="${l.Tipo==='Receita'?'text-success':'text-danger'}">${formatarMoeda(valor)}</td>`;
            });

            const btnPdf = document.getElementById('btn-gerar-pdf');
            if(dadosFiltradosParaPDF.length > 0) {
                btnPdf.style.display = 'inline-flex';
                document.getElementById('tbody-relatorio').innerHTML += `<tr style="background-color: #f8fafc; font-weight: bold;"><td colspan="3" class="text-right">SALDO DO PERÍODO:</td><td class="${(totalReceitas - totalDespesas) >= 0 ? 'text-success' : 'text-danger'}">${formatarMoeda(totalReceitas - totalDespesas)}</td></tr>`;
            } else { btnPdf.style.display = 'none'; }
            btn.innerHTML = '<i class="ph ph-funnel"></i> Gerar Relatório'; btn.disabled = false;
        });
    }

    document.getElementById('btn-gerar-pdf').addEventListener('click', () => {
        const { jsPDF } = window.jspdf; const doc = new jsPDF();
        doc.setFontSize(18); doc.text("Relatório Financeiro - Priscylla Rocha", 14, 20);
        doc.setFontSize(11); doc.setTextColor(100); doc.text(`Período: ${formatarData(document.getElementById('filtro-inicio').value)} até ${formatarData(document.getElementById('filtro-fim').value)}`, 14, 28);
        doc.autoTable({ html: '#tabela-relatorio-pdf', startY: 35, theme: 'striped', styles: { fontSize: 10, cellPadding: 3 }, headStyles: { fillColor: [13, 148, 136] } });
        doc.save(`Relatorio_Financeiro.pdf`);
    });

    // ==========================================
    // 4. EVENTO DE SUBMIT DO MODAL DE EDIÇÃO
    // ==========================================
    document.getElementById('form-editar').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('button[type="submit"]');
        const txtOrg = btn.innerHTML;
        btn.innerHTML = 'Salvando...'; btn.disabled = true;

        const dadosFull = await buscarDados(tabelaEditandoGlobal);
        const reg = dadosFull.find(x => x.ID === idEditandoGlobal);
        const novosDados = [];
        
        Object.keys(reg).forEach(key => {
            if(key === 'ID') return;
            novosDados.push(document.getElementById(`edit-${key}`).value);
        });

        const res = await enviarParaBanco('alterar', tabelaEditandoGlobal, novosDados, idEditandoGlobal);
        btn.innerHTML = txtOrg; btn.disabled = false;

        if(res.status === 'sucesso') {
            showToast('Registro atualizado com sucesso!', 'sucesso');
            fecharModal();
            if(tabelaEditandoGlobal === 'Lancamentos') carregarPainelFinanceiro();
            if(tabelaEditandoGlobal === 'Agenda') carregarAgenda();
            if(tabelaEditandoGlobal === 'Pacientes') carregarPacientes();
            if(tabelaEditandoGlobal === 'Categorias') carregarCategorias();
        } else { showToast('Erro: ' + res.mensagem, 'erro'); }
    });

}); // Fim DOMContentLoaded

// ==========================================
// FUNÇÕES DE INTELIGÊNCIA E API
// ==========================================
const API_URL = 'https://script.google.com/macros/s/AKfycbzmrx8ds2GZLGjOoFz-VKdjMEPXHagDsYwRPuxX_YIp4KpoQvnNOl6PIsQGFba77SIJng/exec';
let graficoB = null; let graficoC = null;
let tabelaEditandoGlobal = ''; let idEditandoGlobal = '';

// Sistema de Notificações Toast
window.showToast = function(mensagem, tipo = 'sucesso') {
    const container = document.getElementById('toast-container');
    if(!container) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${tipo}`;
    const icone = tipo === 'sucesso' ? 'ph-check-circle' : (tipo === 'erro' ? 'ph-warning-octagon' : 'ph-info');
    toast.innerHTML = `<i class="ph ${icone}" style="font-size: 1.2rem;"></i> ${mensagem}`;
    container.appendChild(toast);
    setTimeout(() => { toast.style.animation = 'fadeOut 0.5s forwards'; setTimeout(() => toast.remove(), 500); }, 3000);
}

// Utilitários de Formatação Blindados
function formatarMoeda(valor) { return (parseFloat(valor) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }

function formatarData(valor) {
    if (!valor) return '-'; 
    try {
        const d = String(valor).split('T')[0].split('-');
        if (d.length >= 3) { let ano = d[d.length-3].replace('+',''); if(ano.length>4) ano=ano.substring(ano.length-4); return `${d[d.length-1]}/${d[d.length-2]}/${ano}`; }
        return valor;
    } catch(e) { return valor; }
}

function formatarDataHora(valorISO) {
    if(!valorISO) return '-'; 
    try { 
        const valStr = String(valorISO);
        const partes = valStr.split('T'); 
        if(partes.length === 1) return formatarData(partes[0]); 
        return `${formatarData(partes[0])} às ${partes[1].substring(0,5)}`; 
    } catch(e) { return valorISO; }
}

async function buscarDados(tabela) { try { const r = await fetch(`${API_URL}?tabela=${tabela}`); const j = await r.json(); return j.dados || []; } catch(e) { return []; } }
async function enviarParaBanco(acao, tabela, dados = null, id = null) { const r = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ acao, tabela, dados, id }) }); return await r.json(); }

// ==========================================
// CARREGAMENTO DE DADOS E KPIS
// ==========================================
async function carregarPainelFinanceiro() {
    const lancamentos = await buscarDados('Lancamentos');
    const hoje = new Date(); const anoMesAtual = hoje.getFullYear() + '-' + String(hoje.getMonth() + 1).padStart(2, '0');
    let recMes = 0, desMes = 0; const lRec = [], lDes = [], desGrafico = [];

    lancamentos.forEach(l => {
        const val = parseFloat(l.Valor) || 0; const d = String(l.Data).split('T')[0];
        if (l.Tipo === 'Receita') { lRec.push(l); } else if (l.Tipo === 'Despesa') { lDes.push(l); }
        if (d.startsWith(anoMesAtual)) { if (l.Tipo === 'Receita') recMes += val; else if (l.Tipo === 'Despesa') { desMes += val; desGrafico.push(l); } }
    });

    document.getElementById('kpi-receita').textContent = formatarMoeda(recMes); document.getElementById('kpi-despesa').textContent = formatarMoeda(desMes); document.getElementById('kpi-lucro').textContent = formatarMoeda(recMes - desMes);
    renderizarTabela('tbody-receitas', lRec.reverse().slice(0, 10), l => `<td>${formatarData(l.Data)}</td><td><strong>${l.Descricao}</strong></td><td class="text-success">${formatarMoeda(l.Valor)}</td><td class="text-center">${botoesAcao('Lancamentos', l.ID)}</td>`);
    renderizarTabela('tbody-despesas', lDes.reverse().slice(0, 10), l => `<td>${formatarData(l.Data)}</td><td><span class="badge">${l.Categoria||'Geral'}</span></td><td><strong>${l.Descricao}</strong></td><td class="text-danger">${formatarMoeda(l.Valor)}</td><td class="text-center">${botoesAcao('Lancamentos', l.ID)}</td>`);
    desenharGraficos(recMes, desMes, desGrafico);
}

function desenharGraficos(rec, des, desMes) {
    if (graficoB) graficoB.destroy(); if (graficoC) graficoC.destroy();
    const ctxB = document.getElementById('graficoBalanco'); const ctxC = document.getElementById('graficoCategorias');
    if (ctxB) graficoB = new Chart(ctxB, { type: 'bar', data: { labels: ['Receitas', 'Despesas'], datasets: [{ data: [rec, des], backgroundColor: ['#10b981', '#ef4444'], borderRadius: 4 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } } });
    if (ctxC) {
        const cat = {}; desMes.forEach(d => { cat[d.Categoria||'Outros'] = (cat[d.Categoria||'Outros'] || 0) + (parseFloat(d.Valor) || 0); });
        const labels = Object.keys(cat); const data = Object.values(cat);
        if(labels.length === 0) { labels.push('Sem despesas'); data.push(1); }
        graficoC = new Chart(ctxC, { type: 'doughnut', data: { labels: labels, datasets: [{ data: data, backgroundColor: ['#f43f5e', '#ec4899', '#d946ef', '#a855f7', '#8b5cf6', '#6366f1', '#3b82f6', '#0ea5e9'], borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: false, cutout: '70%' } });
    }
}

async function carregarCategorias() {
    const cats = await buscarDados('Categorias');
    const select = document.getElementById('cat-despesa');
    if (select) { select.innerHTML = '<option value="">Selecione uma categoria...</option>'; cats.forEach(c => { if(c.Natureza === 'Despesa') select.innerHTML += `<option value="${c.Nome_Categoria}">${c.Nome_Categoria}</option>`; }); }
    renderizarTabela('tbody-categorias', cats.reverse(), c => `<td><strong>${c.Nome_Categoria}</strong></td><td><span class="text-${c.Natureza==='Receita'?'success':'danger'}">${c.Natureza}</span></td><td class="text-center">${botoesAcao('Categorias', c.ID)}</td>`);
}

async function carregarPacientes() {
    const pacs = await buscarDados('Pacientes');
    renderizarTabela('tbody-pacientes', pacs.reverse(), p => `<td>${formatarData(p.Data_Cadastro)}</td><td><strong>${p.Nome_Completo}</strong></td><td>${p.Telefone}</td><td>${p.Email}</td><td class="text-center">${botoesAcao('Pacientes', p.ID)}</td>`);
}

// ==========================================
// AGENDA COM INTELIGÊNCIA BLINDADA
// ==========================================
async function carregarAgenda() {
    try {
        const agendaFull = await buscarDados('Agenda');
        
        // 1. Filtro Anti-Fantasma (Remove linhas vazias do Google Sheets)
        const agenda = agendaFull.filter(a => {
            const nome = a.Nome_Paciente || a.Paciente || '';
            return String(nome).trim() !== '';
        });

        const hoje = new Date();
        const anoMesAtual = hoje.getFullYear() + '-' + String(hoje.getMonth() + 1).padStart(2, '0');

        let totalMes = 0, prim = 0, ret = 0, real = 0;
        
        agenda.forEach(a => {
            const dataAg = String(a.Data_Hora || '').split('T')[0]; 
            const tipo = String(a.Tipo_Consulta || '').trim().toLowerCase();
            const status = String(a.Status_Presenca || '').trim().toLowerCase();
            
            // KPIs limitados ao mês atual
            if (dataAg.startsWith(anoMesAtual)) {
                totalMes++;
                if(tipo.includes('1ª') || tipo.includes('1a') || tipo.includes('primeira')) prim++;
                if(tipo.includes('retorno')) ret++;
                if(status.includes('realizado')) real++;
            }
        });

        const kpiTot = document.getElementById('kpi-agenda-total');
        if(kpiTot) {
            kpiTot.textContent = totalMes;
            document.getElementById('kpi-agenda-prim').textContent = prim;
            document.getElementById('kpi-agenda-ret').textContent = ret;
            document.getElementById('kpi-agenda-realizados').textContent = real;
        }

        renderizarTabela('tbody-agenda', agenda.reverse(), a => {
            const tipoOriginal = String(a.Tipo_Consulta || 'Indefinido').trim();
            const statusOriginal = String(a.Status_Presenca || 'Aguardando').trim();
            const statusL = statusOriginal.toLowerCase();
            const nomePac = String(a.Nome_Paciente || a.Paciente || 'Sem Nome').trim();
            
            let corStatus = statusL.includes('realizado') ? 'success' : 'warning';
            let iconeStatus = statusL.includes('realizado') ? 'check' : 'clock';
            
            let btnFinalizar = !statusL.includes('realizado') ? `<button onclick="finalizarConsulta('${a.ID}', '${nomePac}')" class="btn-icon" style="color: var(--color-success); background: none; border: none; font-size: 1.1rem; cursor: pointer; margin-right: 0.5rem;" title="Finalizar e Gerar Receita"><i class="ph ph-check-circle"></i></button>` : '';

            return `
            <td><strong>${formatarDataHora(a.Data_Hora)}</strong></td>
            <td>${nomePac}</td>
            <td><span class="badge" style="background:#e0f2fe; color:#0284c7;">${tipoOriginal}</span></td>
            <td><span class="text-${corStatus}"><i class="ph ph-${iconeStatus}"></i> ${statusOriginal}</span></td>
            <td class="text-center">${btnFinalizar}${botoesAcao('Agenda', a.ID)}</td>
        `});

    } catch(e) {
        console.error("Erro na Agenda:", e);
        const tbody = document.getElementById('tbody-agenda');
        if(tbody) tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger">Erro ao processar dados.</td></tr>`;
    }
}

function renderizarTabela(id, dados, templateTr) {
    const tbody = document.getElementById(id); if(!tbody) return;
    if(dados.length === 0) { tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">Nenhum registro encontrado.</td></tr>`; return; }
    tbody.innerHTML = ''; dados.forEach(d => { const tr = document.createElement('tr'); tr.innerHTML = templateTr(d); tbody.appendChild(tr); });
}

function botoesAcao(tabela, id) {
    return `
        <button onclick="abrirModalEditar('${tabela}', '${id}')" class="btn-icon" style="color: var(--color-primary); background: none; border: none; font-size: 1.1rem; cursor: pointer; margin-right: 0.5rem;" title="Editar"><i class="ph ph-pencil-simple"></i></button>
        <button onclick="excluirRegistro('${tabela}', '${id}')" class="btn-icon" style="color: var(--color-danger); background: none; border: none; font-size: 1.1rem; cursor: pointer;" title="Excluir"><i class="ph ph-trash"></i></button>
    `;
}

// ==========================================
// AÇÕES PRO (EXCLUIR, EDITAR MODAL, FINALIZAR CONSULTA)
// ==========================================
window.excluirRegistro = async function(tabela, id) {
    if (!confirm(`Tem certeza que deseja apagar este registro permanentemente?`)) return;
    const res = await enviarParaBanco('excluir', tabela, null, id);
    if (res.status === 'sucesso') {
        showToast('Registro excluído!', 'sucesso');
        if(tabela === 'Lancamentos') carregarPainelFinanceiro();
        if(tabela === 'Categorias') carregarCategorias();
        if(tabela === 'Pacientes') carregarPacientes();
        if(tabela === 'Agenda') carregarAgenda();
    } else showToast('Erro: ' + res.mensagem, 'erro');
}

window.abrirModalEditar = async function(tabela, id) {
    tabelaEditandoGlobal = tabela; idEditandoGlobal = id;
    const dados = await buscarDados(tabela);
    const reg = dados.find(x => x.ID === id);
    if(!reg) return;

    const container = document.getElementById('modal-campos');
    container.innerHTML = ''; 

    Object.keys(reg).forEach(key => {
        if(key === 'ID') return;
        const div = document.createElement('div');
        div.className = 'input-group'; div.style.marginBottom = '1rem';
        div.innerHTML = `<label style="text-transform: capitalize;">${key.replace('_', ' ')}</label>
                         <input type="text" id="edit-${key}" value="${reg[key] || ''}">`;
        container.appendChild(div);
    });
    document.getElementById('modal-editar').classList.remove('hidden');
}

window.fecharModal = function() { document.getElementById('modal-editar').classList.add('hidden'); }

window.finalizarConsulta = async function(idAgenda, paciente) {
    const valorStr = prompt(`Finalizando consulta de ${paciente}.\nQual o valor recebido? (Use ponto. Ex: 250.00)\nDeixe 0 se for retorno gratuito.`, "0.00");
    if (valorStr === null) return; 
    
    const valor = parseFloat(valorStr) || 0;
    showToast('Finalizando e integrando com o financeiro...', 'info');

    const agendaFull = await buscarDados('Agenda');
    const a = agendaFull.find(x => x.ID === idAgenda);
    if (a) {
        await enviarParaBanco('alterar', 'Agenda', [a.Data_Hora, a.Nome_Paciente, a.Tipo_Consulta, 'Realizado', 'Pago', a.Observacoes], idAgenda);
    }

    if (valor > 0) {
        const hoje = new Date().toISOString().split('T')[0];
        await enviarParaBanco('salvar', 'Lancamentos', [hoje, 'Receita', `Consulta: ${paciente}`, 'Consulta', valor, 'Pago']);
    }

    showToast('Consulta Finalizada com Sucesso!', 'sucesso');
    carregarAgenda();
    carregarPainelFinanceiro();
}
